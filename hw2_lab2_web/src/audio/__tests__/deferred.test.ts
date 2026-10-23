import { describe, expect, it } from "vitest";
import { createDeferred } from "./deferred";

describe("createDeferred", () => {
  it("allows an async operation to be resolved by the test", async () => {
    const deferred = createDeferred<number>();
    deferred.resolve(42);

    await expect(deferred.promise).resolves.toBe(42);
  });

  it("allows an async operation to be rejected by the test", async () => {
    const deferred = createDeferred<string>();
    const reason = new Error("expected failure");
    deferred.reject(reason);

    await expect(deferred.promise).rejects.toBe(reason);
  });
});