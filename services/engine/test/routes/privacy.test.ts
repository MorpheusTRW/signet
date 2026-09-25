import { afterEach, describe, expect, it } from "vitest";
import { createTestApp } from "./helpers.js";

describe("GET /privacy", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;
  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("404 finché titolare ed email non sono configurati", async () => {
    ctx = createTestApp();
    const res = await ctx.app.inject({ method: "GET", url: "/privacy" });
    expect(res.statusCode).toBe(404);
  });

  it("serve la pagina con i dati del titolare, con escape HTML", async () => {
    ctx = createTestApp({
      env: { PRIVACY_CONTROLLER_NAME: "Mario <Rossi>", PRIVACY_CONTACT_EMAIL: "privacy@example.com" },
    });
    const res = await ctx.app.inject({ method: "GET", url: "/privacy" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body).toContain("Mario &lt;Rossi&gt;");
    expect(res.body).toContain("privacy@example.com");
  });
});
