
import { EventEmitter, type IAttachable, type IDestroyable } from "../../../core";
import type { MediaDragStateChangeEvent, MediaDropEvent } from "./types";

type MediaDropTargetEvents = {
	drop: MediaDropEvent;
	dragStateChange: MediaDragStateChangeEvent;
};

export class MediaDropTarget implements IAttachable<HTMLElement>, IDestroyable {
	private readonly _events = new EventEmitter<MediaDropTargetEvents>();
	private _surface: HTMLElement | null = null;
	private _dragDepth = 0;
	private _isDragging = false;

	public onDrop(callback: (event: MediaDropEvent) => void): () => void {
		return this._events.on("drop", callback);
	}

	public onDragStateChange(
		callback: (event: MediaDragStateChangeEvent) => void,
	): () => void {
		return this._events.on("dragStateChange", callback);
	}

	public getSurface(): HTMLElement | null {
		return this._surface;
	}

	public isAttached(): boolean {
		return this._surface !== null;
	}

	public isDragging(): boolean {
		return this._isDragging;
	}

	public attach(surface: HTMLElement): void {
		if (surface === this._surface) {
			return;
		}

		this.detach();
		this._surface = surface;
		surface.addEventListener("dragenter", this._onDragEnter);
		surface.addEventListener("dragover", this._onDragOver);
		surface.addEventListener("dragleave", this._onDragLeave);
		surface.addEventListener("drop", this._onDrop);
	}

	public detach(): void {
		if (!this._surface) {
			return;
		}

		this._surface.removeEventListener("dragenter", this._onDragEnter);
		this._surface.removeEventListener("dragover", this._onDragOver);
		this._surface.removeEventListener("dragleave", this._onDragLeave);
		this._surface.removeEventListener("drop", this._onDrop);
		this._surface = null;
		this._dragDepth = 0;
		this._setDragging(false);
	}

	public destroy(): void {
		this.detach();
		this._events.clear();
	}

	private readonly _onDragEnter = (event: DragEvent): void => {
		if (!this._isFileDrag(event)) {
			return;
		}

		event.preventDefault();
		this._dragDepth += 1;
		this._setDragging(true);
	};

	private readonly _onDragOver = (event: DragEvent): void => {
		if (!this._isFileDrag(event)) {
			return;
		}

		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = "copy";
		}
	};

	private readonly _onDragLeave = (event: DragEvent): void => {
		if (!this._isDragging) {
			return;
		}

		event.preventDefault();
		this._dragDepth = Math.max(0, this._dragDepth - 1);
		if (this._dragDepth === 0) {
			this._setDragging(false);
		}
	};

	private readonly _onDrop = (event: DragEvent): void => {
		if (!this._isFileDrag(event)) {
			return;
		}

		event.preventDefault();

		const surface = this._surface;
		const dataTransfer = event.dataTransfer;
		this._dragDepth = 0;
		this._setDragging(false);

		if (!surface || !dataTransfer || dataTransfer.files.length === 0) {
			return;
		}

		const rect = surface.getBoundingClientRect();
		this._events.emit("drop", {
			files: Array.from(dataTransfer.files),
			screenPoint: {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			},
		});
	};

	private _isFileDrag(event: DragEvent): boolean {
		const dataTransfer = event.dataTransfer;
		if (!dataTransfer) {
			return false;
		}

		return (
			Array.from(dataTransfer.types).includes("Files") ||
			dataTransfer.files.length > 0
		);
	}

	private _setDragging(value: boolean): void {
		if (value === this._isDragging) {
			return;
		}

		this._isDragging = value;
		this._events.emit("dragStateChange", { isDragging: value });
	}
}
