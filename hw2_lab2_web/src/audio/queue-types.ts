import type { AudioTask, AudioTaskId, AudioTaskHandle } from "./audio-task";

export type AudioTaskListener = (tasks: readonly AudioTask[]) => void;

/** Small public API for submitting work, cancellation, and observing snapshots. */
export interface AudioTaskQueue {
  enqueue(trackUrl: string): AudioTaskHandle;
  /** Shared decode/playback context; the queue closes it when disposed. */
  getAudioContext(): AudioContext;
  cancel(taskId: AudioTaskId, reason?: unknown): boolean;
  getSnapshot(): readonly AudioTask[];
  subscribe(listener: AudioTaskListener): () => void;
  /** Remove a terminal task snapshot; active tasks cannot be forgotten. */
  forget(taskId: AudioTaskId): boolean;
  /** Cancel remaining work and close the queue-owned AudioContext, if created. */
  dispose(): Promise<void>;
}
