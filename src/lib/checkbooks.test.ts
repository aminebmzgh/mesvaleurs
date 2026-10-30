import { describe, expect, it } from "vitest";
import {
  availableCount,
  availableNumbers,
  checkbookInventory,
  formatInstrumentNumber,
  isLowStock,
  remainingCount,
  stockByAccount,
} from "./checkbooks";

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

describe("stockByAccount / isLowStock", () => {
  const books = [
    { bankAccountId: "a", type: "check" as const, status: "active" as const, remaining: 3 },
    { bankAccountId: "a", type: "check" as const, status: "active" as const, remaining: 25 },
    { bankAccountId: "a", type: "lcn" as const, status: "active" as const, remaining: 4 },
    { bankAccountId: "b", type: "check" as const, status: "active" as const, remaining: 5 },
    { bankAccountId: "b", type: "check" as const, status: "archived" as const, remaining: 40 },
  ];

  it("additionne les carnets en service d'un même compte et d'un même type", () => {
    expect(stockByAccount(books, 5)).toEqual([
      { bankAccountId: "a", type: "check", remaining: 28, low: false },
      { bankAccountId: "a", type: "lcn", remaining: 4, low: true },
      { bankAccountId: "b", type: "check", remaining: 5, low: true },
    ]);
  });

  it("un carnet qui s'achève n'alerte pas si un autre prend le relais", () => {
    expect(isLowStock(books, 5, "a", "check")).toBe(false);
    expect(isLowStock(books, 30, "a", "check")).toBe(true);
    // Un carnet archivé ne compte pas dans le stock
    expect(isLowStock(books, 5, "b", "check")).toBe(true);
  });
});

describe("checkbookInventory", () => {
  it("classe chaque formule et regroupe les plages sans paiement", () => {
    const { rows, counts } = checkbookInventory(
      { firstNumber: 1000, lastNumber: 1011, nextNumber: 1006 },
      [
        { number: 1000, status: "paid" },
        { number: 1001, status: "cancelled" },
        { number: 1002, status: "stopped" },
        { number: 1004, status: "cancelled", guaranteeClosed: true },
      ],
      [[1005, 1005], [1008, 1009]],
    );
    expect(counts).toEqual({ used: 2, cancelled: 1, stopped: 4, remaining: 4, skipped: 1 });
    expect(rows.map((r) => [r.first, r.last, r.status])).toEqual([
      [1000, 1000, "used"],
      [1001, 1001, "cancelled"],
      [1002, 1002, "stopped"],
      [1003, 1003, "skipped"],
      [1004, 1004, "used"],
      [1005, 1005, "stopped"],
      [1006, 1007, "remaining"],
      [1008, 1009, "stopped"],
      [1010, 1011, "remaining"],
    ]);
  });
});
