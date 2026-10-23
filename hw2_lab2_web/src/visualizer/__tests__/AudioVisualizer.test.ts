import { describe, expect, it, vi } from "vitest";
import {
  AudioVisualizer,
  type AnimationFrameScheduler,
  type AudioFrequencyBinCount,
} from "../AudioVisualizer";

class FakeScheduler implements AnimationFrameScheduler {
  private nextId = 1;
  readonly callbacks = new Map<number, FrameRequestCallback>();
  readonly cancel = vi.fn((frameId: number) => {
    this.callbacks.delete(frameId);
  });

  request = vi.fn((callback: FrameRequestCallback): number => {
    const frameId = this.nextId++;
    this.callbacks.set(frameId, callback);
    return frameId;
  });

  runNextFrame(): void {
    const entry = this.callbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error("No animation frame is scheduled.");
    this.callbacks.delete(entry[0]);
    entry[1](0);
  }
}

class FakeVisibilityDocument extends EventTarget {
  hidden = false;
}

function createAnalyser() {
  let fftSize = 2048;
  const getByteFrequencyData = vi.fn((data: Uint8Array<ArrayBuffer>) => data.fill(128));
  const analyser = {
    get fftSize() {
      return fftSize;
    },
    set fftSize(value: number) {
      fftSize = value;
    },
    get frequencyBinCount() {
      return fftSize / 2;
    },
    getByteFrequencyData,
  } as unknown as AnalyserNode;
  return { analyser, getByteFrequencyData };
}

function createCanvas() {
  const canvasContext = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillStyle: "",
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    width: 512,
    height: 200,
    getContext: vi.fn(() => canvasContext),
  } as unknown as HTMLCanvasElement;
  return { canvas, canvasContext };
}

function createVisualizer(frequencyBinCount: AudioFrequencyBinCount = 256) {
  const scheduler = new FakeScheduler();
  const documentTarget = new FakeVisibilityDocument();
  const { canvas, canvasContext } = createCanvas();
  const { analyser, getByteFrequencyData } = createAnalyser();
  const addEventListener = vi.spyOn(documentTarget, "addEventListener");
  const removeEventListener = vi.spyOn(documentTarget, "removeEventListener");
  const visualizer = new AudioVisualizer({
    canvas,
    analyser,
    frequencyBinCount,
    document: documentTarget as unknown as Document,
    scheduler,
  });
  return {
    visualizer,
    analyser,
    canvas,
    canvasContext,
    documentTarget,
    scheduler,
    getByteFrequencyData,
    addEventListener,
    removeEventListener,
  };
}

describe("AudioVisualizer", () => {
  it.each([256, 512] as const)("configures %i frequency bins using fftSize = bins * 2", (bins) => {
    const { analyser, canvas } = createVisualizer(bins);

    expect(analyser.fftSize).toBe(bins * 2);
    expect(analyser.frequencyBinCount).toBe(bins);
    expect(canvas.getContext).toHaveBeenCalledOnce();
  });

  it("keeps one RAF loop, reuses its frequency array, and cancels on stop", () => {
    const { visualizer, scheduler, getByteFrequencyData, canvasContext, addEventListener } = createVisualizer();

    visualizer.start();
    visualizer.start();
    expect(scheduler.callbacks.size).toBe(1);
    expect(scheduler.request).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledOnce();

    scheduler.runNextFrame();
    expect(scheduler.callbacks.size).toBe(1);
    expect(getByteFrequencyData).toHaveBeenCalledOnce();
    const reusedBuffer = getByteFrequencyData.mock.calls[0]?.[0];
    expect(reusedBuffer).toHaveLength(256);
    expect(canvasContext.fillRect).toHaveBeenCalledTimes(256);

    scheduler.runNextFrame();
    expect(getByteFrequencyData).toHaveBeenCalledTimes(2);
    expect(getByteFrequencyData.mock.calls[1]?.[0]).toBe(reusedBuffer);

    visualizer.stop();
    expect(scheduler.callbacks.size).toBe(0);
    expect(scheduler.cancel).toHaveBeenCalledOnce();
  });

  it("pauses while the tab is hidden and resumes one loop when visible", () => {
    const { visualizer, scheduler, documentTarget } = createVisualizer();

    documentTarget.hidden = true;
    visualizer.start();
    expect(scheduler.callbacks.size).toBe(0);

    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(scheduler.callbacks.size).toBe(1);

    documentTarget.hidden = true;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(scheduler.callbacks.size).toBe(0);

    documentTarget.hidden = false;
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    documentTarget.dispatchEvent(new Event("visibilitychange"));
    expect(scheduler.callbacks.size).toBe(1);
  });

  it("cancels frames and removes the visibility listener on dispose", () => {
    const { visualizer, scheduler, documentTarget, removeEventListener } = createVisualizer();
    visualizer.start();

    visualizer.dispose();
    visualizer.dispose();
    documentTarget.dispatchEvent(new Event("visibilitychange"));

    expect(scheduler.callbacks.size).toBe(0);
    expect(scheduler.cancel).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledOnce();
    expect(() => visualizer.start()).toThrow(/disposed/i);
  });
});
