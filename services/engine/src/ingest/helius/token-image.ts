/**
 * Immagine del token dai metadati off-chain (JSON con campo `image`).
 *
 * I gateway IPFS pubblici storici (ipfs.io, dweb.link, gateway.pinata.cloud) nel 2026
 * rispondono solo a service worker di browser e non servono più file a client normali;
 * verificato dal vivo il 2026-09-28 che ipfs.filebase.io risponde (200, <0,2 s). Ogni
 * riferimento IPFS (ipfs://CID o https://qualunque-gateway/ipfs/CID) viene quindi
 * riscritto su quel gateway. Le immagini fuori IPFS (es. pbs.twimg.com) restano come
 * sono, purché https.
 */
export const IPFS_GATEWAY = "https://ipfs.filebase.io/ipfs/";
const MAX_URL_LENGTH = 512;
const FETCH_TIMEOUT_MS = 4000;

export function normalizeImageUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  const ipfsPath = value.match(/^ipfs:\/\/(?:ipfs\/)?(.+)$/i)?.[1] ?? value.match(/^https?:\/\/[^/]+\/ipfs\/(.+)$/i)?.[1];
  const url = ipfsPath ? IPFS_GATEWAY + ipfsPath : value;
  if (!url.startsWith("https://") || url.length > MAX_URL_LENGTH) return undefined;
  try {
    new URL(url);
  } catch {
    return undefined;
  }
  return url;
}

/** Scarica il JSON dei metadati e ne estrae l'immagine; undefined su qualsiasi errore (non blocca il segnale). */
export async function fetchTokenImage(uri: string, fetchImpl: typeof fetch = fetch): Promise<string | undefined> {
  const metadataUrl = normalizeImageUrl(uri);
  if (!metadataUrl) return undefined;
  try {
    const response = await fetchImpl(metadataUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!response.ok) return undefined;
    const json = (await response.json()) as { image?: unknown };
    return normalizeImageUrl(json.image);
  } catch {
    return undefined;
  }
}
