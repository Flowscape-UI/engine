import { EPSILON, type ID, type Vector2 } from "../../core";
import {
	resolveStrokePathMetrics,
	resolveStrokePatternGeometry,
	ShapeBase,
	StrokeAlign,
	StrokeDashCap,
	StrokeStyle,
	type ShapePathCommand,
	type ShapeStrokeArea,
	type ShapeStrokePath,
	type StrokeWidth,
} from "../shape";
import { NodeType, type Rect } from "../base";
import { matrixInvert } from "../utils";
import { LineCap, LineEnding, type INodeLine } from "./types";

type ResolvedLineStrokeGeometry = Readonly<{
	halfThickness: number;
	length: number;
	direction: Vector2;
	normal: Vector2;
	normalAngle: number;
	outline: readonly [Vector2, Vector2, Vector2, Vector2];
}>;

type ResolvedLineEndingLayout = Readonly<{
	bodyStart: Vector2;
	bodyEnd: Vector2;
	startLength: number;
	endLength: number;
	bodyLength: number;

	outline: readonly [Vector2, Vector2, Vector2, Vector2];
}>;

export class NodeLine extends ShapeBase implements INodeLine {
	private _start: Vector2;
	private _end: Vector2;

	private _thickness: number;

	private _lineCapStart: LineCap;
	private _lineCapEnd: LineCap;

	private _startEnding: LineEnding;
	private _endEnding: LineEnding;

	private static readonly MIN_LINE_ENDING_LENGTH = 8;
	private static readonly LINE_ENDING_LENGTH_FACTOR = 4;
	private static readonly LINE_ENDING_HALF_WIDTH_FACTOR = 0.6;

	constructor(id: ID, name?: string) {
		super(id, NodeType.Line, name ?? "Line");

		this._thickness = 1;
		super.setStrokeWidth([this._thickness]);
		this._start = { x: 0, y: 0 };
		this._end = { x: 100, y: 0 };
		this._updateBounds();

		this._lineCapStart = LineCap.Butt;
		this._lineCapEnd = LineCap.Butt;

		this._startEnding = LineEnding.None;
		this._endEnding = LineEnding.None;
	}

	/*********************************************************/
	/*                        Geometry                       */
	/*********************************************************/
	public getStart(): Vector2 {
		return { ...this._start };
	}

	public setStart(value: Vector2): void {
		if (value.x === this._start.x && value.y === this._start.y) {
			return;
		}
		this._start = value;
		this._updateBounds();
	}

	public getEnd(): Vector2 {
		return { ...this._end };
	}

	public setEnd(value: Vector2): void {
		if (value.x === this._end.x && value.y === this._end.y) {
			return;
		}
		this._end = value;
		this._updateBounds();
	}

	/*********************************************************/
	/*                         Stroke                        */
	/*********************************************************/
	public getStrokeThickness(): number {
		return this._thickness;
	}

	public setStrokeThickness(value: number): void {
		if (!Number.isFinite(value)) {
			return;
		}

		const newValue = Math.max(0, value);
		if (newValue === this._thickness) {
			return;
		}
		this._thickness = newValue;
		super.setStrokeWidth([newValue]);
	}

	public override getStrokeWidth(): StrokeWidth {
		return [this._thickness];
	}

	public override setStrokeWidth(value: StrokeWidth): void {
		this.setStrokeThickness(value[0] ?? 0);
	}

	/*********************************************************/
	/*                     Stroke Endings                    */
	/*********************************************************/
	public getLineCapStart(): LineCap {
		return this._lineCapStart;
	}

	public setLineCapStart(value: LineCap): void {
		if (this._lineCapStart === value) {
			return;
		}
		this._lineCapStart = value;
	}

	public getLineCapEnd(): LineCap {
		return this._lineCapEnd;
	}

	public setLineCapEnd(value: LineCap): void {
		if (this._lineCapEnd === value) {
			return;
		}
		this._lineCapEnd = value;
	}

	public getStartEnding(): LineEnding {
		return this._startEnding;
	}

	public setStartEnding(value: LineEnding): void {
		if (this._startEnding === value) {
			return;
		}
		this._startEnding = value;
	}

	public getEndEnding(): LineEnding {
		return this._endEnding;
	}

