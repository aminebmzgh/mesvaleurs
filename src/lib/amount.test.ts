import { describe, expect, it } from "vitest";
import { fromCents, parseAmount, toCents } from "./amount";

describe("parseAmount", () => {
  it.each([
    ["1234,56", 1234.56],
    ["1 234,56", 1234.56],
    ["1\u00A0234,56 DH", 1234.56],
    ["1.234,56", 1234.56],
    ["1.234.567,8", 1234567.8],
    ["1234.56", 1234.56],
    ["1.234.567", 1234567],
    ["0,01", 0.01],
    ["15000", 15000],
    ["  42 MAD ", 42],
  ])("%s → %s", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "12,345", "1,2,3", "12.", ",5", "1 234,567"])("refuse %s", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it("refuse les négatifs sauf si autorisés", () => {
    expect(parseAmount("-150,00")).toBeNull();
    expect(parseAmount("-150,00", { allowNegative: true })).toBe(-150);
  });
});

describe("toCents / fromCents", () => {
  it("convertit sans erreur de virgule flottante", () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents(8450.5)).toBe(845050);
    expect(toCents(-12.34)).toBe(-1234);
  });

  it("revient au montant", () => {
    expect(fromCents(123456)).toBe(1234.56);
  });
});
