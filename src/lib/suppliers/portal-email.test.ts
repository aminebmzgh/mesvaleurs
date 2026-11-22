import { describe, expect, it } from "vitest";
import { linesToHtml, portalEmail, portalLinkLines } from "./portal-email";

const URL = `https://mesvaleurs.ma/suivi/${"Ab_-".repeat(8)}`;

describe("portalEmail", () => {
  it("donne le lien, cliquable dans la version HTML", () => {
    const email = portalEmail({ organizationName: "Atlas & Fils", supplierName: "Sotrama <SARL>", url: URL });
    expect(email.subject).toBe("Suivi de vos règlements — Atlas & Fils");
    expect(email.text).toContain(`Votre lien personnel : ${URL}`);
    expect(email.html).toContain(`<a href="${URL}">${URL}</a>`);
    // Noms échappés dans le HTML
    expect(email.html).toContain("Atlas &amp; Fils");
    expect(email.html).toContain("Sotrama &lt;SARL&gt;");
    expect(email.html).not.toContain("<SARL>");
  });
});

describe("portalLinkLines", () => {
  it("n'ajoute rien sans lien actif", () => {
    expect(portalLinkLines(null)).toEqual([]);
  });

  it("ajoute une ligne avec le lien, rendue cliquable", () => {
    const lines = ["Bonjour,", ...portalLinkLines(URL)];
    expect(lines.at(-1)).toContain(URL);
    expect(linesToHtml(lines, URL)).toContain(`<a href="${URL}">`);
  });
});
