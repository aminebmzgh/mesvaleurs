import { describe, expect, it } from "vitest";
import { clientIp, lockoutKey, lockoutMessage } from "./lockout";

describe("lockoutKey", () => {
  it("empreinte stable, insensible à la casse et aux espaces, distincte par type", () => {
    const key = lockoutKey("email", "Admin@Demo.ma ");
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).toBe(lockoutKey("email", "admin@demo.ma"));
    expect(key).not.toContain("admin");
    expect(lockoutKey("ip", "admin@demo.ma")).not.toBe(key);
  });
});

describe("clientIp", () => {
  it("première adresse de x-forwarded-for, sinon x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "196.200.1.2, 10.0.0.1" }))).toBe("196.200.1.2");
    expect(clientIp(new Headers({ "x-real-ip": "196.200.1.3" }))).toBe("196.200.1.3");
    expect(clientIp(new Headers())).toBeNull();
  });
});

describe("lockoutMessage", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  it("minutes restantes arrondies au-dessus", () => {
    expect(lockoutMessage(new Date("2026-10-30T10:14:10Z"), now)).toContain("Réessayez dans 15 minutes");
    expect(lockoutMessage(new Date("2026-10-30T10:00:20Z"), now)).toContain("Réessayez dans 1 minute,");
  });
});
