import { describe, expect, it } from "vitest";
import { reminderMailto } from "./reminders";

describe("reminderMailto", () => {
  const link = reminderMailto({
    email: "compta@sotrama.ma",
    contactName: "M. Alaoui",
    label: "Chèque 0001002",
    issueDate: "2026-08-08",
    amount: 15600,
    organizationName: "Atlas Distribution SARL",
  });
  const url = new URL(link);

  it("adresse, objet et message pré-remplis", () => {
    expect(url.protocol).toBe("mailto:");
    expect(decodeURIComponent(url.pathname)).toBe("compta@sotrama.ma");
    expect(url.searchParams.get("subject")).toBe("Chèque 0001002 du 08/08/2026 non encaissé");
    const body = url.searchParams.get("body")!;
    expect(body).toMatch(/^Bonjour M\. Alaoui,/);
    expect(body).toMatch(/notre chèque 0001002 de 15\s600,00\sDH, émis le 08\/08\/2026/);
    expect(body.endsWith("Atlas Distribution SARL")).toBe(true);
  });

  it("salutation neutre sans contact", () => {
    const body = new URL(
      reminderMailto({ email: "a@b.ma", contactName: null, label: "Chèque 1", issueDate: "2026-01-01", amount: 1, organizationName: "X" }),
    ).searchParams.get("body")!;
    expect(body.startsWith("Bonjour,")).toBe(true);
  });
});
