import type { Color } from "culori";
import type { ShapeEffectManager } from "./effect";
import type { INode, OrientedRect, Rect } from "../base";
import type { Matrix, Vector2 } from "../../core/transform/types";

export type CornerRadius = number[];
export type StrokeWidth = number[];

export type ShapeCornerRadiusAnchor = {
	point: Vector2;
	previous: Vector2;
	next: Vector2;

	handleTarget?: Vector2;
};

export enum StrokeAlign {
	Inside = 0,
	Center = 1,
	Outside = 2,
}

export enum StrokeStyle {
	Solid = "solid",
	Dashed = "dashed",
	Dotted = "dotted",
	Custom = "custom",
}

export type StrokeStyleLength = number | readonly number[];

export type StrokeStyleGap = number | readonly number[];

export type StrokeStyleShape = string;

export enum StrokeDashCap {
	Flat = "flat",
	Round = "round",
}

export type StrokeDashedStyleProperties = Readonly<{
	length: StrokeStyleLength;
	gap: StrokeStyleGap;
	cap: StrokeDashCap;
}>;

export type StrokeDottedStyleProperties = Readonly<{
	length: StrokeStyleLength;
	gap: StrokeStyleGap;
}>;

export type StrokeCustomStyleProperties = Readonly<{
	length: StrokeStyleLength;
	gap: StrokeStyleGap;
	shape?: StrokeStyleShape;
}>;

export type StrokeStyleProperties =
	| StrokeDashedStyleProperties
	| StrokeDottedStyleProperties
	| StrokeCustomStyleProperties;

export type ConfigurableStrokeStyle =
	StrokeStyle.Dashed | StrokeStyle.Dotted | StrokeStyle.Custom;

export type ResolvedStrokeStylePatternItem = Readonly<{
	length: number;
	gap: number;
}>;

export type ResolvedStrokeStylePattern =
	readonly ResolvedStrokeStylePatternItem[];

export type StrokePathMetricPoint = Readonly<{
	point: Vector2;
	distance: number;
}>;

export type StrokePathMetrics = Readonly<{
	points: readonly StrokePathMetricPoint[];
	length: number;
	closed: boolean;
	winding: number;
}>;

export type StrokePatternInterval = Readonly<{
	start: number;
	end: number;
	patternIndex: number;
}>;

export type ResolvedStrokePatternSegment = Readonly<{
	start: number;
	end: number;
	patternIndex: number;

	points: readonly Vector2[];
}>;

export type ResolvedStrokePatternEdge = Readonly<{
	start: Vector2;
	end: Vector2;

	startDistance: number;
	endDistance: number;

	length: number;

	tangent: Vector2;
	outwardNormal: Vector2;
}>;

export type ResolvedStrokePatternEdgeSegment = Readonly<{
	start: number;
	end: number;
	patternIndex: number;

	edges: readonly ResolvedStrokePatternEdge[];
}>;

export type ResolvedStrokePatternOffsetEdge = Readonly<{
	source: ResolvedStrokePatternEdge;

	outerOffset: number;
	innerOffset: number;

	outerStart: Vector2;
	outerEnd: Vector2;

	innerStart: Vector2;
	innerEnd: Vector2;
}>;

export type ResolvedStrokePatternOffsetSegment = Readonly<{
	start: number;
	end: number;
	patternIndex: number;

	edges: readonly ResolvedStrokePatternOffsetEdge[];
}>;

export type ResolvedStrokePatternContourSegment = Readonly<{
	start: number;
	end: number;
	patternIndex: number;

	startTangent: Vector2;
	endTangent: Vector2;

	outer: readonly Vector2[];
	inner: readonly Vector2[];
}>;

export type ResolvedStrokePatternPathSegment = Readonly<{
	start: number;
	end: number;
	patternIndex: number;

	commands: readonly ShapePathCommand[];
}>;

export enum FillMode {
	Color = "color",
	LinearGradient = "linear-gradient",
	RadialGradient = "radial-gradient",
	ConicGradient = "conic-gradient",
	DiamondGradient = "diamond-gradient",
	MeshGradient = "mesh-gradient",
}