	public setEndEnding(value: LineEnding): void {
		if (this._endEnding === value) {
			return;
		}
		this._endEnding = value;
	}

	/*********************************************************/
	/*                        Overrides                      */
	/*********************************************************/
	public override toPathCommands(): readonly ShapePathCommand[] {
		const startX = this._start.x;
		const startY = this._start.y;
		const endX = this._end.x;
		const endY = this._end.y;

		const dx = endX - startX;
		const dy = endY - startY;
		const length = Math.hypot(dx, dy);

		if (length <= EPSILON) {
			return [];
		}

		return [
			{
				type: "moveTo",
				point: { x: startX, y: startY },
			},
			{
				type: "lineTo",
				point: { x: endX, y: endY },
			},
		];
	}

	public override toStrokePathCommands(): readonly ShapePathCommand[] {
		const geometry = this._resolveStrokeGeometry();

		if (!geometry) {
			return [];
		}

		const layout = this._resolveLineEndingLayout(geometry);

		if (layout.bodyLength <= EPSILON) {
			return [];
		}

		return [
			{
				type: "moveTo",
				point: { ...layout.bodyStart },
			},
			{
				type: "lineTo",
				point: { ...layout.bodyEnd },
			},
		];
	}

	public override getStrokePath(): ShapeStrokePath | null {
		const geometry = this._resolveStrokeGeometry();

		if (!geometry) {
			return null;
		}

		const endingLayout = this._resolveLineEndingLayout(geometry);

		const {
			bodyLength,
			outline: [startSideA, endSideA, endSideB, startSideB],
		} = endingLayout;

		const outer: ShapePathCommand[] = [];

		if (bodyLength > EPSILON) {
			outer.push(
				{
					type: "moveTo",
					point: startSideA,
				},
				{
					type: "lineTo",
					point: endSideA,
				},
			);

			if (
				this._endEnding === LineEnding.None &&
				this._lineCapEnd === LineCap.Round
			) {
				outer.push({
					type: "arcTo",
					center: { ...this._end },
					radiusX: geometry.halfThickness,
					radiusY: geometry.halfThickness,
					startAngle: geometry.normalAngle,
					endAngle: geometry.normalAngle - 180,
					clockwise: false,
				});
			} else {
				outer.push({
					type: "lineTo",
					point: endSideB,
				});
			}

			outer.push({
				type: "lineTo",
				point: startSideB,
			});

			if (
				this._startEnding === LineEnding.None &&
				this._lineCapStart === LineCap.Round
			) {
				outer.push({
					type: "arcTo",
					center: { ...this._start },
					radiusX: geometry.halfThickness,
					radiusY: geometry.halfThickness,
					startAngle: geometry.normalAngle - 180,
					endAngle: geometry.normalAngle - 360,
					clockwise: false,
				});
			}

			outer.push({
				type: "closePath",
			});
		}

		const additionalAreas: ShapeStrokeArea[] = [];

		const startEndingArea = this._resolveLineEndingArea(
			this._startEnding,
			this._start,
			{
				x: -geometry.direction.x,
				y: -geometry.direction.y,
			},
			endingLayout.startLength,
		);

		if (startEndingArea) {
			additionalAreas.push(startEndingArea);
		}

		const endEndingArea = this._resolveLineEndingArea(
			this._endEnding,
			this._end,
			geometry.direction,
			endingLayout.endLength,
		);

		if (endEndingArea) {
			additionalAreas.push(endEndingArea);
		}

		return {
			outer,
			inner: [],
			...(additionalAreas.length > 0 ? { additionalAreas } : {}),
		};
	}

