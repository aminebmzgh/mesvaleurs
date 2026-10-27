import { describe, expect, it } from "vitest";
import { ageBucket, isMonth, missingNumbers, monthLabel, monthRange, shiftMonth } from "./period";

describe("mois", () => {
  it("bornes du mois, années bissextiles comprises", () => {
    expect(monthRange("2026-10")).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(monthRange("2028-02")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(monthRange("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });

  it("mois précédent et suivant, changement d'année", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });

  it("libellé en français", () => {
    expect(monthLabel("2026-08")).toBe("août 2026");
  });

  it("valide le format", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("10-2026")).toBe(false);
    expect(() => monthRange("2026-1")).toThrow(RangeError);
  });
});

describe("missingNumbers", () => {
  it("trouve les numéros sautés du carnet", () => {
    // Carnet 1000 → prochain 1006 : 1000 à 1005 attribuables
    expect(missingNumbers(1000, 1006, [1000, 1001, 1003, 1005])).toEqual([1002, 1004]);
  });

  it("aucun numéro manquant, ou carnet neuf", () => {
    expect(missingNumbers(1000, 1003, [1000, 1001, 1002])).toEqual([]);
    expect(missingNumbers(1000, 1000, [])).toEqual([]);
  });

  it("borne le nombre de numéros signalés", () => {
    expect(missingNumbers(1, 1000, [], 5)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("ageBucket", () => {
  it.each([
    [0, "< 30 j"],
    [29, "< 30 j"],
    [30, "30 à 60 j"],
    [60, "60 à 90 j"],
    [90, "> 90 j"],
  ] as const)("%s jours → %s", (days, bucket) => {
    expect(ageBucket(days)).toBe(bucket);
  });
});
