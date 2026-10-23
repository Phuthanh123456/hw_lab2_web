/** Opaque, queue-assigned identifier that remains stable for the task lifetime. */
export type AudioTaskId = string & { readonly __audioTaskId: "AudioTaskId" };

export type AudioTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type AudioTaskError =
  | { readonly kind: "aborted"; readonly message: string; readonly reason?: unknown }
  | { readonly kind: "network"; readonly message: string; readonly cause?: unknown }
  | { readonly kind: "http"; readonly message: string; readonly status: number }
  | { readonly kind: "decode"; readonly message: string; readonly cause?: unknown }
  | { readonly kind: "unknown"; readonly message: string; readonly cause?: unknown };

/** Read-only task state. AbortController ownership stays with the queue. */
export interface AudioTask {
  readonly id: AudioTaskId;
  readonly trackUrl: string;
  readonly status: AudioTaskStatus;
  readonly signal: AbortSignal;
  readonly createdAt: number;
  readonly startedAt?: number;
  readonly finishedAt?: number;
  readonly error?: AudioTaskError;
}

/** The result resolves when the queue has fetched and decoded the track. */
export interface AudioTaskHandle {
  readonly id: AudioTaskId;
  readonly result: Promise<AudioBuffer>;
}
