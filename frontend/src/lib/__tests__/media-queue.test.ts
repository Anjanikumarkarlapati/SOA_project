import { describe, expect, it } from "vitest";
import { createMemoryMediaStore, getDefaultMediaStore } from "@/lib/media-queue";

describe("media-queue", () => {
  it("stores, retrieves, deletes, and clears blobs in memory store", async () => {
    const store = createMemoryMediaStore();
    const blob = new Blob(["leaf-bytes"], { type: "image/jpeg" });

    await store.put("media-1", blob);
    const loaded = await store.get("media-1");
    expect(loaded).not.toBeNull();
    expect(await loaded?.text()).toBe("leaf-bytes");

    await store.delete("media-1");
    expect(await store.get("media-1")).toBeNull();

    await store.put("media-2", blob);
    await store.put("media-3", blob);
    await store.clearAll();
    expect(await store.get("media-2")).toBeNull();
    expect(await store.get("media-3")).toBeNull();
  });

  it("provides a working default store even in environments without indexedDB", async () => {
    const store = getDefaultMediaStore();
    const blob = new Blob(["fallback-test"], { type: "image/jpeg" });
    await store.put("test-key", blob);
    const fetched = await store.get("test-key");
    expect(await fetched?.text()).toBe("fallback-test");
    await store.clearAll();
    expect(await store.get("test-key")).toBeNull();
  });
});
