import { describe, expect, it } from "vitest";
import { formatInstrumentNumber, remainingCount } from "./checkbooks";

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
