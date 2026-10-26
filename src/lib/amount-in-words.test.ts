import { describe, expect, it } from "vitest";
import { amountInWords, MAX_AMOUNT_IN_WORDS } from "./amount-in-words";

describe("amountInWords — orthographe traditionnelle", () => {
  it.each([
    // Zéro, unités, singulier / pluriel
    [0, "Zéro dirham"],
    [1, "Un dirham"],
    [2, "Deux dirhams"],
    [16, "Seize dirhams"],
    [17, "Dix-sept dirhams"],
    [19, "Dix-neuf dirhams"],
    // Dizaines et « et un »
    [20, "Vingt dirhams"],
    [21, "Vingt et un dirhams"],
    [22, "Vingt-deux dirhams"],
    [31, "Trente et un dirhams"],
    [41, "Quarante et un dirhams"],
    [51, "Cinquante et un dirhams"],
    [61, "Soixante et un dirhams"],
    [69, "Soixante-neuf dirhams"],
    // 70 à 99
    [70, "Soixante-dix dirhams"],
    [71, "Soixante et onze dirhams"],
    [72, "Soixante-douze dirhams"],
    [77, "Soixante-dix-sept dirhams"],
    [79, "Soixante-dix-neuf dirhams"],
    [80, "Quatre-vingts dirhams"],
    [81, "Quatre-vingt-un dirhams"],
    [85, "Quatre-vingt-cinq dirhams"],
    [90, "Quatre-vingt-dix dirhams"],
    [91, "Quatre-vingt-onze dirhams"],
    [99, "Quatre-vingt-dix-neuf dirhams"],
    // Centaines : accord de « cent »
    [100, "Cent dirhams"],
    [101, "Cent un dirhams"],
    [110, "Cent dix dirhams"],
    [180, "Cent quatre-vingts dirhams"],
    [200, "Deux cents dirhams"],
    [201, "Deux cent un dirhams"],
    [280, "Deux cent quatre-vingts dirhams"],
    [300, "Trois cents dirhams"],
    [999, "Neuf cent quatre-vingt-dix-neuf dirhams"],
    // Milliers : « mille » invariable, sans « un »
    [1000, "Mille dirhams"],
    [1001, "Mille un dirhams"],
    [1100, "Mille cent dirhams"],
    [2000, "Deux mille dirhams"],
    [21000, "Vingt et un mille dirhams"],
    [80000, "Quatre-vingt mille dirhams"],
    [81000, "Quatre-vingt-un mille dirhams"],
    [100000, "Cent mille dirhams"],
    [200000, "Deux cent mille dirhams"],
    [280000, "Deux cent quatre-vingt mille dirhams"],
    [999999, "Neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf dirhams"],
    // Millions et milliards : noms, accord et « de »
    [1_000_000, "Un million de dirhams"],
    [1_000_001, "Un million un dirhams"],
    [1_200_000, "Un million deux cent mille dirhams"],
    [2_000_000, "Deux millions de dirhams"],
    [3_500_250, "Trois millions cinq cent mille deux cent cinquante dirhams"],
    [80_000_000, "Quatre-vingts millions de dirhams"],
    [200_000_000, "Deux cents millions de dirhams"],
    [1_000_000_000, "Un milliard de dirhams"],
    [2_000_000_001, "Deux milliards un dirhams"],
    [2_001_000_000, "Deux milliards un million de dirhams"],
  ])("%s → %s", (amount, expected) => {
    expect(amountInWords(amount)).toBe(expected);
  });

  it.each([
    [0.01, "Un centime"],
    [0.5, "Cinquante centimes"],
    [0.21, "Vingt et un centimes"],
    [0.8, "Quatre-vingts centimes"],
    [0.99, "Quatre-vingt-dix-neuf centimes"],
    [1.01, "Un dirham et un centime"],
    [12.8, "Douze dirhams et quatre-vingts centimes"],
    [1234.56, "Mille deux cent trente-quatre dirhams et cinquante-six centimes"],
    [8450.5, "Huit mille quatre cent cinquante dirhams et cinquante centimes"],
    [2_000_000.75, "Deux millions de dirhams et soixante-quinze centimes"],
  ])("centimes : %s → %s", (amount, expected) => {
    expect(amountInWords(amount)).toBe(expected);
  });

  it.each([
    [15600, "Quinze mille six cents dirhams"],
    [48000, "Quarante-huit mille dirhams"],
    [120000, "Cent vingt mille dirhams"],
    [24000, "Vingt-quatre mille dirhams"],
  ])("montants du jeu de démonstration : %s → %s", (amount, expected) => {
    expect(amountInWords(amount)).toBe(expected);
  });
});

describe("amountInWords — orthographe rectifiée de 1990", () => {
  it.each([
    [21, "Vingt-et-un dirhams"],
    [71, "Soixante-et-onze dirhams"],
    [200, "Deux-cents dirhams"],
    [1234.56, "Mille-deux-cent-trente-quatre dirhams et cinquante-six centimes"],
    [200000, "Deux-cent-mille dirhams"],
    [0.21, "Vingt-et-un centimes"],
    [1_000_000, "Un million de dirhams"],
    [2_300_000, "Deux millions trois-cent-mille dirhams"],
    [200_000_080, "Deux-cents millions quatre-vingts dirhams"],
  ])("%s → %s", (amount, expected) => {
    expect(amountInWords(amount, { rectified: true })).toBe(expected);
  });
});

describe("amountInWords — cas limites", () => {
  it("arrondit au centime le plus proche", () => {
    expect(amountInWords(10.005)).toBe("Dix dirhams et un centime");
    expect(amountInWords(0.1 + 0.2)).toBe("Trente centimes");
  });

  it("accepte le montant maximal", () => {
    expect(amountInWords(MAX_AMOUNT_IN_WORDS)).toBe(
      "Neuf cent quatre-vingt-dix-neuf milliards neuf cent quatre-vingt-dix-neuf millions " +
        "neuf cent quatre-vingt-dix-neuf mille neuf cent quatre-vingt-dix-neuf dirhams " +
        "et quatre-vingt-dix-neuf centimes",
    );
  });

  it("sans majuscule initiale si demandé", () => {
    expect(amountInWords(81, { capitalize: false })).toBe("quatre-vingt-un dirhams");
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 1_000_000_000_000])("refuse %s", (amount) => {
    expect(() => amountInWords(amount)).toThrow(RangeError);
  });
});
