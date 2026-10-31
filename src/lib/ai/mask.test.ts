import { describe, expect, it } from "vitest";
import { maskPersonalData } from "./mask";

describe("maskPersonalData", () => {
  it("masque e-mails, téléphones, RIB et IBAN", () => {
    const text = [
      "Contact : k.alami@atlas-materiaux.ma",
      "Tél. +212 6 61 23 45 67 / 0522-45-67-89 / 00212522456789",
      "RIB : 007 780 0001234567890123 45",
      "RIB 011780000012345678901234",
      "IBAN MA64 0077 8000 0123 4567 8901 2345",
    ].join("\n");
    expect(maskPersonalData(text)).toBe(
      ["Contact : [e-mail]", "Tél. [téléphone] / [téléphone] / [téléphone]", "RIB : [RIB]", "RIB [RIB]", "IBAN [IBAN]"].join("\n"),
    );
  });

  it("conserve les identifiants d'entreprise, numéros de facture, dates et montants", () => {
    const text = "ICE 001234567000089 · IF 12345678 · RC 98765 · Facture FA-2026-0042 du 15/10/2026 · TTC 12 345,60 DH";
    expect(maskPersonalData(text)).toBe(text);
  });
});