	public override getLocalViewOBB(): Rect {
		const strokePath = this.getStrokePath();

		if (!strokePath) {
			return this.getLocalOBB();
		}

		const areas: readonly ShapeStrokeArea[] = [
			strokePath,
			...(strokePath.additionalAreas ?? []),
		];

		const strokeStyle = this.getStrokeStyle();

		/*
		 * Pattern stroke строится отдельной системой.
		 * Базовые bounds гарантированно покрывают его сегменты.
		 */
		let bounds: Rect | null =
			strokeStyle === StrokeStyle.Dashed ||
				strokeStyle === StrokeStyle.Dotted
				? super.getLocalViewOBB()
				: null;

		for (const area of areas) {
			const areaBounds = this._resolvePathCommandsBounds([
				...area.outer,
				...area.inner,
			]);

			if (!areaBounds) {
				continue;
			}

			if (!bounds) {
				bounds = areaBounds;
				continue;
			}

			const minX = Math.min(bounds.x, areaBounds.x);
			const minY = Math.min(bounds.y, areaBounds.y);

			const maxX = Math.max(
				bounds.x + bounds.width,
				areaBounds.x + areaBounds.width,
			);

			const maxY = Math.max(
				bounds.y + bounds.height,
				areaBounds.y + areaBounds.height,
			);

			bounds = {
				x: minX,
				y: minY,
				width: maxX - minX,
				height: maxY - minY,
			};
		}

		return bounds ?? this.getLocalOBB();
	}

	public override setWidth(value: number): void {
		if (this.isLockedInHierarchy()) {
			return;
		}

		const nextWidth = Math.max(0, value);
		const oldWidth = this.getWidth();

		if (nextWidth === oldWidth) {
			return;
		}

		const start = { ...this._start };
		const end = { ...this._end };

		if (oldWidth > 0) {
			start.x = (start.x / oldWidth) * nextWidth;
			end.x = (end.x / oldWidth) * nextWidth;
		}

		this._start = start;
		this._end = end;

		super.setWidth(nextWidth);
	}

	public override setHeight(value: number): void {
		if (this.isLockedInHierarchy()) {
			return;
		}

		const nextHeight = Math.max(0, value);
		const oldHeight = this.getHeight();

		if (nextHeight === oldHeight) {
			return;
		}

		const start = { ...this._start };
		const end = { ...this._end };

		if (oldHeight > 0) {
			start.y = (start.y / oldHeight) * nextHeight;
			end.y = (end.y / oldHeight) * nextHeight;
		}

		this._start = start;
		this._end = end;

		super.setHeight(nextHeight);
	}

	public override setSize(width: number, height: number): void {
		if (this.isLockedInHierarchy()) {
			return;
		}

		const nextWidth = Math.max(0, width);
		const nextHeight = Math.max(0, height);

		const oldWidth = this.getWidth();
		const oldHeight = this.getHeight();

		if (nextWidth === oldWidth && nextHeight === oldHeight) {
			return;
		}

		const start = { ...this._start };
		const end = { ...this._end };

		if (oldWidth > 0) {
			start.x = (start.x / oldWidth) * nextWidth;
			end.x = (end.x / oldWidth) * nextWidth;
		}

		if (oldHeight > 0) {
			start.y = (start.y / oldHeight) * nextHeight;
			end.y = (end.y / oldHeight) * nextHeight;
		}

		this._start = start;
		this._end = end;

		super.setSize(nextWidth, nextHeight);
	}

	public override hitTest(worldPoint: Vector2): boolean {
		try {
			const inverseMatrix = matrixInvert(this.getWorldMatrix());

			const localPoint = this._applyMatrixToPoint(
				inverseMatrix,
				worldPoint,
			);

			const localBounds = this.getLocalViewOBB();

			if (
				localPoint.x < localBounds.x ||
				localPoint.x > localBounds.x + localBounds.width ||
				localPoint.y < localBounds.y ||
				localPoint.y > localBounds.y + localBounds.height
			) {
				return false;
			}

			const strokePath = this.getStrokePath();

			if (!strokePath) {
				return false;
			}

			const areas: readonly ShapeStrokeArea[] = [
				strokePath,
				...(strokePath.additionalAreas ?? []),
			];

			for (const area of areas) {
				if (this._isPointInsideStrokeArea(localPoint, area)) {
					return true;
				}
			}

			return false;
		} catch {
			return false;
		}
	}

	/*********************************************************/
	/*                         Helpers                       */
	/*********************************************************/

	private _isPointInsideStrokeArea(
		point: Vector2,
		area: ShapeStrokeArea,
	): boolean {
		let inside = false;

		for (const commands of [area.outer, area.inner]) {
			if (commands.length === 0) {
				continue;
			}

			const metrics = resolveStrokePathMetrics(commands);

			if (!metrics.closed || metrics.points.length < 3) {
				continue;
			}

			const polygon = metrics.points.map(
				(metricPoint) => metricPoint.point,
			);

			if (this._isPointInsidePolygon(point, polygon)) {
				inside = !inside;
			}
		}

		return inside;
	}

