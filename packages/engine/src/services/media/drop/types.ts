import type { Point } from "../../../core";


export type MediaDropEvent = {
	readonly files: readonly File[];
	readonly screenPoint: Point;
};

export type MediaDragStateChangeEvent = {
	readonly isDragging: boolean;
};
