/**
 * NodeRect-specific contract.
 *
 * Generic node behavior belongs to NodeBase.spec.ts. Shared appearance,
 * effects and view geometry belong to ShapeBase.spec.ts.
 */
import { describe, expect, it } from "vitest";

import type { Rect } from "../../src/nodes/base";
import { NodeType } from "../../src/nodes/base";
import { NodeRect } from "../../src/nodes/rect";
import { StrokeAlign, type ShapePathCommand } from "../../src/nodes/shape";

type ArcCommand = Extract<ShapePathCommand, { type: "arcTo" }>;

const createRect = (width: number = 100, height: number = 60): NodeRect => {
  const rect = new NodeRect("rect");
  rect.setSize(width, height);
  return rect;
};

const getArcs = (
  commands: readonly ShapePathCommand[],
): readonly ArcCommand[] =>
  commands.filter((command): command is ArcCommand => command.type === "arcTo");

const getPathBounds = (commands: readonly ShapePathCommand[]): Rect | null => {
  const points: { x: number; y: number }[] = [];

  for (const command of commands) {
    switch (command.type) {
      case "moveTo":
      case "lineTo":
        points.push(command.point);
        break;

      case "arcTo":
        points.push(
          {
            x: command.center.x - command.radiusX,
            y: command.center.y,
          },
          {
            x: command.center.x + command.radiusX,
            y: command.center.y,
          },
          {
            x: command.center.x,
            y: command.center.y - command.radiusY,
          },
          {
            x: command.center.x,
            y: command.center.y + command.radiusY,
          },
        );
        break;

      case "quadraticCurveTo":
        points.push(command.control, command.point);
        break;

      case "closePath":
        break;
    }
  }

  if (points.length === 0) {
    return null;
  }

  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const expectPathBounds = (
  commands: readonly ShapePathCommand[],
  expected: Rect,
): void => {
  const actual = getPathBounds(commands);

  expect(actual).not.toBeNull();
  expect(actual!.x).toBeCloseTo(expected.x, 5);
  expect(actual!.y).toBeCloseTo(expected.y, 5);
  expect(actual!.width).toBeCloseTo(expected.width, 5);
  expect(actual!.height).toBeCloseTo(expected.height, 5);
};

describe("NodeRect", () => {
  it("creates a rectangle with its own identity", () => {
    const rect = new NodeRect(7, "Card");

    expect(rect.id).toBe(7);
    expect(rect.type).toBe(NodeType.Rect);
    expect(rect.getName()).toBe("Card");
  });

  describe("path", () => {
    it("builds a closed sharp rectangle", () => {
      expect(createRect().toPathCommands()).toEqual([
        { type: "moveTo", point: { x: 0, y: 0 } },
        { type: "lineTo", point: { x: 100, y: 0 } },
        { type: "lineTo", point: { x: 100, y: 60 } },
        { type: "lineTo", point: { x: 0, y: 60 } },
        { type: "lineTo", point: { x: 0, y: 0 } },
        { type: "closePath" },
      ]);
    });

    it("maps four corner radii to the correct arcs", () => {
      const rect = createRect(120, 100);
      rect.setCornerRadius([10, 20, 30, 40]);

      const arcs = getArcs(rect.toPathCommands());

      expect(arcs.map(({ radiusX }) => radiusX)).toEqual([20, 30, 40, 10]);
      expect(arcs.map(({ center }) => center)).toEqual([
        { x: 100, y: 20 },
        { x: 90, y: 70 },
        { x: 40, y: 60 },
        { x: 10, y: 10 },
      ]);
      expect(arcs.every(({ clockwise }) => clockwise)).toBe(true);
    });

    it("normalizes oversized radii without leaving local bounds", () => {
      const rect = createRect(100, 60);
      rect.setCornerRadius([100]);

      const arcs = getArcs(rect.toPathCommands());

      expect(arcs.map(({ radiusX }) => radiusX)).toEqual([30, 30, 30, 30]);
      expectPathBounds(rect.toPathCommands(), {
        x: 0,
        y: 0,
        width: 100,
        height: 60,
      });
    });
  });

  it("returns rectangle corners as cyclic corner-radius anchors", () => {
    const rect = createRect();

    expect(rect.getCornerRadiusAnchors()).toEqual([
      {
        point: { x: 0, y: 0 },
        previous: { x: 0, y: 60 },
        next: { x: 100, y: 0 },
      },
      {
        point: { x: 100, y: 0 },
        previous: { x: 0, y: 0 },
        next: { x: 100, y: 60 },
      },
      {
        point: { x: 100, y: 60 },
        previous: { x: 100, y: 0 },
        next: { x: 0, y: 60 },
      },
      {
        point: { x: 0, y: 60 },
        previous: { x: 100, y: 60 },
        next: { x: 0, y: 0 },
      },
    ]);
  });

  describe("stroke path", () => {
    it("returns null without usable rectangle stroke geometry", () => {
      expect(createRect().getStrokePath()).toBeNull();

      const degenerate = createRect(0, 60);
      degenerate.setStrokeWidth([10]);

      expect(degenerate.getStrokePath()).toBeNull();
    });

    it.each([
      [
        StrokeAlign.Inside,
        { x: 0, y: 0, width: 100, height: 60 },
        { x: 10, y: 10, width: 80, height: 40 },
      ],
      [
        StrokeAlign.Center,
        { x: -5, y: -5, width: 110, height: 70 },
        { x: 5, y: 5, width: 90, height: 50 },
      ],
      [
        StrokeAlign.Outside,
        { x: -10, y: -10, width: 120, height: 80 },
        { x: 0, y: 0, width: 100, height: 60 },
      ],
    ] as const)(
      "builds the expected %s stroke contours",
      (align, outerBounds, innerBounds) => {
        const rect = createRect();
        rect.setStrokeWidth([10]);
        rect.setStrokeAlign(align);

        const path = rect.getStrokePath();

        expect(path).not.toBeNull();
        expectPathBounds(path!.outer, outerBounds);
        expectPathBounds(path!.inner, innerBounds);
      },
    );

    it("applies asymmetric widths and adjusts rounded corners", () => {
      const rect = createRect();
      rect.setCornerRadius([20]);
      rect.setStrokeWidth([2, 4, 6, 8]);
      rect.setStrokeAlign(StrokeAlign.Outside);

      const path = rect.getStrokePath();

      expect(path).not.toBeNull();
      expectPathBounds(path!.outer, {
        x: -8,
        y: -2,
        width: 112,
        height: 68,
      });
      expect(getArcs(path!.outer).map(({ radiusX }) => radiusX)).toEqual([
        24, 26, 28, 28,
      ]);
    });

    it("omits an inner contour consumed by an inside stroke", () => {
      const rect = createRect(20, 20);
      rect.setStrokeWidth([15]);
      rect.setStrokeAlign(StrokeAlign.Inside);

      const path = rect.getStrokePath();

      expect(path).not.toBeNull();
      expect(path!.outer).not.toEqual([]);
      expect(path!.inner).toEqual([]);
    });
  });

  describe("hit testing", () => {
    it("uses rectangle boundaries for sharp corners", () => {
      const rect = createRect();
      rect.setPivot(0, 0);

      expect(rect.hitTest({ x: 0, y: 0 })).toBe(true);
      expect(rect.hitTest({ x: 100, y: 60 })).toBe(true);
      expect(rect.hitTest({ x: -0.01, y: 30 })).toBe(false);
      expect(rect.hitTest({ x: 100.01, y: 30 })).toBe(false);
    });

    it("excludes the cutout area of rounded corners", () => {
      const rect = createRect();
      rect.setPivot(0, 0);
      rect.setCornerRadius([20]);

      expect(rect.hitTest({ x: 5, y: 5 })).toBe(false);
      expect(rect.hitTest({ x: 10, y: 10 })).toBe(true);
      expect(rect.hitTest({ x: 20, y: 0 })).toBe(true);
    });

    it("includes the outside stroke in the rectangle hit area", () => {
      const rect = createRect();
      rect.setPivot(0, 0);
      rect.setStrokeWidth([10]);
      rect.setStrokeAlign(StrokeAlign.Outside);

      expect(rect.hitTest({ x: -10, y: 30 })).toBe(true);
      expect(rect.hitTest({ x: -10.01, y: 30 })).toBe(false);
    });

    it.todo(
      "keeps sharp outside-stroke corners hittable like the generated stroke path",
    );
  });
});
