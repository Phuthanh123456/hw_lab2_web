import { FifoAudioTaskQueue } from "../audio/AudioTaskQueue";
import type { AudioTask, AudioTaskId } from "../audio/audio-task";
import { AudioPlayback, type AudioPlaybackId } from "../audio/audio-playback";
import { AudioVisualizer } from "../visualizer/AudioVisualizer";

interface TaskViewModel {
  task: AudioTask;
  buffer: AudioBuffer | null;
  playbackId: AudioPlaybackId | null;
}

/** Thin browser demo that observes and invokes the existing audio engine APIs. */
export class AudioQueueDemo {
  private readonly queue = new FifoAudioTaskQueue();
  private readonly tasks = new Map<AudioTaskId, TaskViewModel>();
  private readonly pendingPlays = new Set<AudioTaskId>();
  private unsubscribeQueue: (() => void) | null = null;
  private playback: AudioPlayback | null = null;
  private visualizer: AudioVisualizer | null = null;
  private disposed = false;
  private trackForm!: HTMLFormElement;
  private trackInput!: HTMLInputElement;
  private binsSelect!: HTMLSelectElement;
  private stopAllButton!: HTMLButtonElement;
  private taskList!: HTMLUListElement;
  private emptyMessage!: HTMLParagraphElement;
  private announcement!: HTMLParagraphElement;
  private canvas!: HTMLCanvasElement;

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = `
      <main class="page-shell">
        <header class="page-header">
          <p class="eyebrow">HOMEWORK 2 <span aria-hidden="true">·</span> AUDIO ENGINE</p>
          <h1>Concurrent FIFO Audio Queue</h1>
          <p class="lede">Enqueue audio URLs, follow load and decode status, then play decoded tracks through the frequency visualizer.</p>
        </header>

        <section class="control-panel" aria-label="Queue controls">
          <form id="track-form" class="track-form">
            <label for="track-url">Audio track URL</label>
            <div class="url-entry">
              <input id="track-url" name="trackUrl" type="url" placeholder="https://example.com/track.mp3" required />
              <button type="submit">Add to queue</button>
            </div>
          </form>
          <div class="playback-settings">
            <label for="frequency-bins">Visualizer frequency bins</label>
            <select id="frequency-bins" name="frequencyBins">
              <option value="256">256 bins</option>
              <option value="512">512 bins</option>
            </select>
            <button id="stop-all" class="secondary-button" type="button" disabled>Stop playback</button>
          </div>
        </section>

        <p id="demo-announcement" class="announcement" aria-live="polite" aria-atomic="true"></p>

        <section class="queue-panel" aria-labelledby="queue-heading">
          <div class="section-heading">
            <div>
              <p class="panel-label">TASKS</p>
              <h2 id="queue-heading">Audio queue</h2>
            </div>
            <span id="task-count" class="task-count">0 tracks</span>
          </div>
          <p id="empty-message" class="empty-message">No tracks yet. Add an audio URL to begin.</p>
          <ul id="task-list" class="task-list" aria-label="Audio tasks"></ul>
        </section>

        <section class="visualizer-panel" aria-labelledby="visualizer-heading">
          <div class="section-heading">
            <div>
              <p class="panel-label">LIVE ANALYSIS</p>
              <h2 id="visualizer-heading">Frequency spectrum</h2>
            </div>
            <span class="visualizer-note">Canvas · requestAnimationFrame</span>
          </div>
          <canvas class="audio-canvas" width="960" height="220" role="img" aria-label="Audio frequency spectrum visualization"></canvas>
        </section>

        <footer class="page-footer">
          <span class="status-dot" aria-hidden="true"></span>
          <p>Queue order is FIFO. A running task may be loading or decoding.</p>
        </footer>
      </main>
    `;

    this.trackForm = requireElement(this.root, "#track-form");
    this.trackInput = requireElement(this.root, "#track-url");
    this.binsSelect = requireElement(this.root, "#frequency-bins");
    this.stopAllButton = requireElement(this.root, "#stop-all");
    this.taskList = requireElement(this.root, "#task-list");
    this.emptyMessage = requireElement(this.root, "#empty-message");
    this.announcement = requireElement(this.root, "#demo-announcement");
    this.canvas = requireElement(this.root, ".audio-canvas");

