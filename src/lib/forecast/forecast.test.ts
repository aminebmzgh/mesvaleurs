import { describe, expect, it } from "vitest";
import { dueStatus, monthGrid, monthLabel, shiftMonth, startOfWeek, weekDays } from "./calendar";
import { buildForecast, type ForecastMovement, plannedDate } from "./forecast";

const movement = (date: string, amount: number, kind: ForecastMovement["kind"] = "lcn"): ForecastMovement => ({
  date,
  amount,
  kind,
  label: `${kind} ${amount}`,
  supplier: "Sotrama",
  href: "/",
});

describe("plannedDate", () => {
  it("chèque : aujourd'hui ; LCN, virement, facture : à leur date, aujourd'hui si passée", () => {
    expect(plannedDate("check", "2026-12-01", "2026-10-29")).toBe("2026-10-29");
    expect(plannedDate("lcn", "2026-11-18", "2026-10-29")).toBe("2026-11-18");
    expect(plannedDate("lcn", "2026-10-01", "2026-10-29")).toBe("2026-10-29");
    expect(plannedDate("invoice", null, "2026-10-29")).toBe("2026-10-29");
  });
});

describe("buildForecast", () => {
  it("solde jour par jour, point bas et premier jour négatif", () => {
    const forecast = buildForecast(
      50000,
      [movement("2026-10-29", 15600.1, "check"), movement("2026-11-18", 40000), movement("2026-12-18", 40000), movement("2027-03-01", 1)],
      "2026-10-29",
      90,
    );
    expect(forecast.days).toHaveLength(91);
    expect(forecast.days[0]).toMatchObject({ date: "2026-10-29", balance: 34399.9, outflow: 15600.1 });
    expect(forecast.days.find((d) => d.date === "2026-11-18")!.balance).toBe(-5600.1);
    expect(forecast.firstNegative).toEqual({ date: "2026-11-18", balance: -5600.1 });
    expect(forecast.low).toEqual({ date: "2026-12-18", balance: -45600.1 });
    // Le débit au-delà de l'horizon est ignoré
    expect(forecast.endBalance).toBe(-45600.1);
  });

  it("sans débit : solde constant, jamais négatif", () => {
    const forecast = buildForecast(1000, [], "2026-10-29", 10);
    expect(forecast.firstNegative).toBeNull();
    expect(forecast.low).toEqual({ date: "2026-10-29", balance: 1000 });
    expect(forecast.endBalance).toBe(1000);
  });
});

describe("calendrier", () => {
  it("semaines du lundi au dimanche couvrant le mois", () => {
    const weeks = monthGrid("2026-11");
    expect(weeks[0][0]).toBe("2026-10-26");
    expect(weeks.at(-1)![6]).toBe("2026-12-06");
    expect(weeks).toHaveLength(6);
    expect(monthGrid("2027-02")).toHaveLength(4);
  });

  it("semaine d'une date, mois voisins, libellé", () => {
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26");
    expect(weekDays("2026-10-29")).toEqual(["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]);
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-11")).toBe("novembre 2026");
  });

  it("payé, en attente, en retard", () => {
    expect(dueStatus(true, "2026-10-01", "2026-10-29")).toBe("paid");
    expect(dueStatus(false, "2026-10-28", "2026-10-29")).toBe("late");
    expect(dueStatus(false, "2026-10-29", "2026-10-29")).toBe("pending");
  });
});
