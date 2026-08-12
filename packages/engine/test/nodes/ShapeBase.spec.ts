/**
 * Public-contract suite for ShapeBase.
 *
 * NodeBase owns the generic node contract. Concrete shape suites should only
 * cover their own state, geometry and overridden behavior after this suite.
 */
import { describe, expect, it } from "vitest";

import type { ID } from "../../src/core/types";
import { NodeType, type Rect } from "../../src/nodes/base";
import {
	FillMode,
	ShapeBase,
	StrokeAlign,
	StrokeDashCap,
	StrokeStyle,
	type ShapeCornerRadiusAnchor,
	type ShapePathCommand,
	type ShapeStrokePath,
} from "../../src/nodes/shape";

type ArcCommand = Extract<ShapePathCommand, { type: "arcTo" }>;

const FILL_DEFAULTS: Readonly<Record<FillMode, string>> = {
	[FillMode.Color]: "#D9D9D9",
	[FillMode.LinearGradient]:
		"linear-gradient(to left, #000000 0%, #FFFFFF 100%)",
	[FillMode.RadialGradient]:
		"radial-gradient(circle at center, #000000 0%, #FFFFFF 100%)",
	[FillMode.ConicGradient]:
		"conic-gradient(from 0deg at center, #000000 0%, #FFFFFF 100%)",
	[FillMode.DiamondGradient]:
		"diamond-gradient(at center, #000000 0%, #FFFFFF 100%)",
	[FillMode.MeshGradient]:
		"mesh-gradient(grid 2 2 method bilinear in oklab, vertex v00 0% 0% #F472B6, vertex v10 100% 0% #FBBF24, vertex v01 0% 100% #34D399, vertex v11 100% 100% #3B82F6, patch p00 v00 v10 v11 v01)",
};

const SQUARE_ANCHORS: readonly ShapeCornerRadiusAnchor[] = [
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
];

class ShapeFixture extends ShapeBase {
	constructor(id: ID = "shape") {
		super(id, NodeType.Base, "Shape");
	}

	public resolveShapeValues(
		values: readonly number[],
		count: number,
	): number[] {
		return this._resolveShapeValues(values, count);
	}

	public buildRoundedCornerPath(
		anchors: readonly ShapeCornerRadiusAnchor[],
	): readonly ShapePathCommand[] {
		return this._buildRoundedCornerPath(anchors);
	}

	public buildClosedPolygonStrokePath(
		anchors: readonly ShapeCornerRadiusAnchor[],
	): ShapeStrokePath | null {
		return this._buildClosedPolygonStrokePath(anchors);
	}
}

const createShape = (id: ID = "shape"): ShapeFixture => new ShapeFixture(id);

