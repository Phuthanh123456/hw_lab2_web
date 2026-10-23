import type {
  AudioTask,
  AudioTaskError,
  AudioTaskHandle,
  AudioTaskId,
  AudioTaskStatus,
} from "./audio-task";
import type { AudioTaskListener, AudioTaskQueue } from "./queue-types";
import {
  AudioHttpError,
  AudioNetworkError,
  createAudioDataLoader,
  type AudioDataLoader,
} from "./audio-loader";

interface TaskRecord {
  readonly id: AudioTaskId;
  readonly trackUrl: string;
  readonly signal: AbortSignal;
  controller: AbortController | null;
  status: AudioTaskStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: AudioTaskError;
  resolve: ((value: AudioBuffer) => void) | null;
  reject: ((reason: unknown) => void) | null;
}

export interface FifoAudioTaskQueueOptions {
  readonly loader?: AudioDataLoader;
  /** The queue owns and closes an injected context when dispose() is called. */
  readonly audioContext?: AudioContext;
  /** Used once, lazily, when no context was injected. */
  readonly createAudioContext?: () => AudioContext;
  readonly createId?: () => string;
  readonly now?: () => number;
}

export class FifoAudioTaskQueue implements AudioTaskQueue {
  private readonly pending: TaskRecord[] = [];
  private readonly records = new Map<AudioTaskId, TaskRecord>();
  private readonly listeners = new Set<AudioTaskListener>();
  private readonly loader: AudioDataLoader;
  private readonly createAudioContext: () => AudioContext;
  private readonly createId: () => string;
  private readonly now: () => number;
  private worker: Promise<void> | null = null;
  private audioContext: AudioContext | null;
  private disposed = false;
  private disposePromise: Promise<void> | null = null;

