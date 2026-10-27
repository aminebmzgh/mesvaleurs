import { describe, expect, it } from "vitest";
import { defaultTemplateFor } from "./default-templates";
import { backgroundPath, isBackgroundPathOf, templateInputSchema } from "./schemas";

const ORG = "b0000000-0000-4000-8000-000000000001";
const TEMPLATE = "70000000-0000-4000-8000-000000000001";

describe("templateInputSchema", () => {
  it("accepte un modèle par défaut tel quel", () => {
    const template = defaultTemplateFor("check", "AWB");
    // Les champs propres aux modèles par défaut (clé, banque, type) sont ignorés
    expect(templateInputSchema.safeParse(template).success).toBe(true);
  });

  it("borne le décalage imprimante et la taille des polices", () => {
    const template = defaultTemplateFor("lcn", "CAM");
    expect(templateInputSchema.safeParse({ ...template, offsetXMm: 45 }).success).toBe(false);
    expect(
      templateInputSchema.safeParse({ ...template, zones: [{ ...template.zones[0], fontSize: 40 }] }).success,
    ).toBe(false);
  });
});

describe("scan de fond", () => {
  it("chemin préfixé par l'organisation et le modèle", () => {
    expect(backgroundPath(ORG, TEMPLATE, "image/png", "abc")).toBe(`${ORG}/${TEMPLATE}/abc.png`);
    expect(backgroundPath(ORG, TEMPLATE, "image/jpeg", "abc")).toBe(`${ORG}/${TEMPLATE}/abc.jpg`);
  });

  it("refuse le chemin d'un autre modèle ou une remontée de dossier", () => {
    expect(isBackgroundPathOf(`${ORG}/${TEMPLATE}/abc.jpg`, ORG, TEMPLATE)).toBe(true);
    expect(isBackgroundPathOf(`${ORG}/${TEMPLATE}/../x.jpg`, ORG, TEMPLATE)).toBe(false);
    expect(isBackgroundPathOf(`${ORG}/b0000000-0000-4000-8000-000000000002/abc.jpg`, ORG, TEMPLATE)).toBe(false);
  });
});
