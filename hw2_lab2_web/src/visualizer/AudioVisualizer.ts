export type AudioFrequencyBinCount = 256 | 512;

export interface AnimationFrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(frameId: number): void;
}

export type VisibilityDocument = Pick<
  Document,
  "hidden" | "addEventListener" | "removeEventListener"
>;

export interface AudioVisualizerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly analyser: AnalyserNode;
  readonly frequencyBinCount: AudioFrequencyBinCount;
  readonly document?: VisibilityDocument;
  readonly scheduler?: AnimationFrameScheduler;
  readonly barColor?: string;
}

const browserScheduler: AnimationFrameScheduler = {
  request: (callback) => globalThis.requestAnimationFrame(callback),
  cancel: (frameId) => globalThis.cancelAnimationFrame(frameId),
};

/** Draws analyser frequency data directly to a canvas without framework state updates. */
export class AudioVisualizer {
  private readonly canvasContext: CanvasRenderingContext2D;
  private readonly documentTarget: VisibilityDocument;
  private readonly scheduler: AnimationFrameScheduler;
  private readonly frequencyData: Uint8Array<ArrayBuffer>;
  private readonly barColor: string;
  private frameId: number | null = null;
  private running = false;
  private disposed = false;

  constructor(private readonly options: AudioVisualizerOptions) {
    const canvasContext = options.canvas.getContext("2d");
    if (!canvasContext) throw new Error("Could not get a 2D canvas context.");
    this.canvasContext = canvasContext;

    // Web Audio defines frequencyBinCount as fftSize / 2.
    options.analyser.fftSize = options.frequencyBinCount * 2;
    if (options.analyser.frequencyBinCount !== options.frequencyBinCount) {
      throw new Error("AnalyserNode frequencyBinCount did not match the requested bin count.");
    }
    this.frequencyData = new Uint8Array(options.analyser.frequencyBinCount);

    this.documentTarget = options.document ?? document;
    this.scheduler = options.scheduler ?? browserScheduler;
    this.barColor = options.barColor ?? "#4ea1ff";
    this.documentTarget.addEventListener("visibilitychange", this.onVisibilityChange);
  }

  start(): void {
    if (this.disposed) throw new Error("AudioVisualizer has been disposed.");
    this.running = true;
    this.scheduleFrame();
  }

  stop(): void {
    this.running = false;
    this.cancelFrame();
  }

  /** Call when the owning view/component is removed. */
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.documentTarget.removeEventListener("visibilitychange", this.onVisibilityChange);
    this.canvasContext.clearRect(0, 0, this.options.canvas.width, this.options.canvas.height);
  }

  private readonly onVisibilityChange = (): void => {
    if (this.documentTarget.hidden) {
      this.cancelFrame();
    } else if (this.running) {
      this.scheduleFrame();
    }
  };

  private readonly drawFrame: FrameRequestCallback = () => {
    this.frameId = null;
    if (!this.running || this.disposed || this.documentTarget.hidden) return;

    this.options.analyser.getByteFrequencyData(this.frequencyData);
    this.drawBars();
    this.scheduleFrame();
  };

  private scheduleFrame(): void {
    if (this.frameId !== null || !this.running || this.disposed || this.documentTarget.hidden) return;
    this.frameId = this.scheduler.request(this.drawFrame);
  }

  private cancelFrame(): void {
    if (this.frameId === null) return;
    this.scheduler.cancel(this.frameId);
    this.frameId = null;
  }

  private drawBars(): void {
    const { width, height } = this.options.canvas;
    const binWidth = width / this.frequencyData.length;
    const barWidth = Math.max(1, binWidth * 0.72);

    this.canvasContext.clearRect(0, 0, width, height);
    this.canvasContext.fillStyle = this.barColor;
    for (let index = 0; index < this.frequencyData.length; index += 1) {
      const magnitude = this.frequencyData[index] ?? 0;
      const barHeight = (magnitude / 255) * height;
      this.canvasContext.fillRect(index * binWidth, height - barHeight, barWidth, barHeight);
    }
  }
}
