/**
 * NodeLine-specific contract.
 *
 * Shared shape appearance and geometry are covered by ShapeBase. This suite
 * verifies endpoints, line sizing, endings, path generation and hit testing.
 */
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/nodes/base";
import { LineCap, LineEnding, NodeLine } from "../../src/nodes/line";

const createLine = (): NodeLine => {
  const line = new NodeLine("line");
  line.setPivot(0, 0);
  return line;
};

describe("NodeLine", () => {
  it("creates a horizontal line with line-specific defaults", () => {
    const line = new NodeLine(7, "Connector");

    expect(line.id).toBe(7);
    expect(line.type).toBe(NodeType.Line);
    expect(line.getName()).toBe("Connector");
    expect(line.getStart()).toEqual({ x: 0, y: 0 });
    expect(line.getEnd()).toEqual({ x: 100, y: 0 });
    expect(line.getSize()).toEqual({ width: 100, height: 0 });
    expect(line.getStrokeThickness()).toBe(1);
    expect(line.getStrokeWidth()).toEqual([1]);
    expect(line.getLineCapStart()).toBe(LineCap.Butt);
    expect(line.getLineCapEnd()).toBe(LineCap.Butt);
    expect(line.getStartEnding()).toBe(LineEnding.None);
    expect(line.getEndEnding()).toBe(LineEnding.None);
  });

  describe("endpoints and size", () => {
    it("normalizes endpoint bounds while preserving world geometry", () => {
      const line = createLine();
      line.setPosition(5, 7);

      line.setStart({ x: -20, y: -10 });

      expect(line.getStart()).toEqual({ x: 0, y: 0 });
      expect(line.getEnd()).toEqual({ x: 120, y: 10 });
      expect(line.getSize()).toEqual({ width: 120, height: 10 });
      expect(line.getPosition()).toEqual({ x: -15, y: -3 });
    });

    it("returns defensive endpoint copies", () => {
      const line = createLine();
      const start = line.getStart();
      const end = line.getEnd();

      start.x = 99;
      end.y = 99;

      expect(line.getStart()).toEqual({ x: 0, y: 0 });
      expect(line.getEnd()).toEqual({ x: 100, y: 0 });
    });

    it("rescales endpoints through all size overrides", () => {
      const line = createLine();
      line.setEnd({ x: 100, y: 50 });

      line.setWidth(200);
      expect(line.getEnd()).toEqual({ x: 200, y: 50 });

      line.setHeight(100);
      expect(line.getEnd()).toEqual({ x: 200, y: 100 });

      line.setSize(50, 25);
      expect(line.getEnd()).toEqual({ x: 50, y: 25 });
      expect(line.getStrokeThickness()).toBe(1);
    });

    it.todo("copies endpoint objects provided to its setters");
  });

  it("normalizes thickness and maps the shared stroke-width API", () => {
    const line = createLine();

    line.setStrokeThickness(-5);
    expect(line.getStrokeThickness()).toBe(0);

    line.setStrokeThickness(Number.POSITIVE_INFINITY);
    expect(line.getStrokeThickness()).toBe(0);

    line.setStrokeWidth([8, 12]);
    expect(line.getStrokeThickness()).toBe(8);
    expect(line.getStrokeWidth()).toEqual([8]);
  });

  it("stores independent caps and decorative endings", () => {
    const line = createLine();

    line.setLineCapStart(LineCap.Round);
    line.setLineCapEnd(LineCap.Square);
    line.setStartEnding(LineEnding.CircleArrow);
    line.setEndEnding(LineEnding.TriangleArrow);

    expect(line.getLineCapStart()).toBe(LineCap.Round);
    expect(line.getLineCapEnd()).toBe(LineCap.Square);
    expect(line.getStartEnding()).toBe(LineEnding.CircleArrow);
    expect(line.getEndEnding()).toBe(LineEnding.TriangleArrow);
  });

  describe("path", () => {
    it("builds one open segment from its endpoints", () => {
      expect(createLine().toPathCommands()).toEqual([
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 100, y: 0 } },
      ]);
    });

    it("omits a degenerate segment", () => {
      const line = createLine();
      line.setEnd({ x: 0, y: 0 });

      expect(line.toPathCommands()).toEqual([]);
    });
  });

  describe("hit testing", () => {
    it("hit-tests a translated segment instead of its node box", () => {
      const line = createLine();
      line.setStrokeThickness(10);
      line.setPosition(10, 20);

      expect(line.hitTest({ x: 60, y: 20 })).toBe(true);
      expect(line.hitTest({ x: 60, y: 30 })).toBe(false);
    });

    it("treats a degenerate line as a thickness-sized point", () => {
      const line = createLine();
      line.setEnd({ x: 0, y: 0 });
      line.setStrokeThickness(10);
      line.setPosition(10, 20);

      expect(line.hitTest({ x: 13, y: 24 })).toBe(true);
      expect(line.hitTest({ x: 14, y: 24 })).toBe(false);
    });

    it.todo("uses thickness-expanded hit bounds for rotated segments and caps");
  });
});
