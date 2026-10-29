import { describe, expect, it } from "vitest";
import type { AppAlert } from "./alerts";
import { DIGEST_ITEM_LIMIT, digestEmail } from "./digest";

const alert = (overrides: Partial<AppAlert> = {}): AppAlert => ({
  kind: "lcn_due",
  severity: "warning",
  title: "2 LCN à échoir sous 7 jours",
  detail: "3 500,00 DH à provisionner.",
  href: "/calendrier",
  action: "Voir le calendrier",
  items: [{ label: "LCN 0000002", detail: "Sotrama · 2 500,00 DH", badge: "04/11/2026 · J-3" }],
  ...overrides,
});

describe("digestEmail", () => {
  const email = digestEmail({
    appName: "MesValeurs",
    organizationName: "Atlas & Fils <SARL>",
    date: "2026-10-29",
    alerts: [
      alert(),
      alert({ kind: "rejected", severity: "critical", title: "1 paiement rejeté à régulariser", href: "/paiements?statut=rejected", action: "Régulariser", items: [] }),
    ],
    siteUrl: "https://mesvaleurs.vercel.app/",
  });

  it("objet : nombre d'alertes, entreprise et date", () => {
    expect(email.subject).toBe("MesValeurs · 2 alertes pour Atlas & Fils <SARL> — 29/10/2026");
  });

  it("liens absolus vers l'application et lien de désinscription", () => {
    expect(email.text).toContain("Voir le calendrier : https://mesvaleurs.vercel.app/calendrier");
    expect(email.html).toContain('href="https://mesvaleurs.vercel.app/paiements?statut=rejected"');
    expect(email.text).toContain("https://mesvaleurs.vercel.app/alertes");
  });

  it("HTML échappé", () => {
    expect(email.html).toContain("Atlas &amp; Fils &lt;SARL&gt;");
    expect(email.html).not.toContain("<SARL>");
  });

  it("éléments limités, la suite résumée", () => {
    const items = Array.from({ length: DIGEST_ITEM_LIMIT + 3 }, (_, i) => ({ label: `F-${i}`, detail: "Atlas" }));
    const long = digestEmail({ appName: "MesValeurs", organizationName: "Atlas", date: "2026-10-29", alerts: [alert({ items })], siteUrl: "http://localhost:3000" });
    expect(long.text).toContain("… et 3 autre(s)");
    expect(long.text).not.toContain(`F-${DIGEST_ITEM_LIMIT}`);
    expect(long.subject).toContain("1 alerte pour");
  });
});
