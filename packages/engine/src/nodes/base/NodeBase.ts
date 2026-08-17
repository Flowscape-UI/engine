import { MathF32 } from "../../core/math";
import { Transform } from "../../core/transform/Transform";
import type { Matrix, Vector2 } from "../../core/transform/types";
import type { ID } from "../../core/types";
import { multiplyMatrix } from "../utils";
import { matrixInvert } from "../utils/matrix-invert";
import {
	NodeType,
	type INode,
	type NodeJSON,
	type OrientedRect,
	type Rect,
	type Size,
} from "./types";

export class NodeBase implements INode {
	/**
	 * Maximum allowed length for the node name.
	 *
	 * Максимально допустимая длина имени ноды.
	 */
	public static readonly NAME_MAX_LENGTH = 256;

	/**
	 * Default name used if no name is provided or if sanitization results in an empty string.
	 *
	 * Имя по умолчанию, если имя не указано или очистка привела к пустой строке.
	 */
	public static readonly DEFAULT_NODE_NAME = "Node";

	public readonly type: NodeType;
	public readonly id: ID;

	private _opacity: number;

	private _isVisible: boolean;
	private _isLocked: boolean;

	private _isVisibleInHierarchy: boolean;
	private _isLockedInHierarchy: boolean;

	private _name: string;
	private _parent: INode | null;
	private _children: INode[];

	private _width: number;
	private _height: number;
	private _transform: Transform;

	private _isWorldMatrixDirty: boolean;
	private _isHierarchyLocalOBBDirty: boolean;
	private _isHierarchyWorldAABBDirty: boolean;

	private _cachedWorldMatrix: Matrix | null;
	private _cachedHierarchyLocalOBB: Rect | null;
	private _cachedHierarchyWorldAABB: Rect | null;

	constructor(id: ID, type: NodeType = NodeType.Base, name: string = "Node") {
		this.id = id;
		this.type = type;
		this._name = this._sanitizeNodeName(name);

		this._isVisible = true;
		this._isLocked = false;
		this._isVisibleInHierarchy = true;
		this._isLockedInHierarchy = false;

		this._isWorldMatrixDirty = true;
		this._cachedWorldMatrix = null;
		this._isHierarchyLocalOBBDirty = true;
		this._isHierarchyWorldAABBDirty = true;

		this._cachedHierarchyLocalOBB = null;
		this._cachedHierarchyWorldAABB = null;

		this._width = 0;
		this._height = 0;
		this._opacity = 1;

		this._children = [];
		this._parent = null;
		this._transform = new Transform();
	}

	public getOpacity(): number {
		return this._opacity;
	}

	public setOpacity(value: number): void {
		if (!Number.isFinite(value)) {
			return;
		}
		const newValue = Math.max(0, Math.min(1, value));
		if (newValue === this._opacity) {
			return;
		}
		this._opacity = newValue;
	}

	public setDirty(): void {
		// 1. Invalidate Edges (upward to parents)
		// We call this BEFORE checking for _isDirty, because even if the matrix
		// this node is already dirty, the borders of the parent could be valid (for example, after addChild)
		this.setHierarchyBoundsDirty();

		// 2. Invalidate Matrix (down to children)
		if (this._isWorldMatrixDirty) return;

		this._isWorldMatrixDirty = true;
		this._cachedWorldMatrix = null;

		for (const child of this._children) {
			(child as NodeBase).setDirty();
		}
	}

	public setHierarchyBoundsDirty(): void {
		const wasLocalDirty = this._isHierarchyLocalOBBDirty;
		const wasWorldDirty = this._isHierarchyWorldAABBDirty;

		if (wasLocalDirty && wasWorldDirty) {
			return;
		}

		this._isHierarchyLocalOBBDirty = true;
		this._isHierarchyWorldAABBDirty = true;
		this._cachedHierarchyLocalOBB = null;
		this._cachedHierarchyWorldAABB = null;

		if (this._parent) {
			(this._parent as NodeBase).setHierarchyBoundsDirty();
		}
	}

	public traverse(callback: (node: INode) => void | boolean): void {
		// Выполняем действие для текущей ноды
		const shouldContinue = callback(this);

		// if callback returns false, We stop going deep into this branch
		if (shouldContinue === false) {
			return;
		}

		// Recursion to children
		for (const child of this._children) {
			(child as NodeBase).traverse(callback);
		}
	}

	/********************************************************************/
	/*                        Basic Functionality                       */
	/********************************************************************/
	public getName(): string {
		return this._name;
	}