const getArcCommands = (
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

	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
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

const expectRectToBeCloseTo = (actual: Rect, expected: Rect): void => {
	expect(actual.x).toBeCloseTo(expected.x, 5);
	expect(actual.y).toBeCloseTo(expected.y, 5);
	expect(actual.width).toBeCloseTo(expected.width, 5);
	expect(actual.height).toBeCloseTo(expected.height, 5);
};

const expectPathBounds = (
	commands: readonly ShapePathCommand[],
	expected: Rect,
): void => {
	const actual = getPathBounds(commands);

	expect(actual).not.toBeNull();
	expectRectToBeCloseTo(actual!, expected);
};

describe("ShapeBase", () => {
	describe("construction", () => {
		it("adds the default shape size", () => {
			const shape = createShape();

			expect(shape.getSize()).toEqual({ width: 100, height: 100 });
		});

		it("creates an independent empty effect manager for each shape", () => {
			const first = createShape("first");
			const second = createShape("second");

			expect(first.effectManager.getAll()).toEqual([]);
			expect(second.effectManager.getAll()).toEqual([]);
			expect(first.effectManager).not.toBe(second.effectManager);
		});
	});

	describe("corner radius", () => {
		it("uses sharp corners by default and stores normalized values", () => {
			const shape = createShape();

			expect(shape.getCornerRadius()).toEqual([0]);

			shape.setCornerRadius([12, -4, Number.NaN, Number.POSITIVE_INFINITY]);

			expect(shape.getCornerRadius()).toEqual([12, 0, 0, 0]);

			shape.setCornerRadius([]);
			expect(shape.getCornerRadius()).toEqual([0]);
		});

		it("copies corner radius inputs", () => {
			const shape = createShape();
			const radii = [4, 8, 12, 16];

			shape.setCornerRadius(radii);
			radii[0] = 99;

			expect(shape.getCornerRadius()).toEqual([4, 8, 12, 16]);
		});

		it("returns a defensive corner radius copy", () => {
			const shape = createShape();
			shape.setCornerRadius([4, 8, 12, 16]);

			const radii = shape.getCornerRadius();
			radii[0] = 99;

			expect(shape.getCornerRadius()).toEqual([4, 8, 12, 16]);
		});
	});

	describe("fill", () => {
		it("uses the default color fill", () => {
			const shape = createShape();

			expect(shape.getFillMode()).toBe(FillMode.Color);
			expect(shape.getFill()).toBe(FILL_DEFAULTS[FillMode.Color]);
		});

		it("trims a fill and ignores an empty value", () => {
			const shape = createShape();

			shape.setFill("  #123456  ");
			expect(shape.getFill()).toBe("#123456");

			shape.setFill("   ");
			expect(shape.getFill()).toBe("#123456");
		});

		it("provides the canonical default for every fill mode", () => {
			for (const mode of Object.values(FillMode)) {
				const shape = createShape();

				shape.setFillMode(mode);

				expect(shape.getFillMode()).toBe(mode);
				expect(shape.getFill()).toBe(FILL_DEFAULTS[mode]);
			}
		});

		it("resets a mode to its canonical fill when it is selected again", () => {
			const shape = createShape();

			shape.setFillMode(FillMode.LinearGradient);
			shape.setFill("linear-gradient(red, blue)");
			shape.setFillMode(FillMode.Color);
			shape.setFillMode(FillMode.LinearGradient);

			expect(shape.getFill()).toBe(FILL_DEFAULTS[FillMode.LinearGradient]);
		});
	});

	describe("stroke appearance", () => {
		it("uses a disabled centered color stroke by default", () => {
			const shape = createShape();

			expect(shape.getStrokeWidth()).toEqual([0]);
			expect(shape.getStrokeMode()).toBe(FillMode.Color);
			expect(shape.getStrokeFill()).toBe(FILL_DEFAULTS[FillMode.Color]);
			expect(shape.getStrokeAlign()).toBe(StrokeAlign.Center);
			expect(shape.getStrokeStyle()).toBe(StrokeStyle.Solid);
		});

		it("normalizes stroke widths", () => {
			const shape = createShape();

			shape.setStrokeWidth([8, -4, Number.NaN, Number.POSITIVE_INFINITY]);

			expect(shape.getStrokeWidth()).toEqual([8, 0, 0, 0]);

			shape.setStrokeWidth([]);
			expect(shape.getStrokeWidth()).toEqual([0]);
		});

		it("copies stroke width inputs and outputs", () => {
			const shape = createShape();
			const widths = [2, 4, 6, 8];

			shape.setStrokeWidth(widths);
			widths[0] = 99;

			const returned = shape.getStrokeWidth();
			returned[1] = 99;

			expect(shape.getStrokeWidth()).toEqual([2, 4, 6, 8]);
		});

		it("trims the stroke fill and ignores an empty value", () => {
			const shape = createShape();

			shape.setStrokeFill("  #abcdef  ");
			expect(shape.getStrokeFill()).toBe("#abcdef");

			shape.setStrokeFill("   ");
			expect(shape.getStrokeFill()).toBe("#abcdef");
		});

		it("provides the canonical default for every stroke fill mode", () => {
			for (const mode of Object.values(FillMode)) {
				const shape = createShape();

				shape.setStrokeMode(mode);

				expect(shape.getStrokeMode()).toBe(mode);
				expect(shape.getStrokeFill()).toBe(FILL_DEFAULTS[mode]);
			}
		});

		it("changes stroke alignment and style independently", () => {
			const shape = createShape();

			shape.setStrokeAlign(StrokeAlign.Outside);
			shape.setStrokeStyle(StrokeStyle.Dashed);

			expect(shape.getStrokeAlign()).toBe(StrokeAlign.Outside);
			expect(shape.getStrokeStyle()).toBe(StrokeStyle.Dashed);
		});
	});

	describe("stroke style properties", () => {
		it("provides defaults for every configurable style", () => {
			const shape = createShape();

			expect(shape.getStrokeStyleProperties(StrokeStyle.Dashed)).toEqual({
				length: 12,
				gap: 8,
				cap: StrokeDashCap.Flat,
			});
			expect(shape.getStrokeStyleProperties(StrokeStyle.Dotted)).toEqual({
				length: 4,
				gap: 8,
			});
			expect(shape.getStrokeStyleProperties(StrokeStyle.Custom)).toEqual({
				length: 12,
				gap: 8,
				shape: undefined,
			});
		});

		it("sets dashed properties and preserves an omitted cap", () => {
			const shape = createShape();

			shape.setStrokeStyleProperties(
				StrokeStyle.Dashed,
				16,
				6,
				StrokeDashCap.Round,
			);
			shape.setStrokeStyleProperties(StrokeStyle.Dashed, 10, 5);

			expect(shape.getStrokeStyleProperties(StrokeStyle.Dashed)).toEqual({
				length: 10,
				gap: 5,
				cap: StrokeDashCap.Round,
			});
		});

		it("keeps dotted and custom properties independent", () => {
			const shape = createShape();

			shape.setStrokeStyleProperties(StrokeStyle.Dotted, [2, 4], [6, 8]);
			shape.setStrokeStyleProperties(StrokeStyle.Custom, 10, 5, "triangle");

			expect(shape.getStrokeStyleProperties(StrokeStyle.Dotted)).toEqual({
				length: [2, 4],
				gap: [6, 8],
			});
			expect(shape.getStrokeStyleProperties(StrokeStyle.Custom)).toEqual({
				length: 10,
				gap: 5,
				shape: "triangle",
			});
		});

		it("copies stroke pattern inputs and outputs", () => {
			const shape = createShape();
			const lengths = [12, 4];
			const gaps = [8, 2];

			shape.setStrokeStyleProperties(StrokeStyle.Dashed, lengths, gaps);
			lengths[0] = 99;
			gaps[0] = 99;

			const properties = shape.getStrokeStyleProperties(StrokeStyle.Dashed);
			(properties.length as number[])[0] = 77;
			(properties.gap as number[])[0] = 77;

			expect(shape.getStrokeStyleProperties(StrokeStyle.Dashed)).toMatchObject({
				length: [12, 4],
				gap: [8, 2],
			});
		});

		it("normalizes invalid and empty stroke pattern metrics", () => {
			const shape = createShape();

			shape.setStrokeStyleProperties(
				StrokeStyle.Dashed,
				[-4, Number.NaN],
				[Number.POSITIVE_INFINITY, -2],
			);

			expect(shape.getStrokeStyleProperties(StrokeStyle.Dashed)).toMatchObject({
				length: [0, 0],
				gap: [0, 0],
			});

			shape.setStrokeStyleProperties(StrokeStyle.Dashed, [], []);
			expect(shape.getStrokeStyleProperties(StrokeStyle.Dashed)).toMatchObject({
				length: [0],
				gap: [0],
			});
		});

		it("rejects mismatched array pattern lengths", () => {
			const shape = createShape();

			expect(() =>
				shape.setStrokeStyleProperties(StrokeStyle.Dashed, [12, 4], [8]),
			).toThrow(RangeError);
		});
	});

	describe("shared view geometry", () => {
		it("builds the base rectangular path from local bounds", () => {
			const shape = createShape();
			shape.setSize(120, 80);

			expect(shape.toPathCommands()).toEqual([
				{ type: "moveTo", point: { x: 0, y: 0 } },
				{ type: "lineTo", point: { x: 120, y: 0 } },
				{ type: "lineTo", point: { x: 120, y: 80 } },
				{ type: "lineTo", point: { x: 0, y: 80 } },
				{ type: "closePath" },
			]);
		});

		it("exposes empty base hooks for corner anchors and stroke paths", () => {
			const shape = createShape();

			expect(shape.getCornerRadiusAnchors()).toEqual([]);
			expect(shape.getStrokePath()).toBeNull();
		});

		it("expands local view bounds according to stroke alignment", () => {
			const cases: readonly [StrokeAlign, Rect][] = [
				[StrokeAlign.Inside, { x: 0, y: 0, width: 100, height: 60 }],
				[StrokeAlign.Center, { x: -10, y: -10, width: 120, height: 80 }],
				[StrokeAlign.Outside, { x: -20, y: -20, width: 140, height: 100 }],
			];

			for (const [align, expected] of cases) {
				const shape = createShape();
				shape.setSize(100, 60);
				shape.setStrokeWidth([20]);
				shape.setStrokeAlign(align);

				expect(shape.getLocalViewOBB()).toEqual(expected);
			}
		});

		it("uses the largest side width for conservative view bounds", () => {
			const shape = createShape();
			shape.setSize(100, 60);
			shape.setStrokeWidth([2, 4, 6, 8]);
			shape.setStrokeAlign(StrokeAlign.Outside);

			expect(shape.getLocalViewOBB()).toEqual({
				x: -8,
				y: -8,
				width: 116,
				height: 76,
			});
		});

		it("transforms local view bounds into world corners", () => {
			const shape = createShape();
			shape.setSize(100, 50);
			shape.setPivot(0, 0);
			shape.setPosition(10, 20);
			shape.setStrokeWidth([10]);
			shape.setStrokeAlign(StrokeAlign.Outside);

			expect(shape.getWorldViewCorners()).toEqual([
				{ x: 0, y: 10 },
				{ x: 120, y: 10 },
				{ x: 120, y: 80 },
				{ x: 0, y: 80 },
			]);
		});

		it("returns stroke-aware world OBB and AABB", () => {
			const shape = createShape();
			shape.setSize(100, 50);
			shape.setPosition(10, 20);
			shape.setRotation(90);

			const obb = shape.getWorldViewOBB();

			expect(obb.center.x).toBeCloseTo(10, 5);
			expect(obb.center.y).toBeCloseTo(20, 5);
			expect(obb.width).toBeCloseTo(100, 5);
			expect(obb.height).toBeCloseTo(50, 5);
			expect(obb.rotation).toBeCloseTo(90, 5);
			expectRectToBeCloseTo(shape.getWorldViewAABB(), {
				x: -15,
				y: -30,
				width: 50,
				height: 100,
			});
		});

		it("returns a complete geometry snapshot with a copied matrix", () => {
			const shape = createShape();
			shape.setPosition(10, 20);
			shape.setStrokeWidth([8]);
			shape.setStrokeAlign(StrokeAlign.Outside);

			const worldMatrix = shape.getWorldMatrix();
			const geometry = shape.getGeometry();

			expect(geometry.worldMatrix).toEqual(worldMatrix);
			expect(geometry.worldMatrix).not.toBe(worldMatrix);
			expect(geometry.localOBB).toEqual(shape.getLocalOBB());
			expect(geometry.worldCorners).toEqual(shape.getWorldCorners());
			expect(geometry.worldOBB).toEqual(shape.getWorldOBB());
			expect(geometry.worldAABB).toEqual(shape.getWorldAABB());
			expect(geometry.localViewOBB).toEqual(shape.getLocalViewOBB());
			expect(geometry.worldViewCorners).toEqual(shape.getWorldViewCorners());
			expect(geometry.worldViewOBB).toEqual(shape.getWorldViewOBB());
			expect(geometry.worldViewAABB).toEqual(shape.getWorldViewAABB());
		});
	});

	describe("shared polygon helpers", () => {
		it("resolves shape value lists to the requested length", () => {
			const shape = createShape();

			expect(shape.resolveShapeValues([], 4)).toEqual([0, 0, 0, 0]);
			expect(shape.resolveShapeValues([7], 4)).toEqual([7, 7, 7, 7]);
			expect(shape.resolveShapeValues([1, 2], 4)).toEqual([1, 2, 0, 0]);
			expect(shape.resolveShapeValues([1], 0)).toEqual([]);
		});

		it("builds a closed sharp polygon path", () => {
			const shape = createShape();

			expect(shape.buildRoundedCornerPath(SQUARE_ANCHORS)).toEqual([
				{ type: "moveTo", point: { x: 0, y: 0 } },
				{ type: "lineTo", point: { x: 100, y: 0 } },
				{ type: "lineTo", point: { x: 100, y: 60 } },
				{ type: "lineTo", point: { x: 0, y: 60 } },
				{ type: "closePath" },
			]);
		});

		it("builds rounded polygon corners and clamps oversized radii", () => {
			const shape = createShape();
			shape.setCornerRadius([100]);

			const commands = shape.buildRoundedCornerPath(SQUARE_ANCHORS);
			const arcs = getArcCommands(commands);

			expect(arcs).toHaveLength(4);
			expect(arcs.every((arc) => arc.clockwise)).toBe(true);
			for (const arc of arcs) {
				expect(arc.radiusX).toBeCloseTo(30, 5);
				expect(arc.radiusY).toBeCloseTo(30, 5);
			}
			expect(commands.at(-1)).toEqual({ type: "closePath" });
		});

		it("rejects unusable closed polygon stroke geometry", () => {
			const shape = createShape();
			shape.setStrokeWidth([10]);
			const collinear: readonly ShapeCornerRadiusAnchor[] = [
				{
					point: { x: 0, y: 0 },
					previous: { x: 20, y: 0 },
					next: { x: 10, y: 0 },
				},
				{
					point: { x: 10, y: 0 },
					previous: { x: 0, y: 0 },
					next: { x: 20, y: 0 },
				},
				{
					point: { x: 20, y: 0 },
					previous: { x: 10, y: 0 },
					next: { x: 0, y: 0 },
				},
			];

			expect(shape.buildClosedPolygonStrokePath(SQUARE_ANCHORS)).not.toBeNull();
			shape.setStrokeWidth([0]);
			expect(shape.buildClosedPolygonStrokePath(SQUARE_ANCHORS)).toBeNull();
			shape.setStrokeWidth([10]);
			expect(
				shape.buildClosedPolygonStrokePath(SQUARE_ANCHORS.slice(0, 2)),
			).toBeNull();
			expect(shape.buildClosedPolygonStrokePath(collinear)).toBeNull();
		});

		it("builds polygon stroke contours for every alignment", () => {
			const cases: readonly [StrokeAlign, Rect, Rect][] = [
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
			];

			for (const [align, outerBounds, innerBounds] of cases) {
				const shape = createShape();
				shape.setStrokeWidth([10]);
				shape.setStrokeAlign(align);

				const path = shape.buildClosedPolygonStrokePath(SQUARE_ANCHORS);

				expect(path).not.toBeNull();
				expectPathBounds(path!.outer, outerBounds);
				expectPathBounds(path!.inner, innerBounds);
			}
		});

		it("adjusts rounded polygon corners for a centered stroke", () => {
			const shape = createShape();
			shape.setCornerRadius([20]);
			shape.setStrokeWidth([10]);
			shape.setStrokeAlign(StrokeAlign.Center);

			const path = shape.buildClosedPolygonStrokePath(SQUARE_ANCHORS);

			expect(path).not.toBeNull();
			expect(getArcCommands(path!.outer).map((arc) => arc.radiusX)).toEqual([
				25, 25, 25, 25,
			]);
			expect(getArcCommands(path!.inner).map((arc) => arc.radiusX)).toEqual([
				15, 15, 15, 15,
			]);
		});

		it.todo("omits a polygon inner contour after it collapses");
	});

	describe("serialization", () => {
		it.todo("serializes and restores shared appearance, stroke, and effects");
	});
});
