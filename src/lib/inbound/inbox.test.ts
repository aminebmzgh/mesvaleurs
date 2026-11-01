import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { inboxAddress, isStatementAttachment, storageFileName, tokenFromRecipients, verifyWebhookSignature } from "./inbox";

describe("adresse de réception", () => {
  it("adresse et jeton retrouvé parmi les destinataires", () => {
    expect(inboxAddress("ab12cd34ef56")).toBe("releves-ab12cd34ef56@import.mesvaleurs.ma");
    expect(tokenFromRecipients(["compta@atlas.ma", "Relevés <RELEVES-AB12CD34EF56@import.mesvaleurs.ma>"])).toBe("ab12cd34ef56");
    expect(tokenFromRecipients(["releves-ab12cd34ef56@import.mesvaleurs.ma"])).toBe("ab12cd34ef56");
  });

  it("autre domaine, jeton mal formé ou adresse prolongée : ignorés", () => {
    expect(tokenFromRecipients(["releves-ab12cd34ef56@autre.ma"])).toBeNull();
    expect(tokenFromRecipients(["releves-ab12@import.mesvaleurs.ma"])).toBeNull();
    expect(tokenFromRecipients(["releves-ab12cd34ef56@import.mesvaleurs.ma.evil.com"])).toBeNull();
    expect(tokenFromRecipients(["xreleves-ab12cd34ef56@import.mesvaleurs.ma"])).toBeNull();
  });
});

describe("pièces jointes", () => {
  it("relevés PDF, Excel, CSV et photos ; ni image insérée, ni fichier vide ou trop gros", () => {
    expect(isStatementAttachment({ filename: "Relevé octobre.PDF", size: 1000 })).toBe(true);
    expect(isStatementAttachment({ filename: "export.xlsx", size: 1000, content_disposition: "attachment" })).toBe(true);
    expect(isStatementAttachment({ filename: "logo.png", size: 1000, content_disposition: "inline" })).toBe(false);
    expect(isStatementAttachment({ filename: "virus.exe", size: 1000 })).toBe(false);
    expect(isStatementAttachment({ filename: "vide.csv", size: 0 })).toBe(false);
    expect(isStatementAttachment({ filename: "gros.pdf", size: 30 * 1024 * 1024 })).toBe(false);
    expect(isStatementAttachment({ filename: null, size: 1000 })).toBe(false);
  });

  it("nom de fichier sûr pour le stockage", () => {
    expect(storageFileName("Relevé n°12 (octobre).PDF")).toBe("Releve-n-12-octobre.pdf");
    expect(storageFileName("../../etc.csv")).toBe("etc.csv");
    expect(storageFileName("éé.xlsx")).toBe("ee.xlsx");
  });
});

describe("verifyWebhookSignature", () => {
  const key = Buffer.from("secret-de-test-0123456789");
  const secret = `whsec_${key.toString("base64")}`;
  const body = '{"type":"email.received","data":{"email_id":"e1"}}';
  const now = 1_793_500_000_000;
  const timestamp = String(now / 1000);
  const sign = (content: string) => createHmac("sha256", key).update(content).digest("base64");

  it("signature valide, parmi plusieurs", () => {
    const signature = `v1,${sign("other")} v1,${sign(`msg_1.${timestamp}.${body}`)}`;
    expect(verifyWebhookSignature(secret, { id: "msg_1", timestamp, signature }, body, now)).toBe(true);
  });

  it("corps modifié, autre secret, horodatage trop ancien ou en-têtes manquants : refusé", () => {
    const signature = `v1,${sign(`msg_1.${timestamp}.${body}`)}`;
    expect(verifyWebhookSignature(secret, { id: "msg_1", timestamp, signature }, body.replace("e1", "e2"), now)).toBe(false);
    expect(verifyWebhookSignature(`whsec_${Buffer.from("autre").toString("base64")}`, { id: "msg_1", timestamp, signature }, body, now)).toBe(false);
    expect(verifyWebhookSignature(secret, { id: "msg_1", timestamp, signature }, body, now + 10 * 60_000)).toBe(false);
    expect(verifyWebhookSignature(secret, { id: null, timestamp, signature }, body, now)).toBe(false);
    expect(verifyWebhookSignature(secret, { id: "msg_1", timestamp, signature: "v2,abc" }, body, now)).toBe(false);
  });
});
