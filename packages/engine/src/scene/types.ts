import type { IInputControllerBase } from "../input";
import type { ID } from "../core/types";
import type { IRendererLayerBase } from "../renderer/canvas/scene/layers/types";
import type { IRendererHost } from "../renderer/hosts";
import type { InputManager } from "./InputManager";
import type { ILayerBase } from "./layers";
import type { ManagerRenderHost } from "./ManagerRenderHost";
import type { IRenderable, IUpdatable } from "../core";

export type LayerBinding = {
	layer: ILayerBase;
	renderer: IRendererLayerBase<unknown>;
};

export type InputBinding = {
	layer: ILayerBase;
	controller: IInputControllerBase<unknown>;
};

export interface IScene extends IUpdatable, IRenderable {
	readonly hostManager: ManagerRenderHost;
	readonly inputManager: InputManager;

	addHost(host: IRendererHost): void;
	removeHost(id: number): boolean;

	addLayer(layer: ILayerBase): boolean;
	bindLayerRenderer<TLayer extends ILayerBase>(
		layer: TLayer,
		renderer: IRendererLayerBase<TLayer>,
	): void;
	unbindLayerRenderer(id: ID): boolean;
	getLayerRendererBindings(): readonly LayerBinding[];

	removeLayer(id: ID): boolean;
	hasLayer(id: ID): boolean;
	getLayerById<TLayer extends ILayerBase = ILayerBase>(id: ID): TLayer | null;
	getLayers(): readonly ILayerBase[];

	// setRenderHost(value: IRendererRoot): void;

	setSize(width: number, height: number): void;

	getWidth(): number;
	getHeight(): number;

	invalidate(): void;
}