export type ShapeGeometry = {
	worldMatrix: Matrix;

	localOBB: Rect;
	worldCorners: [Vector2, Vector2, Vector2, Vector2];
	worldOBB: OrientedRect;
	worldAABB: Rect;

	localViewOBB: Rect;
	worldViewCorners: [Vector2, Vector2, Vector2, Vector2];
	worldViewOBB: OrientedRect;
	worldViewAABB: Rect;
};

export type RoundedCornerGeometry = {
	entry: Vector2;
	exit: Vector2;

	center: Vector2;

	radius: number;

	startAngle: number;
	endAngle: number;

	clockwise: boolean;
};

export type ShapePathCommand =
	| {
			type: "moveTo";
			point: Vector2;
	  }
	| {
			type: "lineTo";
			point: Vector2;
	  }
	| {
			type: "arcTo";
			center: Vector2;
			radiusX: number;
			radiusY: number;
			startAngle: number;
			endAngle: number;
			clockwise: boolean;
	  }
	| {
			type: "closePath";
	  }
	| {
			type: "quadraticCurveTo";
			control: Vector2;
			point: Vector2;
	  };

export type ShapeStrokeArea = {
	outer: readonly ShapePathCommand[];
	inner: readonly ShapePathCommand[];
};

export type ShapeStrokePath = ShapeStrokeArea & {
	additionalAreas?: readonly ShapeStrokeArea[];
};

export interface IShapeBase extends INode {
	readonly effectManager: ShapeEffectManager;

	/**
	 * Returns a geometry snapshot of this shape.
	 *
	 * Includes transform matrix and both pure-geometry and view (stroke-aware) bounds
	 * in local/world space for overlay and editor tooling.
	 *
	 * Возвращает снимок геометрии этой фигуры.
	 *
	 * Включает матрицу трансформации, а также геометрические и визуальные
	 * (с учетом stroke) границы в локальном/мировом пространстве для overlay-инструментов.
	 */
	getGeometry(): ShapeGeometry;

	toPathCommands(): readonly ShapePathCommand[];

	toStrokePathCommands(): readonly ShapePathCommand[];

	/***********************************************************/
	/*                        Appearance                       */
	/***********************************************************/
	/**
	 * Returns the corner radius values for the rectangle.
	 *
	 * Возвращает значения радиусов углов прямоугольника.
	 */
	getCornerRadius(): CornerRadius;

	/**
	 * Sets the corner radius values for the rectangle.
	 *
	 * Устанавливает радиусы углов прямоугольника.
	 */
	setCornerRadius(value: CornerRadius): void;

	/**
	 * Returns the current fill mode of the shape.
	 *
	 * Возвращает текущий режим заливки фигуры.
	 */
	getFillMode(): FillMode;

	/**
	 * Sets the fill mode of the shape.
	 *
	 * Устанавливает режим заливки фигуры.
	 */
	setFillMode(value: FillMode): void;

	/**
	 * Returns the current fill value of the shape.
	 * The returned string represents the fill associated with the active fill mode.
	 *
	 * Возвращает текущее значение заливки фигуры.
	 * Возвращаемая строка представляет заливку, связанную с активным режимом заливки.
	 */
	getFill(): string;

	/**
	 * Sets the fill value for the active fill mode.
	 * Accepts a color or gradient string supported by the current fill mode.
	 *
	 * Устанавливает значение заливки для активного режима заливки.
	 * Принимает строку цвета или градиента, поддерживаемую текущим режимом заливки.
	 */
	setFill(value: string): void;

	/***********************************************************/
	/*                          Stroke                         */
	/***********************************************************/

	/**
	 * Returns the stroke mode for the rectangle.
	 *
	 * Возвращает режим обводки для прямоугольника.
	 */
	getStrokeMode(): FillMode;

	/**
	 * Sets the stroke mode for the rectangle.
	 *
	 * Устанавливает режим обводки для прямоугольника.
	 */
	setStrokeMode(value: FillMode): void;

	/**
	 * Returns the stroke width for each side of the rectangle.
	 *
	 * Возвращает толщину обводки для каждой стороны прямоугольника.
	 */
	getStrokeWidth(): StrokeWidth;

	/**
	 * Sets the stroke width for each side of the rectangle.
	 *
	 * Устанавливает толщину обводки для каждой стороны прямоугольника.
	 */
	setStrokeWidth(value: StrokeWidth): void;

	/**
	 * Returns the stroke color in hex format.
	 *
	 * Возвращает цвет обводки в формате hex.
	 */
	getStrokeFill(): string;

