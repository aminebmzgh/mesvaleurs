import { describe, expect, it } from "vitest";
import { sanitizeSearch, supplierSchema } from "./schemas";

describe("supplierSchema", () => {
  it("accepte une fiche minimale", () => {
    expect(supplierSchema.parse({ name: "Sotrama", payment_terms_days: "" })).toMatchObject({
      name: "Sotrama",
      payment_terms_days: null,
      print_cover_letter: false,
    });
  });

  it("convertit délai, case à cocher, ICE et RIB", () => {
    const result = supplierSchema.parse({
      name: "Maghreb Emballages SA",
      payee_name: "MAGHREB EMBALLAGES",
      ice: "001 987 654 000 023",
      rib: "150500213301441691000532",
      email: "Compta@Maghreb.ma",
      payment_terms_days: "90",
      print_cover_letter: "on",
    });
    expect(result).toMatchObject({
      ice: "001987654000023",
      rib: "150500213301441691000532",
      email: "compta@maghreb.ma",
      payment_terms_days: 90,
      print_cover_letter: true,
    });
  });

  it("refuse un délai hors limites et un e-mail invalide", () => {
    const result = supplierSchema.safeParse({ name: "X", payment_terms_days: "400", email: "pas-un-mail" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual(
      expect.arrayContaining(["payment_terms_days", "email"]),
    );
  });
});

describe("sanitizeSearch", () => {
  it("retire la syntaxe des filtres PostgREST", () => {
    expect(sanitizeSearch("sotrama,name.eq.x")).toBe("sotrama name.eq.x");
    expect(sanitizeSearch("(a)%*b")).toBe("a b");
  });

  it("borne la longueur et ignore les valeurs non textuelles", () => {
    expect(sanitizeSearch("a".repeat(200))).toHaveLength(80);
    expect(sanitizeSearch(undefined)).toBe("");
    expect(sanitizeSearch(["x"])).toBe("");
  });
});
