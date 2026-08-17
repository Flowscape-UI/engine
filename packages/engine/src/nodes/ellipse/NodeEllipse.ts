import type { Vector2 } from "../../core/transform/types";
import { matrixInvert } from "../utils/matrix-invert";
import { NodeType } from "../base";
import {
	ShapeBase,
	type ShapeCornerRadiusAnchor,
	type ShapePathCommand,
} from "../shape";
import type { INodeEllipse } from "./types";
import type { ID } from "../../core/types";
import { EPSILON } from "../../core/math";
export class NodeEllipse extends ShapeBase implements INodeEllipse {
	private _innerRatio: number;
	private _startAngle: number;
	private _endAngle: number;

	constructor(id: ID, name?: string) {
		super(id, NodeType.Ellipse, name ?? "Ellipse");

		this._innerRatio = 0;
		this._startAngle = 0;
		this._endAngle = Math.PI * 2;
	}

	/*********************************************************/
	/*                         Ratio                         */
	/*********************************************************/
	public getInnerRatio(): number {
		return this._innerRatio;
	}

	public setInnerRatio(value: number): void {
		const next = Math.max(0, Math.min(value, 0.999));

		if (next === this._innerRatio) {
			return;
		}

		this._innerRatio = next;
	}

	/*********************************************************/
	/*                         Angle                         */
	/*********************************************************/
	public getStartAngle(): number {
		return this._radToDeg(this._startAngle);
	}

	public setStartAngle(value: number): void {
		const newValue = this._degToRad(value);
		if (this._startAngle === newValue) {
			return;
		}
		this._startAngle = newValue;
	}

	public getEndAngle(): number {
		return this._radToDeg(this._endAngle);
	}

	public setEndAngle(value: number): void {
		const newValue = this._degToRad(value);
		if (this._endAngle === newValue) {
			return;
		}
		this._endAngle = newValue;
	}

	public getSweepAngle(): number {
		return this._radToDeg(this._endAngle - this._startAngle);
	}

