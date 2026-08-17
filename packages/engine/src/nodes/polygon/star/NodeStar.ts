import type { ID } from "../../../core";
import type { Vector2 } from "../../../core/transform/types";
import { NodeType } from "../../base";
import { NodePolygon } from "../NodePolygon";
import type { INodeStar } from "./types";

export class NodeStar extends NodePolygon implements INodeStar {
	private _innerRatio: number;

	constructor(id: ID, name?: string) {
		super(id, name ?? "Star", NodeType.Star);
		this._innerRatio = 0.5;
		this.setSideCount(5);
	}

	/*********************************************************/
	/*                     Inner Radius                      */
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
	/*                       Overrides                       */
	/*********************************************************/

	protected override _getVertices(): Vector2[] {
		const sides = this.getSideCount();

		const rx = this.getWidth() / 2;
		const ry = this.getHeight() / 2;

		const cx = rx;
		const cy = ry;

		const outerStep = (Math.PI * 2) / sides;
		const innerStep = outerStep / 2;

		const vertices = new Array<Vector2>(sides * 2);

		for (let i = 0; i < sides; i++) {
			const outerAngle = i * outerStep - Math.PI / 2;
			const innerAngle = outerAngle + innerStep;

			const outerIndex = i * 2;
			const innerIndex = outerIndex + 1;

			vertices[outerIndex] = {
				x: cx + Math.cos(outerAngle) * rx,
				y: cy + Math.sin(outerAngle) * ry,
			};

			vertices[innerIndex] = {
				x: cx + Math.cos(innerAngle) * rx * this._innerRatio,
				y: cy + Math.sin(innerAngle) * ry * this._innerRatio,
			};
		}

		return vertices;
	}
}