  constructor(options: FifoAudioTaskQueueOptions = {}) {
    this.loader = options.loader ?? createAudioDataLoader();
    this.audioContext = options.audioContext ?? null;
    this.createAudioContext = options.createAudioContext ?? (() => new AudioContext());
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID());
    this.now = options.now ?? Date.now;
  }

  enqueue(trackUrl: string): AudioTaskHandle {
    if (this.disposed) throw new Error("AudioTaskQueue has been disposed.");

    const controller = new AbortController();
    let resolveResult!: (value: AudioBuffer) => void;
    let rejectResult!: (reason: unknown) => void;
    const result = new Promise<AudioBuffer>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const record: TaskRecord = {
      id: this.createId() as AudioTaskId,
      trackUrl,
      signal: controller.signal,
      controller,
      status: "queued",
      createdAt: this.now(),
      resolve: resolveResult,
      reject: rejectResult,
    };

    this.records.set(record.id, record);
    this.pending.push(record);
    this.emit();
    this.ensureWorker();

    return { id: record.id, result };
  }

  cancel(taskId: AudioTaskId, reason?: unknown): boolean {
    const record = this.records.get(taskId);
    if (!record || isTerminal(record.status)) return false;

    record.controller?.abort(reason);

    if (record.status === "queued") {
      const index = this.pending.indexOf(record);
      if (index !== -1) this.pending.splice(index, 1);
    }

    this.finishCancelled(record, reason);
    return true;
  }

  getSnapshot(): readonly AudioTask[] {
    return Object.freeze([...this.records.values()].map(toSnapshot));
  }

  subscribe(listener: AudioTaskListener): () => void {
    if (this.disposed) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  forget(taskId: AudioTaskId): boolean {
    const record = this.records.get(taskId);
    if (!record || !isTerminal(record.status)) return false;
    return this.records.delete(taskId);
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;

    this.disposed = true;
    for (const record of this.records.values()) {
      if (!isTerminal(record.status)) this.cancel(record.id, "AudioTaskQueue disposed.");
    }

    const worker = this.worker;
    this.disposePromise = (async () => {
      try {
        if (worker) await worker;
      } finally {
        const context = this.audioContext;
        this.audioContext = null;
        try {
          if (context && context.state !== "closed") await context.close();
        } finally {
          this.pending.length = 0;
          this.records.clear();
          this.listeners.clear();
        }
      }
    })();

    return this.disposePromise;
  }

  private ensureWorker(): void {
    if (this.worker !== null) return;

    const worker = Promise.resolve().then(() => this.drain());
    this.worker = worker;
    void worker.then(
      () => this.onWorkerSettled(worker),
      (error: unknown) => {
        console.error("AudioTaskQueue worker failed unexpectedly", error);
        this.onWorkerSettled(worker);
      },
    );
  }

  private onWorkerSettled(worker: Promise<void>): void {
    if (this.worker !== worker) return;
    this.worker = null;
    if (this.pending.length > 0) this.ensureWorker();
  }

  private async drain(): Promise<void> {
    while (this.pending.length > 0) {
      const record = this.pending.shift();
      if (!record || record.status !== "queued") continue;

      record.status = "running";
      record.startedAt = this.now();
      this.emit();

      let encodedData: ArrayBuffer | null = null;
      let decodedBuffer: AudioBuffer | null = null;

      try {
        // A subscriber can cancel synchronously while observing the running state.
        // Do not start I/O after that cancellation has already completed.
        if (record.signal.aborted || isTerminal(record.status)) continue;

        encodedData = await this.loadOrAbort(record);
        if (record.signal.aborted || isTerminal(record.status)) continue;

        try {
          // decodeAudioData cannot be aborted. Keep the worker here until it settles,
          // then discard its result if cancellation happened while decoding.
          decodedBuffer = await this.getAudioContext().decodeAudioData(encodedData);
        } catch (cause) {
          throw new AudioDecodeError("Could not decode audio data.", { cause });
        } finally {
          encodedData = null;
        }

        if (record.signal.aborted || isTerminal(record.status)) continue;
        this.finishCompleted(record, decodedBuffer);
      } catch (cause) {
        if (record.signal.aborted) {
          this.finishCancelled(record, record.signal.reason);
        } else {
          this.finishFailed(record, cause);
        }
      } finally {
        encodedData = null;
        decodedBuffer = null;
        record.controller = null;
      }
    }
  }

  /** Return the single context used for decoding and downstream playback. */
  getAudioContext(): AudioContext {
    if (this.audioContext) return this.audioContext;
    if (this.disposed) throw new Error("AudioTaskQueue has been disposed.");
    this.audioContext = this.createAudioContext();
    return this.audioContext;
  }

  private loadOrAbort(record: TaskRecord): Promise<ArrayBuffer> {
    const { signal } = record;
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_resolve, reject) => {
      onAbort = () => reject(createAbortError(signal.reason));
      if (signal.aborted) {
        onAbort();
      } else {
        signal.addEventListener("abort", onAbort, { once: true });
      }
    });
    const load = Promise.resolve().then(() => this.loader(record.trackUrl, signal));

    return Promise.race([load, aborted]).finally(() => {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    });
  }

  private finishCompleted(record: TaskRecord, buffer: AudioBuffer): void {
    if (isTerminal(record.status)) return;
    record.status = "completed";
    record.finishedAt = this.now();
    record.controller = null;
    const resolve = record.resolve;
    record.resolve = null;
    record.reject = null;
    this.emit();
    resolve?.(buffer);
  }

  private finishFailed(record: TaskRecord, cause: unknown): void {
    if (isTerminal(record.status)) return;
    const error = toTaskError(cause);
    record.status = "failed";
    record.finishedAt = this.now();
    record.error = error;
    record.controller = null;
    const reject = record.reject;
    record.resolve = null;
    record.reject = null;
    this.emit();
    reject?.(cause);
  }

  private finishCancelled(record: TaskRecord, reason: unknown): void {
    if (isTerminal(record.status)) return;
    const error = createAbortError(reason);
    record.status = "cancelled";
    record.finishedAt = this.now();
    record.error = {
      kind: "aborted",
      message: error.message,
      reason,
    };
    record.controller = null;
    const reject = record.reject;
    record.resolve = null;
    record.reject = null;
    this.emit();
    reject?.(error);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.error("AudioTaskQueue listener failed", error);
      }
    }
  }
}

function toSnapshot(record: TaskRecord): AudioTask {
  return Object.freeze({
    id: record.id,
    trackUrl: record.trackUrl,
    status: record.status,
    signal: record.signal,
    createdAt: record.createdAt,
    ...(record.startedAt === undefined ? {} : { startedAt: record.startedAt }),
    ...(record.finishedAt === undefined ? {} : { finishedAt: record.finishedAt }),
    ...(record.error === undefined ? {} : { error: record.error }),
  });
}

function isTerminal(status: AudioTaskStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function toTaskError(cause: unknown): AudioTaskError {
  if (cause instanceof AudioDecodeError) {
    return { kind: "decode", message: cause.message, cause: cause.cause };
  }
  if (cause instanceof AudioHttpError) {
    return { kind: "http", message: cause.message, status: cause.status };
  }
  if (cause instanceof AudioNetworkError) {
    return { kind: "network", message: cause.message, cause: cause.cause };
  }
  return {
    kind: "unknown",
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  };
}

class AudioDecodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AudioDecodeError";
  }
}

function createAbortError(reason: unknown): Error {
  const message = typeof reason === "string" ? reason : "Audio task was cancelled.";
  const error = new Error(message, reason instanceof Error ? { cause: reason } : undefined);
  error.name = "AbortError";
  return error;
}
