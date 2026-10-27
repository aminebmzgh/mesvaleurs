import { describe, expect, it } from "vitest";
import { isActiveLink, navigationFor } from "./navigation";

const hrefs = ["/paiements", "/paiements/nouveau", "/factures"];

describe("isActiveLink", () => {
  it("active le lien exact", () => {
    expect(isActiveLink("/factures", "/factures", hrefs)).toBe(true);
  });

  it("active le parent pour une sous-page sans lien dédié", () => {
    expect(isActiveLink("/paiements/123", "/paiements", hrefs)).toBe(true);
  });

  it("préfère le lien le plus précis", () => {
    expect(isActiveLink("/paiements/nouveau", "/paiements", hrefs)).toBe(false);
    expect(isActiveLink("/paiements/nouveau", "/paiements/nouveau", hrefs)).toBe(true);
  });

  it("ne confond pas des préfixes de mots", () => {
    expect(isActiveLink("/facturesX", "/factures", hrefs)).toBe(false);
  });
});

describe("navigationFor", () => {
  const hrefsFor = (role: Parameters<typeof navigationFor>[0]) => navigationFor(role).flatMap((s) => s.items.map((i) => i.href));

  it("journal d'audit réservé à la direction et à la comptabilité", () => {
    expect(hrefsFor("admin")).toContain("/journal");
    expect(hrefsFor("accountant")).toContain("/journal");
    expect(hrefsFor("preparer")).not.toContain("/journal");
  });

  it("rôle inconnu : seuls les liens ouverts à tous", () => {
    expect(hrefsFor(null)).not.toContain("/journal");
    expect(hrefsFor(null)).toContain("/factures");
  });
});
