/**
 * NodeEllipse-specific contract.
 *
 * This suite covers ellipse state and overridden geometry only. Generic node
 * and shared shape behavior are covered by NodeBase and ShapeBase suites.
 */
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/nodes/base";
import { NodeEllipse } from "../../src/nodes/ellipse";
import type { ShapePathCommand } from "../../src/nodes/shape";

type ArcCommand = Extract<ShapePathCommand, { type: "arcTo" }>;

const createEllipse = (
  width: number = 100,
  height: number = 60,
): NodeEllipse => {
  const ellipse = new NodeEllipse("ellipse");
  ellipse.setSize(width, height);
  return ellipse;
};

const getArcs = (
  commands: readonly ShapePathCommand[],
): readonly ArcCommand[] =>
  commands.filter((command): command is ArcCommand => command.type === "arcTo");

const getCommandTypes = (
  commands: readonly ShapePathCommand[],
): ShapePathCommand["type"][] => commands.map(({ type }) => type);

describe("NodeEllipse", () => {
  it("creates a full ellipse with ellipse-specific defaults", () => {
    const ellipse = new NodeEllipse(7, "Arc");

    expect(ellipse.id).toBe(7);
    expect(ellipse.type).toBe(NodeType.Ellipse);
    expect(ellipse.getName()).toBe("Arc");
    expect(ellipse.getInnerRatio()).toBe(0);
    expect(ellipse.getStartAngle()).toBe(0);
    expect(ellipse.getEndAngle()).toBe(360);
    expect(ellipse.getSweepAngle()).toBe(360);
  });

  describe("ellipse state", () => {
    it("clamps the inner ratio to the supported range", () => {
      const ellipse = createEllipse();

      ellipse.setInnerRatio(-1);
      expect(ellipse.getInnerRatio()).toBe(0);

      ellipse.setInnerRatio(0.4);
      expect(ellipse.getInnerRatio()).toBe(0.4);

      ellipse.setInnerRatio(2);
      expect(ellipse.getInnerRatio()).toBe(0.999);
    });

    it("stores start and end angles in degrees and exposes their raw sweep", () => {
      const ellipse = createEllipse();

      ellipse.setStartAngle(300);
      ellipse.setEndAngle(420);

      expect(ellipse.getStartAngle()).toBeCloseTo(300, 10);
      expect(ellipse.getEndAngle()).toBeCloseTo(420, 10);
      expect(ellipse.getSweepAngle()).toBeCloseTo(120, 10);
    });
  });

  describe("path", () => {
    it("builds one clockwise contour for a full ellipse", () => {
      const commands = createEllipse().toPathCommands();

      expect(commands).toEqual([
        { type: "moveTo", point: { x: 100, y: 30 } },
        {
          type: "arcTo",
          center: { x: 50, y: 30 },
          radiusX: 50,
          radiusY: 30,
          startAngle: 0,
          endAngle: 360,
          clockwise: true,
        },
        { type: "closePath" },
      ]);
    });

    it("adds a counter-clockwise inner contour for a full ring", () => {
      const ellipse = createEllipse();
      ellipse.setInnerRatio(0.5);

      const commands = ellipse.toPathCommands();
      const arcs = getArcs(commands);

      expect(getCommandTypes(commands)).toEqual([
        "moveTo",
        "arcTo",
        "closePath",
        "moveTo",
        "arcTo",
        "closePath",
      ]);
      expect(arcs[0]).toMatchObject({
        radiusX: 50,
        radiusY: 30,
        clockwise: true,
      });
      expect(arcs[1]).toMatchObject({
        radiusX: 25,
        radiusY: 15,
        startAngle: 360,
        endAngle: 0,
        clockwise: false,
      });
    });

    it("builds a closed sector for a partial ellipse", () => {
      const ellipse = createEllipse();
      ellipse.setEndAngle(90);

      const commands = ellipse.toPathCommands();
      const arcs = getArcs(commands);

      expect(getCommandTypes(commands)).toEqual([
        "moveTo",
        "arcTo",
        "quadraticCurveTo",
        "lineTo",
        "lineTo",
        "quadraticCurveTo",
        "closePath",
      ]);
      expect(arcs).toHaveLength(1);
      expect(arcs[0]).toMatchObject({
        startAngle: 0,
        endAngle: 90,
        clockwise: true,
      });
    });

    it("builds outer and reverse inner arcs for a partial ring", () => {
      const ellipse = createEllipse();
      ellipse.setInnerRatio(0.5);
      ellipse.setEndAngle(90);

      const commands = ellipse.toPathCommands();
      const arcs = getArcs(commands);

      expect(getCommandTypes(commands)).toEqual([
        "moveTo",
        "arcTo",
        "quadraticCurveTo",
        "lineTo",
        "quadraticCurveTo",
        "arcTo",
        "quadraticCurveTo",
        "lineTo",
        "quadraticCurveTo",
        "closePath",
      ]);
      expect(arcs).toHaveLength(2);
      expect(arcs[0]).toMatchObject({
        radiusX: 50,
        radiusY: 30,
        clockwise: true,
      });
      expect(arcs[1]).toMatchObject({
        radiusX: 25,
        radiusY: 15,
        clockwise: false,
      });
    });

    it("applies corner radii to partial-sector cuts", () => {
      const ellipse = createEllipse();
      ellipse.setEndAngle(90);
      ellipse.setCornerRadius([8, 12]);

      const commands = ellipse.toPathCommands();
      const curves = commands.filter(
        (command) => command.type === "quadraticCurveTo",
      );
      const [arc] = getArcs(commands);

      expect(curves).toHaveLength(2);
      expect(arc!.startAngle).toBeGreaterThan(0);
      expect(arc!.endAngle).toBeLessThan(90);
    });

    it("returns no path for degenerate ellipse bounds", () => {
      expect(createEllipse(0, 60).toPathCommands()).toEqual([]);
      expect(createEllipse(100, 0).toPathCommands()).toEqual([]);
    });
  });

  describe("corner-radius anchors", () => {
    it("does not expose corner anchors for a full ellipse", () => {
      expect(createEllipse().getCornerRadiusAnchors()).toEqual([]);
    });

    it("exposes two cut anchors for a sector and four for a ring", () => {
      const ellipse = createEllipse();
      ellipse.setEndAngle(90);

      const sectorAnchors = ellipse.getCornerRadiusAnchors();

      expect(sectorAnchors).toHaveLength(2);
      expect(sectorAnchors[0]).toEqual({
        point: { x: 100, y: 30 },
        previous: { x: 50, y: 30 },
        next: { x: 50, y: 60 },
        handleTarget: { x: 75, y: 30 },
      });

      ellipse.setInnerRatio(0.5);
      const ringAnchors = ellipse.getCornerRadiusAnchors();

      expect(ringAnchors).toHaveLength(4);
      expect(ringAnchors[0]!.handleTarget).toEqual({ x: 87.5, y: 30 });
      expect(ringAnchors[3]!.handleTarget).toEqual({ x: 87.5, y: 30 });
    });
  });

  describe("hit testing", () => {
    it("uses the elliptical boundary and removes an inner hole", () => {
      const ellipse = createEllipse();
      ellipse.setPivot(0, 0);

      expect(ellipse.hitTest({ x: 50, y: 30 })).toBe(true);
      expect(ellipse.hitTest({ x: 100, y: 30 })).toBe(true);
      expect(ellipse.hitTest({ x: 0, y: 0 })).toBe(false);

      ellipse.setInnerRatio(0.5);

      expect(ellipse.hitTest({ x: 50, y: 30 })).toBe(false);
      expect(ellipse.hitTest({ x: 80, y: 30 })).toBe(true);
    });

    it("respects normal and wrapped angle ranges", () => {
      const ellipse = createEllipse();
      ellipse.setPivot(0, 0);
      ellipse.setEndAngle(90);

      expect(ellipse.hitTest({ x: 75, y: 45 })).toBe(true);
      expect(ellipse.hitTest({ x: 25, y: 15 })).toBe(false);

      ellipse.setStartAngle(300);
      ellipse.setEndAngle(60);

      expect(ellipse.hitTest({ x: 80, y: 30 })).toBe(true);
      expect(ellipse.hitTest({ x: 50, y: 55 })).toBe(false);
    });
  });
});
