import { describe, expect, it } from "vitest";
import { actionLabel, changedFields, describeRecord, formatValue, recordHref, tableLabel } from "./entries";

describe("changedFields", () => {
  it("ne garde que les champs modifiés, sans colonnes techniques", () => {
    const before = { id: "1", amount: 1000, status: "issued", notes: null, updated_at: "a" };
    const after = { id: "1", amount: 1200, status: "issued", notes: null, updated_at: "b" };
    expect(changedFields(before, after)).toEqual([{ field: "amount", before: 1000, after: 1200 }]);
  });

  it("compare les objets par valeur", () => {
    expect(changedFields({ options: { font: "helvetica" } }, { options: { font: "helvetica" } })).toEqual([]);
    expect(changedFields({ zones: [1] }, { zones: [2] })).toHaveLength(1);
  });

  it("création : champs renseignés ; suppression : champs de la ligne", () => {
    expect(changedFields(null, { id: "1", name: "Sotrama", ice: null })).toEqual([{ field: "name", before: null, after: "Sotrama" }]);
    expect(changedFields({ id: "1", name: "Sotrama" }, null)).toEqual([{ field: "name", before: "Sotrama", after: null }]);
  });
});

describe("formatValue", () => {
  it("statuts traduits selon la table", () => {
    expect(formatValue("payments", "status", "paid")).toBe("Débité");
    expect(formatValue("invoices", "status", "paid")).toBe("Payée");
    expect(formatValue("payments", "type", "lcn")).toBe("LCN");
  });

  it("dates, booléens, vides et objets", () => {
    expect(formatValue("payments", "due_date", "2026-12-25")).toBe("25/12/2026");
    expect(formatValue("suppliers", "is_active", false)).toBe("Non");
    expect(formatValue("suppliers", "notes", null)).toBe("—");
    expect(formatValue("print_templates", "options", { font: "helvetica" })).toBe('{"font":"helvetica"}');
  });
});

describe("describeRecord", () => {
  it("désigne l'objet concerné", () => {
    expect(describeRecord("payments", null, { type: "check", number: 1003 }, null)).toBe("Chèque n° 0001003");
    expect(describeRecord("invoices", { number: "F-12" }, null, null)).toBe("Facture F-12");
    expect(describeRecord("suppliers", null, { name: "Sotrama" }, null)).toBe("Sotrama");
    expect(describeRecord("print_batches", null, null, { first_number: 1006, last_number: 1008 })).toBe("Formules n° 1006 à 1008");
    expect(describeRecord("payment_allocations", null, { amount: 24000 }, null)).toMatch(/^24\s000,00\sDH affectés$/);
    expect(describeRecord("statement_lines", null, null, { payment_id: "x" })).toBe("Ligne de relevé");
  });

  it("libellés inconnus conservés", () => {
    expect(actionLabel("print")).toBe("Impression");
    expect(actionLabel("custom_event")).toBe("custom_event");
    expect(tableLabel(null)).toBe("—");
  });
});

describe("recordHref", () => {
  it("lien vers l'écran de l'objet", () => {
    expect(recordHref("suppliers", "s1", null, { name: "x" })).toBe("/fournisseurs/s1");
    expect(recordHref("payments", "p1", null, { print_batch_id: "b1" })).toBe("/paiements/lots/b1");
    expect(recordHref("print_batches", "b1", null, null)).toBe("/paiements/lots/b1");
  });

  it("aucun lien pour un objet supprimé", () => {
    expect(recordHref("suppliers", "s1", { name: "x" }, null)).toBeNull();
    expect(recordHref("memberships", "m1", null, { role: "admin" })).toBeNull();
  });
});
