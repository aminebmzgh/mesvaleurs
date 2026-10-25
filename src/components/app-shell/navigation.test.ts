import { describe, expect, it } from "vitest";
import { isActiveLink } from "./navigation";

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
