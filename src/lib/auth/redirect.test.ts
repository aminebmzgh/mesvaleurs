import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./redirect";

describe("safeRedirectPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeRedirectPath("/fournisseurs")).toBe("/fournisseurs");
    expect(safeRedirectPath("/factures?statut=impayee")).toBe("/factures?statut=impayee");
  });

  it.each([
    "https://exemple.com",
    "//exemple.com",
    "/\\exemple.com",
    "javascript:alert(1)",
    "",
    null,
    undefined,
    42,
  ])("refuse %s", (value) => {
    expect(safeRedirectPath(value)).toBe("/tableau-de-bord");
  });
});
