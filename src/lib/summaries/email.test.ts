import { describe, expect, it } from "vitest";
import { commentaryFacts, monthLabel, ofMonth, summaryEmail } from "./email";
import type { MonthlySummary } from "./figures";

const summary: MonthlySummary = {
  month: { start: "2026-10-01", end: "2026-10-31" },
  paid: { count: 2, total: 5500, checks: { count: 1, total: 1500 }, lcns: { count: 1, total: 4000 }, transfers: { count: 0, total: 0 } },
  issued: { count: 1, total: 800 },
  remaining: { invoices: { count: 3, total: 18000 }, inCirculation: { count: 1, total: 3000 } },
  risks: {
    late: { count: 1, total: 15000, fines: 337.5, listed: [{ number: "LATE-1", supplier: "Sotrama <SARL>", remaining: 15000, legalDueDate: "2026-10-15" }] },
    dueSoon: { count: 1, total: 2000 },
    lcnDueSoon: { count: 0, total: 0 },
    rejected: { count: 0, total: 0 },
    coverage: { balance: 10000, commitments: 20000, gap: -10000 },
  },
};
const input = { appName: "MesValeurs", organizationName: "Atlas Distribution", summary, siteUrl: "https://mesvaleurs.ma/" };

describe("summaryEmail", () => {
  it("objet, sections et liens ; texte échappé dans le HTML", () => {
    const email = summaryEmail({ ...input, commentary: null });
    expect(email.subject).toBe("MesValeurs · résumé d'octobre 2026 pour Atlas Distribution");
    expect(email.text).toContain("Payé en octobre 2026");
    expect(email.text).toContain("(1 chèque 1");
    expect(summaryEmail({ ...input, commentary: null, summary: { ...summary, paid: { ...summary.paid, count: 1, total: 1500, lcns: { count: 0, total: 0 } } } }).text).toMatch(/Débité sur vos comptes : 1.500,00.DH \(1 chèque\)/);
    expect(email.text).toContain("- Factures en retard (loi 69-21) : 1 ·");
    expect(email.text).toContain("- LATE-1 · Sotrama <SARL> :");
    expect(email.text).toContain("Délais de paiement : https://mesvaleurs.ma/conformite");
    expect(email.text).not.toContain("Points d'attention");
    expect(email.html).toContain("Sotrama &lt;SARL&gt;");
    expect(email.html).not.toContain("<SARL>");
    // Marge négative signalée en rouge
    expect(email.html).toContain("color:#d03b3b");
  });

  it("paragraphe de l'assistant en tête quand il existe", () => {
    const email = summaryEmail({ ...input, commentary: "Provisionnez le compte principal.\nRéglez LATE en priorité." });
    expect(email.text.indexOf("Points d'attention")).toBeLessThan(email.text.indexOf("Payé en"));
    expect(email.html).toContain("Provisionnez le compte principal.</p>");
  });
});

describe("assistant", () => {
  it("chiffres agrégés seulement, sans nom de fournisseur ni numéro de facture", () => {
    const facts = commentaryFacts(summary);
    expect(JSON.parse(facts)).toMatchObject({ mois: "octobre 2026", factures_en_retard: { nombre: 1, montant: 15000 }, marge_apres_engagements: -10000 });
    expect(facts).not.toContain("Sotrama");
    expect(facts).not.toContain("LATE-1");
  });

  it("libellé du mois, avec élision", () => {
    expect(monthLabel("2027-01-01")).toBe("janvier 2027");
    expect(ofMonth("octobre 2026")).toBe("d'octobre 2026");
    expect(ofMonth("août 2026")).toBe("d'août 2026");
    expect(ofMonth("mars 2026")).toBe("de mars 2026");
  });
});
