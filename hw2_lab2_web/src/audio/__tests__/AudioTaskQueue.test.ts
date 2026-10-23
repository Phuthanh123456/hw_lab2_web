import { describe, expect, it, vi } from "vitest";
import { FifoAudioTaskQueue } from "../AudioTaskQueue";
import type { FifoAudioTaskQueueOptions } from "../AudioTaskQueue";
import { createAudioDataLoader } from "../audio-loader";
import { createDeferred } from "./deferred";

const TEST_AUDIO_BUFFER = {} as AudioBuffer;

function createFakeAudioContext(
  decode: (data: ArrayBuffer) => Promise<AudioBuffer> = async () => TEST_AUDIO_BUFFER,
): AudioContext {
  return {
    state: "running",
    decodeAudioData: vi.fn(decode),
    close: vi.fn(async () => undefined),
  } as unknown as AudioContext;
}

function createQueue(options: FifoAudioTaskQueueOptions = {}) {
  const audioContext = options.audioContext ?? createFakeAudioContext();
  const queue = new FifoAudioTaskQueue({ ...options, audioContext });
  return { queue, audioContext };
}

function getTaskInternals(queue: FifoAudioTaskQueue) {
  return queue as unknown as {
    records: Map<string, {
      controller: AbortController | null;
      resolve: ((buffer: AudioBuffer) => void) | null;
      reject: ((reason: unknown) => void) | null;
    }>;
    listeners: Set<unknown>;
  };
}

function responseFor(value: string, status = 200): Response {
  return new Response(new TextEncoder().encode(value), { status });
}

function delayedFetch(
  delays: Readonly<Record<string, number>>,
  events: string[],
): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    events.push(`start:${url}`);
    await new Promise<void>((resolve, reject) => {
      const signal = init?.signal;
      const timeout = setTimeout(() => {
        signal?.removeEventListener("abort", abort);
        events.push(`finish:${url}`);
        resolve();
      }, delays[url] ?? 0);
      const abort = () => {
        clearTimeout(timeout);
        reject(signal?.reason ?? new Error("aborted"));
      };
      if (signal?.aborted) {
        abort();
      } else {
        signal?.addEventListener("abort", abort, { once: true });
      }
    });
    return responseFor(url);
  };
}

