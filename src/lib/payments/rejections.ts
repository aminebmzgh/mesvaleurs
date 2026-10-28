import { daysBetween } from "@/lib/dates";

export type RegularizationState =
  | { kind: "regularized"; on: string }
  | { kind: "pending"; dueDate: string; daysLeft: number }
  | { kind: "overdue"; dueDate: string; daysLate: number }
  | { kind: "no_deadline" };

/**
 * État de la régularisation d'un paiement rejeté (loi 71-24) : compte à rebours
 * jusqu'à la date limite, ou retard. Une LCN impayée n'a pas de délai légal.
 */
export function regularizationState(
  payment: { regularized_at: string | null; regularization_due_date: string | null },
  today: string,
): RegularizationState {
  if (payment.regularized_at) {
    return { kind: "regularized", on: payment.regularized_at };
  }
  if (!payment.regularization_due_date) {
    return { kind: "no_deadline" };
  }
  const daysLeft = daysBetween(today, payment.regularization_due_date);
  return daysLeft >= 0
    ? { kind: "pending", dueDate: payment.regularization_due_date, daysLeft }
    : { kind: "overdue", dueDate: payment.regularization_due_date, daysLate: -daysLeft };
}

/** Libellé court : « J-12 », « aujourd'hui », « dépassé de 3 j ». */
export function countdownLabel(state: RegularizationState): string {
  switch (state.kind) {
    case "regularized":
      return "Régularisé";
    case "no_deadline":
      return "À régulariser";
    case "overdue":
      return `Délai dépassé de ${state.daysLate} j`;
    case "pending":
      return state.daysLeft === 0 ? "Dernier jour" : `J-${state.daysLeft}`;
  }
}
