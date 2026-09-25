import type { SettingsRepo } from "../db/settings-repo.js";

const KEY = "kill_switch";

/**
 * Interruttore globale: quando attivo, /build-swap non costruisce più alcuna
 * transazione. Lo stato è persistito, così un riavvio non lo disattiva in
 * silenzio (fail-safe). KILL_SWITCH=true in env può solo attivarlo all'avvio;
 * disattivarlo richiede l'endpoint admin.
 */
export class KillSwitch {
  private active: boolean;

  constructor(
    private readonly repo: SettingsRepo,
    forceActiveFromEnv: boolean,
  ) {
    this.active = forceActiveFromEnv || repo.get(KEY) === "true";
    if (forceActiveFromEnv) repo.set(KEY, "true");
  }

  isActive(): boolean {
    return this.active;
  }

  set(active: boolean): void {
    this.active = active;
    this.repo.set(KEY, active ? "true" : "false");
  }
}