	public override toPathCommands(): readonly ShapePathCommand[] {
		const bounds = this.getLocalOBB();

		const rx = bounds.width / 2;
		const ry = bounds.height / 2;

		if (rx <= EPSILON || ry <= EPSILON) {
			return [];
		}

		const cx = bounds.x + rx;
		const cy = bounds.y + ry;

		const center: Vector2 = {
			x: cx,
			y: cy,
		};

		const start = this._normalizeAngle(this._startAngle);

		const sweep = this._normalizeAngle(this._endAngle - this._startAngle);

		const isFullEllipse =
			Math.abs(sweep) <= EPSILON ||
			Math.abs(sweep - Math.PI * 2) <= EPSILON;

		const commands: ShapePathCommand[] = [];

		/*********************************************************/
		/*                     Full ellipse                      */
		/*********************************************************/

		if (isFullEllipse) {
			commands.push({
				type: "moveTo",
				point: {
					x: cx + rx,
					y: cy,
				},
			});

			commands.push({
				type: "arcTo",
				center,
				radiusX: rx,
				radiusY: ry,
				startAngle: 0,
				endAngle: 360,
				clockwise: true,
			});

			commands.push({
				type: "closePath",
			});

			if (this._innerRatio > EPSILON) {
				const innerRx = rx * this._innerRatio;

				const innerRy = ry * this._innerRatio;

				commands.push({
					type: "moveTo",
					point: {
						x: cx + innerRx,
						y: cy,
					},
				});

				commands.push({
					type: "arcTo",
					center,
					radiusX: innerRx,
					radiusY: innerRy,
					startAngle: 360,
					endAngle: 0,
					clockwise: false,
				});

				commands.push({
					type: "closePath",
				});
			}

			return commands;
		}

		/*
		 * Не нормализуем end обратно в 0..2π.
		 *
		 * Например:
		 * start = 300°
		 * sweep = 120°
		 * end   = 420°
		 *
		 * Так arc остаётся непрерывным.
		 */
		const end = start + sweep;

		/*********************************************************/
		/*                    Simple sector                      */
		/*********************************************************/

		if (this._innerRatio <= EPSILON) {
			let [startRadius, endRadius] = this._resolveCornerRadiusValues(2);

			startRadius = Math.max(0, startRadius ?? 0);

			endRadius = Math.max(0, endRadius ?? 0);

			const originalStart = this._getEllipsePoint(cx, cy, rx, ry, start);

			const originalEnd = this._getEllipsePoint(cx, cy, rx, ry, end);

			const startEdgeLength = Math.hypot(
				originalStart.x - cx,
				originalStart.y - cy,
			);

			const endEdgeLength = Math.hypot(
				originalEnd.x - cx,
				originalEnd.y - cy,
			);

			startRadius = Math.min(startRadius, startEdgeLength * 0.999);

			endRadius = Math.min(endRadius, endEdgeLength * 0.999);

			/*
			 * Проверяем, чтобы два corner radius
			 * не съели всю outer arc.
			 */
			let startTrim = this._getEllipseArcTrimAngle(
				rx,
				ry,
				start,
				startRadius,
			);

			let endTrim = this._getEllipseArcTrimAngle(rx, ry, end, endRadius);

			const trimTotal = startTrim + endTrim;

			const maxTrim = sweep * 0.999;

			if (trimTotal > maxTrim && trimTotal > EPSILON) {
				const scale = maxTrim / trimTotal;

				startRadius *= scale;
				endRadius *= scale;

				startTrim = this._getEllipseArcTrimAngle(
					rx,
					ry,
					start,
					startRadius,
				);

				endTrim = this._getEllipseArcTrimAngle(rx, ry, end, endRadius);
			}

			const trimmedStart = start + startTrim;

			const trimmedEnd = end - endTrim;

			const arcStart = this._getEllipsePoint(
				cx,
				cy,
				rx,
				ry,
				trimmedStart,
			);

			const startEdgePoint = this._moveToward(
				originalStart,
				center,
				startRadius,
			);

			const endEdgePoint = this._moveToward(
				originalEnd,
				center,
				endRadius,
			);

			commands.push({
				type: "moveTo",
				point: arcStart,
			});

			commands.push({
				type: "arcTo",
				center,
				radiusX: rx,
				radiusY: ry,
				startAngle: this._radToDeg(trimmedStart),
				endAngle: this._radToDeg(trimmedEnd),
				clockwise: true,
			});

			/*
			 * Outer end:
			 *
			 * ellipse → rounded corner → radial edge
			 */
			commands.push({
				type: "quadraticCurveTo",
				control: originalEnd,
				point: endEdgePoint,
			});

			commands.push({
				type: "lineTo",
				point: center,
			});

			commands.push({
				type: "lineTo",
				point: startEdgePoint,
			});

			/*
			 * Outer start:
			 *
			 * radial edge → rounded corner → ellipse
			 */
			commands.push({
				type: "quadraticCurveTo",
				control: originalStart,
				point: arcStart,
			});

			commands.push({
				type: "closePath",
			});

			return commands;
		}

		/*********************************************************/
		/*                     Partial ring                      */
		/*********************************************************/

		const innerRx = rx * this._innerRatio;

		const innerRy = ry * this._innerRatio;

		let [
			outerStartRadius,
			outerEndRadius,
			innerEndRadius,
			innerStartRadius,
		] = this._resolveCornerRadiusValues(4);

		outerStartRadius = Math.max(0, outerStartRadius ?? 0);

		outerEndRadius = Math.max(0, outerEndRadius ?? 0);

		innerEndRadius = Math.max(0, innerEndRadius ?? 0);

		innerStartRadius = Math.max(0, innerStartRadius ?? 0);

		const outerStart = this._getEllipsePoint(cx, cy, rx, ry, start);

		const outerEnd = this._getEllipsePoint(cx, cy, rx, ry, end);

		const innerStart = this._getEllipsePoint(
			cx,
			cy,
			innerRx,
			innerRy,
			start,
		);

		const innerEnd = this._getEllipsePoint(cx, cy, innerRx, innerRy, end);

		/*
		 * На каждом radial cut два corner radius
		 * делят одну и ту же грань.
		 *
		 * Не позволяем им пересечься.
		 */
		[outerStartRadius, innerStartRadius] = this._fitCornerDistances(
			outerStartRadius,
			innerStartRadius,
			this._getDistance(outerStart, innerStart),
		);

		[outerEndRadius, innerEndRadius] = this._fitCornerDistances(
			outerEndRadius,
			innerEndRadius,
			this._getDistance(outerEnd, innerEnd),
		);

		/*
		 * Теперь ограничиваем outer arc.
		 */
		let outerStartTrim = this._getEllipseArcTrimAngle(
			rx,
			ry,
			start,
			outerStartRadius,
		);

		let outerEndTrim = this._getEllipseArcTrimAngle(
			rx,
			ry,
			end,
			outerEndRadius,
		);

		const outerTrimTotal = outerStartTrim + outerEndTrim;

		const maxArcTrim = sweep * 0.999;

		if (outerTrimTotal > maxArcTrim && outerTrimTotal > EPSILON) {
			const scale = maxArcTrim / outerTrimTotal;

			outerStartRadius *= scale;
			outerEndRadius *= scale;

			outerStartTrim = this._getEllipseArcTrimAngle(
				rx,
				ry,
				start,
				outerStartRadius,
			);

			outerEndTrim = this._getEllipseArcTrimAngle(
				rx,
				ry,
				end,
				outerEndRadius,
			);
		}

		/*
		 * И отдельно inner arc.
		 */
		let innerStartTrim = this._getEllipseArcTrimAngle(
			innerRx,
			innerRy,
			start,
			innerStartRadius,
		);

		let innerEndTrim = this._getEllipseArcTrimAngle(
			innerRx,
			innerRy,
			end,
			innerEndRadius,
		);

		const innerTrimTotal = innerStartTrim + innerEndTrim;

		if (innerTrimTotal > maxArcTrim && innerTrimTotal > EPSILON) {
			const scale = maxArcTrim / innerTrimTotal;

			innerStartRadius *= scale;
			innerEndRadius *= scale;

			innerStartTrim = this._getEllipseArcTrimAngle(
				innerRx,
				innerRy,
				start,
				innerStartRadius,
			);

			innerEndTrim = this._getEllipseArcTrimAngle(
				innerRx,
				innerRy,
				end,
				innerEndRadius,
			);
		}

		const outerArcStart = this._getEllipsePoint(
			cx,
			cy,
			rx,
			ry,
			start + outerStartTrim,
		);

		/*
		 * Inner arc идёт в обратную сторону:
		 *
		 * end → start
		 */
		const innerArcEndSide = this._getEllipsePoint(
			cx,
			cy,
			innerRx,
			innerRy,
			end - innerEndTrim,
		);

		/*
		 * Radial cut справа/end.
		 */
		const outerEndEdge = this._moveToward(
			outerEnd,
			innerEnd,
			outerEndRadius,
		);

		const innerEndEdge = this._moveToward(
			innerEnd,
			outerEnd,
			innerEndRadius,
		);

		/*
		 * Radial cut слева/start.
		 */
		const outerStartEdge = this._moveToward(
			outerStart,
			innerStart,
			outerStartRadius,
		);

		const innerStartEdge = this._moveToward(
			innerStart,
			outerStart,
			innerStartRadius,
		);

		/*********************************************************/
		/*                    Build the path                     */
		/*********************************************************/

		commands.push({
			type: "moveTo",
			point: outerArcStart,
		});

		/*
		 * Outer ellipse.
		 */
		commands.push({
			type: "arcTo",
			center,
			radiusX: rx,
			radiusY: ry,
			startAngle: this._radToDeg(start + outerStartTrim),
			endAngle: this._radToDeg(end - outerEndTrim),
			clockwise: true,
		});

		/*
		 * Outer end corner.
		 */
		commands.push({
			type: "quadraticCurveTo",
			control: outerEnd,
			point: outerEndEdge,
		});

		/*
		 * End radial edge.
		 */
		commands.push({
			type: "lineTo",
			point: innerEndEdge,
		});

		/*
		 * Inner end corner.
		 */
		commands.push({
			type: "quadraticCurveTo",
			control: innerEnd,
			point: innerArcEndSide,
		});

		/*
		 * Inner ellipse backwards.
		 */
		commands.push({
			type: "arcTo",
			center,
			radiusX: innerRx,
			radiusY: innerRy,
			startAngle: this._radToDeg(end - innerEndTrim),
			endAngle: this._radToDeg(start + innerStartTrim),
			clockwise: false,
		});

		/*
		 * Inner start corner.
		 */
		commands.push({
			type: "quadraticCurveTo",
			control: innerStart,
			point: innerStartEdge,
		});

		/*
		 * Start radial edge.
		 */
		commands.push({
			type: "lineTo",
			point: outerStartEdge,
		});

		/*
		 * Outer start corner.
		 */
		commands.push({
			type: "quadraticCurveTo",
			control: outerStart,
			point: outerArcStart,
		});

		commands.push({
			type: "closePath",
		});

		return commands;
	}

