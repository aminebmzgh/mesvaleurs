import { describe, expect, it } from "vitest";
import { cmc7Number, lastNumberOf, normalizeDigits, printedNumber, printedRibs, readCheque } from "./parse";

const RIB = "007780000123456789012396";
const OTHER_RIB = "150500211501441691001583";

const text = [
  "Attijariwafa bank",
  "Payez contre ce chèque",
  "Compte n° 007 780 0001234567890123 96",
  "Chèque : série N° 0001000",
].join("\n");
// Bande CMC7 : numéro, puis codes et compte ; séparateurs CMC7 lus comme des espaces
const band = "0001000 007780000 0001234567890123 96";

describe("normalizeDigits", () => {
  it("corrige les lettres prises pour des chiffres dans les suites numériques seulement", () => {
    expect(normalizeDigits("N° OOO1O5O")).toBe("N° 0001050");
    expect(normalizeDigits("Chèque SOBO")).toBe("Chèque SOBO");
  });
});

describe("printedNumber / cmc7Number / printedRibs", () => {
  it("numéro imprimé après N° ou série", () => {
    expect(printedNumber(text)).toBe("0001000");
    expect(printedNumber("CHEQUE SERIE 4 520 117")).toBe("4520117");
    expect(printedNumber("Payable à Casablanca")).toBeNull();
  });

  it("numéro en tête de bande, bande trop courte ignorée", () => {
    expect(cmc7Number(band)).toBe("0001000");
    expect(cmc7Number("0001000 12")).toBeNull();
    // Numéro imprimé tronqué juste au-dessus de la bande : écarté
    expect(cmc7Number(`000100\n${band}`)).toBe("0001000");
  });

  it("RIB en clair, par blocs, clé vérifiée", () => {
    expect(printedRibs(text)).toEqual([RIB]);
    expect(printedRibs("Compte 007 780 0001234567890123 97")).toEqual([]);
  });
});

describe("readCheque", () => {
  it("lectures concordantes et compte reconnu", () => {
    expect(readCheque(text, band, RIB)).toEqual({ number: "0001000", source: "both", conflict: null, account: "match" });
  });

  it("désaccord : le numéro imprimé prime, signalé", () => {
    const reading = readCheque(text, band.replace("0001000", "0007000"), RIB);
    expect(reading).toMatchObject({ number: "0001000", source: "printed", conflict: { printed: "0001000", cmc7: "0007000" } });
  });

  it("bande lue sans séparateurs : concordante si elle commence par le numéro imprimé", () => {
    expect(readCheque(text, band.replace(/ /g, ""), RIB).source).toBe("both");
    expect(readCheque(text, `9${band.replace(/ /g, "")}`, RIB).source).toBe("printed");
  });

  it("bande seule ; compte reconnu par son numéro dans la bande", () => {
    expect(readCheque("", band, RIB)).toEqual({ number: "0001000", source: "cmc7", conflict: null, account: "match" });
  });

  it("chèque d'un autre compte", () => {
    expect(readCheque(text, "", OTHER_RIB).account).toBe("mismatch");
    expect(readCheque("Chèque N° 0001000", "", OTHER_RIB)).toMatchObject({ source: "printed", account: "unknown" });
  });

  it("rien de lisible", () => {
    expect(readCheque("", "", RIB)).toEqual({ number: null, source: null, conflict: null, account: "unknown" });
  });
});

describe("lastNumberOf", () => {
  it("garde la largeur du premier numéro", () => {
    expect(lastNumberOf("0001000", 25)).toBe("0001024");
    expect(lastNumberOf("99", 50)).toBe("148");
    expect(lastNumberOf("", 25)).toBeNull();
    expect(lastNumberOf("12a", 25)).toBeNull();
  });
});
