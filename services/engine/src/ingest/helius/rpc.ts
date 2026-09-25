/** Chiamata JSON-RPC minimale, iniettabile nei test (nessun Connection: serve il JSON grezzo). */
export type RpcCall = <T>(method: string, params: unknown[]) => Promise<T>;

export function createRpcCall(url: string, fetchImpl: typeof fetch = fetch): RpcCall {
  let id = 0;
  return async <T>(method: string, params: unknown[]): Promise<T> => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
    });
    if (!response.ok) throw new Error(`RPC ${method} -> HTTP ${response.status}`);
    const json = (await response.json()) as { result?: T; error?: { message: string } };
    if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
    return json.result as T;
  };
}