describe("FifoAudioTaskQueue", () => {
  it("starts and completes near-simultaneous enqueues in FIFO order despite different delays", async () => {
    const events: string[] = [];
    const fetcher = delayedFetch({ "/slow": 30, "/medium": 8, "/fast": 1 }, events);
    const { queue } = createQueue({ loader: createAudioDataLoader(fetcher) });
    const handles = ["/slow", "/medium", "/fast"].map((url) => queue.enqueue(url));

    const data = await Promise.all(handles.map((handle) => handle.result));

    expect(events).toEqual([
      "start:/slow",
      "finish:/slow",
      "start:/medium",
      "finish:/medium",
      "start:/fast",
      "finish:/fast",
    ]);
    expect(data).toEqual([TEST_AUDIO_BUFFER, TEST_AUDIO_BUFFER, TEST_AUDIO_BUFFER]);
    expect(queue.getSnapshot().map((task) => task.status)).toEqual([
      "completed",
      "completed",
      "completed",
    ]);
  });

  it("passes the task signal to fetch and cancellation unblocks the next task", async () => {
    const firstResponse = createDeferred<Response>();
    let firstSignal: AbortSignal | null | undefined;
    const fetcher = vi.fn<typeof fetch>((input, init) => {
      if (String(input) === "/pending") {
        firstSignal = init?.signal;
        return firstResponse.promise;
      }
      return Promise.resolve(responseFor("next"));
    });
    const { queue, audioContext } = createQueue({ loader: createAudioDataLoader(fetcher) });
    const first = queue.enqueue("/pending");
    const next = queue.enqueue("/next");

    await vi.waitFor(() => expect(firstSignal).toBeDefined());
    expect(firstSignal).toBe(queue.getSnapshot()[0]?.signal);
    expect(queue.cancel(first.id, "cancelled by test")).toBe(true);
    expect(queue.cancel(first.id, "duplicate cancellation")).toBe(false);

    await expect(first.result).rejects.toHaveProperty("name", "AbortError");
    await expect(next.result).resolves.toBe(TEST_AUDIO_BUFFER);
    expect(firstSignal?.aborted).toBe(true);
    expect(queue.getSnapshot().map((task) => task.status)).toEqual(["cancelled", "completed"]);

    firstResponse.resolve(responseFor("late result"));
    await Promise.resolve();
    expect(audioContext.decodeAudioData).toHaveBeenCalledOnce();
    expect(queue.getSnapshot().some((task) => task.id === first.id)).toBe(true);
    expect(queue.forget(first.id)).toBe(true);
    expect(queue.getSnapshot().some((task) => task.id === first.id)).toBe(false);
    expect(queue.cancel(first.id)).toBe(false);
  });

  it("publishes state snapshots and stops notifying after unsubscribe", async () => {
    const { queue } = createQueue({
      loader: async () => responseFor("ok").arrayBuffer(),
    });
    const observed: string[] = [];
    const unsubscribe = queue.subscribe((tasks) => {
      observed.push(tasks.at(-1)?.status ?? "empty");
    });

    const first = queue.enqueue("/first");
    await first.result;
    unsubscribe();
    const second = queue.enqueue("/second");
    await second.result;

    expect(observed).toEqual(["queued", "running", "completed"]);
  });

  it("removes a cancelled queued task without fetching it", async () => {
    const firstResponse = createDeferred<Response>();
    const fetchedUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      fetchedUrls.push(url);
      if (url === "/first") return firstResponse.promise;
      return responseFor(url);
    };
    const { queue } = createQueue({ loader: createAudioDataLoader(fetcher) });
    const transitions: string[] = [];
    let previousQueuedStatus: string | undefined;
    queue.subscribe((tasks) => {
      const queuedTask = tasks.find((task) => task.trackUrl === "/queued");
      if (queuedTask && queuedTask.status !== previousQueuedStatus) {
        previousQueuedStatus = queuedTask.status;
        transitions.push(queuedTask.status);
      }
    });
    const first = queue.enqueue("/first");
    const queued = queue.enqueue("/queued");

    await vi.waitFor(() => expect(fetchedUrls).toEqual(["/first"]));
    expect(queue.cancel(queued.id)).toBe(true);
    expect(queue.cancel(queued.id)).toBe(false);
    await expect(queued.result).rejects.toHaveProperty("name", "AbortError");
    firstResponse.resolve(responseFor("/first"));
    await expect(first.result).resolves.toBe(TEST_AUDIO_BUFFER);

    expect(fetchedUrls).toEqual(["/first"]);
    expect(queue.getSnapshot().map((task) => task.status)).toEqual(["completed", "cancelled"]);
    expect(transitions.filter((status) => status === "cancelled")).toHaveLength(1);
  });

  it("does not start loading when a running-state observer cancels synchronously", async () => {
    const loader = vi.fn(async () => new ArrayBuffer(4));
    const { queue } = createQueue({ loader });
    let taskId: string | undefined;
    queue.subscribe((tasks) => {
      const running = tasks.find((task) => task.status === "running");
      if (running && taskId) queue.cancel(running.id, "cancelled by running observer");
    });
    const handle = queue.enqueue("/cancel-on-running");
    taskId = handle.id;

    // The worker's running notification happens in a microtask after enqueue returns.
    await expect(handle.result).rejects.toHaveProperty("name", "AbortError");
    await vi.waitFor(() => expect(queue.getSnapshot()[0]?.status).toBe("cancelled"));
    expect(loader).not.toHaveBeenCalled();
  });

  it("records network and HTTP errors and continues processing", async () => {
    const fetcher: typeof fetch = async (input) => {
      const url = String(input);
      if (url === "/network-error") throw new TypeError("offline");
      if (url === "/http-error") return responseFor("unavailable", 503);
      return responseFor("ok");
    };
    const { queue } = createQueue({ loader: createAudioDataLoader(fetcher) });
    const network = queue.enqueue("/network-error");
    const http = queue.enqueue("/http-error");
    const success = queue.enqueue("/success");

    const results = await Promise.allSettled([network.result, http.result, success.result]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected", "fulfilled"]);
    expect(queue.getSnapshot().map((task) => task.status)).toEqual(["failed", "failed", "completed"]);
    expect(queue.getSnapshot().map((task) => task.error?.kind)).toEqual([
      "network",
      "http",
      undefined,
    ]);
  });

  it("resolves with a decoded AudioBuffer and completes only after decoding", async () => {
    const decodeResult = createDeferred<AudioBuffer>();
    const audioContext = createFakeAudioContext(() => decodeResult.promise);
    const { queue } = createQueue({
      audioContext,
      loader: async () => new TextEncoder().encode("valid audio").buffer,
    });
    const handle = queue.enqueue("/valid");

    await vi.waitFor(() => expect(audioContext.decodeAudioData).toHaveBeenCalledOnce());
    expect(queue.getSnapshot()[0]?.status).toBe("running");
    decodeResult.resolve(TEST_AUDIO_BUFFER);

    await expect(handle.result).resolves.toBe(TEST_AUDIO_BUFFER);
    expect(queue.getSnapshot()[0]?.status).toBe("completed");
  });

  it("marks invalid audio as a decode failure and continues with the next task", async () => {
    const audioContext = createFakeAudioContext(async (data) => {
      if (new TextDecoder().decode(data) === "invalid") {
        throw new DOMException("Invalid audio data", "DataError");
      }
      return TEST_AUDIO_BUFFER;
    });
    const { queue } = createQueue({
      audioContext,
      loader: async (url) => new TextEncoder().encode(url === "/invalid" ? "invalid" : "valid").buffer,
    });
    const invalid = queue.enqueue("/invalid");
    const valid = queue.enqueue("/valid");

    const results = await Promise.allSettled([invalid.result, valid.result]);
    expect(results.map((result) => result.status)).toEqual(["rejected", "fulfilled"]);
    expect(queue.getSnapshot().map((task) => task.status)).toEqual(["failed", "completed"]);
    expect(queue.getSnapshot()[0]?.error?.kind).toBe("decode");
  });

  it("does not begin decoding when cancellation wins immediately after fetch", async () => {
    const loadResult = createDeferred<ArrayBuffer>();
    const loadStarted = createDeferred<void>();
    const audioContext = createFakeAudioContext();
    const { queue } = createQueue({
      audioContext,
      loader: () => {
        loadStarted.resolve();
        return loadResult.promise;
      },
    });
    const handle = queue.enqueue("/cancel-before-decode");

    await loadStarted.promise;
    loadResult.resolve(new ArrayBuffer(4));
    expect(queue.cancel(handle.id, "cancel before decode")).toBe(true);

    await expect(handle.result).rejects.toHaveProperty("name", "AbortError");
    await vi.waitFor(() => expect(queue.getSnapshot()[0]?.status).toBe("cancelled"));
    expect(audioContext.decodeAudioData).not.toHaveBeenCalled();
  });

  it("discards a decoded result if cancellation happens during decode", async () => {
    const decodeResult = createDeferred<AudioBuffer>();
    const decodeStarted = createDeferred<void>();
    let decodeCalls = 0;
    const audioContext = createFakeAudioContext(() => {
      decodeCalls += 1;
      if (decodeCalls === 1) {
        decodeStarted.resolve();
        return decodeResult.promise;
      }
      return Promise.resolve(TEST_AUDIO_BUFFER);
    });
    const { queue } = createQueue({
      audioContext,
      loader: async () => new ArrayBuffer(4),
    });
    const handle = queue.enqueue("/cancel-during-decode");

    await decodeStarted.promise;
    const next = queue.enqueue("/after-cancelled-decode");
    expect(queue.cancel(handle.id, "cancel during decode")).toBe(true);
    await expect(handle.result).rejects.toHaveProperty("name", "AbortError");

    // decodeAudioData itself is not abortable, so the serial worker waits for it to settle.
    expect(queue.getSnapshot().map((task) => task.status)).toEqual(["cancelled", "queued"]);
    decodeResult.resolve(TEST_AUDIO_BUFFER);
    await expect(next.result).resolves.toBe(TEST_AUDIO_BUFFER);
    expect(queue.getSnapshot().map((task) => task.status)).toEqual(["cancelled", "completed"]);
    expect(audioContext.decodeAudioData).toHaveBeenCalledTimes(2);
  });

  it("keeps FIFO start order for a burst of concurrent enqueues", async () => {
    const urls = Array.from({ length: 32 }, (_item, index) => `/burst-${index}`);
    const started: string[] = [];
    const { queue } = createQueue({
      loader: async (url) => {
        started.push(url);
        await Promise.resolve();
        return new ArrayBuffer(4);
      },
    });

    const handles = await Promise.all(urls.map(async (url) => queue.enqueue(url)));
    await Promise.all(handles.map((handle) => handle.result));

    expect(started).toEqual(urls);
    expect(queue.getSnapshot().every((task) => task.status === "completed")).toBe(true);
  });

  it("closes its shared AudioContext once when disposed", async () => {
    const { queue, audioContext } = createQueue({
      loader: async () => new ArrayBuffer(4),
    });
    const handle = queue.enqueue("/track");
    await handle.result;

    await queue.dispose();
    await queue.dispose();

    expect(audioContext.close).toHaveBeenCalledOnce();
    expect(queue.getSnapshot()).toEqual([]);
    expect(getTaskInternals(queue).listeners.size).toBe(0);
    expect(() => queue.enqueue("/after-dispose")).toThrow(/disposed/i);
  });

  it("releases task controllers and promise callbacks at terminal states", async () => {
    const { queue } = createQueue({ loader: async () => new ArrayBuffer(4) });
    const completed = queue.enqueue("/completed");
    await completed.result;
    const completedRecord = getTaskInternals(queue).records.get(completed.id);
    expect(completedRecord?.controller).toBeNull();
    expect(completedRecord?.resolve).toBeNull();
    expect(completedRecord?.reject).toBeNull();

    const cancelled = queue.enqueue("/cancelled-before-start");
    expect(queue.cancel(cancelled.id)).toBe(true);
    await expect(cancelled.result).rejects.toHaveProperty("name", "AbortError");
    const cancelledRecord = getTaskInternals(queue).records.get(cancelled.id);
    expect(cancelledRecord?.controller).toBeNull();
    expect(cancelledRecord?.resolve).toBeNull();
    expect(cancelledRecord?.reject).toBeNull();
  });

  it("cancels pending tasks and releases queue snapshots on dispose", async () => {
    const loadResult = createDeferred<ArrayBuffer>();
    const audioContext = createFakeAudioContext();
    const { queue } = createQueue({ audioContext, loader: () => loadResult.promise });
    const running = queue.enqueue("/running-on-dispose");
    const queued = queue.enqueue("/queued-on-dispose");

    await vi.waitFor(() => expect(queue.getSnapshot()[0]?.status).toBe("running"));
    const disposePromise = queue.dispose();
    await expect(running.result).rejects.toHaveProperty("name", "AbortError");
    await expect(queued.result).rejects.toHaveProperty("name", "AbortError");
    await disposePromise;

    expect(queue.getSnapshot()).toEqual([]);
    expect(audioContext.close).toHaveBeenCalledOnce();
    loadResult.reject(new Error("Late loader failure after abort"));
    await Promise.resolve();
  });
});
