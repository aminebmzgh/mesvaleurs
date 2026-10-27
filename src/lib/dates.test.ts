import { describe, expect, it } from "vitest";
import { addDays, dayStartInstant, daysBetween, todayIso } from "./dates";

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

describe("dayStartInstant", () => {
  it("minuit local converti en UTC", () => {
    expect(dayStartInstant("2026-10-28", "Asia/Tokyo")).toBe("2026-10-27T15:00:00.000Z");
    expect(dayStartInstant("2026-10-28", "UTC")).toBe("2026-10-28T00:00:00.000Z");
  });

  it("tient compte de l'heure d'été", () => {
    expect(dayStartInstant("2026-01-15", "Europe/Paris")).toBe("2026-01-14T23:00:00.000Z");
    expect(dayStartInstant("2026-07-01", "Europe/Paris")).toBe("2026-06-30T22:00:00.000Z");
  });
});
