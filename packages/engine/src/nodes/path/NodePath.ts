import { NodeType } from "../base";
import { ShapeBase, type ShapePathCommand } from "../shape";
import type { Vector2 } from "../../core/transform/types";
import type { INodePath, PathCommand } from "./types";
import { PathCommandType } from "./types";
import type { ID } from "../../core/types";
import { matrixInvert } from "../utils/matrix-invert";

export class NodePath extends ShapeBase implements INodePath {
	private _commands: PathCommand[];

	constructor(id: ID, name?: string) {
		super(id, NodeType.Path, name ?? "Path");
		this._commands = [];
		this.setSize(100, 100);
	}

	public getCommands(): PathCommand[] {
		return this._commands.map((cmd) => structuredClone(cmd));
	}

	public setCommands(value: PathCommand[]): void {
		const next = value.map((cmd) => structuredClone(cmd));
		this._commands = next;
	}

	public moveTo(to: Vector2): void {
		this._commands.push({
			type: PathCommandType.MoveTo,
			to: { ...to },
		});
	}

	public lineTo(to: Vector2): void {
		this._commands.push({
			type: PathCommandType.LineTo,
			to: { ...to },
		});
	}

	public quadTo(control: Vector2, to: Vector2): void {
		this._commands.push({
			type: PathCommandType.QuadTo,
			control: { ...control },
			to: { ...to },
		});
	}

	public cubicTo(control1: Vector2, control2: Vector2, to: Vector2): void {
		this._commands.push({
			type: PathCommandType.CubicTo,
			control1: { ...control1 },
			control2: { ...control2 },
			to: { ...to },
		});
	}

	public closePath(): void {
		const last = this._commands[this._commands.length - 1];
		if (last?.type === PathCommandType.Close) {
			return;
		}
		this._commands.push({
			type: PathCommandType.Close,
		});
	}

	public clearPath(): void {
		if (this._commands.length === 0) {
			return;
		}
		this._commands = [];
	}

	public isClosed(): boolean {
		return (
			this._commands[this._commands.length - 1]?.type ===
			PathCommandType.Close
		);
	}

