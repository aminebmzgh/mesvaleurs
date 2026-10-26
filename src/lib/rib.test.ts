import { describe, expect, it } from "vitest";
import { computeRibKey, formatRib, isValidRib, normalizeRib, parseRib } from "./rib";

// RIB réels fournis pour valider l'algorithme de clé
const REAL_RIBS = ["150500211501441691001583", "150500213301441691000532"];

describe("isValidRib", () => {
  it.each(REAL_RIBS)("accepte le RIB réel %s", (rib) => {
    expect(isValidRib(rib)).toBe(true);
  });

  it("accepte les RIB du jeu de démonstration", () => {
    expect(isValidRib("007780000123456789012396")).toBe(true);
    expect(isValidRib("145780000987654321098721")).toBe(true);
  });

  it("accepte un RIB saisi avec espaces ou tirets", () => {
    expect(isValidRib("150 500 2115014416910015 83")).toBe(true);
    expect(isValidRib("150-500-2115014416910015-83")).toBe(true);
  });

  it("refuse une clé erronée", () => {
    expect(isValidRib("150500211501441691001584")).toBe(false);
  });

  it("refuse une inversion de deux chiffres", () => {
    expect(isValidRib("105500211501441691001583")).toBe(false);
  });

  it.each(["", "12345", "1505002115014416910015830", "15050021150144169100158A"])(
    "refuse le format %s",
    (rib) => {
      expect(isValidRib(rib)).toBe(false);
    },
  );
});

describe("computeRibKey", () => {
  it("retrouve la clé des RIB réels", () => {
    expect(computeRibKey("1505002115014416910015")).toBe("83");
    expect(computeRibKey("1505002133014416910005")).toBe("32");
  });

  it("complète la clé sur deux chiffres", () => {
    const key = computeRibKey("0000000000000000000001");
    expect(key).toHaveLength(2);
    expect(isValidRib(`0000000000000000000001${key}`)).toBe(true);
  });

  it("refuse une longueur incorrecte", () => {
    expect(() => computeRibKey("123")).toThrow(RangeError);
  });
});

describe("parseRib / formatRib", () => {
  it("découpe banque, ville, compte et clé", () => {
    expect(parseRib(REAL_RIBS[0])).toEqual({
      bankCode: "150",
      cityCode: "500",
      accountNumber: "2115014416910015",
      key: "83",
    });
  });

  it("renvoie null pour un RIB invalide", () => {
    expect(parseRib("000")).toBeNull();
  });

  it("formate par blocs", () => {
    expect(formatRib(REAL_RIBS[1])).toBe("150 500 2133014416910005 32");
  });

  it("normalise la saisie", () => {
    expect(normalizeRib(" 150.500 2115 014416910015-83 ")).toBe(REAL_RIBS[0]);
  });
});
