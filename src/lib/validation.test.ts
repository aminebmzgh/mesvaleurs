import { describe, expect, it } from "vitest";
import { emailSchema, iceSchema, optionalText, passwordSchema } from "./validation";

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
