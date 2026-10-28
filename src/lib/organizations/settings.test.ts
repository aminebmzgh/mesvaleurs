import { describe, expect, it } from "vitest";
import { parseOrganizationSettings } from "./settings";

describe("parseOrganizationSettings", () => {
  it("applique les valeurs par défaut", () => {
    expect(parseOrganizationSettings({})).toEqual({ require_mfa: false, amount_words_rectified: false, uncashed_alert_days: 60 });
    expect(parseOrganizationSettings(null)).toEqual({ require_mfa: false, amount_words_rectified: false, uncashed_alert_days: 60 });
  });

  it("lit les valeurs enregistrées et ignore les valeurs invalides", () => {
    expect(parseOrganizationSettings({ require_mfa: true, amount_words_rectified: "oui", uncashed_alert_days: 90 })).toEqual({
      require_mfa: true,
      amount_words_rectified: false,
      uncashed_alert_days: 90,
    });
    expect(parseOrganizationSettings({ uncashed_alert_days: 2 }).uncashed_alert_days).toBe(60);
  });

  it("ignore un JSON qui n'est pas un objet", () => {
    expect(parseOrganizationSettings([1, 2])).toEqual({ require_mfa: false, amount_words_rectified: false, uncashed_alert_days: 60 });
  });
});