	public override getCornerRadiusAnchors(): readonly ShapeCornerRadiusAnchor[] {
		const bounds = this.getLocalOBB();

		const rx = bounds.width / 2;

		const ry = bounds.height / 2;

		if (rx <= EPSILON || ry <= EPSILON) {
			return [];
		}

		const sweep = this._normalizeAngle(this._endAngle - this._startAngle);

		const isFullEllipse =
			Math.abs(sweep) < EPSILON ||
			Math.abs(sweep - Math.PI * 2) < EPSILON;

		if (isFullEllipse) {
			return [];
		}

		const cx = bounds.x + rx;

		const cy = bounds.y + ry;

		const center: Vector2 = {
			x: cx,
			y: cy,
		};

		const start = this._normalizeAngle(this._startAngle);

		const end = start + sweep;

		const outerStart = this._getEllipsePoint(cx, cy, rx, ry, start);

		const outerEnd = this._getEllipsePoint(cx, cy, rx, ry, end);

		/*
		 * Sector without inner hole.
		 *
		 * Каждый handle движется не к общему center,
		 * а к середине своей radial section.
		 */
		if (this._innerRatio <= EPSILON) {
			const startTarget = this._getMidPoint(outerStart, center);

			const endTarget = this._getMidPoint(outerEnd, center);

			return [
				{
					point: outerStart,

					previous: center,
					next: outerEnd,

					handleTarget: startTarget,
				},

				{
					point: outerEnd,

					previous: outerStart,
					next: center,

					handleTarget: endTarget,
				},
			];
		}

		const innerRx = rx * this._innerRatio;

		const innerRy = ry * this._innerRatio;

		const innerStart = this._getEllipsePoint(
			cx,
			cy,
			innerRx,
			innerRy,
			start,
		);

		const innerEnd = this._getEllipsePoint(cx, cy, innerRx, innerRy, end);

		/*
		 * У start-cut своя центральная точка.
		 * К ней идут outerStart + innerStart.
		 */
		const startTarget = this._getMidPoint(outerStart, innerStart);

		/*
		 * У end-cut своя.
		 */
		const endTarget = this._getMidPoint(outerEnd, innerEnd);

		return [
			{
				point: outerStart,

				previous: innerStart,
				next: outerEnd,

				handleTarget: startTarget,
			},

			{
				point: outerEnd,

				previous: outerStart,
				next: innerEnd,

				handleTarget: endTarget,
			},

			{
				point: innerEnd,

				previous: outerEnd,
				next: innerStart,

				handleTarget: endTarget,
			},

			{
				point: innerStart,

				previous: innerEnd,
				next: outerStart,

				handleTarget: startTarget,
			},
		];
	}

