export type AudioDataLoader = (
  trackUrl: string,
  signal: AbortSignal,
) => Promise<ArrayBuffer>;

export class AudioNetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AudioNetworkError";
  }
}

export class AudioHttpError extends Error {
  readonly status: number;

  constructor(trackUrl: string, status: number, statusText: string) {
    super(`Audio request failed (${status}${statusText ? ` ${statusText}` : ""}): ${trackUrl}`);
    this.name = "AudioHttpError";
    this.status = status;
  }
}

export function createAudioDataLoader(fetcher: typeof fetch = globalThis.fetch): AudioDataLoader {
  return async (trackUrl, signal) => {
    let response: Response;

    try {
      response = await fetcher(trackUrl, { signal });
    } catch (cause) {
      if (signal.aborted) throw cause;
      throw new AudioNetworkError(`Could not fetch audio track: ${trackUrl}`, { cause });
    }

    if (!response.ok) {
      throw new AudioHttpError(trackUrl, response.status, response.statusText);
    }

    try {
      return await response.arrayBuffer();
    } catch (cause) {
      if (signal.aborted) throw cause;
      throw new AudioNetworkError(`Could not read audio response: ${trackUrl}`, { cause });
    }
  };
}