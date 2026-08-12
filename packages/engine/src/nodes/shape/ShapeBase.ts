import { MathF32, EPSILON } from "../../core/math";
import type { ID } from "../../core/types";
import { NodeBase, NodeType, type OrientedRect, type Rect } from "../base";
import {
	StrokeAlign,
	type CornerRadius,
	type ShapeGeometry,
	type IShapeBase,
	type ShapePathCommand,
	type StrokeWidth,
	FillMode,
	type ShapeCornerRadiusAnchor,
	type RoundedCornerGeometry,
	type ShapeStrokePath,
	StrokeStyle,
	type StrokeCustomStyleProperties,
	type StrokeDottedStyleProperties,
	type StrokeDashedStyleProperties,
	StrokeDashCap,
	type StrokeStyleLength,
	type StrokeStyleGap,
	type StrokeStyleProperties,
	type ConfigurableStrokeStyle,
	type StrokeStyleShape,
} from "./types";
import { ShapeEffectManager } from "./effect";
import type { Vector2 } from "../../core/transform/types";

export class ShapeBase extends NodeBase implements IShapeBase {
	private static readonly DEFAULT_FILLS: Readonly<Record<FillMode, string>> =
		{
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

	public readonly effectManager: ShapeEffectManager;

	private _cornerRadius: CornerRadius;
	private _fillMode: FillMode;
	private _fills: Record<FillMode, string>;

	private _strokeWidth: StrokeWidth;
	private _strokeFillMode: FillMode;
	private _strokeFills: Record<FillMode, string>;
	private _strokeAlign: StrokeAlign;
	private _strokeStyle: StrokeStyle;
	private _strokeDashedStyleProperties: StrokeDashedStyleProperties;
	private _strokeDottedStyleProperties: StrokeDottedStyleProperties;
	private _strokeCustomStyleProperties: StrokeCustomStyleProperties;

	constructor(id: ID, type: NodeType, name?: string) {
		super(id, type, name);
		this.setSize(100, 100);

		this._cornerRadius = [0];
		this._fillMode = FillMode.Color;
		this._fills = { ...ShapeBase.DEFAULT_FILLS };

		this._strokeWidth = [0];
		this._strokeFillMode = FillMode.Color;
		this._strokeFills = { ...ShapeBase.DEFAULT_FILLS };
		this._strokeAlign = StrokeAlign.Center;
		this._strokeStyle = StrokeStyle.Solid;
		this._strokeDashedStyleProperties = {
			length: 12,
			gap: 8,
			cap: StrokeDashCap.Flat,
		};

		this._strokeDottedStyleProperties = {
			length: 4,
			gap: 8,
		};

		this._strokeCustomStyleProperties = {
			length: 12,
			gap: 8,
		};

		this.effectManager = new ShapeEffectManager();
	}

	/***********************************************************/
	/*                        Appearance                       */
	/***********************************************************/
	public getCornerRadius(): CornerRadius {
		return [...this._cornerRadius];
	}

	public setCornerRadius(value: CornerRadius): void {
		const next = this._normalizeAppearanceValues(value);

		if (this._numberArraysEqual(next, this._cornerRadius)) {
			return;
		}

		this._cornerRadius = next;
	}

	public getFillMode(): FillMode {
		return this._fillMode;
	}

	public setFillMode(value: FillMode): void {
		if (value === this._fillMode) {
			return;
		}

		this._fillMode = value;
		this._fills[value] = ShapeBase.DEFAULT_FILLS[value];
	}

	public getFill(): string {
		return (
			this._fills[this._fillMode] ||
			ShapeBase.DEFAULT_FILLS[FillMode.Color]
		);
	}

	public setFill(value: string): void {
		const fill = value.trim();

		if (!fill || fill === this._fills[this._fillMode]) {
			return;
		}

		this._fills[this._fillMode] = fill;
	}

	/***********************************************************/
	/*                          Stroke                         */
	/***********************************************************/
	public getStrokeWidth(): StrokeWidth {
		return [...this._strokeWidth];
	}

	public setStrokeWidth(value: StrokeWidth): void {
		const next = this._normalizeAppearanceValues(value);

		if (this._numberArraysEqual(next, this._strokeWidth)) {
			return;
		}

		this._strokeWidth = next;
	}

	public getStrokeFill(): string {
		return this._strokeFills[this._strokeFillMode];
	}

	public setStrokeFill(value: string): void {
		const fill = value.trim();

		if (!fill) {
			return;
		}

		if (fill === this._strokeFills[this._strokeFillMode]) {
			return;
		}

		this._strokeFills[this._strokeFillMode] = fill;
	}

	public getStrokeMode(): FillMode {
		return this._strokeFillMode;
	}

	public setStrokeMode(value: FillMode): void {
		if (value === this._strokeFillMode) {
			return;
		}

		this._strokeFillMode = value;
		this._strokeFills[value] = ShapeBase.DEFAULT_FILLS[value];
	}

	public getStrokeAlign(): StrokeAlign {
		return this._strokeAlign;
	}

	public setStrokeAlign(value: StrokeAlign): void {
		if (value === this._strokeAlign) {
			return;
		}
		this._strokeAlign = value;
	}

	public getStrokePath(): ShapeStrokePath | null {
		return null;
	}

	public getStrokeStyle(): StrokeStyle {
		return this._strokeStyle;
	}

	public setStrokeStyle(value: StrokeStyle): void {
		if (value === this._strokeStyle) {
			return;
		}
		this._strokeStyle = value;
	}

	public getStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dashed,
	): StrokeDashedStyleProperties;