    this.trackForm.addEventListener("submit", this.onSubmit);
    this.binsSelect.addEventListener("change", this.onBinsChange);
    this.stopAllButton.addEventListener("click", this.onStopAll);
    this.unsubscribeQueue = this.queue.subscribe(this.onQueueSnapshot);
    this.renderTasks();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.trackForm.removeEventListener("submit", this.onSubmit);
    this.binsSelect.removeEventListener("change", this.onBinsChange);
    this.stopAllButton.removeEventListener("click", this.onStopAll);
    this.unsubscribeQueue?.();
    this.unsubscribeQueue = null;
    this.visualizer?.dispose();
    this.visualizer = null;
    this.playback?.dispose();
    this.playback = null;
    for (const task of this.tasks.values()) task.buffer = null;
    this.tasks.clear();
    this.pendingPlays.clear();
    await this.queue.dispose();
  }

  private readonly onSubmit = (event: Event): void => {
    event.preventDefault();
    const trackUrl = this.trackInput.value.trim();
    if (!trackUrl || this.disposed) return;

    try {
      const handle = this.queue.enqueue(trackUrl);
      this.trackInput.value = "";
      this.announce(`Queued ${trackUrl}.`);
      // Always observe rejection; the queue snapshot provides the displayed error state.
      void handle.result.then(
        (buffer) => {
          const task = this.tasks.get(handle.id);
          if (!task || task.task.status !== "completed" || task.task.signal.aborted || this.disposed) return;
          task.buffer = buffer;
          this.renderTasks();
        },
        () => undefined,
      ).catch((error: unknown) => {
        if (!this.disposed) this.announce(`Could not retain decoded audio: ${errorMessage(error)}`);
      });
    } catch (error) {
      this.announce(errorMessage(error));
    }
  };

  private readonly onBinsChange = (): void => {
    if (!this.playback) return;
    const wasPlaying = this.playback.activeSourceCount > 0;
    this.createVisualizer(wasPlaying);
  };

  private readonly onStopAll = (): void => {
    this.playback?.stopAll();
    this.visualizer?.stop();
    this.renderTasks();
    this.announce("Playback stopped.");
  };

  private readonly onQueueSnapshot = (snapshot: readonly AudioTask[]): void => {
    for (const task of snapshot) {
      const previous = this.tasks.get(task.id);
      const viewModel = previous ?? { task, buffer: null, playbackId: null };
      const previousStatus = viewModel.task.status;
      viewModel.task = task;
      if (task.status === "failed" || task.status === "cancelled") viewModel.buffer = null;
      this.tasks.set(task.id, viewModel);

      if (task.status === "failed" && previousStatus !== "failed") {
        this.announce(`Could not load ${task.trackUrl}: ${task.error?.message ?? "Unknown audio error."}`);
      }
    }
    this.renderTasks();
  };

  private renderTasks(): void {
    if (!this.taskList || this.disposed) return;
    const items = [...this.tasks.values()].map((viewModel) => this.renderTask(viewModel));
    this.taskList.replaceChildren(...items);
    this.emptyMessage.hidden = items.length > 0;
    const count = this.root.querySelector<HTMLElement>("#task-count");
    if (count) count.textContent = `${items.length} ${items.length === 1 ? "track" : "tracks"}`;
    this.stopAllButton.disabled = (this.playback?.activeSourceCount ?? 0) === 0;
  }

  private renderTask(viewModel: TaskViewModel): HTMLLIElement {
    const { task } = viewModel;
    const item = document.createElement("li");
    item.className = "task-item";

    const summary = document.createElement("div");
    summary.className = "task-summary";
    const url = document.createElement("p");
    url.className = "task-url";
    url.textContent = task.trackUrl;
    const status = document.createElement("span");
    const statusLabel = getStatusLabel(viewModel);
    status.className = `task-status status-${getStatusClass(viewModel)}`;
    status.textContent = statusLabel;
    summary.append(url, status);
    item.append(summary);

    if (task.error) {
      const error = document.createElement("p");
      error.className = "task-error";
      error.textContent = task.error.message;
      item.append(error);
    }

    const actions = document.createElement("div");
    actions.className = "task-actions";
    if (task.status === "queued" || task.status === "running") {
      actions.append(createButton("Cancel", `Cancel task for ${task.trackUrl}`, () => {
        if (this.queue.cancel(task.id, "Cancelled from the demo.")) {
          this.announce(`Cancelled ${task.trackUrl}.`);
        }
      }, "secondary-button"));
    } else if (viewModel.playbackId) {
      actions.append(createButton("Stop", `Stop playback for ${task.trackUrl}`, () => {
        if (viewModel.playbackId) this.playback?.stop(viewModel.playbackId);
      }, "secondary-button"));
    } else if (this.pendingPlays.has(task.id)) {
      const starting = createButton("Starting…", `Starting playback for ${task.trackUrl}`, () => undefined, "secondary-button");
      starting.disabled = true;
      actions.append(starting);
    } else if (task.status === "completed" && viewModel.buffer) {
      actions.append(createButton("Play", `Play ${task.trackUrl}`, () => {
        void this.playTask(task.id);
      }));
    } else if (isTerminalTask(task)) {
      actions.append(createButton("Remove", `Remove ${task.trackUrl} and release its audio data`, () => {
        this.removeTask(task.id);
      }, "secondary-button"));
    }

    if (actions.childElementCount > 0) item.append(actions);
    return item;
  }

  private async playTask(taskId: AudioTaskId): Promise<void> {
    const viewModel = this.tasks.get(taskId);
    if (!viewModel?.buffer || viewModel.task.status !== "completed" || viewModel.task.signal.aborted
      || viewModel.playbackId || this.pendingPlays.has(taskId)) return;

    const buffer = viewModel.buffer;
    const taskSignal = viewModel.task.signal;
    this.pendingPlays.add(taskId);
    this.renderTasks();
    try {
      const audioContext = this.queue.getAudioContext();
      if (audioContext.state === "suspended") await audioContext.resume();
      if (this.disposed || taskSignal.aborted) return;
      const current = this.tasks.get(taskId);
      if (!current || current.buffer !== buffer || current.task.signal.aborted) return;

      this.playback ??= new AudioPlayback(audioContext);
      if (!this.visualizer) this.createVisualizer(false);

      let playbackId: AudioPlaybackId | null = null;
      playbackId = this.playback.play(buffer, taskSignal, () => {
        if (playbackId) this.onPlaybackFinished(taskId, playbackId);
      });
      if (!playbackId) return;

      if (current.task.signal.aborted || this.disposed) {
        this.playback.stop(playbackId);
        return;
      }
      current.playbackId = playbackId;
      this.visualizer?.start();
      this.announce(`Playing ${current.task.trackUrl}.`);
      this.renderTasks();
    } catch (error) {
      this.announce(`Could not play ${viewModel.task.trackUrl}: ${errorMessage(error)}`);
    } finally {
      this.pendingPlays.delete(taskId);
      this.renderTasks();
    }
  }

  private createVisualizer(start: boolean): void {
    this.visualizer?.dispose();
    this.visualizer = new AudioVisualizer({
      canvas: this.canvas,
      analyser: this.playback!.analyser,
      frequencyBinCount: Number(this.binsSelect.value) === 512 ? 512 : 256,
    });
    if (start) this.visualizer.start();
  }

  private onPlaybackFinished(taskId: AudioTaskId, playbackId: AudioPlaybackId): void {
    if (this.disposed) return;
    const viewModel = this.tasks.get(taskId);
    if (viewModel?.playbackId === playbackId) viewModel.playbackId = null;
    if ((this.playback?.activeSourceCount ?? 0) === 0) this.visualizer?.stop();
    this.renderTasks();
  }

  private removeTask(taskId: AudioTaskId): void {
    const viewModel = this.tasks.get(taskId);
    if (!viewModel || !isTerminalTask(viewModel.task) || viewModel.playbackId || this.pendingPlays.has(taskId)) return;
    if (!this.queue.forget(taskId)) return;
    viewModel.buffer = null;
    this.tasks.delete(taskId);
    this.renderTasks();
    this.announce(`Removed ${viewModel.task.trackUrl} and released its decoded audio.`);
  }

  private announce(message: string): void {
    if (!this.disposed) this.announcement.textContent = message;
  }
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Demo element not found: ${selector}`);
  return element;
}

function createButton(
  text: string,
  ariaLabel: string,
  onClick: () => void,
  className = "",
): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.setAttribute("aria-label", ariaLabel);
  if (className) button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function getStatusLabel(viewModel: TaskViewModel): string {
  if (viewModel.playbackId) return "Playing";
  switch (viewModel.task.status) {
    case "queued": return "Queued";
    case "running": return "Loading / decoding";
    case "completed": return "Ready";
    case "failed": return "Error";
    case "cancelled": return "Cancelled";
  }
}

function getStatusClass(viewModel: TaskViewModel): string {
  if (viewModel.playbackId) return "playing";
  switch (viewModel.task.status) {
    case "queued": return "queued";
    case "running": return "loading";
    case "completed": return "ready";
    case "failed": return "error";
    case "cancelled": return "cancelled";
  }
}

function isTerminalTask(task: AudioTask): boolean {
  return task.status === "completed" || task.status === "failed" || task.status === "cancelled";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
