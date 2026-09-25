import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";
import { HeliusEventSource } from "../../src/ingest/helius/helius-event-source.js";
import type { RawTransaction } from "../../src/ingest/helius/parse-create-pool.js";
import type { RawLaunchEvent } from "../../src/ingest/event-source.js";
import { buildSignal } from "../../src/signals/build-signal.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/pump-migrate-tx.json", import.meta.url), "utf8"),
) as RawTransaction;

const MINT = "65gyEJ4kWQm2HHHFkqKuX2d5D3eL7gEMku7vv7eYpump";

function fakeRpc(overrides: { tx?: (attempt: number) => RawTransaction | null } = {}) {
  let txAttempt = 0;
  const calls: string[] = [];
  const rpc = vi.fn(async (method: string, params: unknown[]) => {
    calls.push(method);
    switch (method) {
      case "getTransaction":
        return overrides.tx ? overrides.tx(txAttempt++) : fixture;
      case "getAccountInfo": {
        if (params[0] === MINT) {
          return {
            value: {
              data: {
                parsed: {
                  info: {
                    mintAuthority: null,
                    freezeAuthority: null,
                    supply: "1000000000000",
                    decimals: 6,
                    extensions: [{ extension: "tokenMetadata", state: { name: "green cat", symbol: "CAT" } }],
                  },
                },
              },
            },
          };
        }
        return { value: null };
      }
      case "getTokenLargestAccounts":
        return {
          value: [
            { address: "POOLVAULT", amount: "800000000000" }, // vault della pool: escluso
            { address: "A", amount: "100000000000" }, // 10%
            { address: "B", amount: "50000000000" }, // 5%
          ],
        };
      case "getSignaturesForAddress":
        return [{ signature: "s", blockTime: Math.floor(Date.now() / 1000) - 30 * 86_400 }];
      default:
        throw new Error(`unexpected ${method}`);
    }
  });
  return { rpc: rpc as never, calls };
}

function makeSource(rpc: never, extra: Partial<ConstructorParameters<typeof HeliusEventSource>[0]> = {}) {
  const socket = Object.assign(new EventEmitter(), { send: vi.fn(), ping: vi.fn(), close: vi.fn() });
  const source = new HeliusEventSource({
    wsUrl: "wss://fake",
    rpc,
    logger: { info: vi.fn(), warn: vi.fn() },
    createWebSocket: () => socket as unknown as WebSocket,
    sleep: async () => {},
    ...extra,
  });
  return { source, socket };
}

const notification = (signature: string, logs: string[], err: unknown = null) =>
  JSON.stringify({
    jsonrpc: "2.0",
    method: "logsNotification",
    params: { result: { value: { signature, err, logs } } },
  });

const CREATE_POOL_LOGS = ["Program log: Instruction: Migrate", "Program log: Instruction: CreatePool"];

describe("HeliusEventSource", () => {
  it("sottoscrive logsSubscribe sul wallet di migrazione all'apertura", () => {
    const { source, socket } = makeSource(fakeRpc().rpc);
    source.start(() => {});
    socket.emit("open");
    const sent = JSON.parse(socket.send.mock.calls[0]![0] as string);
    expect(sent.method).toBe("logsSubscribe");
    expect(sent.params[0].mentions).toEqual(["39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"]);
    source.stop();
  });

  it("trasforma una migrazione in un RawLaunchEvent arricchito e segnalato come non verificato", async () => {
    const events: RawLaunchEvent[] = [];
    const { source } = makeSource(fakeRpc().rpc);
    source.start((e) => events.push(e));
    await source.handleMessage(notification("SIG1", CREATE_POOL_LOGS));

    expect(events).toHaveLength(1);
    const e = events[0]!;
    expect(e.program).toBe("pumpswap");
    expect(e.tokenMint).toBe(MINT);
    expect(e.tokenSymbol).toBe("CAT");
    expect(e.initialLiquiditySol).toBeCloseTo(0.637116159, 9);
    expect(e.mintAuthorityRevoked).toBe(true);
    expect(e.devWalletHistory.walletAgeDays).toBe(30);
    expect(e.unverified).toEqual(["dev-history", "snipes"]);
    source.stop();
  });

  it("il signal risultante non dichiara 'Dev pulito' né 'Nessuno snipe' per aspetti non verificati", async () => {
    const events: RawLaunchEvent[] = [];
    const { source } = makeSource(fakeRpc().rpc);
    source.start((e) => events.push(e));
    await source.handleMessage(notification("SIG1", CREATE_POOL_LOGS));
    const signal = buildSignal(events[0]!);
    expect(signal.summary).not.toContain("Dev pulito");
    expect(signal.summary).not.toContain("Nessuno snipe");
    expect(signal.summary).toContain("non verificat");
    source.stop();
  });

  it("ignora tx fallite, senza CreatePool e duplicati", async () => {
    const { rpc, calls } = fakeRpc();
    const events: RawLaunchEvent[] = [];
    const { source } = makeSource(rpc);
    source.start((e) => events.push(e));
    await source.handleMessage(notification("F", CREATE_POOL_LOGS, { InstructionError: [0, "x"] }));
    await source.handleMessage(notification("N", ["Program log: Instruction: MigrateV2", "Bonding curve already migrated"]));
    expect(calls).toHaveLength(0);
    await source.handleMessage(notification("D", CREATE_POOL_LOGS));
    await source.handleMessage(notification("D", CREATE_POOL_LOGS));
    expect(events).toHaveLength(1);
    source.stop();
  });

  it("riprova se la tx non è ancora indicizzata", async () => {
    const { rpc } = fakeRpc({ tx: (attempt) => (attempt < 2 ? null : fixture) });
    const events: RawLaunchEvent[] = [];
    const { source } = makeSource(rpc);
    source.start((e) => events.push(e));
    await source.handleMessage(notification("R", CREATE_POOL_LOGS));
    expect(events).toHaveLength(1);
    source.stop();
  });

  it("scarta l'evento se la tx non compare mai", async () => {
    const { rpc } = fakeRpc({ tx: () => null });
    const events: RawLaunchEvent[] = [];
    const { source } = makeSource(rpc);
    source.start((e) => events.push(e));
    await source.handleMessage(notification("X", CREATE_POOL_LOGS));
    expect(events).toHaveLength(0);
    source.stop();
  });
});
