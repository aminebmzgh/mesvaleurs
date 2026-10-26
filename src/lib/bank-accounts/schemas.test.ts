import { describe, expect, it } from "vitest";
import { bankAccountSchema, checkbookSchema, numberWidthFromInput } from "./schemas";

const BANK_ID = "4f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f";

describe("bankAccountSchema", () => {
  it("accepte un compte complet et normalise RIB et solde", () => {
    const result = bankAccountSchema.parse({
      bank_id: BANK_ID,
      label: " Compte principal ",
      branch: "",
      rib: "150 500 2115014416910015 83",
      opening_balance: "-1 250,50",
      opening_balance_date: "2026-10-01",
    });
    expect(result).toEqual({
      bank_id: BANK_ID,
      label: "Compte principal",
      branch: null,
      rib: "150500211501441691001583",
      opening_balance: -1250.5,
      opening_balance_date: "2026-10-01",
    });
  });

  it("signale banque manquante, RIB invalide et solde illisible", () => {
    const result = bankAccountSchema.safeParse({
      bank_id: "",
      label: "X",
      rib: "150500211501441691001584",
      opening_balance: "douze",
    });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["bank_id", "rib", "opening_balance"]));
  });
});

describe("checkbookSchema", () => {
  it("accepte un chéquier de 50 formules", () => {
    expect(checkbookSchema.parse({ type: "check", first_number: "0001000", last_number: "0001049" })).toMatchObject({
      first_number: 1000,
      last_number: 1049,
    });
  });

  it("refuse une plage inversée", () => {
    const result = checkbookSchema.safeParse({ type: "check", first_number: "1049", last_number: "1000" });
    expect(result.error?.issues[0].path).toEqual(["last_number"]);
  });

  it("refuse un carnet de plus de 1000 formules (faute de frappe)", () => {
    expect(checkbookSchema.safeParse({ type: "lcn", first_number: "1", last_number: "1001" }).success).toBe(false);
    expect(checkbookSchema.safeParse({ type: "lcn", first_number: "1", last_number: "1000" }).success).toBe(true);
  });

  it("refuse un type inconnu", () => {
    expect(checkbookSchema.safeParse({ type: "virement", first_number: "1", last_number: "2" }).success).toBe(false);
  });
});

describe("numberWidthFromInput", () => {
  it("conserve les zéros initiaux saisis", () => {
    expect(numberWidthFromInput("0001000", "0001049")).toBe(7);
    expect(numberWidthFromInput("98", "120")).toBe(3);
  });

  it("borne la largeur", () => {
    expect(numberWidthFromInput("", "")).toBe(1);
    expect(numberWidthFromInput("0000000000000001", "2")).toBe(12);
  });
});