	private _isPointInsidePolygon(
		point: Vector2,
		polygon: readonly Vector2[],
	): boolean {
		let inside = false;

		for (
			let index = 0, previousIndex = polygon.length - 1;
			index < polygon.length;
			previousIndex = index++
		) {
			const current = polygon[index]!;
			const previous = polygon[previousIndex]!;

			const intersects =
				current.y > point.y !== previous.y > point.y &&
				point.x <
				((previous.x - current.x) *
					(point.y - current.y)) /
				(previous.y - current.y) +
				current.x;

			if (intersects) {
				inside = !inside;
			}
		}

		return inside;
	}

	private _resolvePathCommandsBounds(
		commands: readonly ShapePathCommand[],
	): Rect | null {
		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		const includePoint = (point: Vector2): void => {
			minX = Math.min(minX, point.x);
			minY = Math.min(minY, point.y);
			maxX = Math.max(maxX, point.x);
			maxY = Math.max(maxY, point.y);
		};

		for (const command of commands) {
			switch (command.type) {
				case "moveTo":
				case "lineTo":
					includePoint(command.point);
					break;

				case "quadraticCurveTo":
					/*
					 * Control hull даёт безопасные bounds
					 * для всей quadratic curve.
					 */
					includePoint(command.control);
					includePoint(command.point);
					break;

				case "arcTo": {
					const radiusX = Math.abs(command.radiusX);
					const radiusY = Math.abs(command.radiusY);

					includePoint({
						x: command.center.x - radiusX,
						y: command.center.y - radiusY,
					});

					includePoint({
						x: command.center.x + radiusX,
						y: command.center.y + radiusY,
					});

					break;
				}

				case "closePath":
					break;
			}
		}

		if (
			!Number.isFinite(minX) ||
			!Number.isFinite(minY) ||
			!Number.isFinite(maxX) ||
			!Number.isFinite(maxY)
		) {
			return null;
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}

	private _resolveStrokeGeometry(): ResolvedLineStrokeGeometry | null {
		const halfThickness = this._thickness / 2;

		if (halfThickness <= EPSILON) {
			return null;
		}

		const dx = this._end.x - this._start.x;
		const dy = this._end.y - this._start.y;
		const length = Math.hypot(dx, dy);

		if (length <= EPSILON) {
			return null;
		}

		const direction = {
			x: dx / length,
			y: dy / length,
		};

		const normal = {
			x: -direction.y,
			y: direction.x,
		};

		const startExtension =
			this._startEnding === LineEnding.None &&
				this._lineCapStart === LineCap.Square
				? halfThickness
				: 0;

		const endExtension =
			this._endEnding === LineEnding.None &&
				this._lineCapEnd === LineCap.Square
				? halfThickness
				: 0;

		const startCenter = {
			x: this._start.x - direction.x * startExtension,
			y: this._start.y - direction.y * startExtension,
		};

		const endCenter = {
			x: this._end.x + direction.x * endExtension,
			y: this._end.y + direction.y * endExtension,
		};

		const offset = {
			x: normal.x * halfThickness,
			y: normal.y * halfThickness,
		};

		return {
			halfThickness,
			length,
			direction,
			normal,
			normalAngle: (Math.atan2(normal.y, normal.x) * 180) / Math.PI,

			outline: [
				{
					x: startCenter.x + offset.x,
					y: startCenter.y + offset.y,
				},
				{
					x: endCenter.x + offset.x,
					y: endCenter.y + offset.y,
				},
				{
					x: endCenter.x - offset.x,
					y: endCenter.y - offset.y,
				},
				{
					x: startCenter.x - offset.x,
					y: startCenter.y - offset.y,
				},
			],
		};
	}

	private _resolveLineEndingArea(
		ending: LineEnding,
		anchor: Vector2,
		outwardDirection: Vector2,
		endingLength: number,
	): ShapeStrokeArea | null {
		if (ending === LineEnding.None) {
			return null;
		}

		if (endingLength <= EPSILON) {
			return null;
		}

		const normal = {
			x: -outwardDirection.y,
			y: outwardDirection.x,
		};

		const halfWidth = endingLength * NodeLine.LINE_ENDING_HALF_WIDTH_FACTOR;

		const baseCenter = {
			x: anchor.x - outwardDirection.x * endingLength,
			y: anchor.y - outwardDirection.y * endingLength,
		};

		const sideA = {
			x: baseCenter.x + normal.x * halfWidth,
			y: baseCenter.y + normal.y * halfWidth,
		};

		const sideB = {
			x: baseCenter.x - normal.x * halfWidth,
			y: baseCenter.y - normal.y * halfWidth,
		};

		switch (ending) {
			case LineEnding.LineArrow:
				return this._createLineArrowArea(sideA, anchor, sideB);

			case LineEnding.TriangleArrow:
				return this._createClosedEndingArea([anchor, sideA, sideB]);

			case LineEnding.ReversedTriangle: {
				const baseA = {
					x: anchor.x + normal.x * halfWidth,
					y: anchor.y + normal.y * halfWidth,
				};

				const baseB = {
					x: anchor.x - normal.x * halfWidth,
					y: anchor.y - normal.y * halfWidth,
				};

				return this._createClosedEndingArea([baseA, baseCenter, baseB]);
			}

			case LineEnding.CircleArrow: {
				const radius = endingLength / 2;

				const center = {
					x: anchor.x,
					y: anchor.y,
				};

				return {
					outer: [
						{
							type: "moveTo",
							point: {
								x: center.x + radius,
								y: center.y,
							},
						},
						{
							type: "arcTo",
							center,
							radiusX: radius,
							radiusY: radius,
							startAngle: 0,
							endAngle: 360,
							clockwise: true,
						},
						{
							type: "closePath",
						},
					],
					inner: [],
				};
			}

			case LineEnding.DiamondArrow: {
				const halfLength = endingLength / 2;
				const halfWidth = endingLength / 2;

				const front = {
					x: anchor.x + outwardDirection.x * halfLength,
					y: anchor.y + outwardDirection.y * halfLength,
				};

				const back = {
					x: anchor.x - outwardDirection.x * halfLength,
					y: anchor.y - outwardDirection.y * halfLength,
				};

				const sideA = {
					x: anchor.x + normal.x * halfWidth,
					y: anchor.y + normal.y * halfWidth,
				};

				const sideB = {
					x: anchor.x - normal.x * halfWidth,
					y: anchor.y - normal.y * halfWidth,
				};

				return this._createClosedEndingArea([
					front,
					sideA,
					back,
					sideB,
				]);
			}

			default:
				return null;
		}
	}

	private _resolveLineEndingLength(
		ending: LineEnding,
		maximumLength: number,
	): number {
		if (ending === LineEnding.None) {
			return 0;
		}

		const preferredLength = Math.max(
			NodeLine.MIN_LINE_ENDING_LENGTH,
			this._thickness * NodeLine.LINE_ENDING_LENGTH_FACTOR,
		);

		return Math.min(preferredLength, Math.max(0, maximumLength));
	}

	private _resolveLineEndingBodyInset(
		ending: LineEnding,
		endingLength: number,
	): number {
		switch (ending) {
			case LineEnding.TriangleArrow:
			case LineEnding.ReversedTriangle:
				return endingLength / 2;
			default:
				return 0;
		}
	}

	private _resolveLineEndingLayout(
		geometry: ResolvedLineStrokeGeometry,
	): ResolvedLineEndingLayout {
		const hasStartEnding = this._startEnding !== LineEnding.None;
		const hasEndEnding = this._endEnding !== LineEnding.None;

		const maximumEndingLength =
			hasStartEnding && hasEndEnding
				? geometry.length / 2
				: geometry.length;

		const startLength = this._resolveLineEndingLength(
			this._startEnding,
			maximumEndingLength,
		);

		const endLength = this._resolveLineEndingLength(
			this._endEnding,
			maximumEndingLength,
		);

		const startInset = this._resolveLineEndingBodyInset(
			this._startEnding,
			startLength,
		);

		const endInset = this._resolveLineEndingBodyInset(
			this._endEnding,
			endLength,
		);

		const startExtension =
			this._startEnding === LineEnding.None &&
				this._lineCapStart === LineCap.Square
				? geometry.halfThickness
				: 0;

		const endExtension =
			this._endEnding === LineEnding.None &&
				this._lineCapEnd === LineCap.Square
				? geometry.halfThickness
				: 0;

		const startDistance = startInset - startExtension;

		const endDistance = geometry.length - endInset + endExtension;

		const bodyLength = Math.max(0, endDistance - startDistance);

		const bodyStart = {
			x: this._start.x + geometry.direction.x * startDistance,
			y: this._start.y + geometry.direction.y * startDistance,
		};

		const bodyEnd =
			bodyLength > EPSILON
				? {
					x: this._start.x + geometry.direction.x * endDistance,
					y: this._start.y + geometry.direction.y * endDistance,
				}
				: { ...bodyStart };

		const offset = {
			x: geometry.normal.x * geometry.halfThickness,
			y: geometry.normal.y * geometry.halfThickness,
		};

		return {
			startLength,
			endLength,
			bodyLength,
			bodyStart,
			bodyEnd,
			outline: [
				{
					x: bodyStart.x + offset.x,
					y: bodyStart.y + offset.y,
				},
				{
					x: bodyEnd.x + offset.x,
					y: bodyEnd.y + offset.y,
				},
				{
					x: bodyEnd.x - offset.x,
					y: bodyEnd.y - offset.y,
				},
				{
					x: bodyStart.x - offset.x,
					y: bodyStart.y - offset.y,
				},
			],
		};
	}

	private _createLineArrowArea(
		sideA: Vector2,
		anchor: Vector2,
		sideB: Vector2,
	): ShapeStrokeArea | null {
		const commands: ShapePathCommand[] = [
			{
				type: "moveTo",
				point: { ...sideA },
			},
			{
				type: "lineTo",
				point: { ...anchor },
			},
			{
				type: "lineTo",
				point: { ...sideB },
			},
		];

		const centerlineLength =
			Math.hypot(anchor.x - sideA.x, anchor.y - sideA.y) +
			Math.hypot(sideB.x - anchor.x, sideB.y - anchor.y);

		const [resolved] = resolveStrokePatternGeometry(commands, {
			strokeWidth: this._thickness,
			strokeAlign: StrokeAlign.Center,
			length: centerlineLength + 1,
			gap: 0,
			cap: StrokeDashCap.Flat,
		});

		if (!resolved) {
			return null;
		}

		return {
			outer: resolved.commands,
			inner: [],
		};
	}

	private _createClosedEndingArea(
		points: readonly Vector2[],
	): ShapeStrokeArea | null {
		const first = points[0];

		if (!first || points.length < 3) {
			return null;
		}

		const outer: ShapePathCommand[] = [
			{
				type: "moveTo",
				point: { ...first },
			},
		];

		for (let index = 1; index < points.length; index += 1) {
			outer.push({
				type: "lineTo",
				point: { ...points[index]! },
			});
		}

		outer.push({
			type: "closePath",
		});

		return {
			outer,
			inner: [],
		};
	}

	private _updateBounds(): void {
		const minX = Math.min(this._start.x, this._end.x);
		const minY = Math.min(this._start.y, this._end.y);

		const maxX = Math.max(this._start.x, this._end.x);
		const maxY = Math.max(this._start.y, this._end.y);

		const nextWidth = maxX - minX;
		const nextHeight = maxY - minY;

		const needsNormalization = minX !== 0 || minY !== 0;
		const sizeChanged =
			nextWidth !== this.getWidth() || nextHeight !== this.getHeight();

		if (!needsNormalization && !sizeChanged) {
			return;
		}

		// Save current node position before normalization
		const position = this.getPosition();

		// Convert local offset into parent-space delta using current local matrix basis
		const localMatrix = this.getLocalMatrix();

		const deltaX = localMatrix.a * minX + localMatrix.c * minY;
		const deltaY = localMatrix.b * minX + localMatrix.d * minY;

		// Normalize line points into local box
		this._start = {
			x: this._start.x - minX,
			y: this._start.y - minY,
		};

		this._end = {
			x: this._end.x - minX,
			y: this._end.y - minY,
		};

		// Update derived box size without applying line resize logic
		super.setSize(nextWidth, nextHeight);

		// Move node so the line stays visually in the same place
		this.setPosition(position.x + deltaX, position.y + deltaY);
	}
}