	public override hitTest(worldPoint: Vector2): boolean {
		const bounds = this.getWorldViewAABB();

		if (
			worldPoint.x < bounds.x ||
			worldPoint.x > bounds.x + bounds.width ||
			worldPoint.y < bounds.y ||
			worldPoint.y > bounds.y + bounds.height
		) {
			return false;
		}

		try {
			const invMatrix = matrixInvert(this.getWorldMatrix());
			const localPoint = this._applyMatrixToPoint(invMatrix, worldPoint);
			const view = this.getLocalOBB();

			const halfWidth = view.width / 2;
			const halfHeight = view.height / 2;

			if (halfWidth === 0 || halfHeight === 0) {
				return false;
			}

			const centerX = view.x + halfWidth;
			const centerY = view.y + halfHeight;

			const normalizedX = (localPoint.x - centerX) / halfWidth;
			const normalizedY = (localPoint.y - centerY) / halfHeight;

			const distanceSq =
				normalizedX * normalizedX + normalizedY * normalizedY;

			// 1. Outside outer ellipse
			if (distanceSq > 1) {
				return false;
			}

			// 2. Inside inner ellipse hole
			if (this._innerRatio > 0) {
				const innerRatioSq = this._innerRatio * this._innerRatio;

				if (distanceSq < innerRatioSq) {
					return false;
				}
			}

			// 3. Full ellipse shortcut
			const sweep = this._normalizeAngle(
				this._endAngle - this._startAngle,
			);
			const isFullEllipse =
				Math.abs(sweep) < EPSILON ||
				Math.abs(sweep - Math.PI * 2) < EPSILON;

			if (isFullEllipse) {
				return true;
			}

			// 4. Angle check
			// Angle for ellipse sector check must be computed in normalized
			// ellipse space, otherwise arc boundaries drift on stretched shapes.
			const angle = this._normalizeAngle(
				Math.atan2(normalizedY, normalizedX),
			);

			const start = this._normalizeAngle(this._startAngle);
			const end = this._normalizeAngle(this._endAngle);

			return this._isAngleBetween(angle, start, end);
		} catch {
			return false;
		}
	}

