interface ActiveSource {
  readonly source: AudioBufferSourceNode;
  readonly taskSignal: AbortSignal;
  readonly onEnded: () => void;
  readonly onTaskAbort: () => void;
  readonly onFinished?: () => void;
}

export type AudioPlaybackId = string & { readonly __audioPlaybackId: "AudioPlaybackId" };

/** Owns playback source nodes and one shared analyser; AudioContext remains queue-owned. */
export class AudioPlayback {
  private readonly analyserNode: AnalyserNode;
  private readonly activeSources = new Map<AudioPlaybackId, ActiveSource>();
  private readonly createId: () => string;
  private disposed = false;

  constructor(
    private readonly audioContext: AudioContext,
    createId: () => string = () => globalThis.crypto.randomUUID(),
  ) {
    this.createId = createId;
    this.analyserNode = audioContext.createAnalyser();
    this.analyserNode.connect(audioContext.destination);
  }

  /** The shared analyser is also the input for the visualizer. */
  get analyser(): AnalyserNode {
    return this.analyserNode;
  }

  get activeSourceCount(): number {
    return this.activeSources.size;
  }

  /** Returns null for an already-cancelled task; its signal stops playback if canceled later. */
  play(
    buffer: AudioBuffer,
    taskSignal: AbortSignal,
    onFinished?: () => void,
  ): AudioPlaybackId | null {
    if (this.disposed) throw new Error("AudioPlayback has been disposed.");
    if (taskSignal.aborted) return null;

    const source = this.audioContext.createBufferSource();
    const id = this.createId() as AudioPlaybackId;
    const active: ActiveSource = {
      source,
      taskSignal,
      onEnded: () => this.releaseSource(id, active),
      onTaskAbort: () => this.stop(id),
      ...(onFinished === undefined ? {} : { onFinished }),
    };

    this.activeSources.set(id, active);
    try {
      source.addEventListener("ended", active.onEnded, { once: true });
      taskSignal.addEventListener("abort", active.onTaskAbort, { once: true });
      if (taskSignal.aborted) {
        this.releaseSource(id, active);
        return null;
      }

      source.buffer = buffer;
      source.connect(this.analyserNode);
      source.start();
      return id;
    } catch (error) {
      this.releaseSource(id, active);
      throw error;
    }
  }

  stop(id: AudioPlaybackId): boolean {
    const active = this.activeSources.get(id);
    if (!active) return false;

    try {
      active.source.stop();
    } catch {
      // A source may already have stopped or ended. Cleanup must remain safe and idempotent.
    }
    this.releaseSource(id, active);
    return true;
  }

  stopAll(): void {
    for (const id of [...this.activeSources.keys()]) this.stop(id);
  }

  /** Stop sources and detach listeners/nodes. The shared AudioContext is closed by its owner. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAll();
    try {
      this.analyserNode.disconnect();
    } catch {
      // Disconnect is safe to repeat during application teardown.
    }
  }

  private releaseSource(id: AudioPlaybackId, active: ActiveSource): void {
    if (this.activeSources.get(id) !== active) return;

    this.activeSources.delete(id);
    active.source.removeEventListener("ended", active.onEnded);
    active.taskSignal.removeEventListener("abort", active.onTaskAbort);
    try {
      active.source.disconnect();
    } catch {
      // The source may have disconnected itself as it ended.
    }
    try {
      active.source.buffer = null;
    } catch {
      // Releasing the source's buffer reference is best-effort during teardown.
    }
    try {
      active.onFinished?.();
    } catch (error) {
      console.error("AudioPlayback finish listener failed", error);
    }
  }
}
