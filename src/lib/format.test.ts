import { describe, expect, it } from "vitest";
import { formatAmount, formatDate, formatMAD } from "./format";

// Espace insécable utilisé comme séparateur de milliers
const S = " ";

describe("formatAmount", () => {
  it.each([
    [0, "0,00"],
    [0.01, "0,01"],
    [0.1, "0,10"],
    [1, "1,00"],
    [999.99, "999,99"],
    [1000, `1${S}000,00`],
    [1234.56, `1${S}234,56`],
    [1234567.8, `1${S}234${S}567,80`],
    [100000000, `100${S}000${S}000,00`],
    [-1234.5, `-1${S}234,50`],
  ])("%s → %s", (value, expected) => {
    expect(formatAmount(value)).toBe(expected);
  });

  it("arrondit au centime le plus proche", () => {
    expect(formatAmount(1.005)).toBe("1,01");
    expect(formatAmount(0.1 + 0.2)).toBe("0,30");
    expect(formatAmount(2.344)).toBe("2,34");
  });

  it("n'affiche pas de signe pour un négatif arrondi à zéro", () => {
    expect(formatAmount(-0.001)).toBe("0,00");
  });

  it("refuse les valeurs non finies", () => {
    expect(() => formatAmount(Number.NaN)).toThrow(RangeError);
    expect(() => formatAmount(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});

describe("formatMAD", () => {
  it("ajoute le suffixe DH", () => {
    expect(formatMAD(1234.56)).toBe(`1${S}234,56${S}DH`);
  });
});

describe("formatDate", () => {
  it("formate une date SQL sans décalage de fuseau", () => {
    expect(formatDate("2026-01-01")).toBe("01/01/2026");
    expect(formatDate("2026-12-31")).toBe("31/12/2026");
  });

  it("convertit un instant dans le fuseau de Casablanca", () => {
    // 23 h 30 UTC le 31/12 : déjà le 01/01 à Casablanca (UTC+1)
    expect(formatDate("2026-12-31T23:30:00Z")).toBe("01/01/2027");
    expect(formatDate(new Date("2026-06-15T10:00:00Z"))).toBe("15/06/2026");
  });

  it("refuse une date invalide", () => {
    expect(() => formatDate("pas une date")).toThrow(RangeError);
  });
});