	public getStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dotted,
	): StrokeDottedStyleProperties;

	public getStrokeStyleProperties(
		strokeStyle: StrokeStyle.Custom,
	): StrokeCustomStyleProperties;

	public getStrokeStyleProperties(
		strokeStyle: ConfigurableStrokeStyle,
	): StrokeStyleProperties {
		switch (strokeStyle) {
			case StrokeStyle.Dashed:
				return {
					length: this._cloneStrokeStyleMetric(
						this._strokeDashedStyleProperties.length,
					),

					gap: this._cloneStrokeStyleMetric(
						this._strokeDashedStyleProperties.gap,
					),

					cap: this._strokeDashedStyleProperties.cap,
				};

			case StrokeStyle.Dotted:
				return {
					length: this._cloneStrokeStyleMetric(
						this._strokeDottedStyleProperties.length,
					),

					gap: this._cloneStrokeStyleMetric(
						this._strokeDottedStyleProperties.gap,
					),
				};

			case StrokeStyle.Custom:
				return {
					length: this._cloneStrokeStyleMetric(
						this._strokeCustomStyleProperties.length,
					),

					gap: this._cloneStrokeStyleMetric(
						this._strokeCustomStyleProperties.gap,
					),

					shape: this._strokeCustomStyleProperties.shape,
				};
		}
	}

	public setStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dashed,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
		cap?: StrokeDashCap,
	): void;

	public setStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dotted,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
	): void;

	public setStrokeStyleProperties(
		strokeStyle: StrokeStyle.Custom,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
		shape?: StrokeStyleShape,
	): void;

	public setStrokeStyleProperties(
		strokeStyle: ConfigurableStrokeStyle,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
		option?: StrokeDashCap | StrokeStyleShape,
	): void {
		const { length: normalizedLength, gap: normalizedGap } =
			this._normalizeStrokeStylePattern(length, gap);

		switch (strokeStyle) {
			case StrokeStyle.Dashed:
				this._strokeDashedStyleProperties = {
					length: normalizedLength,
					gap: normalizedGap,

					cap:
						(option as StrokeDashCap | undefined) ??
						this._strokeDashedStyleProperties.cap,
				};

				return;

			case StrokeStyle.Dotted:
				this._strokeDottedStyleProperties = {
					length: normalizedLength,
					gap: normalizedGap,
				};

				return;

			case StrokeStyle.Custom:
				this._strokeCustomStyleProperties = {
					length: normalizedLength,
					gap: normalizedGap,

					...(typeof option === "string" ? { shape: option } : {}),
				};

				return;
		}
	}

	/***********************************************************/
	/*                       View Bounds                       */
	/***********************************************************/
	public getGeometry(): ShapeGeometry {
		const worldMatrix = this.getWorldMatrix();

		return {
			worldMatrix: {
				a: worldMatrix.a,
				b: worldMatrix.b,
				c: worldMatrix.c,
				d: worldMatrix.d,
				tx: worldMatrix.tx,
				ty: worldMatrix.ty,
			},

			localOBB: this.getLocalOBB(),
			worldCorners: this.getWorldCorners(),
			worldOBB: this.getWorldOBB(),
			worldAABB: this.getWorldAABB(),

			localViewOBB: this.getLocalViewOBB(),
			worldViewCorners: this.getWorldViewCorners(),
			worldViewOBB: this.getWorldViewOBB(),
			worldViewAABB: this.getWorldViewAABB(),
		};
	}

	public toPathCommands(): readonly ShapePathCommand[] {
		const bounds = this.getLocalOBB();

		return [
			{
				type: "moveTo",
				point: {
					x: bounds.x,
					y: bounds.y,
				},
			},
			{
				type: "lineTo",
				point: {
					x: MathF32.add(bounds.x, bounds.width),
					y: bounds.y,
				},
			},
			{
				type: "lineTo",
				point: {
					x: MathF32.add(bounds.x, bounds.width),
					y: MathF32.add(bounds.y, bounds.height),
				},
			},
			{
				type: "lineTo",
				point: {
					x: bounds.x,
					y: MathF32.add(bounds.y, bounds.height),
				},
			},
			{
				type: "closePath",
			},
		];
	}

	public toStrokePathCommands(): readonly ShapePathCommand[] {
		return this.toPathCommands();
	} 

	public getLocalViewOBB(): Rect {
		const bounds = this.getLocalOBB();
		const outset = this._getViewStrokeOutset();

		return {
			x: MathF32.sub(bounds.x, outset),
			y: MathF32.sub(bounds.y, outset),
			width: MathF32.add(bounds.width, MathF32.mul(outset, 2)),
			height: MathF32.add(bounds.height, MathF32.mul(outset, 2)),
		};
	}

	public getWorldViewCorners(): [Vector2, Vector2, Vector2, Vector2] {
		const worldMatrix = this.getWorldMatrix();
		const local = this.getLocalViewOBB();

		const x = local.x;
		const y = local.y;
		const w = local.width;
		const h = local.height;

		return [
			this._applyMatrixToPoint(worldMatrix, { x, y }),
			this._applyMatrixToPoint(worldMatrix, { x: MathF32.add(x, w), y }),
			this._applyMatrixToPoint(worldMatrix, {
				x: MathF32.add(x, w),
				y: MathF32.add(y, h),
			}),
			this._applyMatrixToPoint(worldMatrix, { x, y: MathF32.add(y, h) }),
		];
	}

	public getWorldViewOBB(): OrientedRect {
		const corners = this.getWorldViewCorners();

		const center = {
			x: MathF32.toF32((corners[0].x + corners[2].x) / 2),
			y: MathF32.toF32((corners[0].y + corners[2].y) / 2),
		};

		const width = Math.hypot(
			corners[1].x - corners[0].x,
			corners[1].y - corners[0].y,
		);

		const height = Math.hypot(
			corners[2].x - corners[1].x,
			corners[2].y - corners[1].y,
		);

		return {
			center,
			width: MathF32.toF32(width),
			height: MathF32.toF32(height),
			rotation: this.getWorldRotation(),
		};
	}

	public getWorldViewAABB(): Rect {
		return this._getAABBFromPoints(this.getWorldViewCorners());
	}

	public getCornerRadiusAnchors(): readonly ShapeCornerRadiusAnchor[] {
		return [];
	}

	protected _resolveShapeValues(
		values: readonly number[],
		count: number,
	): number[] {
		if (count <= 0) {
			return [];
		}

		if (values.length === 0) {
			return new Array(count).fill(0);
		}

		if (values.length === 1) {
			return new Array(count).fill(values[0]!);
		}

		return Array.from({ length: count }, (_, index) => values[index] ?? 0);
	}

	protected _buildClosedPolygonStrokePath(
		anchors: readonly ShapeCornerRadiusAnchor[],
	): ShapeStrokePath | null {
		const count = anchors.length;

		if (count < 3) {
			return null;
		}

		const winding = this._getCornerContourWinding(anchors);

		if (Math.abs(winding) <= EPSILON) {
			return null;
		}

		const strokeWidths = this._resolveShapeValues(
			this.getStrokeWidth(),
			count,
		).map((value) => MathF32.max(0, Number.isFinite(value) ? value : 0));

		if (strokeWidths.every((value) => value <= EPSILON)) {
			return null;
		}

		const cornerRadii = this._resolveShapeValues(
			this.getCornerRadius(),
			count,
		);

		const outerOffsets = new Array<number>(count);

		const innerOffsets = new Array<number>(count);

		for (let index = 0; index < count; index += 1) {
			const width = strokeWidths[index] ?? 0;

			switch (this.getStrokeAlign()) {
				case StrokeAlign.Inside:
					outerOffsets[index] = 0;
					innerOffsets[index] = -width;
					break;

				case StrokeAlign.Center:
					outerOffsets[index] = width * 0.5;

					innerOffsets[index] = -width * 0.5;
					break;

				case StrokeAlign.Outside:
					outerOffsets[index] = width;

					innerOffsets[index] = 0;
					break;
			}
		}

		const outerAnchors = this._buildOffsetCornerAnchors(
			anchors,
			outerOffsets,
			winding,
		);

		const innerAnchors = this._buildOffsetCornerAnchors(
			anchors,
			innerOffsets,
			winding,
		);

		if (outerAnchors.length !== count || innerAnchors.length !== count) {
			return null;
		}

		const outerRadii = this._buildOffsetCornerRadii(
			cornerRadii,
			outerOffsets,
		);

		const innerRadii = this._buildOffsetCornerRadii(
			cornerRadii,
			innerOffsets,
		);

		const outer = this._buildRoundedCornerPathWithRadii(
			outerAnchors,
			outerRadii,
		);

		if (outer.length === 0) {
			return null;
		}

		const inner = this._isValidInnerStrokeContour(innerAnchors, winding)
			? this._buildRoundedCornerPathWithRadii(innerAnchors, innerRadii)
			: [];

		return {
			outer,
			inner,
		};
	}

	protected _buildRoundedCornerPath(
		anchors: readonly ShapeCornerRadiusAnchor[],
	): readonly ShapePathCommand[] {
		const radii = this._resolveShapeValues(
			this.getCornerRadius(),
			anchors.length,
		);

		return this._buildRoundedCornerPathWithRadii(anchors, radii);
	}

	private _buildRoundedCornerPathWithRadii(
		anchors: readonly ShapeCornerRadiusAnchor[],
		radii: readonly number[],
	): readonly ShapePathCommand[] {
		const count = anchors.length;

		if (count < 3) {
			return [];
		}

		const resolvedRadii = this._resolveShapeValues(radii, count);

		const winding = this._getCornerContourWinding(anchors);

		if (Math.abs(winding) <= EPSILON) {
			return this._buildSharpCornerPath(anchors);
		}

		const windingSign = winding > 0 ? 1 : -1;

		const corners: RoundedCornerGeometry[] = [];

		for (let index = 0; index < count; index += 1) {
			const anchor = anchors[index]!;

			corners.push(
				this._resolveRoundedCornerGeometry(
					anchor,
					resolvedRadii[index] ?? 0,
					windingSign,
				),
			);
		}

		const commands: ShapePathCommand[] = [];

		const first = corners[0]!;

		commands.push({
			type: "moveTo",
			point: first.entry,
		});

		for (let index = 0; index < count; index += 1) {
			const corner = corners[index]!;

			if (index > 0) {
				commands.push({
					type: "lineTo",
					point: corner.entry,
				});
			}

			if (corner.radius <= EPSILON) {
				continue;
			}

			commands.push({
				type: "arcTo",

				center: corner.center,

				radiusX: corner.radius,
				radiusY: corner.radius,

				startAngle: corner.startAngle,

				endAngle: corner.endAngle,

				clockwise: corner.clockwise,
			});
		}

		commands.push({
			type: "closePath",
		});

		return commands;
	}

	private _buildSharpCornerPath(
		anchors: readonly ShapeCornerRadiusAnchor[],
	): readonly ShapePathCommand[] {
		if (anchors.length === 0) {
			return [];
		}

		const commands: ShapePathCommand[] = [
			{
				type: "moveTo",
				point: {
					x: MathF32.toF32(anchors[0]!.point.x),
					y: MathF32.toF32(anchors[0]!.point.y),
				},
			},
		];

		for (let index = 1; index < anchors.length; index += 1) {
			const point = anchors[index]!.point;

			commands.push({
				type: "lineTo",
				point: {
					x: MathF32.toF32(point.x),
					y: MathF32.toF32(point.y),
				},
			});
		}

		commands.push({
			type: "closePath",
		});

		return commands;
	}

	private _buildOffsetCornerAnchors(
		anchors: readonly ShapeCornerRadiusAnchor[],
		offsets: readonly number[],
		winding: number,
	): ShapeCornerRadiusAnchor[] {
		const count = anchors.length;

		if (count < 3) {
			return [];
		}

		const points = anchors.map((anchor) => anchor.point);

		const offsetPoints: Vector2[] = [];

		for (let index = 0; index < count; index += 1) {
			const previousIndex = (index - 1 + count) % count;

			const nextIndex = (index + 1) % count;

			const previous = points[previousIndex]!;

			const current = points[index]!;

			const next = points[nextIndex]!;

			const previousNormal = this._getPolygonEdgeOutwardNormal(
				previous,
				current,
				winding,
			);

			const nextNormal = this._getPolygonEdgeOutwardNormal(
				current,
				next,
				winding,
			);

			if (!previousNormal || !nextNormal) {
				offsetPoints.push(this._toCornerF32Point(current));

				continue;
			}

			const previousOffset = offsets[previousIndex] ?? 0;

			const nextOffset = offsets[index] ?? 0;

			const previousLinePoint = {
				x: current.x + previousNormal.x * previousOffset,

				y: current.y + previousNormal.y * previousOffset,
			};

			const nextLinePoint = {
				x: current.x + nextNormal.x * nextOffset,

				y: current.y + nextNormal.y * nextOffset,
			};

			const previousDirection = {
				x: current.x - previous.x,

				y: current.y - previous.y,
			};

			const nextDirection = {
				x: next.x - current.x,

				y: next.y - current.y,
			};

			const intersection = this._intersectStrokeLines(
				previousLinePoint,
				previousDirection,

				nextLinePoint,
				nextDirection,
			);

			if (intersection) {
				offsetPoints.push(this._toCornerF32Point(intersection));

				continue;
			}

			/*
			 * Почти параллельные edges.
			 * Берём среднее двух offset positions.
			 */
			offsetPoints.push(
				this._toCornerF32Point({
					x: (previousLinePoint.x + nextLinePoint.x) * 0.5,

					y: (previousLinePoint.y + nextLinePoint.y) * 0.5,
				}),
			);
		}

		return offsetPoints.map((point, index) => ({
			point,

			previous: offsetPoints[(index - 1 + count) % count]!,

			next: offsetPoints[(index + 1) % count]!,
		}));
	}

	private _getPolygonEdgeOutwardNormal(
		start: Vector2,
		end: Vector2,
		winding: number,
	): Vector2 | null {
		const dx = end.x - start.x;

		const dy = end.y - start.y;

		const length = Math.hypot(dx, dy);

		if (length <= EPSILON) {
			return null;
		}

		const windingSign = winding > 0 ? 1 : -1;

		/*
		 * Для нашего contour winding:
		 *
		 * positive -> right normal наружу
		 * negative -> left normal наружу
		 */
		return {
			x: (windingSign * dy) / length,

			y: (-windingSign * dx) / length,
		};
	}

	private _intersectStrokeLines(
		firstPoint: Vector2,
		firstDirection: Vector2,

		secondPoint: Vector2,
		secondDirection: Vector2,
	): Vector2 | null {
		const denominator =
			firstDirection.x * secondDirection.y -
			firstDirection.y * secondDirection.x;

		if (Math.abs(denominator) <= EPSILON) {
			return null;
		}

		const delta = {
			x: secondPoint.x - firstPoint.x,

			y: secondPoint.y - firstPoint.y,
		};

		const t =
			(delta.x * secondDirection.y - delta.y * secondDirection.x) /
			denominator;

		if (!Number.isFinite(t)) {
			return null;
		}

		return {
			x: firstPoint.x + firstDirection.x * t,

			y: firstPoint.y + firstDirection.y * t,
		};
	}

	private _buildOffsetCornerRadii(
		radii: readonly number[],
		offsets: readonly number[],
	): number[] {
		const count = radii.length;

		return Array.from({ length: count }, (_, index) => {
			const radius = Math.max(0, radii[index] ?? 0);

			if (radius <= EPSILON) {
				/*
				 * Sharp corner должен оставаться sharp.
				 */
				return 0;
			}

			const previousOffset = offsets[(index - 1 + count) % count] ?? 0;

			const currentOffset = offsets[index] ?? 0;

			/*
			 * Corner принадлежит двум сторонам:
			 *
			 * previous edge + current edge.
			 *
			 * Берём offset большей по модулю стороны,
			 * как мы уже делали для Rect.
			 */
			const delta =
				Math.abs(previousOffset) >= Math.abs(currentOffset)
					? previousOffset
					: currentOffset;

			return MathF32.max(0, radius + delta);
		});
	}

	private _isValidInnerStrokeContour(
		anchors: readonly ShapeCornerRadiusAnchor[],
		originalWinding: number,
	): boolean {
		if (anchors.length < 3) {
			return false;
		}

		const winding = this._getCornerContourWinding(anchors);

		if (Math.abs(winding) <= EPSILON) {
			return false;
		}

		/*
		 * Если inner contour схлопнулся и
		 * перевернулся - отверстия больше нет.
		 */
		return Math.sign(winding) === Math.sign(originalWinding);
	}

	/***********************************************************/
	/*                          Helper                         */
	/***********************************************************/
	private _getViewStrokeOutset(): number {
		const strokeWidth = this._getMaxStrokeWidth();

		switch (this.getStrokeAlign()) {
			case StrokeAlign.Inside:
				return 0;

			case StrokeAlign.Center:
				return strokeWidth / 2;

			case StrokeAlign.Outside:
				return strokeWidth;

			default:
				return 0;
		}
	}

	private _normalizeStrokeStyleMetric(
		value: StrokeStyleLength | StrokeStyleGap,
	): StrokeStyleLength {
		if (typeof value === "number") {
			return MathF32.max(0, Number.isFinite(value) ? value : 0);
		}

		if (value.length === 0) {
			return [0];
		}

		return value.map((item) =>
			MathF32.max(0, Number.isFinite(item) ? item : 0),
		);
	}

	private _normalizeStrokeStylePattern(
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
	): {
		length: StrokeStyleLength;
		gap: StrokeStyleGap;
	} {
		const normalizedLength = this._normalizeStrokeStyleMetric(length);

		const normalizedGap = this._normalizeStrokeStyleMetric(gap);

		if (
			Array.isArray(normalizedLength) &&
			Array.isArray(normalizedGap) &&
			normalizedLength.length !== normalizedGap.length
		) {
			throw new RangeError(
				"Stroke style length and gap patterns must have the same number of elements.",
			);
		}

		return {
			length: normalizedLength,
			gap: normalizedGap,
		};
	}

	private _cloneStrokeStyleMetric(
		value: StrokeStyleLength | StrokeStyleGap,
	): StrokeStyleLength {
		return typeof value === "number" ? value : [...value];
	}

	private _normalizeAppearanceValues(values: readonly number[]): number[] {
		if (values.length === 0) {
			return [0];
		}

		return values.map((value) =>
			MathF32.max(0, Number.isFinite(value) ? value : 0),
		);
	}

	private _numberArraysEqual(
		a: readonly number[],
		b: readonly number[],
	): boolean {
		if (a.length !== b.length) {
			return false;
		}

		for (let i = 0; i < a.length; i += 1) {
			if (a[i] !== b[i]) {
				return false;
			}
		}

		return true;
	}

	private _getMaxStrokeWidth(): number {
		let maxWidth = 0;

		for (const width of this._strokeWidth) {
			maxWidth = MathF32.max(maxWidth, width);
		}

		return maxWidth;
	}

	private _resolveRoundedCornerGeometry(
		anchor: ShapeCornerRadiusAnchor,
		requestedRadius: number,
		windingSign: number,
	): RoundedCornerGeometry {
		const point = anchor.point;
		const previous = anchor.previous;
		const next = anchor.next;

		const toPrevious = {
			x: previous.x - point.x,
			y: previous.y - point.y,
		};

		const toNext = {
			x: next.x - point.x,
			y: next.y - point.y,
		};

		const previousLength = Math.hypot(toPrevious.x, toPrevious.y);

		const nextLength = Math.hypot(toNext.x, toNext.y);

		if (previousLength <= EPSILON || nextLength <= EPSILON) {
			return this._createSharpCornerGeometry(point);
		}

		const previousDirection = {
			x: toPrevious.x / previousLength,

			y: toPrevious.y / previousLength,
		};

		const nextDirection = {
			x: toNext.x / nextLength,

			y: toNext.y / nextLength,
		};

		const dot = Math.max(
			-1,
			Math.min(
				1,
				previousDirection.x * nextDirection.x +
					previousDirection.y * nextDirection.y,
			),
		);

		const angle = Math.acos(dot);

		if (angle <= EPSILON || Math.abs(Math.PI - angle) <= EPSILON) {
			return this._createSharpCornerGeometry(point);
		}

		const halfAngle = angle * 0.5;

		const tangentFactor = Math.tan(halfAngle);

		if (
			!Number.isFinite(tangentFactor) ||
			Math.abs(tangentFactor) <= EPSILON
		) {
			return this._createSharpCornerGeometry(point);
		}

		const maxRadius =
			Math.min(previousLength, nextLength) * 0.5 * tangentFactor;

		const radius = Math.max(0, Math.min(requestedRadius, maxRadius));

		if (radius <= EPSILON) {
			return this._createSharpCornerGeometry(point);
		}

		const tangentDistance = radius / tangentFactor;

		const entry = {
			x: point.x + previousDirection.x * tangentDistance,

			y: point.y + previousDirection.y * tangentDistance,
		};

		const exit = {
			x: point.x + nextDirection.x * tangentDistance,

			y: point.y + nextDirection.y * tangentDistance,
		};

		const bisector = this._normalizeCornerVector({
			x: previousDirection.x + nextDirection.x,

			y: previousDirection.y + nextDirection.y,
		});

		if (!bisector) {
			return this._createSharpCornerGeometry(point);
		}

		const sinHalfAngle = Math.sin(halfAngle);

		if (Math.abs(sinHalfAngle) <= EPSILON) {
			return this._createSharpCornerGeometry(point);
		}

		const centerDistance = radius / sinHalfAngle;

		const center = {
			x: point.x + bisector.x * centerDistance,

			y: point.y + bisector.y * centerDistance,
		};

		const incomingDirection = {
			x: -previousDirection.x,
			y: -previousDirection.y,
		};

		const turn =
			incomingDirection.x * nextDirection.y -
			incomingDirection.y * nextDirection.x;

		const isConvex = turn * windingSign >= 0;

		const clockwise = isConvex ? windingSign > 0 : windingSign < 0;

		return {
			entry: this._toCornerF32Point(entry),
			exit: this._toCornerF32Point(exit),

			center: this._toCornerF32Point(center),

			radius: MathF32.toF32(radius),

			startAngle: this._getCornerAngleDegrees(center, entry),

			endAngle: this._getCornerAngleDegrees(center, exit),

			clockwise,
		};
	}

	private _createSharpCornerGeometry(point: Vector2): RoundedCornerGeometry {
		const value = this._toCornerF32Point(point);

		return {
			entry: value,
			exit: value,

			center: value,

			radius: 0,

			startAngle: 0,
			endAngle: 0,

			clockwise: true,
		};
	}

	private _getCornerContourWinding(
		anchors: readonly ShapeCornerRadiusAnchor[],
	): number {
		let area = 0;

		for (let index = 0; index < anchors.length; index += 1) {
			const current = anchors[index]!.point;

			const next = anchors[(index + 1) % anchors.length]!.point;

			area += current.x * next.y - next.x * current.y;
		}

		return area;
	}

	private _normalizeCornerVector(value: Vector2): Vector2 | null {
		const length = Math.hypot(value.x, value.y);

		if (length <= EPSILON) {
			return null;
		}

		return {
			x: value.x / length,
			y: value.y / length,
		};
	}

	private _getCornerAngleDegrees(center: Vector2, point: Vector2): number {
		return MathF32.toF32(
			Math.atan2(point.y - center.y, point.x - center.x) *
				(180 / Math.PI),
		);
	}

	private _toCornerF32Point(point: Vector2): Vector2 {
		return {
			x: MathF32.toF32(point.x),
			y: MathF32.toF32(point.y),
		};
	}
}
