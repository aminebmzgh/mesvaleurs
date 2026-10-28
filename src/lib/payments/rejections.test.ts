import { describe, expect, it } from "vitest";
import { countdownLabel, regularizationState } from "./rejections";

const today = "2026-10-28";

describe("regularizationState", () => {
  it("compte à rebours avant la date limite", () => {
    const state = regularizationState({ regularized_at: null, regularization_due_date: "2026-11-09" }, today);
    expect(state).toEqual({ kind: "pending", dueDate: "2026-11-09", daysLeft: 12 });
    expect(countdownLabel(state)).toBe("J-12");
  });

  it("dernier jour, puis retard", () => {
    expect(countdownLabel(regularizationState({ regularized_at: null, regularization_due_date: today }, today))).toBe("Dernier jour");
    const late = regularizationState({ regularized_at: null, regularization_due_date: "2026-10-25" }, today);
    expect(late).toEqual({ kind: "overdue", dueDate: "2026-10-25", daysLate: 3 });
    expect(countdownLabel(late)).toBe("Délai dépassé de 3 j");
  });

  it("régularisé, ou sans délai légal (LCN)", () => {
    expect(regularizationState({ regularized_at: "2026-10-20", regularization_due_date: "2026-11-09" }, today)).toEqual({
      kind: "regularized",
      on: "2026-10-20",
    });
    expect(countdownLabel(regularizationState({ regularized_at: null, regularization_due_date: null }, today))).toBe("À régulariser");
  });
});
