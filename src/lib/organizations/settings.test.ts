import { describe, expect, it } from "vitest";
import { parseOrganizationSettings } from "./settings";

describe("parseOrganizationSettings", () => {
  it("applique les valeurs par défaut", () => {
    expect(parseOrganizationSettings({})).toEqual({ require_mfa: false, amount_words_rectified: false });
    expect(parseOrganizationSettings(null)).toEqual({ require_mfa: false, amount_words_rectified: false });
  });

  it("lit les valeurs enregistrées et ignore les valeurs invalides", () => {
    expect(parseOrganizationSettings({ require_mfa: true, amount_words_rectified: "oui" })).toEqual({
      require_mfa: true,
      amount_words_rectified: false,
    });
  });

  it("ignore un JSON qui n'est pas un objet", () => {
    expect(parseOrganizationSettings([1, 2])).toEqual({ require_mfa: false, amount_words_rectified: false });
  });
});
