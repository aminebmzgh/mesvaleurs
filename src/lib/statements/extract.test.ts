import { describe, expect, it } from "vitest";
import { extractInstrumentNumber, isRejectionLabel, normalizeLabel } from "./extract";

describe("extractInstrumentNumber — chèques", () => {
  it.each([
    ["CHQ 0001000 SOTRAMA", 1000],
    ["PAIEMENT CHEQUE N°1001", 1001],
    ["Chèque n° 0001017", 1017],
    ["CH N° 1234567", 1234567],
    ["CH. 1234567 FOURNISSEUR", 1234567],
    ["CHEQUE NO.0045678", 45678],
    ["CHEQUE NUMERO 0045679", 45679],
    ["CHQ COMPENSE N° 2345678", 2345678],
    ["CHQ COMPENSE 0002345", 2345],
    ["PAIEMENT CHQ 3456789 PAYE A SOTRAMA", 3456789],
    ["CHEQUES 0001002", 1002],
    ["chq:0001003", 1003],
    ["CHEQUE 1002", 1002],
  ])("%s → %s", (label, number) => {
    expect(extractInstrumentNumber(label)).toEqual({ number, kind: "check" });
  });
});

describe("extractInstrumentNumber — LCN et effets", () => {
  it.each([
    ["REMISE LCN 5000100", 5000100],
    ["LCN N° 5000101 MAGHREB", 5000101],
    ["L.C.N 5000103", 5000103],
    ["EFFET N 5000101", 5000101],
    ["EFFETS 5000104", 5000104],
    ["ECH 5000102 MAGHREB EMBALLAGES", 5000102],
    ["ECH LCN 0005678", 5678],
    ["ECHEANCE EFFET 5000105", 5000105],
    ["PAIEMENT EFF 5000106", 5000106],
  ])("%s → %s", (label, number) => {
    expect(extractInstrumentNumber(label)).toEqual({ number, kind: "lcn" });
  });
});

describe("extractInstrumentNumber — sans numéro", () => {
  it.each([
    "FRAIS TENUE DE COMPTE",
    "VIREMENT RECU CLIENT MARJANE 123456",
    "COMMISSION CHQ",
    "CHQ 12",
    "CHEQUE DU 03/10/2026",
    "CHQ 0000000",
    "PRLV CNSS 2026",
    "RETRAIT GAB 12345",
    "ACHAT CHEZ CHOUKRI 123456",
  ])("%s → aucun", (label) => {
    expect(extractInstrumentNumber(label)).toBeNull();
  });

  it("ne confond pas une date avec un numéro", () => {
    expect(extractInstrumentNumber("CHQ 0310/2026")).toBeNull();
  });
});

describe("normalizeLabel", () => {
  it("retire accents et espaces multiples", () => {
    expect(normalizeLabel("  Chèque   n°  12 ")).toBe("CHEQUE N° 12");
  });
});

describe("isRejectionLabel", () => {
  it.each(["CHQ IMPAYE 0001003", "Chèque impayé n° 1003", "REJET LCN 5000102", "FRAIS RETOUR CHEQUE 1003", "CONTRE-PASSATION CHQ 1003", "EFFET IMPAYES"])(
    "« %s » signale un rejet",
    (label) => {
      expect(isRejectionLabel(label)).toBe(true);
    },
  );

  it.each(["CHQ 0001003 SOTRAMA", "PAIEMENT CHEQUE N°1001", "ECH LCN 5000102", "VIREMENT RECU"])("« %s » n'est pas un rejet", (label) => {
    expect(isRejectionLabel(label)).toBe(false);
  });
});