	public override toPathCommands(): readonly ShapePathCommand[] {
		if (this._commands.length === 0) {
			return [];
		}

		return this._toShapePathCommands();
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

			const contours = this._toContours();
			if (contours.length === 0) {
				return false;
			}

			let inside = false;

			for (const contour of contours) {
				if (!contour.closed || contour.points.length < 3) {
					continue;
				}

				if (this._isPointInPolygon(localPoint, contour.points)) {
					inside = !inside;
				}
			}

			return inside;
		} catch {
			return false;
		}
	}

	public override toString(): string {
		const parts: string[] = [];

		for (const cmd of this._commands) {
			switch (cmd.type) {
				case PathCommandType.MoveTo:
					parts.push(`M ${cmd.to.x} ${cmd.to.y}`);
					break;
				case PathCommandType.LineTo:
					parts.push(`L ${cmd.to.x} ${cmd.to.y}`);
					break;
				case PathCommandType.QuadTo:
					parts.push(
						`Q ${cmd.control.x} ${cmd.control.y} ${cmd.to.x} ${cmd.to.y}`,
					);
					break;
				case PathCommandType.CubicTo:
					parts.push(
						`C ${cmd.control1.x} ${cmd.control1.y} ${cmd.control2.x} ${cmd.control2.y} ${cmd.to.x} ${cmd.to.y}`,
					);
					break;
				case PathCommandType.Close:
					parts.push(`Z`);
					break;
			}
		}

		return parts.join(" ");
	}

	public static fromString<T extends NodePath>(
		this: new (id: ID, name?: string) => T,
		id: ID,
		path: string,
	): T {
		const node = new this(id);
		const commands = NodePath.parseSvgPathToCommands(path);
		node.setCommands(commands);
		return node;
	}

	public static parseSvgPathToCommands(path: string): PathCommand[] {
		const tokens = this._tokenizeSvgPath(path);
		const commands: PathCommand[] = [];

		let i = 0;
		let current: Vector2 = { x: 0, y: 0 };
		let subpathStart: Vector2 = { x: 0, y: 0 };

		let lastQuadraticControl: Vector2 | null = null;
		let lastCubicControl2: Vector2 | null = null;

		const isCommand = (token: string): boolean => /^[a-zA-Z]$/.test(token);

		const readNumber = (): number => {
			if (i >= tokens.length) {
				throw new Error("Unexpected end of SVG path");
			}

			const value = Number(tokens[i++]);

			if (!Number.isFinite(value)) {
				throw new Error(`Invalid SVG path number: ${tokens[i - 1]}`);
			}

			return value;
		};

		const reflectPoint = (point: Vector2, around: Vector2): Vector2 => {
			return {
				x: around.x * 2 - point.x,
				y: around.y * 2 - point.y,
			};
		};

		while (i < tokens.length) {
			const token = tokens[i++];

			if (!isCommand(token ?? "")) {
				throw new Error(`Expected SVG command, got: ${token}`);
			}

			const cmd = token;
			const isRelative = cmd === cmd?.toLowerCase();

			switch (cmd?.toUpperCase()) {
				case "M": {
					let first = true;

					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const x = readNumber();
						const y = readNumber();

						const next = {
							x: isRelative ? current.x + x : x,
							y: isRelative ? current.y + y : y,
						};

						if (first) {
							commands.push({
								type: PathCommandType.MoveTo,
								to: next,
							});
							subpathStart = { ...next };
							first = false;
						} else {
							commands.push({
								type: PathCommandType.LineTo,
								to: next,
							});
						}

						current = next;
						lastQuadraticControl = null;
						lastCubicControl2 = null;
					}

					break;
				}

				case "L": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const x = readNumber();
						const y = readNumber();

						const next = {
							x: isRelative ? current.x + x : x,
							y: isRelative ? current.y + y : y,
						};

						commands.push({
							type: PathCommandType.LineTo,
							to: next,
						});

						current = next;
						lastQuadraticControl = null;
						lastCubicControl2 = null;
					}

					break;
				}

				case "H": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const x = readNumber();

						const next = {
							x: isRelative ? current.x + x : x,
							y: current.y,
						};

						commands.push({
							type: PathCommandType.LineTo,
							to: next,
						});

						current = next;
						lastQuadraticControl = null;
						lastCubicControl2 = null;
					}

					break;
				}

				case "V": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const y = readNumber();

						const next = {
							x: current.x,
							y: isRelative ? current.y + y : y,
						};

						commands.push({
							type: PathCommandType.LineTo,
							to: next,
						});

						current = next;
						lastQuadraticControl = null;
						lastCubicControl2 = null;
					}

					break;
				}

				case "Q": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const cx = readNumber();
						const cy = readNumber();
						const x = readNumber();
						const y = readNumber();

						const control = {
							x: isRelative ? current.x + cx : cx,
							y: isRelative ? current.y + cy : cy,
						};

						const next = {
							x: isRelative ? current.x + x : x,
							y: isRelative ? current.y + y : y,
						};

						commands.push({
							type: PathCommandType.QuadTo,
							control,
							to: next,
						});

						current = next;
						lastQuadraticControl = { ...control };
						lastCubicControl2 = null;
					}

					break;
				}

				case "T": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const x = readNumber();
						const y = readNumber();

						const control: any = lastQuadraticControl
							? reflectPoint(lastQuadraticControl, current)
							: { ...current };

						const next = {
							x: isRelative ? current.x + x : x,
							y: isRelative ? current.y + y : y,
						};

						commands.push({
							type: PathCommandType.QuadTo,
							control,
							to: next,
						});

						current = next;
						lastQuadraticControl = { ...control };
						lastCubicControl2 = null;
					}

					break;
				}

				case "C": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const c1x = readNumber();
						const c1y = readNumber();
						const c2x = readNumber();
						const c2y = readNumber();
						const x = readNumber();
						const y = readNumber();

						const control1 = {
							x: isRelative ? current.x + c1x : c1x,
							y: isRelative ? current.y + c1y : c1y,
						};

						const control2 = {
							x: isRelative ? current.x + c2x : c2x,
							y: isRelative ? current.y + c2y : c2y,
						};

						const next = {
							x: isRelative ? current.x + x : x,
							y: isRelative ? current.y + y : y,
						};

						commands.push({
							type: PathCommandType.CubicTo,
							control1,
							control2,
							to: next,
						});

						current = next;
						lastQuadraticControl = null;
						lastCubicControl2 = { ...control2 };
					}

					break;
				}

				case "S": {
					while (i < tokens.length && !isCommand(tokens[i]!)) {
						const c2x = readNumber();
						const c2y = readNumber();
						const x = readNumber();
						const y = readNumber();

						const control1 = lastCubicControl2
							? reflectPoint(lastCubicControl2, current)
							: { ...current };

						const control2 = {
							x: isRelative ? current.x + c2x : c2x,
							y: isRelative ? current.y + c2y : c2y,
						};

						const next = {
							x: isRelative ? current.x + x : x,
							y: isRelative ? current.y + y : y,
						};

						commands.push({
							type: PathCommandType.CubicTo,
							control1,
							control2,
							to: next,
						});

						current = next;
						lastQuadraticControl = null;
						lastCubicControl2 = { ...control2 };
					}

					break;
				}

				case "Z": {
					commands.push({
						type: PathCommandType.Close,
					});

					current = { ...subpathStart };
					lastQuadraticControl = null;
					lastCubicControl2 = null;
					break;
				}

				case "A": {
					throw new Error(
						"SVG arc commands (A/a) are not supported yet",
					);
				}

				default:
					throw new Error(`Unsupported SVG command: ${cmd}`);
			}
		}

		return commands;
	}

	private _toShapePathCommands(): ShapePathCommand[] {
		const sourceBounds = this._getPathSourceBounds();

		if (!sourceBounds) {
			return [];
		}

		const shapeCommands: ShapePathCommand[] = [];

		const mapPoint = (point: Vector2): Vector2 =>
			this._toViewPoint(point, sourceBounds);

		let currentPoint: Vector2 | null = null;

		for (const command of this._commands) {
			switch (command.type) {
				case PathCommandType.MoveTo: {
					const point = mapPoint(command.to);
					currentPoint = point;
					shapeCommands.push({
						type: "moveTo",
						point,
					});
					break;
				}

				case PathCommandType.LineTo: {
					const point = mapPoint(command.to);
					currentPoint = point;
					shapeCommands.push({
						type: "lineTo",
						point,
					});
					break;
				}

				case PathCommandType.QuadTo: {
					if (!currentPoint) {
						currentPoint = mapPoint(command.to);
						shapeCommands.push({
							type: "moveTo",
							point: currentPoint,
						});
						break;
					}

					const control = mapPoint(command.control);
					const to = mapPoint(command.to);
					const points = this._flattenQuadraticBezier(
						currentPoint,
						control,
						to,
					);

					for (const point of points) {
						shapeCommands.push({
							type: "lineTo",
							point,
						});
					}

					currentPoint = to;
					break;
				}

				case PathCommandType.CubicTo: {
					if (!currentPoint) {
						currentPoint = mapPoint(command.to);
						shapeCommands.push({
							type: "moveTo",
							point: currentPoint,
						});
						break;
					}

					const control1 = mapPoint(command.control1);
					const control2 = mapPoint(command.control2);
					const to = mapPoint(command.to);
					const points = this._flattenCubicBezier(
						currentPoint,
						control1,
						control2,
						to,
					);

					for (const point of points) {
						shapeCommands.push({
							type: "lineTo",
							point,
						});
					}

					currentPoint = to;
					break;
				}

				case PathCommandType.Close: {
					shapeCommands.push({ type: "closePath" });
					currentPoint = null;
					break;
				}
			}
		}

		return shapeCommands;
	}

	private _toContours(): { points: Vector2[]; closed: boolean }[] {
		const sourceBounds = this._getPathSourceBounds();

		if (!sourceBounds) {
			return [];
		}

		const contours: { points: Vector2[]; closed: boolean }[] = [];

		let current: Vector2[] = [];
		let currentPoint: Vector2 | null = null;

		for (const command of this._commands) {
			switch (command.type) {
				case PathCommandType.MoveTo: {
					if (current.length > 0) {
						contours.push({
							points: current,
							closed: false,
						});
					}

					current = [this._toViewPoint(command.to, sourceBounds)];
					currentPoint = current[0]!;
					break;
				}

				case PathCommandType.LineTo: {
					const point = this._toViewPoint(command.to, sourceBounds);
					if (current.length === 0) {
						current = [point];
					} else {
						current.push(point);
					}
					currentPoint = point;
					break;
				}

				case PathCommandType.QuadTo: {
					const to = this._toViewPoint(command.to, sourceBounds);

					if (!currentPoint) {
						current = [to];
						currentPoint = to;
						break;
					}

					const control = this._toViewPoint(
						command.control,
						sourceBounds,
					);
					const points = this._flattenQuadraticBezier(
						currentPoint,
						control,
						to,
					);
					current.push(...points);
					currentPoint = to;
					break;
				}

				case PathCommandType.CubicTo: {
					const to = this._toViewPoint(command.to, sourceBounds);

					if (!currentPoint) {
						current = [to];
						currentPoint = to;
						break;
					}

					const control1 = this._toViewPoint(
						command.control1,
						sourceBounds,
					);
					const control2 = this._toViewPoint(
						command.control2,
						sourceBounds,
					);
					const points = this._flattenCubicBezier(
						currentPoint,
						control1,
						control2,
						to,
					);
					current.push(...points);
					currentPoint = to;
					break;
				}

				case PathCommandType.Close: {
					if (current.length > 0) {
						contours.push({
							points: current,
							closed: true,
						});
					}
					current = [];
					currentPoint = null;
					break;
				}
			}
		}

		if (current.length > 0) {
			contours.push({
				points: current,
				closed: false,
			});
		}

		return contours;
	}

	private _toViewPoint(
		point: Vector2,
		sourceBounds: {
			x: number;
			y: number;
			width: number;
			height: number;
		},
	): Vector2 {
		const view = this.getLocalOBB();

		const nx =
			sourceBounds.width > 0
				? (point.x - sourceBounds.x) / sourceBounds.width
				: 0.5;
		const ny =
			sourceBounds.height > 0
				? (point.y - sourceBounds.y) / sourceBounds.height
				: 0.5;

		return {
			x: view.x + view.width * nx,
			y: view.y + view.height * ny,
		};
	}

	private _getPathSourceBounds(): {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null {
		if (this._commands.length === 0) {
			return null;
		}

		const points: Vector2[] = [];
		let currentPoint: Vector2 | null = null;

		for (const command of this._commands) {
			switch (command.type) {
				case PathCommandType.MoveTo: {
					const point = { ...command.to };
					points.push(point);
					currentPoint = point;
					break;
				}

				case PathCommandType.LineTo: {
					const point = { ...command.to };
					points.push(point);
					currentPoint = point;
					break;
				}

				case PathCommandType.QuadTo: {
					const to = { ...command.to };

					if (!currentPoint) {
						points.push(to);
						currentPoint = to;
						break;
					}

					const flattened = this._flattenQuadraticBezier(
						currentPoint,
						command.control,
						to,
					);

					points.push(...flattened);
					currentPoint = to;
					break;
				}

				case PathCommandType.CubicTo: {
					const to = { ...command.to };

					if (!currentPoint) {
						points.push(to);
						currentPoint = to;
						break;
					}

					const flattened = this._flattenCubicBezier(
						currentPoint,
						command.control1,
						command.control2,
						to,
					);

					points.push(...flattened);
					currentPoint = to;
					break;
				}

				case PathCommandType.Close: {
					currentPoint = null;
					break;
				}
			}
		}

		if (points.length === 0) {
			return null;
		}

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		for (const point of points) {
			if (point.x < minX) minX = point.x;
			if (point.y < minY) minY = point.y;
			if (point.x > maxX) maxX = point.x;
			if (point.y > maxY) maxY = point.y;
		}

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}

	private _flattenQuadraticBezier(
		from: Vector2,
		control: Vector2,
		to: Vector2,
	): Vector2[] {
		const points: Vector2[] = [];
		const segments = 16;

		for (let i = 1; i <= segments; i += 1) {
			const t = i / segments;
			const omt = 1 - t;

			points.push({
				x: omt * omt * from.x + 2 * omt * t * control.x + t * t * to.x,
				y: omt * omt * from.y + 2 * omt * t * control.y + t * t * to.y,
			});
		}

		return points;
	}

	private _flattenCubicBezier(
		from: Vector2,
		control1: Vector2,
		control2: Vector2,
		to: Vector2,
	): Vector2[] {
		const points: Vector2[] = [];
		const segments = 20;

		for (let i = 1; i <= segments; i += 1) {
			const t = i / segments;
			const omt = 1 - t;

			points.push({
				x:
					omt * omt * omt * from.x +
					3 * omt * omt * t * control1.x +
					3 * omt * t * t * control2.x +
					t * t * t * to.x,
				y:
					omt * omt * omt * from.y +
					3 * omt * omt * t * control1.y +
					3 * omt * t * t * control2.y +
					t * t * t * to.y,
			});
		}

		return points;
	}

	private _isPointInPolygon(
		point: Vector2,
		polygon: readonly Vector2[],
	): boolean {
		let inside = false;

		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			const a = polygon[i]!;
			const b = polygon[j]!;

			const intersects =
				a.y > point.y !== b.y > point.y &&
				point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;

			if (intersects) {
				inside = !inside;
			}
		}

		return inside;
	}

	private static _tokenizeSvgPath(path: string): string[] {
		return path
			.replace(/,/g, " ")
			.replace(/([a-zA-Z])/g, " $1 ")
			.trim()
			.split(/\s+/)
			.flatMap((token) => {
				if (/^[a-zA-Z]$/.test(token)) {
					return [token];
				}

				const matches = token.match(
					/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?/g,
				);
				return matches ?? [];
			});
	}
}
