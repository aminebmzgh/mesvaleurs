import { describe, expect, it } from "vitest";
import { addDays, daysBetween, todayIso } from "./dates";

describe("todayIso", () => {
  it("donne la date du jour dans le fuseau demandé", () => {
    const instant = new Date("2026-12-31T23:30:00Z");
    expect(todayIso("UTC", instant)).toBe("2026-12-31");
    expect(todayIso("Asia/Tokyo", instant)).toBe("2027-01-01");
  });
});

describe("daysBetween / addDays", () => {
  it("compte les jours, y compris sur un changement d'année ou une année bissextile", () => {
    expect(daysBetween("2026-08-05", "2026-10-04")).toBe(60);
    expect(daysBetween("2027-12-31", "2028-03-01")).toBe(61);
    expect(daysBetween("2026-10-04", "2026-08-05")).toBe(-60);
  });

  it("ajoute des jours", () => {
    expect(addDays("2026-07-20", 90)).toBe("2026-10-18");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
