import Konva from "konva";
import type { IRendererLayerWorld } from "./types";
import {
	RendererCanvasGroup,
	RendererCanvasImage,
	RendererCanvasManager,
	RendererCanvasRegistry,
	RendererCanvasShape,
	RendererCanvasText,
	RendererCanvasVideo,
} from "../../../nodes";
import { NodeType } from "../../../../../nodes";
import type { CameraState } from "../../../../../core/camera";
import { GridRenderer, KonvaGridView } from "../../../../../grid";
import { LayerWorld } from "../../../../../scene/layers";
import type { HostType } from "../../../../hosts";

export class RendererLayerWorldCanvas implements IRendererLayerWorld {
	public readonly id: number;
	public readonly type: HostType;

	private readonly _layer: Konva.Layer;
	private readonly _content: Konva.Group;
	private readonly _gridContent: Konva.Group;

	private readonly _registry: RendererCanvasRegistry;
	private readonly _manager: RendererCanvasManager;

	private _world: LayerWorld | null = null;

	// Grid
	private readonly _gridView: KonvaGridView;

	constructor() {
		this.id = 1;
		this.type = "canvas";
		this._layer = new Konva.Layer({
			listening: false,
		});

		this._content = new Konva.Group({
			listening: false,
		});

		this._gridContent = new Konva.Group({
			listening: false,
		});

		this._registry = new RendererCanvasRegistry();
		this._manager = new RendererCanvasManager(
			this._registry,
			this._content,
		);

		const gridRenderer = new GridRenderer();
		this._gridView = new KonvaGridView({
			renderer: gridRenderer,
			getDrawInput: () => {
				if (!this._world) {
					return {
						camera: { x: 0, y: 0, scale: 1, rotation: 0 },
						viewportAabbWorld: { x: 0, y: 0, width: 0, height: 0 },
					};
				}

				return {
					camera: this._world.camera.getState(),
					viewportAabbWorld: this._world.getViewportWorldAABB(),
				};
			},
		});

		this._gridContent.add(this._content);
		this._gridContent.add(this._gridView.getRoot());
		this._layer.add(this._gridContent);
		this._registerDefaultRenderers();
	}

	public getLayer(): Konva.Layer {
		return this._layer;
	}

	public getRenderNode(): Konva.Layer {
		return this._layer;
	}

	public attach(world: LayerWorld): void {
		this._world = world;

		this._gridView.setOptions({
			enabled: true,
			size: 1,
			majorEvery: 10,
			maxLines: 1000,
			minorAlpha: 0.2,
			majorAlpha: 0.2,
		});
	}

	public detach(): void {
		this._world = null;
		this._manager.clear();
		this._content.destroyChildren();

		this._gridContent.setAttrs({
			x: 0,
			y: 0,
			scaleX: 1,
			scaleY: 1,
			rotation: 0,
			offsetX: 0,
			offsetY: 0,
		});
	}

	public update(): void {
		if (!this._world) {
			return;
		}

		this._applyCamera(this._world.camera.getState());

		const viewport = this._world.getViewportWorldAABB();
		this._manager.renderNodes(this._world.getNodes(), viewport);
	}

	public render(): void {
		this._layer.draw();
	}

	public destroy(): void {
		this.detach();
		this._gridView.destroy();
		this._layer.destroy();
	}

	private _registerDefaultRenderers(): void {
		const shapeRenderer = new RendererCanvasShape();

		const shapeTypes = [
			NodeType.Rect,
			NodeType.Ellipse,
			NodeType.Polygon,
			NodeType.Star,
			NodeType.Line,
			NodeType.Path,
		] as const;

		for (const type of shapeTypes) {
			this._registry.register(type, shapeRenderer);
		}

		this._registry.register(NodeType.Group, new RendererCanvasGroup());
		this._registry.register(NodeType.Text, new RendererCanvasText());
		this._registry.register(NodeType.Image, new RendererCanvasImage());
		this._registry.register(NodeType.Video, new RendererCanvasVideo());
	}

	private _applyCamera(state: CameraState): void {
		if (!this._world) {
			return;
		}

		const { width, height } = this._world.getSize();
		const { x, y, scale, rotation } = state;

		const cx = width / 2;
		const cy = height / 2;

		this._gridContent.position({ x: cx, y: cy });
		this._gridContent.offset({ x, y });
		this._gridContent.scale({ x: scale, y: scale });
		this._gridContent.rotation((-rotation * 180) / Math.PI);
	}
}