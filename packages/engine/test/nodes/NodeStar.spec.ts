/**
 * NodeStar-specific contract.
 *
 * NodePolygon.spec.ts owns side-count normalization, cyclic anchors and the
 * shared polygon overrides. This suite verifies only star state and the
 * alternating outer/inner geometry supplied by NodeStar._getVertices().
 */
import { describe, expect, it } from "vitest";

import type { Vector2 } from "../../src/core/transform/types";
import { NodeType } from "../../src/nodes/base";
import { NodeStar } from "../../src/nodes/polygon/star";

const createStar = (width: number = 100, height: number = 100): NodeStar => {
  const star = new NodeStar("star");
  star.setSize(width, height);
  return star;
};

const expectPointToBeCloseTo = (actual: Vector2, expected: Vector2): void => {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
};

describe("NodeStar", () => {
  it("creates a five-point star with star-specific defaults", () => {
    const star = new NodeStar(7, "Spark");

    expect(star.id).toBe(7);
    expect(star.type).toBe(NodeType.Star);
    expect(star.getName()).toBe("Spark");
    expect(star.getSideCount()).toBe(5);
    expect(star.getInnerRatio()).toBe(0.5);
  });

  describe("inner ratio", () => {
    it("clamps the inner ratio to the supported range", () => {
      const star = createStar();

      star.setInnerRatio(-1);
      expect(star.getInnerRatio()).toBe(0);

      star.setInnerRatio(0.35);
      expect(star.getInnerRatio()).toBe(0.35);

      star.setInnerRatio(2);
      expect(star.getInnerRatio()).toBe(0.999);
    });

    it.todo("normalizes non-finite inner ratios instead of storing NaN");
  });

  describe("vertices", () => {
    it("generates one outer and one inner vertex for every point", () => {
      const star = createStar(100, 60);
      star.setSideCount(4);
      star.setInnerRatio(0.25);

      const vertices = star.getVertices();

      expect(vertices).toHaveLength(8);
      expectPointToBeCloseTo(vertices[0]!, { x: 50, y: 0 });
      expectPointToBeCloseTo(vertices[1]!, {
        x: 58.8388347648,
        y: 24.6966991411,
      });
      expectPointToBeCloseTo(vertices[2]!, { x: 100, y: 30 });
      expectPointToBeCloseTo(vertices[3]!, {
        x: 58.8388347648,
        y: 35.3033008589,
      });
      expectPointToBeCloseTo(vertices[4]!, { x: 50, y: 60 });
      expectPointToBeCloseTo(vertices[6]!, { x: 0, y: 30 });
    });

    it("updates only the inner vertices when the inner ratio changes", () => {
      const star = createStar();
      const original = star.getVertices();

      star.setInnerRatio(0.25);
      const updated = star.getVertices();

      for (let index = 0; index < updated.length; index += 2) {
        expectPointToBeCloseTo(updated[index]!, original[index]!);
      }

      expect(updated[1]).not.toEqual(original[1]);
      expect(updated[3]).not.toEqual(original[3]);
    });
  });

  it("builds the inherited polygon path from alternating star vertices", () => {
    const star = createStar();
    const vertices = star.getVertices();
    const commands = star.toPathCommands();

    expect(commands).toHaveLength(vertices.length + 1);
    expect(commands.at(-1)).toEqual({ type: "closePath" });

    for (let index = 0; index < vertices.length; index += 1) {
      const command = commands[index];

      expect(command?.type === "moveTo" || command?.type === "lineTo").toBe(
        true,
      );

      if (command?.type === "moveTo" || command?.type === "lineTo") {
        expectPointToBeCloseTo(command.point, vertices[index]!);
      }
    }
  });

  it("uses the concave star contour for inherited hit testing", () => {
    const star = createStar();
    star.setPivot(0, 0);

    expect(star.hitTest({ x: 50, y: 50 })).toBe(true);
    expect(star.hitTest({ x: 50, y: 5 })).toBe(true);
    expect(star.hitTest({ x: 20, y: 20 })).toBe(false);
  });
});
