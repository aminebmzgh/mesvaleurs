import { describe, expect, it } from "vitest";
import { availableCount, availableNumbers, formatInstrumentNumber, remainingCount } from "./checkbooks";

describe("formatInstrumentNumber", () => {
  it("complète avec des zéros initiaux", () => {
    expect(formatInstrumentNumber(1234, 7)).toBe("0001234");
    expect(formatInstrumentNumber(5000100, 7)).toBe("5000100");
  });

  it("ne tronque jamais un numéro plus long que la largeur", () => {
    expect(formatInstrumentNumber(12345678, 7)).toBe("12345678");
  });
});

describe("remainingCount", () => {
  it("compte le prochain numéro inclus", () => {
    expect(remainingCount(1006, 1049)).toBe(44);
    expect(remainingCount(1049, 1049)).toBe(1);
  });

  it("vaut zéro pour un carnet épuisé", () => {
    expect(remainingCount(1050, 1049)).toBe(0);
  });
});

describe("availableNumbers / availableCount", () => {
  it("saute les formules vierges en opposition", () => {
    expect(availableNumbers(1008, 1049, [[1010, 1010]], 3)).toEqual([1008, 1009, 1011]);
    expect(availableNumbers(1008, 1012, [[1009, 1011]], 5)).toEqual([1008, 1012]);
    expect(availableNumbers(1048, 1049, [], 5)).toEqual([1048, 1049]);
  });

  it("formules restantes hors opposition", () => {
    expect(availableCount(1008, 1049, [[1010, 1010], [1040, 1049]])).toBe(31);
    // Une plage déjà dépassée par le prochain numéro ne compte plus
    expect(availableCount(1008, 1049, [[1006, 1007]])).toBe(42);
    expect(availableCount(1050, 1049, [])).toBe(0);
  });
});