	public setName(value: string): void {
		const newName = this._sanitizeNodeName(value);

		if (newName === this._name) {
			return;
		}
		this._name = newName;
	}

	public getWidth(): number {
		return this._width;
	}

	public setWidth(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		if (value === this._width) {
			return;
		}
		this._width = Math.max(0, value);
		this.setDirty();
	}

	public getHeight(): number {
		return this._height;
	}

	public setHeight(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		if (value === this._height) {
			return;
		}
		this._height = Math.max(0, value);
		this.setDirty();
	}

	public getSize(): Size {
		return {
			width: this.getWidth(),
			height: this.getHeight(),
		};
	}

	public setSize(width: number, height: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}

		const nextWidth = MathF32.max(0, width);
		const nextHeight = MathF32.max(0, height);

		if (nextWidth === this._width && nextHeight === this._height) {
			return;
		}

		this._width = nextWidth;
		this._height = nextHeight;
		this.setDirty();
	}

	public getScaledWidth(): number {
		return MathF32.mul(this.getWidth(), this.getScaleX());
	}

	public getScaledHeight(): number {
		return MathF32.mul(this.getHeight(), this.getScaleY());
	}

	public getScaledSize(): Size {
		return {
			width: this.getScaledWidth(),
			height: this.getScaledHeight(),
		};
	}

	public isVisible(): boolean {
		return this._isVisible;
	}

	public isVisibleInHierarchy(): boolean {
		return this._isVisibleInHierarchy;
	}

	public setVisible(value: boolean): void {
		if (this._isVisible === value) {
			return;
		}
		this._isVisible = value;
		this._updateHierarchyVisibility();
		this.setHierarchyBoundsDirty();
	}

	public isLocked(): boolean {
		return this._isLocked;
	}

	public isLockedInHierarchy(): boolean {
		return this._isLockedInHierarchy;
	}

	public setLocked(value: boolean): void {
		if (this._isLocked === value) {
			return;
		}
		this._isLocked = value;
		this._updateHierarchyLock();
	}

	/********************************************************************/
	/*                        Parent Controller                         */
	/********************************************************************/
	public getParent(): INode | null {
		return this._parent;
	}

	public setParent(parent: INode): void {
		if (this._parent === parent) {
			return;
		}

		parent.addChild(this);
	}

	public removeParent(): void {
		if (!this._parent) {
			return;
		}

		this._parent.removeChild(this);
	}

	/********************************************************************/
	/*                       Children Controller                        */
	/********************************************************************/
	public getChildren(): readonly INode[] {
		return [...this._children];
	}

	public addChild(child: INode): void {
		if (child.id === this.id) {
			throw new Error("Node cannot be added to itself");
		}
		if (NodeBase.isAncestor(this, child)) {
			throw new Error(
				"Cyclic dependency: cannot add an ancestor as a child",
			);
		}
		if (child.getParent() === this) {
			return;
		}

		const oldParent = child.getParent();
		if (oldParent) {
			oldParent.removeChild(child);
		}

		this._children.push(child);
		const c = child as NodeBase;
		c._setParentInternal(this);

		// We should recalculate bounds after adding child
		this.setHierarchyBoundsDirty();
	}

	public removeChild(child: INode): void {
		const index = this._children.indexOf(child);
		if (index === -1) return;

		this._children.splice(index, 1);

		// If the child still thinks that we are his parent, turn him off.
		const c = child as NodeBase;
		if (c.getParent() === this) {
			c._setParentInternal(null);
		}

		// Recalculate bounds after removing child
		this.setHierarchyBoundsDirty();
	}

	/********************************************************************/
	/*                       Transform Delegation                       */
	/********************************************************************/
	public getX(): number {
		return this._transform.getX();
	}

	public getY(): number {
		return this._transform.getY();
	}

	public getPosition(): Vector2 {
		return this._transform.getPosition();
	}

	public setX(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const newValue = MathF32.toF32(value);
		if (this._transform.getX() === newValue) {
			return;
		}
		this._transform.setX(newValue);
		this.setDirty();
	}

	public setY(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const newValue = MathF32.toF32(value);
		if (this._transform.getY() === newValue) {
			return;
		}
		this._transform.setY(newValue);
		this.setDirty();
	}

	public setPosition(x: number, y: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const oldPosition = this._transform.getPosition();
		const xF32 = MathF32.toF32(x);
		const yF32 = MathF32.toF32(y);
		if (oldPosition.x === xF32 && oldPosition.y === yF32) {
			return;
		}
		this._transform.setPosition(xF32, yF32);
		this.setDirty();
	}

	public translateX(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		if (value === 0) {
			return;
		}
		this._transform.translateX(value);
		this.setDirty();
	}

	public translateY(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		if (value === 0) {
			return;
		}
		this._transform.translateY(value);
		this.setDirty();
	}

	public translate(dx: number, dy: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		if (dx === 0 && dy === 0) {
			return;
		}
		this._transform.translate(dx, dy);
		this.setDirty();
	}

	public getScaleX(): number {
		return this._transform.getScaleX();
	}

	public getScaleY(): number {
		return this._transform.getScaleY();
	}

	public getScale(): Vector2 {
		return this._transform.getScale();
	}

	public setScaleX(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const newValue = MathF32.toF32(value);
		if (this._transform.getScaleX() === newValue) {
			return;
		}
		this._transform.setScaleX(newValue);
		this.setDirty();
	}

	public setScaleY(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const newValue = MathF32.toF32(value);
		if (this._transform.getScaleY() === newValue) {
			return;
		}
		this._transform.setScaleY(newValue);
		this.setDirty();
	}

	public setScale(sx: number, sy: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const sxF32 = MathF32.toF32(sx);
		const syF32 = MathF32.toF32(sy);
		const oldScale = this._transform.getScale();
		if (oldScale.x === sxF32 && oldScale.y === syF32) {
			return;
		}
		this._transform.setScale(sxF32, syF32);
		this.setDirty();
	}

	public getRotation(): number {
		return MathF32.radToDeg(this._transform.getRotation());
	}

	public getWorldRotation(): number {
		let rotation = this.getRotation();
		let current = this._parent;
		while (current) {
			rotation += current.getRotation();
			current = current.getParent();
		}
		return MathF32.toF32(rotation);
	}

	public setRotation(value: number): void {
		if (this.isLockedInHierarchy()) {
			return;
		}
		const newValue = MathF32.degToRad(value);
		if (this._transform.getRotation() === newValue) {
			return;
		}
		this._transform.setRotation(newValue);
		this.setDirty();
	}

	public rotate(delta: number): void {
		if (this.isLockedInHierarchy()) {
			return;
		}
		const deltaRadians = MathF32.degToRad(delta);
		if (deltaRadians === 0) {
			return;
		}
		this._transform.rotate(deltaRadians);
		this.setDirty();
	}

	public getPivotX(): number {
		return this._transform.getPivotX();
	}

	public getPivotY(): number {
		return this._transform.getPivotY();
	}

	public getPivot(): Vector2 {
		return this._transform.getPivot();
	}

	public setPivotX(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const newValue = MathF32.toF32(value);
		if (this.getPivotX() === newValue) {
			return;
		}
		this._transform.setPivotX(newValue);
		this.setDirty();
	}

	public setPivotY(value: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const newValue = MathF32.toF32(value);
		if (this.getPivotY() === newValue) {
			return;
		}
		this._transform.setPivotY(newValue);
		this.setDirty();
	}

	public setPivot(px: number, py: number): void {
		if (this.isLockedInHierarchy() === true) {
			return;
		}
		const oldPivot = this._transform.getPivot();
		const newPx = MathF32.toF32(px);
		const newPy = MathF32.toF32(py);
		if (oldPivot.x === newPx && oldPivot.y === newPy) {
			return;
		}
		this._transform.setPivot(newPx, newPy);
		this.setDirty();
	}

	public getLocalMatrix(): Matrix {
		const local = this.getLocalOBB();
		return this._transform.getLocalMatrix(
			local.width,
			local.height,
			local.x,
			local.y,
		);
	}

	public getWorldMatrix(): Matrix {
		if (!this._isWorldMatrixDirty && this._cachedWorldMatrix) {
			return this._cachedWorldMatrix;
		}

		const localMatrix = this.getLocalMatrix();

		if (!this._parent) {
			this._cachedWorldMatrix = localMatrix;
		} else {
			const parentMatrix = this._parent.getWorldMatrix();
			this._cachedWorldMatrix = multiplyMatrix(parentMatrix, localMatrix);
		}

		this._isWorldMatrixDirty = false;
		return this._cachedWorldMatrix;
	}

	/********************************************************************/
	/*                              Bounds                              */
	/********************************************************************/
	public getWorldCorners(): [Vector2, Vector2, Vector2, Vector2] {
		const worldMatrix = this.getWorldMatrix();
		const local = this.getLocalOBB();

		const x = local.x;
		const y = local.y;
		const w = local.width;
		const h = local.height;

		return [
			this._applyMatrixToPoint(worldMatrix, { x, y }),
			this._applyMatrixToPoint(worldMatrix, { x: MathF32.add(x, w), y }),
			this._applyMatrixToPoint(worldMatrix, {
				x: MathF32.add(x, w),
				y: MathF32.add(y, h),
			}),
			this._applyMatrixToPoint(worldMatrix, { x, y: MathF32.add(y, h) }),
		];
	}

	public getLocalOBB(): Rect {
		return {
			x: 0,
			y: 0,
			width: this._width,
			height: this._height,
		};
	}

	public getWorldOBB(): OrientedRect {
		const corners = this.getWorldCorners();

		const center = {
			x: MathF32.toF32((corners[0].x + corners[2].x) / 2),
			y: MathF32.toF32((corners[0].y + corners[2].y) / 2),
		};

		const width = Math.hypot(
			corners[1].x - corners[0].x,
			corners[1].y - corners[0].y,
		);

		const height = Math.hypot(
			corners[2].x - corners[1].x,
			corners[2].y - corners[1].y,
		);

		return {
			center,
			width: MathF32.toF32(width),
			height: MathF32.toF32(height),
			rotation: this.getWorldRotation(),
		};
	}

	public getWorldAABB(): Rect {
		return this._getAABBFromPoints(this.getWorldCorners());
	}

	public getHierarchyLocalOBB(): Rect {
		if (!this._isHierarchyLocalOBBDirty && this._cachedHierarchyLocalOBB) {
			return this._cachedHierarchyLocalOBB;
		}

		const selfBounds = this.getLocalOBB();

		let minX = selfBounds.x;
		let minY = selfBounds.y;
		let maxX = selfBounds.x + selfBounds.width;
		let maxY = selfBounds.y + selfBounds.height;

		for (const child of this._children) {
			const c = child as NodeBase;

			if (!c.isVisibleInHierarchy()) {
				continue;
			}

			const childBounds = c.getHierarchyLocalOBB();
			const childMatrix = c.getLocalMatrix();

			const corners: [Vector2, Vector2, Vector2, Vector2] = [
				{ x: childBounds.x, y: childBounds.y },
				{ x: childBounds.x + childBounds.width, y: childBounds.y },
				{
					x: childBounds.x + childBounds.width,
					y: childBounds.y + childBounds.height,
				},
				{ x: childBounds.x, y: childBounds.y + childBounds.height },
			];

			for (const corner of corners) {
				const p = this._applyMatrixToPoint(childMatrix, corner);

				if (p.x < minX) minX = p.x;
				if (p.y < minY) minY = p.y;
				if (p.x > maxX) maxX = p.x;
				if (p.y > maxY) maxY = p.y;
			}
		}

		this._cachedHierarchyLocalOBB = {
			x: MathF32.toF32(minX),
			y: MathF32.toF32(minY),
			width: MathF32.sub(maxX, minX),
			height: MathF32.sub(maxY, minY),
		};

		this._isHierarchyLocalOBBDirty = false;
		return this._cachedHierarchyLocalOBB;
	}

	public getHierarchyWorldOBB(): OrientedRect {
		const localBounds = this.getHierarchyLocalOBB();
		const worldMatrix = this.getWorldMatrix();

		const corners: [Vector2, Vector2, Vector2, Vector2] = [
			this._applyMatrixToPoint(worldMatrix, {
				x: localBounds.x,
				y: localBounds.y,
			}),
			this._applyMatrixToPoint(worldMatrix, {
				x: localBounds.x + localBounds.width,
				y: localBounds.y,
			}),
			this._applyMatrixToPoint(worldMatrix, {
				x: localBounds.x + localBounds.width,
				y: localBounds.y + localBounds.height,
			}),
			this._applyMatrixToPoint(worldMatrix, {
				x: localBounds.x,
				y: localBounds.y + localBounds.height,
			}),
		];

		const center = {
			x: MathF32.toF32((corners[0].x + corners[2].x) / 2),
			y: MathF32.toF32((corners[0].y + corners[2].y) / 2),
		};

		const width = Math.hypot(
			corners[1].x - corners[0].x,
			corners[1].y - corners[0].y,
		);

		const height = Math.hypot(
			corners[2].x - corners[1].x,
			corners[2].y - corners[1].y,
		);

		return {
			center,
			width: MathF32.toF32(width),
			height: MathF32.toF32(height),
			rotation: this.getWorldRotation(),
		};
	}

	public getHierarchyWorldAABB(): Rect {
		if (
			!this._isHierarchyWorldAABBDirty &&
			this._cachedHierarchyWorldAABB
		) {
			return this._cachedHierarchyWorldAABB;
		}

		const localBounds = this.getHierarchyLocalOBB();
		const worldMatrix = this.getWorldMatrix();

		const corners: [Vector2, Vector2, Vector2, Vector2] = [
			{ x: localBounds.x, y: localBounds.y },
			{ x: localBounds.x + localBounds.width, y: localBounds.y },
			{
				x: localBounds.x + localBounds.width,
				y: localBounds.y + localBounds.height,
			},
			{ x: localBounds.x, y: localBounds.y + localBounds.height },
		];

		const worldPoints = corners.map((corner) =>
			this._applyMatrixToPoint(worldMatrix, corner),
		);

		this._cachedHierarchyWorldAABB = this._getAABBFromPoints(worldPoints);
		this._isHierarchyWorldAABBDirty = false;

		return this._cachedHierarchyWorldAABB;
	}

	public hitTest(worldPoint: Vector2): boolean {
		// 1. Quick Check (AABB)
		// If the point is outside the general boundaries (including children), then it definitely did not get into the node itself.
		const bounds = this.getWorldAABB();
		if (
			worldPoint.x < bounds.x ||
			worldPoint.x > bounds.x + bounds.width ||
			worldPoint.y < bounds.y ||
			worldPoint.y > bounds.y + bounds.height
		) {
			return false;
		}

		// 2. Accurate verification (Local coordinates)
		// We get the world matrix of the node
		const worldMatrix = this.getWorldMatrix();

		try {
			// 1) Invert it
			const invMatrix = matrixInvert(worldMatrix);

			// 2) Translating the world point into the node's local space
			const localPoint = this._applyMatrixToPoint(invMatrix, worldPoint);
			const localBounds = this.getLocalOBB();

			// 3) Check against local OBB bounds.
			return (
				localPoint.x >= localBounds.x &&
				localPoint.x <= localBounds.x + localBounds.width &&
				localPoint.y >= localBounds.y &&
				localPoint.y <= localBounds.y + localBounds.height
			);
		} catch (e) {
			// If the matrix is not invertible (for example, scale = 0), you cannot enter the node// Если матрица не инвертируема (например, scale = 0), попасть в ноду нельзя
			return false;
		}
	}

	/**
	 * Checks whether `potentialAncestor` is an ancestor of `node`.
	 * A node is NOT considered an ancestor of itself.
	 *
	 * @param potentialAncestor - The node to check as ancestor
	 * @param node - The node to start traversal from
	 * @returns true if potentialAncestor exists in the parent chain of node
	 */
	public static isAncestor(source: INode | null, target: INode): boolean {
		const visited = new Set<ID>();
		let current = source;

		while (current) {
			if (current === target) {
				return true;
			}
			if (visited.has(current.id)) {
				return false;
			}

			visited.add(current.id);
			current = current.getParent();
		}

		return false;
	}

	/**
	 * Checks whether the given `target` node exists in the ancestor chain of `source` node.
	 * A node is NOT considered an ancestor of itself.
	 *
	 * @param source - The node whose ancestor chain will be traversed
	 * @param target - The node to search for in the ancestor chain
	 * @returns `true` if `target` is an ancestor of `source`
	 */
	public static hasAncestor(source: INode, target: INode): boolean {
		const visited = new Set<INode>();
		let current: INode | null = source.getParent();

		while (current) {
			if (current === target) return true;
			if (visited.has(current)) return false;
			visited.add(current);
			current = current.getParent();
		}

		return false;
	}

	/********************************************************************/
	/*                              Parsing                             */
	/********************************************************************/
	public toJSON(): NodeJSON {
		return {
			...this._serializeBase(),
			...this._serializeExtra(),
		};
	}

	/**
	 * Creates a node instance from a serialized JSON representation.
	 *
	 * This method reconstructs a node using the data produced by `toJSON()`.
	 * Implementations are responsible for restoring transform, geometry,
	 * and state properties.
	 *
	 * Создает экземпляр узла из сериализованного JSON-представления.
	 *
	 * Метод восстанавливает узел из данных, полученных с помощью `toJSON()`.
	 * Реализация должна восстановить трансформацию, геометрию
	 * и состояние узла.
	 */
	public static fromJSON<T extends NodeBase>(
		this: new (id: ID, name?: string) => T,
		data: Omit<NodeJSON, "parentId" | "children">,
	): T {
		const node = new this(data.id, data.name);

		node.setPosition(data.x, data.y);
		node.setSize(data.width, data.height);
		node.setRotation(data.rotation);
		node.setScale(data.scaleX, data.scaleY);

		node.setVisible(data.visible);
		node.setLocked(data.locked);

		return node;
	}

	/********************************************************************/
	/*                              Helpers                             */
	/********************************************************************/
	protected _serializeBase(): NodeJSON {
		const position = this.getPosition();
		const scale = this.getScale();

		return {
			id: this.id,
			type: this.type,
			name: this._name,

			x: position.x,
			y: position.y,

			width: this.getWidth(),
			height: this.getHeight(),

			rotation: this.getRotation(),

			scaleX: scale.x,
			scaleY: scale.y,

			visible: this._isVisible,
			locked: this._isLocked,

			parentId: this._parent ? this._parent.id : null,
			children: this._children.map((c) => c.id),
		};
	}

	protected _serializeExtra(): Record<string, unknown> {
		return {};
	}

	private _sanitizeNodeName(value: string): string {
		let name = String(value);

		name = name.normalize("NFKC");
		name = name.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
		name = name.replace(
			/[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g,
			"",
		);
		name = name.replace(/\s+/g, " ").trim();

		if (name.length > NodeBase.NAME_MAX_LENGTH) {
			name = name.slice(0, NodeBase.NAME_MAX_LENGTH).trimEnd();
		}
		if (name.length === 0) {
			name = NodeBase.DEFAULT_NODE_NAME;
		}

		return name;
	}

	/**
	 * Helper to transform a point by a 3x3 matrix.
	 */
	protected _applyMatrixToPoint(m: Matrix, p: Vector2): Vector2 {
		/**
		 * The standard affine transformation formula:
		 * Стандартная формула аффинного преобразования:
		 * x' = a*x + c*y + tx
		 * y' = b*x + d*y + ty
		 */
		return {
			x: MathF32.toF32(m.a * p.x + m.c * p.y + m.tx),
			y: MathF32.toF32(m.b * p.x + m.d * p.y + m.ty),
		};
	}

	/**
	 * An internal method for quietly changing the parent.
	 * It is used only inside addChild and removeChild.
	 */
	private _setParentInternal(parent: INode | null): void {
		this._parent = parent;

		// Updating states that depend on the hierarchy
		this._updateHierarchyVisibility();
		this._updateHierarchyLock();

		// Matrices and boundaries are now invalid
		this.setDirty();
	}

	protected _updateHierarchyVisibility(): void {
		const parentVisible = this._parent
			? (this._parent as NodeBase)._isVisibleInHierarchy
			: true;

		// A node is visible in the hierarchy only if it is itself visible and the parent is visible in the hierarchy.
		this._isVisibleInHierarchy = this._isVisible && parentVisible;

		// Notifying the children
		for (const child of this._children) {
			(child as NodeBase)._updateHierarchyVisibility();
		}
	}

	protected _updateHierarchyLock(): void {
		const parentLocked = this._parent
			? (this._parent as NodeBase)._isLockedInHierarchy
			: false;

		// The node is blocked if it is locked itself OR the parent is blocked
		this._isLockedInHierarchy = this._isLocked || parentLocked;

		for (const child of this._children) {
			(child as NodeBase)._updateHierarchyLock();
		}
	}

	protected _getAABBFromPoints(points: readonly Vector2[]): Rect {
		if (points.length === 0) {
			return {
				x: 0,
				y: 0,
				width: 0,
				height: 0,
			};
		}

		let minX = Infinity;
		let minY = Infinity;
		let maxX = -Infinity;
		let maxY = -Infinity;

		for (const p of points) {
			if (p.x < minX) minX = p.x;
			if (p.y < minY) minY = p.y;
			if (p.x > maxX) maxX = p.x;
			if (p.y > maxY) maxY = p.y;
		}

		return {
			x: MathF32.toF32(minX),
			y: MathF32.toF32(minY),
			width: MathF32.sub(maxX, minX),
			height: MathF32.sub(maxY, minY),
		};
	}
}
