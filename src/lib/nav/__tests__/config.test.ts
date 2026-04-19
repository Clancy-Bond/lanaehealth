import { describe, it, expect } from "vitest";
import { NAV_TABS, getTabForPath, getFabForPath } from "../config";

describe("NavConfig", () => {
  it("exposes the primary clone tabs", () => {
    const ids = NAV_TABS.map((t) => t.id);
    expect(ids).toContain("home");
    expect(ids).toContain("calories");
    expect(ids).toContain("cycle");
    expect(ids).toContain("symptoms");
    expect(ids).toContain("sleep");
    expect(ids).toContain("records");
  });

  it("every tab id is unique", () => {
    const ids = NAV_TABS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("resolves home for /", () => {
    expect(getTabForPath("/")?.id).toBe("home");
  });

  it("resolves calories for /calories and /calories/food", () => {
    expect(getTabForPath("/calories")?.id).toBe("calories");
    expect(getTabForPath("/calories/food")?.id).toBe("calories");
  });

  it("resolves symptoms for /log and /symptoms", () => {
    expect(getTabForPath("/log")?.id).toBe("symptoms");
    expect(getTabForPath("/symptoms/entry")?.id).toBe("symptoms");
  });

  it("resolves cycle for /cycle and /cycle/log", () => {
    expect(getTabForPath("/cycle")?.id).toBe("cycle");
    expect(getTabForPath("/cycle/log")?.id).toBe("cycle");
  });

  it("returns a FAB for tabs that declare one", () => {
    expect(getFabForPath("/calories")?.href).toBe("/calories/search");
    expect(getFabForPath("/cycle")?.href).toBe("/cycle/log");
    expect(getFabForPath("/log")?.href).toBe("/log");
    expect(getFabForPath("/sleep")?.href).toBe("/sleep/log");
  });

  it("returns null FAB for tabs without one", () => {
    expect(getFabForPath("/records")).toBeNull();
    expect(getFabForPath("/doctor")).toBeNull();
  });

  it("returns null FAB for unknown paths", () => {
    expect(getFabForPath("/totally-unknown")).toBeNull();
  });
});
