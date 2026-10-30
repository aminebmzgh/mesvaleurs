import { describe, expect, it } from "vitest";
import { parseOrganizationSettings } from "./settings";

const ACCOUNTING_DEFAULTS = {
  journal: "BQ",
  supplierAccount: "44110000",
  bankAccount: "51410000",
  billsAccount: "44150000",
  basis: "debit",
  separator: ";",
  dateFormat: "dd/mm/yyyy",
  decimal: ",",
  header: true,
};

const DEFAULTS = {
  require_mfa: false,
  amount_words_rectified: false,
  uncashed_alert_days: 60,
  low_stock_threshold: 5,
  lcn_alert_days: 7,
  invoice_alert_days: 7,
  approval_threshold: null,
  daily_ceiling: null,
  accounting_export: ACCOUNTING_DEFAULTS,
};

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
      lcn_alert_days: 7,
      invoice_alert_days: 7,
      approval_threshold: null,
      daily_ceiling: null,
      accounting_export: ACCOUNTING_DEFAULTS,
    });
    expect(parseOrganizationSettings({ uncashed_alert_days: 2 }).uncashed_alert_days).toBe(60);
    expect(parseOrganizationSettings({ low_stock_threshold: 10 }).low_stock_threshold).toBe(10);
    expect(parseOrganizationSettings({ low_stock_threshold: 0 }).low_stock_threshold).toBe(5);
  });

  it("ignore un JSON qui n'est pas un objet", () => {
    expect(parseOrganizationSettings([1, 2])).toEqual(DEFAULTS);
  });
});

describe("délais d'alerte", () => {
  it("LCN à échoir et factures proches de la date limite légale", () => {
    expect(parseOrganizationSettings({ lcn_alert_days: 15, invoice_alert_days: 30 })).toMatchObject({ lcn_alert_days: 15, invoice_alert_days: 30 });
    expect(parseOrganizationSettings({ lcn_alert_days: 0, invoice_alert_days: "bientôt" })).toMatchObject({ lcn_alert_days: 7, invoice_alert_days: 7 });
  });
});

describe("double signature", () => {
  it("seuil et plafond facultatifs, valeurs invalides ignorées", () => {
    expect(parseOrganizationSettings({ approval_threshold: 50000, daily_ceiling: 200000 })).toMatchObject({
      approval_threshold: 50000,
      daily_ceiling: 200000,
    });
    expect(parseOrganizationSettings({ approval_threshold: -1, daily_ceiling: "beaucoup" })).toMatchObject({
      approval_threshold: null,
      daily_ceiling: null,
    });
  });
});

describe("export comptable", () => {
  it("valeurs enregistrées, champs invalides remplacés un à un", () => {
    expect(
      parseOrganizationSettings({ accounting_export: { journal: "BNK", basis: "issue", separator: "|", supplierAccount: "4411 000" } }).accounting_export,
    ).toEqual({ ...ACCOUNTING_DEFAULTS, journal: "BNK", basis: "issue" });
    expect(parseOrganizationSettings({ accounting_export: "texte" }).accounting_export).toEqual(ACCOUNTING_DEFAULTS);
  });
});