	/*********************************************************/
	/*                        Helpers                        */
	/*********************************************************/
	private _degToRad(angle: number): number {
		return (angle * Math.PI) / 180;
	}

	private _radToDeg(angle: number): number {
		return (angle * 180) / Math.PI;
	}

	private _normalizeAngle(angle: number): number {
		const tau = Math.PI * 2;
		return ((angle % tau) + tau) % tau;
	}

	private _isAngleBetween(
		angle: number,
		start: number,
		end: number,
	): boolean {
		if (start <= end) {
			return angle >= start && angle <= end;
		}

		// Wrapped range, e.g. 300° -> 60°
		return angle >= start || angle <= end;
	}

	private _getEllipsePoint(
		cx: number,
		cy: number,
		rx: number,
		ry: number,
		angle: number,
	): Vector2 {
		return {
			x: cx + Math.cos(angle) * rx,
			y: cy + Math.sin(angle) * ry,
		};
	}

	private _resolveCornerRadiusValues(count: number): number[] {
		return this._resolveShapeValues(this.getCornerRadius(), count);
	}

	private _getEllipseArcTrimAngle(
		rx: number,
		ry: number,
		angle: number,
		distance: number,
	): number {
		if (distance <= EPSILON) {
			return 0;
		}

		/*
		 * Производная эллипса:
		 *
		 * x' = -rx sin(t)
		 * y' =  ry cos(t)
		 *
		 * Её длина говорит, сколько local-пикселей
		 * приходится примерно на один радиан около
		 * текущей точки.
		 */
		const speed = Math.hypot(rx * Math.sin(angle), ry * Math.cos(angle));

		if (speed <= EPSILON) {
			return 0;
		}

		return distance / speed;
	}

	private _getMidPoint(a: Vector2, b: Vector2): Vector2 {
		return {
			x: (a.x + b.x) * 0.5,

			y: (a.y + b.y) * 0.5,
		};
	}

	private _moveToward(from: Vector2, to: Vector2, distance: number): Vector2 {
		const dx = to.x - from.x;
		const dy = to.y - from.y;

		const length = Math.hypot(dx, dy);

		if (length <= EPSILON) {
			return {
				x: from.x,
				y: from.y,
			};
		}

		const clamped = Math.max(0, Math.min(distance, length));

		const progress = clamped / length;

		return {
			x: from.x + dx * progress,

			y: from.y + dy * progress,
		};
	}

	private _getDistance(a: Vector2, b: Vector2): number {
		return Math.hypot(b.x - a.x, b.y - a.y);
	}

	private _fitCornerDistances(
		first: number,
		second: number,
		length: number,
	): [number, number] {
		const safeLength = Math.max(0, length * 0.999);

		const total = first + second;

		if (total <= safeLength || total <= EPSILON) {
			return [first, second];
		}

		const scale = safeLength / total;

		return [first * scale, second * scale];
	}
}
