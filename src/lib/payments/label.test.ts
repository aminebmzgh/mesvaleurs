import { describe, expect, it } from "vitest";
import { paymentLabel, paymentNumber } from "./label";

describe("paymentNumber / paymentLabel", () => {
  it("numéro de formule avec ses zéros initiaux", () => {
    expect(paymentNumber({ number: 1003, checkbooks: { number_width: 7 } })).toBe("0001003");
    expect(paymentLabel({ type: "lcn", number: 5000102, checkbooks: { number_width: 7 } })).toBe("LCN 5000102");
  });

  it("largeur par défaut de 7 chiffres sans carnet", () => {
    expect(paymentNumber({ number: 42 })).toBe("0000042");
  });

  it("virement : référence à la place du numéro", () => {
    expect(paymentLabel({ type: "transfer", number: null, reference: "VIR-2026-118" })).toBe("Virement VIR-2026-118");
    expect(paymentLabel({ type: "transfer", number: null, reference: null })).toBe("Virement");
  });
});
