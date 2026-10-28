/** Référence interne lisible d'un règlement : « RG-20261028-1006 ». */
export function settlementReference(issueDate: string, firstNumber: number | null): string {
  return `RG-${issueDate.replaceAll("-", "")}${firstNumber != null ? `-${firstNumber}` : ""}`;
}
