# Audio task queue contract

## Public types

- `AudioTaskId` is assigned once by the queue and stays stable through every state transition.
- `AudioTask` is a read-only snapshot. It carries the track URL, current status, timestamps, optional normalized error, and the per-task `AbortSignal`.
- The queue owns each task's `AbortController`; consumers request cancellation through `cancel(id)` and cannot mutate queue state directly.
- `AudioTaskHandle.result` resolves to fetched `ArrayBuffer` data or rejects when the task fails or is cancelled.

## State transitions

| Current | Allowed next states |
| --- | --- |
| `queued` | `running`, `cancelled` |
| `running` | `completed`, `failed`, `cancelled` |
| terminal (`completed`, `failed`, `cancelled`) | none |

The pending FIFO contains queued work only. A single worker removes a task from that list before processing it, so no task can be processed twice and a later task cannot overtake it. A fetch failure settles that task as `failed` and does not prevent later work. Cancellation aborts the task's signal; queued cancellation removes it from pending immediately, while running cancellation is observed by its async operation.

## Observation and retention

`getSnapshot()` returns immutable-by-contract snapshots in submission order. `subscribe()` receives a fresh snapshot after each state change and returns an unsubscribe function. Terminal task metadata remains observable until `forget(id)` is called; completed audio bytes are returned only through the handle promise and are not stored in the task snapshot. Forgetting an active task returns `false`.

This contract covers queue state and fetched bytes only. Audio decoding, playback, and visualization are later milestones.