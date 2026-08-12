/** RulerGuideLine value-object contract. */
import { describe, expect, it } from "vitest";
import { RulerGuideLine } from "../../../src/scene/layers";

describe("RulerGuideLine", () => {
  it("creates a visible one-pixel black guide with stable identity", () => {
    const guide = new RulerGuideLine(17);

    expect(guide.getId()).toBe(17);
    expect(guide.getValue()).toBe(0);
    expect(guide.getColor()).toBe("rgb(0, 0, 0)");
    expect(guide.getThickness()).toBe(1);
    expect(guide.isVisible()).toBe(true);
  });

  it("updates its coordinate and visibility", () => {
    const guide = new RulerGuideLine(1);

    guide.setValue(42.5);
    guide.setVisible(false);

    expect(guide.getValue()).toBe(42.5);
    expect(guide.isVisible()).toBe(false);
  });

  it("parses supported CSS colors and rejects invalid values", () => {
    const guide = new RulerGuideLine(1);

    guide.setColor("#0D93F3");
    expect(guide.getColor()).toBe("rgb(13, 147, 243)");

    guide.setColor("rgba(255, 0, 0, 0.5)");
    expect(guide.getColor()).toBe("rgba(255, 0, 0, 0.5)");

    expect(() => guide.setColor("not-a-color")).toThrow(
      'Invalid color value: "not-a-color"',
    );
  });

  it("rounds thickness to at least one pixel", () => {
    const guide = new RulerGuideLine(1);

    guide.setThickness(4.6);
    expect(guide.getThickness()).toBe(5);

    guide.setThickness(-10);
    expect(guide.getThickness()).toBe(1);
  });

  it("restores every mutable property on reset", () => {
    const guide = new RulerGuideLine(1);
    guide.setValue(100);
    guide.setColor("red");
    guide.setThickness(8);
    guide.setVisible(false);

    guide.reset();

    expect(guide.getId()).toBe(1);
    expect(guide.getValue()).toBe(0);
    expect(guide.getColor()).toBe("rgb(0, 0, 0)");
    expect(guide.getThickness()).toBe(1);
    expect(guide.isVisible()).toBe(true);
  });
});
