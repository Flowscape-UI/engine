import type { ShapePathCommand, StrokePathMetricPoint, StrokePathMetrics } from "../types";
import { EPSILON, MathF32, type Vector2 } from "../../../core";

export function resolveStrokePathMetrics(
	commands: readonly ShapePathCommand[],
): StrokePathMetrics {
	const points: StrokePathMetricPoint[] = [];

	let currentPoint: Vector2 | null = null;
	let subpathStartPoint: Vector2 | null = null;
	let totalLength = 0;
	let closed = false;

	const appendPoint = (point: Vector2): void => {
		if (!currentPoint) {
			currentPoint = clonePoint(point);
			subpathStartPoint = clonePoint(point);

			points.push({
				point: clonePoint(point),
				distance: 0,
			});

			return;
		}

		const segmentLength = Math.hypot(
			point.x - currentPoint.x,
			point.y - currentPoint.y,
		);

		if (segmentLength <= 0) {
			currentPoint = clonePoint(point);
			return;
		}

		totalLength = MathF32.add(totalLength, segmentLength);

		currentPoint = clonePoint(point);

		points.push({
			point: clonePoint(point),
			distance: totalLength,
		});
	};

	for (const command of commands) {
		switch (command.type) {
			case "moveTo":
				currentPoint = clonePoint(command.point);

				subpathStartPoint = clonePoint(command.point);

				if (points.length === 0) {
					points.push({
						point: clonePoint(command.point),
						distance: totalLength,
					});
				}

				break;

			case "lineTo":
				appendPoint(command.point);
				break;

			case "closePath":
				if (!currentPoint || !subpathStartPoint) {
					break;
				}

				appendPoint(subpathStartPoint);
				closed = true;
				break;

			case "quadraticCurveTo": {
				if (!currentPoint) {
					break;
				}

				const startPoint = clonePoint(currentPoint);

				const controlPoint = command.control;

				const endPoint = command.point;

				const estimatedLength =
					Math.hypot(
						controlPoint.x - startPoint.x,
						controlPoint.y - startPoint.y,
					) +
					Math.hypot(
						endPoint.x - controlPoint.x,
						endPoint.y - controlPoint.y,
					);

				const segmentCount = Math.max(
					4,
					Math.min(64, Math.ceil(estimatedLength / 8)),
				);

				for (let index = 1; index <= segmentCount; index += 1) {
					const t = index / segmentCount;

					appendPoint(
						resolveQuadraticPoint(
							startPoint,
							controlPoint,
							endPoint,
							t,
						),
					);
				}

				break;
			}

			case "arcTo": {
				if (command.radiusX <= 0 || command.radiusY <= 0) {
					break;
				}

				const startRadians = (command.startAngle * Math.PI) / 180;

				const sweepRadians = resolveArcSweepRadians(
					command.startAngle,
					command.endAngle,
					command.clockwise,
				);

				const arcStartPoint = resolveArcPoint(
					command.center,
					command.radiusX,
					command.radiusY,
					startRadians,
				);

				/*
				 * Canvas соединяет текущую точку
				 * с началом arc прямой линией,
				 * если они не совпадают.
				 */
				if (!currentPoint) {
					appendPoint(arcStartPoint);
				} else {
					const distanceToArcStart = Math.hypot(
						arcStartPoint.x - currentPoint.x,
						arcStartPoint.y - currentPoint.y,
					);

					if (distanceToArcStart > EPSILON) {
						appendPoint(arcStartPoint);
					}
				}

				if (Math.abs(sweepRadians) <= EPSILON) {
					break;
				}

				const estimatedLength =
					Math.max(command.radiusX, command.radiusY) *
					Math.abs(sweepRadians);

				const segmentCount = Math.max(
					4,
					Math.min(128, Math.ceil(estimatedLength / 8)),
				);

				for (let index = 1; index <= segmentCount; index += 1) {
					const progress = index / segmentCount;

					const angle = startRadians + sweepRadians * progress;

					appendPoint(
						resolveArcPoint(
							command.center,
							command.radiusX,
							command.radiusY,
							angle,
						),
					);
				}

				break;
			}
		}
	}

	return {
		points,
		length: totalLength,
		closed,

		winding: closed ? resolveStrokePathWinding(points) : 0,
	};
}

function clonePoint(point: Vector2): Vector2 {
	return {
		x: MathF32.toF32(point.x),
		y: MathF32.toF32(point.y),
	};
}

function resolveQuadraticPoint(
	start: Vector2,
	control: Vector2,
	end: Vector2,
	t: number,
): Vector2 {
	const inverseT = 1 - t;

	const inverseTSquared = inverseT * inverseT;

	const tSquared = t * t;

	return {
		x: MathF32.toF32(
			inverseTSquared * start.x +
				2 * inverseT * t * control.x +
				tSquared * end.x,
		),

		y: MathF32.toF32(
			inverseTSquared * start.y +
				2 * inverseT * t * control.y +
				tSquared * end.y,
		),
	};
}

function resolveStrokePathWinding(
	points: readonly StrokePathMetricPoint[],
): number {
	if (points.length < 3) {
		return 0;
	}

	let area = 0;

	for (let index = 0; index < points.length - 1; index += 1) {
		const current = points[index]!.point;

		const next = points[index + 1]!.point;

		area += current.x * next.y - next.x * current.y;
	}

	return MathF32.toF32(area);
}

function resolveArcSweepRadians(
	startAngle: number,
	endAngle: number,
	clockwise: boolean,
): number {
	const fullCircle = Math.PI * 2;

	let sweep = ((endAngle - startAngle) * Math.PI) / 180;

	if (clockwise) {
		while (sweep < 0) {
			sweep += fullCircle;
		}
	} else {
		while (sweep > 0) {
			sweep -= fullCircle;
		}
	}

	return sweep;
}

function resolveArcPoint(
	center: Vector2,
	radiusX: number,
	radiusY: number,
	angle: number,
): Vector2 {
	return {
		x: MathF32.toF32(center.x + Math.cos(angle) * radiusX),

		y: MathF32.toF32(center.y + Math.sin(angle) * radiusY),
	};
}