import { describe, expect, it } from "vitest";
import { fromExclTax, fromInclTax } from "./vat";

describe("TVA à 20 %", () => {
  it("depuis le HT", () => {
    expect(fromExclTax(1_000_000)).toEqual({ vatCents: 200_000, inclCents: 1_200_000 });
    // 0,33 DH HT → TVA 0,066 arrondie à 0,07
    expect(fromExclTax(33)).toEqual({ vatCents: 7, inclCents: 40 });
  });

  it("depuis le TTC, HT + TVA = TTC au centime près", () => {
    expect(fromInclTax(1_200_000)).toEqual({ exclCents: 1_000_000, vatCents: 200_000 });
    // 12 500,00 TTC → 10 416,67 HT + 2 083,33 TVA
    expect(fromInclTax(1_250_000)).toEqual({ exclCents: 1_041_667, vatCents: 208_333 });
    for (const incl of [1, 99, 12_345, 4_800_000]) {
      const { exclCents, vatCents } = fromInclTax(incl);
      expect(exclCents + vatCents).toBe(incl);
    }
  });

  it("autre taux", () => {
    expect(fromExclTax(10_000, 10)).toEqual({ vatCents: 1_000, inclCents: 11_000 });
    expect(fromInclTax(10_700, 7)).toEqual({ exclCents: 10_000, vatCents: 700 });
  });
});
