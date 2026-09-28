import { describe, expect, it, vi } from "vitest";
import { fetchTokenImage, IPFS_GATEWAY, normalizeImageUrl } from "../../src/ingest/helius/token-image.js";

describe("normalizeImageUrl", () => {
  it("riscrive ogni riferimento IPFS sul gateway funzionante", () => {
    expect(normalizeImageUrl("https://ipfs.io/ipfs/QmABC")).toBe(`${IPFS_GATEWAY}QmABC`);
    expect(normalizeImageUrl("ipfs://bafyXYZ")).toBe(`${IPFS_GATEWAY}bafyXYZ`);
    expect(normalizeImageUrl("ipfs://ipfs/bafyXYZ")).toBe(`${IPFS_GATEWAY}bafyXYZ`);
  });

  it("mantiene https non-IPFS e scarta tutto il resto", () => {
    expect(normalizeImageUrl("https://pbs.twimg.com/a.jpg")).toBe("https://pbs.twimg.com/a.jpg");
    expect(normalizeImageUrl("http://evil.test/a.png")).toBeUndefined();
    expect(normalizeImageUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeImageUrl(`https://x.test/${"a".repeat(600)}`)).toBeUndefined();
    expect(normalizeImageUrl(42)).toBeUndefined();
  });
});

describe("fetchTokenImage", () => {
  it("legge il campo image dal JSON dei metadati (via gateway)", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ image: "https://ipfs.io/ipfs/QmIMG" })));
    const image = await fetchTokenImage("https://ipfs.io/ipfs/QmMETA", fetchMock as unknown as typeof fetch);
    expect(fetchMock.mock.calls[0]![0]).toBe(`${IPFS_GATEWAY}QmMETA`);
    expect(image).toBe(`${IPFS_GATEWAY}QmIMG`);
  });

  it("undefined se il gateway fallisce", async () => {
    const fetchMock = vi.fn(async () => new Response("err", { status: 502 }));
    expect(await fetchTokenImage("ipfs://QmMETA", fetchMock as unknown as typeof fetch)).toBeUndefined();
  });
});
