import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { emailConfig, sendEmails } = await import("./send");

const message = (to: string) => ({ to, subject: "Alertes", text: "texte", html: "<p>html</p>" });
const config = { apiKey: "re_test", from: "MesValeurs <alertes@exemple.ma>" };

describe("emailConfig", () => {
  it("désactivé sans clé ou sans expéditeur", () => {
    expect(emailConfig({ RESEND_API_KEY: "re_x" })).toBeNull();
    expect(emailConfig({ EMAIL_FROM: "a@b.ma", RESEND_API_KEY: " " })).toBeNull();
    expect(emailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "a@b.ma" })).toEqual({ apiKey: "re_x", from: "a@b.ma" });
  });
});

describe("sendEmails", () => {
  it("sans configuration : rien n'est envoyé", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    expect(await sendEmails([message("a@b.ma")], { idempotencyKey: "k", config: null, fetchImpl })).toEqual({ status: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("un destinataire par message, par lots de 100, avec clé d'idempotence", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response("{}", { status: 200 }));
    const messages = Array.from({ length: 150 }, (_, i) => message(`m${i}@b.ma`));
    expect(await sendEmails(messages, { idempotencyKey: "alertes/org/2026-10-29", config, fetchImpl })).toEqual({ status: "sent", count: 150 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe("https://api.resend.com/emails/batch");
    expect((init?.headers as Record<string, string>)["Idempotency-Key"]).toBe("alertes/org/2026-10-29/1");
    const body = JSON.parse(String(init?.body));
    expect(body).toHaveLength(50);
    expect(body[0]).toEqual({ from: config.from, to: ["m100@b.ma"], subject: "Alertes", text: "texte", html: "<p>html</p>" });
  });

  it("erreur de l'API ou du réseau : échec signalé", async () => {
    const refused = vi.fn<typeof fetch>(async () => new Response("domain not verified", { status: 403 }));
    expect(await sendEmails([message("a@b.ma")], { idempotencyKey: "k", config, fetchImpl: refused })).toEqual({
      status: "failed",
      error: "Resend 403 domain not verified",
    });
    const offline = vi.fn<typeof fetch>(async () => {
      throw new Error("fetch failed");
    });
    expect(await sendEmails([message("a@b.ma")], { idempotencyKey: "k", config, fetchImpl: offline })).toEqual({ status: "failed", error: "fetch failed" });
  });
});
