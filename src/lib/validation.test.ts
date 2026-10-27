import { describe, expect, it } from "vitest";
import {
  amountSchema,
  emailSchema,
  iceSchema,
  integerSchema,
  optionalText,
  passwordSchema,
  ribSchema,
} from "./validation";

describe("emailSchema", () => {
  it("normalise l'adresse", () => {
    expect(emailSchema.parse("  Karim@Exemple.MA ")).toBe("karim@exemple.ma");
  });

  it("refuse une adresse invalide", () => {
    expect(emailSchema.safeParse("pas-une-adresse").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepte lettres + chiffres, 8 caractères minimum", () => {
    expect(passwordSchema.safeParse("Demo1234").success).toBe(true);
  });

  it.each(["court1", "sanschiffres", "12345678"])("refuse %s", (value) => {
    expect(passwordSchema.safeParse(value).success).toBe(false);
  });
});

describe("iceSchema", () => {
  it("accepte 15 chiffres, espaces ignorés", () => {
    expect(iceSchema.parse("002 345 678 000 041")).toBe("002345678000041");
  });

  it("transforme une valeur vide en null", () => {
    expect(iceSchema.parse("")).toBeNull();
  });

  it("refuse un ICE de mauvaise longueur", () => {
    expect(iceSchema.safeParse("12345").success).toBe(false);
  });
});

describe("optionalText", () => {
  it("transforme une chaîne vide en null", () => {
    expect(optionalText().parse("   ")).toBeNull();
  });
});

describe("ribSchema", () => {
  it("accepte un RIB valide saisi par blocs", () => {
    expect(ribSchema.parse("150 500 2115014416910015 83")).toBe("150500211501441691001583");
  });

  it("refuse une clé invalide", () => {
    const result = ribSchema.safeParse("150500211501441691001584");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/Clé RIB invalide/);
  });

  it("transforme une valeur vide en null", () => {
    expect(ribSchema.parse("")).toBeNull();
  });
});

describe("amountSchema", () => {
  it("convertit un montant marocain", () => {
    expect(amountSchema("Le solde").parse("12 500,50")).toBe(12500.5);
  });

  it("refuse une saisie invalide ou vide", () => {
    expect(amountSchema("Le solde").safeParse("abc").success).toBe(false);
    expect(amountSchema("Le solde").safeParse("").success).toBe(false);
  });

  it("autorise un solde négatif si demandé", () => {
    expect(amountSchema("Le solde", { allowNegative: true }).parse("-1 000,00")).toBe(-1000);
  });
});

describe("integerSchema", () => {
  it("valide les bornes", () => {
    expect(integerSchema("Le numéro", { min: 1 }).parse("0001234")).toBe(1234);
    expect(integerSchema("Le nombre", { min: 1, max: 10 }).safeParse("11").success).toBe(false);
    expect(integerSchema("Le numéro").safeParse("12a").success).toBe(false);
  });
});
