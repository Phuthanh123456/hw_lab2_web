import { describe, expect, it, vi } from "vitest";
import { AudioPlayback, type AudioPlaybackId } from "../audio-playback";

interface FakeSource {
  readonly node: AudioBufferSourceNode;
  readonly connect: ReturnType<typeof vi.fn>;
  readonly disconnect: ReturnType<typeof vi.fn>;
  readonly start: ReturnType<typeof vi.fn>;
  readonly stop: ReturnType<typeof vi.fn>;
  readonly removeEventListener: ReturnType<typeof vi.fn>;
  emitEnded(): void;
}

interface AudioHarness {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  readonly sources: FakeSource[];
}

function createAudioHarness(): AudioHarness {
  const sources: FakeSource[] = [];
  const analyser = {
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as AnalyserNode;
  const context = {
    destination: {} as AudioNode,
    createAnalyser: vi.fn(() => analyser),
    createBufferSource: vi.fn(() => {
      const endedListeners = new Set<EventListenerOrEventListenerObject>();
      const connect = vi.fn();
      const disconnect = vi.fn();
      const start = vi.fn();
      const stop = vi.fn();
      const removeEventListener = vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
        endedListeners.delete(listener);
      });
      const node = {
        buffer: null,
        connect,
        disconnect,
        start,
        stop,
        addEventListener: vi.fn((_type: string, listener: EventListenerOrEventListenerObject) => {
          endedListeners.add(listener);
        }),
        removeEventListener,
      } as unknown as AudioBufferSourceNode;
      const source: FakeSource = {
        node,
        connect,
        disconnect,
        start,
        stop,
        removeEventListener,
        emitEnded: () => {
          const event = new Event("ended");
          for (const listener of [...endedListeners]) {
            if (typeof listener === "function") listener(event);
            else listener.handleEvent(event);
          }
        },
      };
      sources.push(source);
      return node;
    }),
  } as unknown as AudioContext;

  return { context, analyser, sources };
}

const AUDIO_BUFFER = {} as AudioBuffer;

describe("AudioPlayback", () => {
  it("creates a fresh source for each play and routes it through the shared analyser", () => {
    const harness = createAudioHarness();
    const playback = new AudioPlayback(harness.context, (() => {
      let id = 0;
      return () => `play-${++id}`;
    })());
    const firstTask = new AbortController();
    const secondTask = new AbortController();

    const firstId = playback.play(AUDIO_BUFFER, firstTask.signal);
    const secondId = playback.play(AUDIO_BUFFER, secondTask.signal);

    expect(firstId).toBe("play-1");
    expect(secondId).toBe("play-2");
    expect(harness.context.createBufferSource).toHaveBeenCalledTimes(2);
    expect(harness.context.createAnalyser).toHaveBeenCalledOnce();
    expect(harness.analyser.connect).toHaveBeenCalledWith(harness.context.destination);
    expect(harness.sources.map((source) => source.connect.mock.calls[0]?.[0])).toEqual([
      harness.analyser,
      harness.analyser,
    ]);
    expect(harness.sources.every((source) => source.start.mock.calls.length === 1)).toBe(true);
    expect(playback.activeSourceCount).toBe(2);
  });

  it("disconnects and releases a source when it ends", () => {
    const harness = createAudioHarness();
    const playback = new AudioPlayback(harness.context);
    const task = new AbortController();
    const onFinished = vi.fn();
    const id = playback.play(AUDIO_BUFFER, task.signal, onFinished) as AudioPlaybackId;
    const source = harness.sources[0];

    source?.emitEnded();
    task.abort("already ended");

    expect(playback.activeSourceCount).toBe(0);
    expect(source?.disconnect).toHaveBeenCalledOnce();
    expect(source?.removeEventListener).toHaveBeenCalledOnce();
    expect(source?.stop).not.toHaveBeenCalled();
    expect(source?.node.buffer).toBeNull();
    expect(onFinished).toHaveBeenCalledOnce();
    expect(playback.stop(id)).toBe(false);
  });

  it("stops safely, including an already-stopped source, and cleans up", () => {
    const harness = createAudioHarness();
    const playback = new AudioPlayback(harness.context);
    const onFinished = vi.fn();
    const id = playback.play(AUDIO_BUFFER, new AbortController().signal, onFinished) as AudioPlaybackId;
    const source = harness.sources[0];
    source?.stop.mockImplementation(() => {
      throw new DOMException("The source was already stopped", "InvalidStateError");
    });

    expect(() => playback.stop(id)).not.toThrow();
    expect(playback.activeSourceCount).toBe(0);
    expect(source?.disconnect).toHaveBeenCalledOnce();
    expect(source?.node.buffer).toBeNull();
    expect(onFinished).toHaveBeenCalledOnce();
    expect(playback.stop(id)).toBe(false);
  });

  it("does not play a canceled task and stops playback when its signal aborts", () => {
    const harness = createAudioHarness();
    const playback = new AudioPlayback(harness.context);
    const canceled = new AbortController();
    canceled.abort("canceled before playback");

    expect(playback.play(AUDIO_BUFFER, canceled.signal)).toBeNull();
    expect(harness.context.createBufferSource).not.toHaveBeenCalled();

    const activeTask = new AbortController();
    playback.play(AUDIO_BUFFER, activeTask.signal);
    activeTask.abort("task canceled during playback");

    expect(playback.activeSourceCount).toBe(0);
    expect(harness.sources[0]?.stop).toHaveBeenCalledOnce();
    expect(harness.sources[0]?.disconnect).toHaveBeenCalledOnce();
  });

  it("stops every source and disconnects the analyser on repeated dispose", () => {
    const harness = createAudioHarness();
    const playback = new AudioPlayback(harness.context);
    playback.play(AUDIO_BUFFER, new AbortController().signal);
    playback.play(AUDIO_BUFFER, new AbortController().signal);

    playback.dispose();
    playback.dispose();

    expect(playback.activeSourceCount).toBe(0);
    expect(harness.sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    expect(harness.sources.every((source) => source.disconnect.mock.calls.length === 1)).toBe(true);
    expect(harness.sources.every((source) => source.node.buffer === null)).toBe(true);
    expect(harness.sources.every((source) => source.removeEventListener.mock.calls.length === 1)).toBe(true);
    expect(harness.analyser.disconnect).toHaveBeenCalledOnce();
    expect(() => playback.play(AUDIO_BUFFER, new AbortController().signal)).toThrow(/disposed/i);
  });

  it("contains exceptions from a finish listener after releasing the source", () => {
    const harness = createAudioHarness();
    const playback = new AudioPlayback(harness.context);
    const logError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const id = playback.play(AUDIO_BUFFER, new AbortController().signal, () => {
      throw new Error("consumer callback failed");
    }) as AudioPlaybackId;

    expect(() => harness.sources[0]?.emitEnded()).not.toThrow();
    expect(playback.activeSourceCount).toBe(0);
    expect(playback.stop(id)).toBe(false);
    expect(logError).toHaveBeenCalledOnce();
    logError.mockRestore();
  });
});
