/**
 * NodePolygon-specific contract.
 *
 * ShapeBase.spec.ts owns the rounded-polygon and stroke-contour algorithms.
 * This suite verifies only polygon state, generated vertices and overrides.
 */
import { describe, expect, it } from "vitest";

import type { Vector2 } from "../../src/core/transform/types";
import { NodeType } from "../../src/nodes/base";
import { NodePolygon } from "../../src/nodes/polygon";

const createPolygon = (
  width: number = 100,
  height: number = 100,
): NodePolygon => {
  const polygon = new NodePolygon("polygon");
  polygon.setSize(width, height);
  return polygon;
};

const expectPointToBeCloseTo = (actual: Vector2, expected: Vector2): void => {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
};

describe("NodePolygon", () => {
  it("creates a triangle with polygon identity by default", () => {
    const polygon = new NodePolygon(7, "Badge");

    expect(polygon.id).toBe(7);
    expect(polygon.type).toBe(NodeType.Polygon);
    expect(polygon.getName()).toBe("Badge");
    expect(polygon.getSideCount()).toBe(3);
  });

  describe("side count and vertices", () => {
    it("rounds and clamps the side count to the supported range", () => {
      const polygon = createPolygon();

      polygon.setSideCount(4.6);
      expect(polygon.getSideCount()).toBe(5);

      polygon.setSideCount(2);
      expect(polygon.getSideCount()).toBe(3);

      polygon.setSideCount(100);
      expect(polygon.getSideCount()).toBe(60);
    });

    it("places regular-polygon vertices clockwise from the top", () => {
      const vertices = createPolygon().getVertices();

      expect(vertices).toHaveLength(3);
      expectPointToBeCloseTo(vertices[0]!, { x: 50, y: 0 });
      expectPointToBeCloseTo(vertices[1]!, {
        x: 93.3012701892,
        y: 75,
      });
      expectPointToBeCloseTo(vertices[2]!, {
        x: 6.6987298108,
        y: 75,
      });
    });

    it("rebuilds independent vertices after side-count and size changes", () => {
      const polygon = createPolygon();
      const original = polygon.getVertices();
      original[0]!.x = 999;

      polygon.setSideCount(4);
      polygon.setSize(80, 40);

      const vertices = polygon.getVertices();

      expect(vertices).toHaveLength(4);
      expectPointToBeCloseTo(vertices[0]!, { x: 40, y: 0 });
      expectPointToBeCloseTo(vertices[1]!, { x: 80, y: 20 });
      expectPointToBeCloseTo(vertices[2]!, { x: 40, y: 40 });
      expectPointToBeCloseTo(vertices[3]!, { x: 0, y: 20 });
    });

    it.todo("normalizes non-finite side counts instead of storing NaN");
  });

  it("maps every vertex to cyclic corner-radius anchors", () => {
    const polygon = createPolygon();
    polygon.setSideCount(4);

    const vertices = polygon.getVertices();
    const anchors = polygon.getCornerRadiusAnchors();

    expect(anchors).toHaveLength(4);
    for (let index = 0; index < anchors.length; index += 1) {
      expect(anchors[index]!.point).toEqual(vertices[index]);
      expect(anchors[index]!.previous).toEqual(
        vertices[(index - 1 + vertices.length) % vertices.length],
      );
      expect(anchors[index]!.next).toEqual(
        vertices[(index + 1) % vertices.length],
      );
    }
  });

  describe("overridden geometry", () => {
    it("builds its path from the generated vertices", () => {
      const polygon = createPolygon();
      polygon.setSideCount(4);

      const commands = polygon.toPathCommands();
      const vertices = polygon.getVertices();

      expect(commands.map(({ type }) => type)).toEqual([
        "moveTo",
        "lineTo",
        "lineTo",
        "lineTo",
        "closePath",
      ]);

      for (let index = 0; index < vertices.length; index += 1) {
        const command = commands[index];

        expect(command?.type === "moveTo" || command?.type === "lineTo").toBe(
          true,
        );

        if (command?.type === "moveTo" || command?.type === "lineTo") {
          expectPointToBeCloseTo(command.point, vertices[index]!);
        }
      }

      polygon.setCornerRadius([10]);

      expect(
        polygon.toPathCommands().filter(({ type }) => type === "arcTo"),
      ).toHaveLength(4);
    });

    it("delegates stroke contours to the shared polygon algorithm", () => {
      const polygon = createPolygon();

      expect(polygon.getStrokePath()).toBeNull();

      polygon.setStrokeWidth([10]);
      const path = polygon.getStrokePath();

      expect(path).not.toBeNull();
      expect(path!.outer.at(-1)).toEqual({ type: "closePath" });
      expect(path!.inner.at(-1)).toEqual({ type: "closePath" });
    });
  });

  describe("hit testing", () => {
    it("tests the generated polygon rather than its rectangular bounds", () => {
      const polygon = createPolygon();
      polygon.setPivot(0, 0);

      expect(polygon.hitTest({ x: 50, y: 50 })).toBe(true);
      expect(polygon.hitTest({ x: 50, y: 10 })).toBe(true);
      expect(polygon.hitTest({ x: 0, y: 0 })).toBe(false);
      expect(polygon.hitTest({ x: 99, y: 99 })).toBe(false);
    });

    it.todo("excludes polygon tips removed by corner rounding");
  });
});
