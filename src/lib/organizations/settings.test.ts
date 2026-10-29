import { describe, expect, it } from "vitest";
import { parseOrganizationSettings } from "./settings";

const DEFAULTS = { require_mfa: false, amount_words_rectified: false, uncashed_alert_days: 60, low_stock_threshold: 5 };

describe("parseOrganizationSettings", () => {
  it("applique les valeurs par défaut", () => {
    expect(parseOrganizationSettings({})).toEqual(DEFAULTS);
    expect(parseOrganizationSettings(null)).toEqual(DEFAULTS);
  });

  it("lit les valeurs enregistrées et ignore les valeurs invalides", () => {
    expect(parseOrganizationSettings({ require_mfa: true, amount_words_rectified: "oui", uncashed_alert_days: 90 })).toEqual({
      require_mfa: true,
      amount_words_rectified: false,
      uncashed_alert_days: 90,
      low_stock_threshold: 5,
    });
    expect(parseOrganizationSettings({ uncashed_alert_days: 2 }).uncashed_alert_days).toBe(60);
    expect(parseOrganizationSettings({ low_stock_threshold: 10 }).low_stock_threshold).toBe(10);
    expect(parseOrganizationSettings({ low_stock_threshold: 0 }).low_stock_threshold).toBe(5);
  });

  it("ignore un JSON qui n'est pas un objet", () => {
    expect(parseOrganizationSettings([1, 2])).toEqual(DEFAULTS);
  });
});
