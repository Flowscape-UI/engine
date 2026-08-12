import type { Vector2 } from "../../core/transform/types";
import type { ID } from "../../core/types";
import { NodeType } from "../base";
import {
	ShapeBase,
	type ShapeCornerRadiusAnchor,
	type ShapePathCommand,
	type ShapeStrokePath,
} from "../shape";
import { matrixInvert } from "../utils/matrix-invert";
import type { INodePolygon } from "./types";

export class NodePolygon extends ShapeBase implements INodePolygon {
	private static readonly MIN_SIDE_COUNT: number = 3;
	private static readonly MAX_SIDE_COUNT: number = 60;

	private _sideCount: number;

	constructor(id: ID, name?: string, type?: NodeType) {
		super(id, type ?? NodeType.Polygon, name ?? "Polygon");
		this._sideCount = NodePolygon.MIN_SIDE_COUNT;
	}

	/*********************************************************/
	/*                         Sides                         */
	/*********************************************************/

	public getSideCount(): number {
		return this._sideCount;
	}

	public setSideCount(value: number): void {
		const next = this._clampSideCount(value);

		if (next === this._sideCount) {
			return;
		}

		this._sideCount = next;
	}

	public getVertices(): Vector2[] {
		return this._getVertices();
	}

	public override getCornerRadiusAnchors(): readonly ShapeCornerRadiusAnchor[] {
		const vertices = this._getVertices();
		const count = vertices.length;

		if (count < 3) {
			return [];
		}

		return vertices.map((point, index) => ({
			point,
			previous: vertices[(index - 1 + count) % count]!,
			next: vertices[(index + 1) % count]!,
		}));
	}

	/*********************************************************/
	/*                       Overrides                       */
	/*********************************************************/
	public override toPathCommands(): readonly ShapePathCommand[] {
		return this._buildRoundedCornerPath(this.getCornerRadiusAnchors());
	}

	public override getStrokePath(): ShapeStrokePath | null {
		return this._buildClosedPolygonStrokePath(
			this.getCornerRadiusAnchors(),
		);
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

			const vertices = this._toViewVertices(this._getVertices());

			let inside = false;

			for (
				let i = 0, j = vertices.length - 1;
				i < vertices.length;
				j = i++
			) {
				const xi = vertices[i]!.x;
				const yi = vertices[i]!.y;

				const xj = vertices[j]!.x;
				const yj = vertices[j]!.y;

				const intersect =
					yi > localPoint.y !== yj > localPoint.y &&
					localPoint.x <
						((xj - xi) * (localPoint.y - yi)) / (yj - yi) + xi;

				if (intersect) {
					inside = !inside;
				}
			}

			return inside;
		} catch {
			return false;
		}
	}

	/*********************************************************/
	/*                        Helpers                        */
	/*********************************************************/

	protected _clampSideCount(count: number): number {
		return Math.max(
			NodePolygon.MIN_SIDE_COUNT,
			Math.min(NodePolygon.MAX_SIDE_COUNT, Math.round(count)),
		);
	}

	protected _getVertices(): Vector2[] {
		const sides = this._sideCount;

		const rx = this.getWidth() / 2;
		const ry = this.getHeight() / 2;

		const cx = rx;
		const cy = ry;

		const step = (Math.PI * 2) / sides;

		const vertices = new Array<Vector2>(sides);

		for (let i = 0; i < sides; i++) {
			const angle = i * step - Math.PI / 2;

			vertices[i] = {
				x: cx + Math.cos(angle) * rx,
				y: cy + Math.sin(angle) * ry,
			};
		}

		return vertices;
	}

	private _toViewVertices(vertices: readonly Vector2[]): Vector2[] {
		const local = this.getLocalOBB();
		const view = this.getLocalViewOBB();

		if (vertices.length === 0) {
			return [];
		}

		const scaleX = local.width !== 0 ? view.width / local.width : 1;
		const scaleY = local.height !== 0 ? view.height / local.height : 1;

		return vertices.map((point) => ({
			x: view.x + (point.x - local.x) * scaleX,
			y: view.y + (point.y - local.y) * scaleY,
		}));
	}
}
