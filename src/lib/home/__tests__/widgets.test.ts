import { describe, it, expect, beforeEach } from "vitest";
import {
  registerWidget,
  resolveWidgetOrder,
  HOME_WIDGETS,
  __resetRegistryForTests,
  type HomeWidget,
} from "../widgets";

function noopComponent() {
  return null;
}

function fixture(
  id: string,
  extras: Partial<HomeWidget> = {},
): HomeWidget {
  return {
    id,
    label: id,
    category: "general",
    defaultEnabled: true,
    defaultOrder: 10,
    Component: noopComponent,
    ...extras,
  };
}

describe("HomeWidget registry", () => {
  beforeEach(() => {
    __resetRegistryForTests();
  });

  it("registerWidget appends to HOME_WIDGETS", () => {
    registerWidget(fixture("a"));
    expect(HOME_WIDGETS.map((w) => w.id)).toEqual(["a"]);
  });

  it("registerWidget throws on duplicate id", () => {
    registerWidget(fixture("a"));
    expect(() => registerWidget(fixture("a"))).toThrow(/Duplicate/);
  });

  it("resolveWidgetOrder honors explicit order first", () => {
    registerWidget(fixture("a", { defaultOrder: 10 }));
    registerWidget(fixture("b", { defaultOrder: 20 }));
    registerWidget(fixture("c", { defaultOrder: 30 }));
    const result = resolveWidgetOrder({
      explicitOrder: ["c", "a"],
      hidden: [],
    });
    expect(result.map((w) => w.id)).toEqual(["c", "a", "b"]);
  });

  it("resolveWidgetOrder filters hidden widgets", () => {
    registerWidget(fixture("a"));
    registerWidget(fixture("b"));
    const result = resolveWidgetOrder({
      explicitOrder: [],
      hidden: ["a"],
    });
    expect(result.map((w) => w.id)).toEqual(["b"]);
  });

  it("resolveWidgetOrder drops hidden widgets even if explicitly ordered", () => {
    registerWidget(fixture("a"));
    registerWidget(fixture("b"));
    const result = resolveWidgetOrder({
      explicitOrder: ["a", "b"],
      hidden: ["a"],
    });
    expect(result.map((w) => w.id)).toEqual(["b"]);
  });

  it("resolveWidgetOrder skips widgets with defaultEnabled: false when not explicitly ordered", () => {
    registerWidget(fixture("a"));
    registerWidget(fixture("b", { defaultEnabled: false }));
    const result = resolveWidgetOrder({ explicitOrder: [], hidden: [] });
    expect(result.map((w) => w.id)).toEqual(["a"]);
  });

  it("resolveWidgetOrder includes defaultEnabled:false widgets when explicitly ordered", () => {
    registerWidget(fixture("a"));
    registerWidget(fixture("b", { defaultEnabled: false }));
    const result = resolveWidgetOrder({
      explicitOrder: ["b"],
      hidden: [],
    });
    expect(result.map((w) => w.id)).toEqual(["b", "a"]);
  });

  it("resolveWidgetOrder sorts default widgets by defaultOrder ascending", () => {
    registerWidget(fixture("c", { defaultOrder: 30 }));
    registerWidget(fixture("a", { defaultOrder: 10 }));
    registerWidget(fixture("b", { defaultOrder: 20 }));
    const result = resolveWidgetOrder({ explicitOrder: [], hidden: [] });
    expect(result.map((w) => w.id)).toEqual(["a", "b", "c"]);
  });

  it("resolveWidgetOrder ignores unknown ids in explicitOrder", () => {
    registerWidget(fixture("a"));
    const result = resolveWidgetOrder({
      explicitOrder: ["ghost", "a"],
      hidden: [],
    });
    expect(result.map((w) => w.id)).toEqual(["a"]);
  });
});
