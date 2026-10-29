/** Référence interne lisible d'un règlement : « RG-20261028-1006 ». */
export function settlementReference(issueDate: string, firstNumber: number | null): string {
  return `RG-${issueDate.replaceAll("-", "")}${firstNumber != null ? `-${firstNumber}` : ""}`;
}

/** Référence d'un courrier type : « OP-20261029-1003 » (préfixe, date, numéro facultatif). */
export function letterReference(prefix: "OP" | "PR" | "RC" | "RL", date: string, number?: number | null): string {
  return `${prefix}-${date.replaceAll("-", "")}${number != null ? `-${number}` : ""}`;
}
