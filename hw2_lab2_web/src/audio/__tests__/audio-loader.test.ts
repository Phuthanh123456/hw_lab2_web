import { describe, expect, it, vi } from "vitest";
import { AudioHttpError, AudioNetworkError, createAudioDataLoader } from "../audio-loader";

function responseFor(value: string, status = 200): Response {
  return new Response(new TextEncoder().encode(value), { status });
}

describe("createAudioDataLoader", () => {
  it("passes the supplied AbortSignal to fetch and returns response bytes", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      expect(init?.signal).toBe(controller.signal);
      return responseFor("audio-bytes");
    });
    const load = createAudioDataLoader(fetcher);

    const bytes = await load("/track.wav", controller.signal);

    expect(new TextDecoder().decode(bytes)).toBe("audio-bytes");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports a non-success HTTP response with its status", async () => {
    const load = createAudioDataLoader(async () => responseFor("unavailable", 503));

    await expect(load("/track.wav", new AbortController().signal)).rejects.toBeInstanceOf(AudioHttpError);
  });

  it("normalizes network failures", async () => {
    const load = createAudioDataLoader(async () => {
      throw new TypeError("offline");
    });

    await expect(load("/track.wav", new AbortController().signal)).rejects.toBeInstanceOf(
      AudioNetworkError,
    );
  });
});