	/**
	 * Sets the stroke color.
	 * Accepts a CSS color string or a culori Color object.
	 *
	 * Устанавливает цвет обводки.
	 * Принимает строку цвета CSS или объект цвета culori.
	 */
	setStrokeFill(value: string | Color): void;

	/**
	 * Returns the stroke alignment mode.
	 *
	 * Возвращает режим выравнивания обводки.
	 */
	getStrokeAlign(): StrokeAlign;

	/**
	 * Sets the stroke alignment mode.
	 *
	 * Устанавливает режим выравнивания обводки.
	 */
	setStrokeAlign(value: StrokeAlign): void;

	getStrokePath(): ShapeStrokePath | null;

	getStrokeStyle(): StrokeStyle;

	setStrokeStyle(value: StrokeStyle): void;

	getStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dashed,
	): StrokeDashedStyleProperties;

	getStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dotted,
	): StrokeDottedStyleProperties;

	getStrokeStyleProperties(
		strokeStyle: StrokeStyle.Custom,
	): StrokeCustomStyleProperties;

	setStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dashed,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
		cap?: StrokeDashCap,
	): void;

	setStrokeStyleProperties(
		strokeStyle: StrokeStyle.Dotted,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
	): void;

	setStrokeStyleProperties(
		strokeStyle: StrokeStyle.Custom,
		length: StrokeStyleLength,
		gap: StrokeStyleGap,
		shape?: StrokeStyleShape,
	): void;

	getCornerRadiusAnchors(): readonly ShapeCornerRadiusAnchor[];

	/***********************************************************/
	/*                       View Bounds                       */
	/***********************************************************/

	/**
	 * Returns the local oriented bounding box (OBB) of the shape including its visual stroke.
	 * Unlike getLocalOBB(), this method expands the bounds based on stroke width and stroke alignment.
	 *
	 * This represents the actual visible area of the shape in local space.
	 *
	 * Возвращает локальный ориентированный bounding box (OBB) фигуры с учетом её обводки (stroke).
	 * В отличие от getLocalOBB(), этот метод расширяет границы с учетом толщины и выравнивания stroke.
	 *
	 * Это фактическая видимая область фигуры в локальном пространстве.
	 */
	getLocalViewOBB(): Rect;

	/**
	 * Returns the world-space corner points of the shape including its visual stroke.
	 * These points represent the transformed corners of the view bounds (with stroke applied).
	 *
	 * Unlike getWorldCorners(), which is based on pure geometry,
	 * this method reflects the actual rendered shape including stroke.
	 *
	 * Возвращает угловые точки фигуры в мировых координатах с учетом обводки (stroke).
	 * В отличие от getWorldCorners(), который основан только на геометрии,
	 * этот метод учитывает реальный визуальный размер фигуры.
	 */
	getWorldViewCorners(): [Vector2, Vector2, Vector2, Vector2];

	/**
	 * Returns the world-space oriented bounding box (OBB) of the shape including stroke.
	 * This box follows the object's rotation and represents its visual bounds.
	 *
	 * Useful for rotated selection outlines and editor overlays.
	 *
	 * Возвращает ориентированный bounding box (OBB) в мировых координатах с учетом stroke.
	 * Этот прямоугольник вращается вместе с объектом и отражает его визуальные границы.
	 *
	 * Используется для выделения повернутых объектов и overlay в редакторе.
	 */
	getWorldViewOBB(): OrientedRect;

	/**
	 * Returns the world-space axis-aligned bounding box (AABB) of the shape including stroke.
	 * This box is aligned to the world axes and fully contains the visual representation of the shape.
	 *
	 * Unlike getWorldAABB(), this includes stroke width and represents what is actually visible.
	 *
	 * Useful for selection frames, hit testing, and spatial queries.
	 *
	 * Возвращает axis-aligned bounding box (AABB) в мировых координатах с учетом stroke.
	 * Этот прямоугольник выровнен по осям мира и полностью охватывает видимую часть фигуры.
	 *
	 * В отличие от getWorldAABB(), учитывает толщину обводки и отражает реальную визуальную область.
	 *
	 * Используется для рамки выделения, hit-test и пространственных проверок.
	 */
	getWorldViewAABB(): Rect;
}
