import Konva from "konva";

import type { INode, Rect } from "../../../../nodes";
import { RendererCanvasRegistry } from "./RendererCanvasRegistry";
import type { ID } from "../../../../core";
import type { IRendererNodeCanvas } from "./types";

interface MountedCanvasNode {
	node: INode;
	readonly view: Konva.Group;
	readonly renderer: IRendererNodeCanvas;
}

interface NodeWithWorldViewAABB extends INode {
	getWorldViewAABB(): Rect;
}

export class RendererCanvasManager {
	private readonly _registry: RendererCanvasRegistry;
	private readonly _contentRoot: Konva.Group;
	private readonly _mounted = new Map<ID, MountedCanvasNode>();

	constructor(registry: RendererCanvasRegistry, contentRoot: Konva.Group) {
		this._registry = registry;
		this._contentRoot = contentRoot;
	}

	/**
	 * Synchronizes a node tree.
	 *
	 * Синхронизирует дерево нод.
	 */
	public renderNodes(nodes: readonly INode[], viewport: Rect): void {
		const visited = new Set<ID>();
		const hierarchyViewBounds = new Map<ID, Rect>();

		for (const node of nodes) {
			this._renderNode(
				node,
				this._contentRoot,
				visited,
				viewport,
				hierarchyViewBounds,
			);
		}

		this._cleanupUnmounted(visited);
	}

	/**
	 * Removes the mounted view associated with the specified node
	 * and all of its descendants.
	 *
	 * Удаляет примонтированное представление указанной ноды
	 * и всех её потомков.
	 */
	public removeNode(node: INode): void {
		this._unmountNodeRecursive(node);
	}

	/**
	 * Removes all mounted views.
	 *
	 * Удаляет все примонтированные представления.
	 */
	public clear(): void {
		const mounted = Array.from(this._mounted.entries());

		mounted.sort(
			([, a], [, b]) =>
				this._getViewDepth(b.view) - this._getViewDepth(a.view),
		);

		for (const [id] of mounted) {
			this._destroyMounted(id);
		}
	}

	/**
	 * Returns the mounted Konva view for the specified node, if it exists.
	 *
	 * Возвращает примонтированное Konva-представление для указанной ноды, если оно существует.
	 */
	public getMountedView(node: INode): Konva.Group | undefined {
		return this._mounted.get(node.id)?.view;
	}

	/****************************************************************/
	/*                            PRIVATE                           */
	/****************************************************************/

	private _renderNode(
		node: INode,
		parentContainer: Konva.Group,
		visited: Set<ID>,
		viewport: Rect,
		hierarchyViewBounds: Map<ID, Rect>,
	): void {
		if (!node.isVisibleInHierarchy()) {
			this._unmountNodeRecursive(node);
			return;
		}

		const bounds = this._getHierarchyWorldViewAABB(
			node,
			hierarchyViewBounds,
		);

		if (!this._intersectsAabb(bounds, viewport)) {
			this._unmountNodeRecursive(node);
			return;
		}

		visited.add(node.id);

		const renderer = this._registry.get(node.type);
		let currentContainer = parentContainer;

		if (renderer) {
			let mounted = this._mounted.get(node.id);

			if (!mounted) {
				mounted = {
					node,
					view: renderer.create(node),
					renderer,
				};

				this._mounted.set(node.id, mounted);
			}

			mounted.node = node;

			const { view } = mounted;

			if (view.getParent() !== parentContainer) {
				view.remove();
				parentContainer.add(view);
			}

			// Keep Konva stacking in sync with node traversal order every frame.
			// Traversal goes from bottom to top, so repeated moveToTop reproduces
			// the expected world draw order deterministically.
			view.moveToTop();

			mounted.renderer.update(node, view);
			currentContainer = view;
		}

		for (const child of node.getChildren()) {
			this._renderNode(
				child,
				currentContainer,
				visited,
				viewport,
				hierarchyViewBounds,
			);
		}
	}

	private _getHierarchyWorldViewAABB(
		node: INode,
		cache: Map<ID, Rect>,
	): Rect {
		const cached = cache.get(node.id);

		if (cached) {
			return cached;
		}

		const renderer = this._registry.get(node.type);
		const ownBounds = renderer?.getWorldBounds
			? renderer.getWorldBounds(node)
			: this._hasWorldViewAABB(node)
				? node.getWorldViewAABB()
				: node.getWorldAABB();

		let minX = ownBounds.x;
		let minY = ownBounds.y;
		let maxX = ownBounds.x + ownBounds.width;
		let maxY = ownBounds.y + ownBounds.height;

		for (const child of node.getChildren()) {
			if (!child.isVisibleInHierarchy()) {
				continue;
			}

			const childBounds = this._getHierarchyWorldViewAABB(child, cache);

			minX = Math.min(minX, childBounds.x);
			minY = Math.min(minY, childBounds.y);
			maxX = Math.max(maxX, childBounds.x + childBounds.width);
			maxY = Math.max(maxY, childBounds.y + childBounds.height);
		}

		const bounds = {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};

		cache.set(node.id, bounds);

		return bounds;
	}

	private _hasWorldViewAABB(node: INode): node is NodeWithWorldViewAABB {
		return (
			"getWorldViewAABB" in node &&
			typeof node.getWorldViewAABB === "function"
		);
	}

	private _cleanupUnmounted(visited: Set<ID>): void {
		const unmounted = Array.from(this._mounted.entries()).filter(
			([id]) => !visited.has(id),
		);

		unmounted.sort(
			([, a], [, b]) =>
				this._getViewDepth(b.view) - this._getViewDepth(a.view),
		);

		for (const [id] of unmounted) {
			this._destroyMounted(id);
		}
	}

	private _unmountNodeRecursive(node: INode): void {
		for (const child of node.getChildren()) {
			this._unmountNodeRecursive(child);
		}

		this._destroyMounted(node.id);
	}

	private _destroyMounted(id: ID): void {
		const mounted = this._mounted.get(id);

		if (!mounted) {
			return;
		}

		this._mounted.delete(id);

		try {
			mounted.renderer.destroy?.(mounted.node, mounted.view);
		} finally {
			mounted.view.destroy();
		}
	}

	private _getViewDepth(view: Konva.Node): number {
		let depth = 0;
		let parent = view.getParent();

		while (parent) {
			depth += 1;
			parent = parent.getParent();
		}

		return depth;
	}

	private _intersectsAabb(a: Rect, b: Rect): boolean {
		return !(
			a.x + a.width < b.x ||
			b.x + b.width < a.x ||
			a.y + a.height < b.y ||
			b.y + b.height < a.y
		);
	}
}