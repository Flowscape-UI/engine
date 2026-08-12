import {
	describe,
	expect,
	it,
	vi,
} from "vitest";

import type { ID } from "../../src/core/types";
import { NodeBase } from "../../src/nodes/base/NodeBase";
import { NodeType, type NodeJSON, type Rect } from "../../src/nodes/base/types";

const createNode = (
	id: ID = "node",
	name: string = NodeBase.DEFAULT_NODE_NAME,
	type: NodeType = NodeType.Base,
): NodeBase => new NodeBase(id, type, name);

const createSizedNode = (
	id: ID = "node",
	width: number = 100,
	height: number = 50,
): NodeBase => {
	const node = createNode(id);
	node.setSize(width, height);
	return node;
};

const expectRectToBeCloseTo = (
	actual: Rect,
	expected: Rect,
	precision: number = 5,
): void => {
	expect(actual.x).toBeCloseTo(expected.x, precision);
	expect(actual.y).toBeCloseTo(expected.y, precision);
	expect(actual.width).toBeCloseTo(expected.width, precision);
	expect(actual.height).toBeCloseTo(expected.height, precision);
};

const createDeserializationData = (
	json: NodeJSON,
): Omit<NodeJSON, "parentId" | "children"> => ({
	id: json.id,
	type: json.type,
	name: json.name,
	x: json.x,
	y: json.y,
	width: json.width,
	height: json.height,
	rotation: json.rotation,
	scaleX: json.scaleX,
	scaleY: json.scaleY,
	visible: json.visible,
	locked: json.locked,
});

class SerializableNode extends NodeBase {
	constructor(id: ID, name: string = NodeBase.DEFAULT_NODE_NAME) {
		super(id, NodeType.Base, name);
	}
}

type NodeMutation = {
	name: string;
	apply: (node: NodeBase) => void;
};

const lockedGeometryMutations: readonly NodeMutation[] = [
	{ name: "setWidth", apply: (node) => node.setWidth(200) },
	{ name: "setHeight", apply: (node) => node.setHeight(200) },
	{ name: "setSize", apply: (node) => node.setSize(200, 200) },
	{ name: "setX", apply: (node) => node.setX(200) },
	{ name: "setY", apply: (node) => node.setY(200) },
	{ name: "setPosition", apply: (node) => node.setPosition(200, 200) },
	{ name: "translateX", apply: (node) => node.translateX(10) },
	{ name: "translateY", apply: (node) => node.translateY(10) },
	{ name: "translate", apply: (node) => node.translate(10, 10) },
	{ name: "setScaleX", apply: (node) => node.setScaleX(4) },
	{ name: "setScaleY", apply: (node) => node.setScaleY(4) },
	{ name: "setScale", apply: (node) => node.setScale(4, 4) },
	{ name: "setRotation", apply: (node) => node.setRotation(90) },
	{ name: "rotate", apply: (node) => node.rotate(15) },
	{ name: "setPivotX", apply: (node) => node.setPivotX(0.75) },
	{ name: "setPivotY", apply: (node) => node.setPivotY(0.25) },
	{ name: "setPivot", apply: (node) => node.setPivot(0.75, 0.25) },
];

const noOpGeometryMutations: readonly NodeMutation[] = [
	{ name: "setWidth", apply: (node) => node.setWidth(0) },
	{ name: "setHeight", apply: (node) => node.setHeight(0) },
	{ name: "setSize", apply: (node) => node.setSize(0, 0) },
	{ name: "setX", apply: (node) => node.setX(0) },
	{ name: "setY", apply: (node) => node.setY(0) },
	{ name: "setPosition", apply: (node) => node.setPosition(0, 0) },
	{ name: "translateX", apply: (node) => node.translateX(0) },
	{ name: "translateY", apply: (node) => node.translateY(0) },
	{ name: "translate", apply: (node) => node.translate(0, 0) },
	{ name: "setScaleX", apply: (node) => node.setScaleX(1) },
	{ name: "setScaleY", apply: (node) => node.setScaleY(1) },
	{ name: "setScale", apply: (node) => node.setScale(1, 1) },
	{ name: "setRotation", apply: (node) => node.setRotation(0) },
	{ name: "rotate", apply: (node) => node.rotate(0) },
	{ name: "setPivotX", apply: (node) => node.setPivotX(0.5) },
	{ name: "setPivotY", apply: (node) => node.setPivotY(0.5) },
	{ name: "setPivot", apply: (node) => node.setPivot(0.5, 0.5) },
];

const getGeometrySnapshot = (node: NodeBase) => ({
	size: node.getSize(),
	position: node.getPosition(),
	scale: node.getScale(),
	rotation: node.getRotation(),
	pivot: node.getPivot(),
});

describe("NodeBase", () => {
	describe("construction and identity", () => {
		it("creates a node with stable identity and default state", () => {
			const node = createNode("node-1");

			expect(node.id).toBe("node-1");
			expect(node.type).toBe(NodeType.Base);
			expect(node.getName()).toBe(NodeBase.DEFAULT_NODE_NAME);
			expect(node.getOpacity()).toBe(1);
			expect(node.getSize()).toEqual({ width: 0, height: 0 });
			expect(node.getPosition()).toEqual({ x: 0, y: 0 });
			expect(node.getScale()).toEqual({ x: 1, y: 1 });
			expect(node.getRotation()).toBe(0);
			expect(node.getPivot()).toEqual({ x: 0.5, y: 0.5 });
			expect(node.isVisible()).toBe(true);
			expect(node.isVisibleInHierarchy()).toBe(true);
			expect(node.isLocked()).toBe(false);
			expect(node.isLockedInHierarchy()).toBe(false);
			expect(node.getParent()).toBeNull();
			expect(node.getChildren()).toEqual([]);
		});

		it("accepts numeric IDs, an explicit type, and a custom name", () => {
			const node = createNode(42, "Rectangle", NodeType.Rect);

			expect(node.id).toBe(42);
			expect(node.type).toBe(NodeType.Rect);
			expect(node.getName()).toBe("Rectangle");
		});
	});

	describe("name", () => {
		it("normalizes Unicode, whitespace, control, and invisible characters", () => {
			const node = createNode("node", "  Cafe\u0301\t\n  Layer\u200B\u202E  ");

			expect(node.getName()).toBe("Café Layer");
		});

		it("falls back to the default name when sanitization produces an empty value", () => {
			const node = createNode("node", "\t\n\u200B\uFEFF");
			expect(node.getName()).toBe(NodeBase.DEFAULT_NODE_NAME);

			node.setName("   ");
			expect(node.getName()).toBe(NodeBase.DEFAULT_NODE_NAME);
		});

		it("limits names to NAME_MAX_LENGTH", () => {
			const node = createNode("node", "x".repeat(300));
			expect(node.getName()).toHaveLength(NodeBase.NAME_MAX_LENGTH);

			node.setName("y".repeat(300));
			expect(node.getName()).toBe("y".repeat(NodeBase.NAME_MAX_LENGTH));
		});
	});

	describe("opacity", () => {
		it("sets opacity within the supported range", () => {
			const node = createNode();

			node.setOpacity(0.35);
			expect(node.getOpacity()).toBe(0.35);
		});

		it("clamps opacity to the 0..1 range", () => {
			const node = createNode();

			node.setOpacity(-10);
			expect(node.getOpacity()).toBe(0);

			node.setOpacity(10);
			expect(node.getOpacity()).toBe(1);
		});

		it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
			"ignores a non-finite opacity value: %s",
			(value) => {
				const node = createNode();
				node.setOpacity(0.4);
				node.setOpacity(value);
				expect(node.getOpacity()).toBe(0.4);
			},
		);
	});

	describe("size", () => {
		it("sets width and height independently", () => {
			const node = createNode();

			node.setWidth(120);
			node.setHeight(80);
			expect(node.getWidth()).toBe(120);
			expect(node.getHeight()).toBe(80);
			expect(node.getSize()).toEqual({ width: 120, height: 80 });
		});

		it("sets both dimensions atomically", () => {
			const node = createNode();
			node.setSize(120, 80);
			expect(node.getSize()).toEqual({ width: 120, height: 80 });
		});

		it("clamps negative dimensions to zero", () => {
			const node = createNode();

			node.setWidth(-10);
			node.setHeight(-20);
			expect(node.getSize()).toEqual({ width: 0, height: 0 });

			node.setSize(-30, 40);
			expect(node.getSize()).toEqual({ width: 0, height: 40 });
		});

		it("returns dimensions with local scale applied", () => {
			const node = createSizedNode("node", 120, 80);
			node.setScale(2, 0.5);

			expect(node.getScaledWidth()).toBe(240);
			expect(node.getScaledHeight()).toBe(40);
			expect(node.getScaledSize()).toEqual({ width: 240, height: 40 });
		});
	});

	describe("position and translation", () => {
		it("sets each position axis independently", () => {
			const node = createNode();

			node.setX(10);
			node.setY(20);

			expect(node.getX()).toBe(10);
			expect(node.getY()).toBe(20);
			expect(node.getPosition()).toEqual({ x: 10, y: 20 });
		});

		it("sets both position axes together", () => {
			const node = createNode();

			node.setPosition(15, -25);

			expect(node.getPosition()).toEqual({ x: 15, y: -25 });
		});

		it("translates relative to the current position", () => {
			const node = createNode();
			node.setPosition(10, 20);

			node.translateX(5);
			node.translateY(-10);
			node.translate(2, 3);

			expect(node.getPosition()).toEqual({ x: 17, y: 13 });
		});

		it("returns a defensive copy of the position", () => {
			const node = createNode();
			node.setPosition(10, 20);
			const position = node.getPosition();

			position.x = 999;
			position.y = 999;

			expect(node.getPosition()).toEqual({ x: 10, y: 20 });
		});
	});

	describe("scale", () => {
		it("sets each scale axis independently", () => {
			const node = createNode();

			node.setScaleX(2);
			node.setScaleY(3);

			expect(node.getScaleX()).toBe(2);
			expect(node.getScaleY()).toBe(3);
			expect(node.getScale()).toEqual({ x: 2, y: 3 });
		});

		it("sets both scale axes together and supports mirroring", () => {
			const node = createNode();
			node.setScale(-2, 0.5);
			expect(node.getScale()).toEqual({ x: -2, y: 0.5 });
		});

		it("returns a defensive copy of the scale", () => {
			const node = createNode();
			node.setScale(2, 3);
			const scale = node.getScale();

			scale.x = 999;
			scale.y = 999;

			expect(node.getScale()).toEqual({ x: 2, y: 3 });
		});
	});

	describe("rotation", () => {
		it("sets an absolute angle with setRotation()", () => {
			const node = createNode();

			node.setRotation(10);
			node.setRotation(25);

			expect(node.getRotation()).toBeCloseTo(25, 5);
		});

		it("normalizes absolute angles", () => {
			const node = createNode();
			node.setRotation(450);
			expect(node.getRotation()).toBeCloseTo(90, 5);
		});

		it("rotates relative to the current angle when the angle equals the delta", () => {
			const node = createNode();

			node.setRotation(10);
			node.rotate(10);

			expect(node.getRotation()).toBeCloseTo(20, 5);
		});

		it("accumulates consecutive rotations", () => {
			const node = createNode();

			node.rotate(15);
			node.rotate(20);
			node.rotate(5);

			expect(node.getRotation()).toBeCloseTo(40, 5);
		});

		it("supports negative rotation deltas", () => {
			const node = createNode();

			node.setRotation(30);
			node.rotate(-45);

			expect(node.getRotation()).toBeCloseTo(-15, 5);
		});

		it("normalizes accumulated rotations", () => {
			const node = createNode();

			node.setRotation(170);
			node.rotate(30);

			expect(node.getRotation()).toBeCloseTo(-160, 5);
		});

		it("returns the sum of local and ancestor rotations in world space", () => {
			const root = createNode("root");
			const parent = createNode("parent");
			const child = createNode("child");
			root.addChild(parent);
			parent.addChild(child);
			root.setRotation(10);
			parent.setRotation(20);
			child.setRotation(-5);

			expect(child.getWorldRotation()).toBeCloseTo(25, 5);
		});
	});

	describe("pivot", () => {
		it("sets each pivot axis independently", () => {
			const node = createNode();

			node.setPivotX(0.25);
			node.setPivotY(0.75);

			expect(node.getPivotX()).toBe(0.25);
			expect(node.getPivotY()).toBe(0.75);
			expect(node.getPivot()).toEqual({ x: 0.25, y: 0.75 });
		});

		it("sets both pivot axes together", () => {
			const node = createNode();

			node.setPivot(0, 1);

			expect(node.getPivot()).toEqual({ x: 0, y: 1 });
		});

		it("returns a defensive copy of the pivot", () => {
			const node = createNode();
			node.setPivot(0.25, 0.75);
			const pivot = node.getPivot();

			pivot.x = 999;
			pivot.y = 999;

			expect(node.getPivot()).toEqual({ x: 0.25, y: 0.75 });
		});
	});

	describe("geometry mutation guards", () => {
		it.each(noOpGeometryMutations)(
			"does not invalidate for a no-op $name mutation",
			({ apply }) => {
				const node = createNode();
				const setDirty = vi.spyOn(node, "setDirty");

				apply(node);

				expect(setDirty).not.toHaveBeenCalled();
			},
		);

		it.each(lockedGeometryMutations)(
			"blocks $name when the node is locally locked",
			({ apply }) => {
				const node = createSizedNode();
				node.setPosition(10, 20);
				node.setScale(2, 3);
				node.setRotation(30);
				node.setPivot(0.25, 0.75);
				node.setLocked(true);
				const before = getGeometrySnapshot(node);

				apply(node);

				expect(getGeometrySnapshot(node)).toEqual(before);
			},
		);

		it("blocks all geometry mutations when an ancestor is locked", () => {
			const parent = createNode("parent");
			const child = createSizedNode("child");
			parent.addChild(child);
			parent.setLocked(true);
			const before = getGeometrySnapshot(child);

			for (const mutation of lockedGeometryMutations) {
				mutation.apply(child);
			}

			expect(child.isLocked()).toBe(false);
			expect(child.isLockedInHierarchy()).toBe(true);
			expect(getGeometrySnapshot(child)).toEqual(before);
		});
	});

	describe("parent and children", () => {
		it("adds a child and updates both sides of the relationship", () => {
			const parent = createNode("parent");
			const child = createNode("child");

			parent.addChild(child);

			expect(parent.getChildren()).toEqual([child]);
			expect(child.getParent()).toBe(parent);
		});

		it("sets a parent through the child API", () => {
			const parent = createNode("parent");
			const child = createNode("child");

			child.setParent(parent);

			expect(parent.getChildren()).toEqual([child]);
			expect(child.getParent()).toBe(parent);
		});

		it("removes a parent through the child API", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.addChild(child);

			child.removeParent();

			expect(parent.getChildren()).toEqual([]);
			expect(child.getParent()).toBeNull();
		});

		it("removes a child through the parent API", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.addChild(child);

			parent.removeChild(child);

			expect(parent.getChildren()).toEqual([]);
			expect(child.getParent()).toBeNull();
		});

		it("reparents a child without leaving it in the previous parent", () => {
			const firstParent = createNode("first-parent");
			const secondParent = createNode("second-parent");
			const child = createNode("child");
			firstParent.addChild(child);

			secondParent.addChild(child);

			expect(firstParent.getChildren()).toEqual([]);
			expect(secondParent.getChildren()).toEqual([child]);
			expect(child.getParent()).toBe(secondParent);
		});

		it("does not add the same child twice", () => {
			const parent = createNode("parent");
			const child = createNode("child");

			parent.addChild(child);
			parent.addChild(child);

			expect(parent.getChildren()).toEqual([child]);
		});

		it("returns a defensive copy of the children array", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.addChild(child);
			const children = parent.getChildren();

			(children as NodeBase[]).length = 0;

			expect(parent.getChildren()).toEqual([child]);
		});

		it("rejects adding a node to itself", () => {
			const node = createNode();

			expect(() => node.addChild(node)).toThrow(
				"Node cannot be added to itself",
			);
		});

		it("rejects cycles in the hierarchy", () => {
			const root = createNode("root");
			const child = createNode("child");
			const grandchild = createNode("grandchild");
			root.addChild(child);
			child.addChild(grandchild);

			expect(() => grandchild.addChild(root)).toThrow("Cyclic dependency");
			expect(root.getParent()).toBeNull();
			expect(grandchild.getChildren()).toEqual([]);
		});
	});

	describe("traversal", () => {
		it("traverses the hierarchy depth-first in child insertion order", () => {
			const root = createNode("root");
			const first = createNode("first");
			const second = createNode("second");
			const grandchild = createNode("grandchild");
			root.addChild(first);
			root.addChild(second);
			first.addChild(grandchild);
			const visited: ID[] = [];

			root.traverse((node) => {
				visited.push(node.id);
			});

			expect(visited).toEqual(["root", "first", "grandchild", "second"]);
		});

		it("prunes only the branch whose callback returns false", () => {
			const root = createNode("root");
			const first = createNode("first");
			const second = createNode("second");
			const grandchild = createNode("grandchild");
			root.addChild(first);
			root.addChild(second);
			first.addChild(grandchild);
			const visited: ID[] = [];

			root.traverse((node) => {
				visited.push(node.id);
				return node === first ? false : undefined;
			});

			expect(visited).toEqual(["root", "first", "second"]);
		});
	});

	describe("hierarchy visibility", () => {
		it("propagates ancestor visibility through all descendants", () => {
			const root = createNode("root");
			const child = createNode("child");
			const grandchild = createNode("grandchild");
			root.addChild(child);
			child.addChild(grandchild);

			root.setVisible(false);

			expect(root.isVisible()).toBe(false);
			expect(child.isVisible()).toBe(true);
			expect(child.isVisibleInHierarchy()).toBe(false);
			expect(grandchild.isVisibleInHierarchy()).toBe(false);
		});

		it("preserves local visibility when an ancestor becomes visible again", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.addChild(child);
			child.setVisible(false);
			parent.setVisible(false);

			parent.setVisible(true);

			expect(parent.isVisibleInHierarchy()).toBe(true);
			expect(child.isVisible()).toBe(false);
			expect(child.isVisibleInHierarchy()).toBe(false);
		});

		it("recomputes inherited visibility after detach and reparent", () => {
			const hiddenParent = createNode("hidden-parent");
			const visibleParent = createNode("visible-parent");
			const child = createNode("child");
			hiddenParent.setVisible(false);
			hiddenParent.addChild(child);
			expect(child.isVisibleInHierarchy()).toBe(false);

			visibleParent.addChild(child);
			expect(child.isVisibleInHierarchy()).toBe(true);

			child.removeParent();
			expect(child.isVisibleInHierarchy()).toBe(true);
		});
	});

	describe("hierarchy locking", () => {
		it("propagates ancestor locking through all descendants", () => {
			const root = createNode("root");
			const child = createNode("child");
			const grandchild = createNode("grandchild");
			root.addChild(child);
			child.addChild(grandchild);

			root.setLocked(true);

			expect(root.isLocked()).toBe(true);
			expect(child.isLocked()).toBe(false);
			expect(child.isLockedInHierarchy()).toBe(true);
			expect(grandchild.isLockedInHierarchy()).toBe(true);
		});

		it("preserves a local lock when an ancestor is unlocked", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.addChild(child);
			child.setLocked(true);
			parent.setLocked(true);

			parent.setLocked(false);

			expect(parent.isLockedInHierarchy()).toBe(false);
			expect(child.isLocked()).toBe(true);
			expect(child.isLockedInHierarchy()).toBe(true);
		});

		it("recomputes inherited locking after detach and reparent", () => {
			const lockedParent = createNode("locked-parent");
			const unlockedParent = createNode("unlocked-parent");
			const child = createNode("child");
			lockedParent.setLocked(true);
			lockedParent.addChild(child);
			expect(child.isLockedInHierarchy()).toBe(true);

			unlockedParent.addChild(child);
			expect(child.isLockedInHierarchy()).toBe(false);

			child.removeParent();
			expect(child.isLockedInHierarchy()).toBe(false);
		});
	});

	describe("ancestor helpers", () => {
		it("detects a target in the source node parent chain", () => {
			const root = createNode("root");
			const child = createNode("child");
			const grandchild = createNode("grandchild");
			root.addChild(child);
			child.addChild(grandchild);

			expect(NodeBase.isAncestor(grandchild, root)).toBe(true);
			expect(NodeBase.isAncestor(root, grandchild)).toBe(false);
			expect(NodeBase.isAncestor(null, root)).toBe(false);
		});

		it("checks ancestors without considering a node its own ancestor", () => {
			const root = createNode("root");
			const child = createNode("child");
			root.addChild(child);

			expect(NodeBase.hasAncestor(child, root)).toBe(true);
			expect(NodeBase.hasAncestor(root, child)).toBe(false);
			expect(NodeBase.hasAncestor(root, root)).toBe(false);
		});

		it.todo(
			"aligns isAncestor() self-comparison with its documented non-self semantics",
		);
	});

	describe("matrices", () => {
		it("composes the local matrix from position, scale, rotation, and pivot", () => {
			const node = createSizedNode("node", 100, 50);
			node.setPivot(0, 0);
			node.setPosition(10, 20);
			node.setScale(2, 3);
			node.setRotation(90);

			const matrix = node.getLocalMatrix();

			expect(matrix.a).toBeCloseTo(0, 5);
			expect(matrix.b).toBeCloseTo(2, 5);
			expect(matrix.c).toBeCloseTo(-3, 5);
			expect(matrix.d).toBeCloseTo(0, 5);
			expect(matrix.tx).toBeCloseTo(10, 5);
			expect(matrix.ty).toBeCloseTo(20, 5);
		});

		it("composes the world matrix through the parent hierarchy", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.setPivot(0, 0);
			child.setPivot(0, 0);
			parent.setPosition(10, 20);
			parent.setScale(2, 3);
			child.setPosition(5, 7);
			parent.addChild(child);

			const matrix = child.getWorldMatrix();

			expect(matrix.a).toBeCloseTo(2, 5);
			expect(matrix.b).toBeCloseTo(0, 5);
			expect(matrix.c).toBeCloseTo(0, 5);
			expect(matrix.d).toBeCloseTo(3, 5);
			expect(matrix.tx).toBeCloseTo(20, 5);
			expect(matrix.ty).toBeCloseTo(41, 5);
		});

		it("caches the world matrix until the node changes", () => {
			const node = createSizedNode();
			const first = node.getWorldMatrix();

			expect(node.getWorldMatrix()).toBe(first);

			node.translateX(10);
			const second = node.getWorldMatrix();

			expect(second).not.toBe(first);
			expect(second.tx).not.toBe(first.tx);
		});

		it("invalidates descendant world matrices when an ancestor changes", () => {
			const parent = createNode("parent");
			const child = createNode("child");
			parent.setPivot(0, 0);
			child.setPivot(0, 0);
			parent.addChild(child);
			child.setPosition(5, 0);
			const first = child.getWorldMatrix();

			parent.translateX(10);
			const second = child.getWorldMatrix();

			expect(second).not.toBe(first);
			expect(second.tx).toBeCloseTo(15, 5);
		});
	});

	describe("bounds", () => {
		it("returns local bounds from the node size", () => {
			const node = createSizedNode("node", 120, 80);

			expect(node.getLocalOBB()).toEqual({
				x: 0,
				y: 0,
				width: 120,
				height: 80,
			});
		});

		it("returns transformed world corners", () => {
			const node = createSizedNode("node", 100, 50);
			node.setPivot(0, 0);
			node.setPosition(10, 20);
			node.setRotation(90);

			const corners = node.getWorldCorners();

			expect(corners[0].x).toBeCloseTo(10, 5);
			expect(corners[0].y).toBeCloseTo(20, 5);
			expect(corners[1].x).toBeCloseTo(10, 5);
			expect(corners[1].y).toBeCloseTo(120, 5);
			expect(corners[2].x).toBeCloseTo(-40, 5);
			expect(corners[2].y).toBeCloseTo(120, 5);
			expect(corners[3].x).toBeCloseTo(-40, 5);
			expect(corners[3].y).toBeCloseTo(20, 5);
		});

		it("returns an oriented world bounding box", () => {
			const node = createSizedNode("node", 100, 50);
			node.setPivot(0, 0);
			node.setPosition(10, 20);
			node.setScale(2, 3);
			node.setRotation(90);

			const bounds = node.getWorldOBB();

			expect(bounds.center.x).toBeCloseTo(-65, 5);
			expect(bounds.center.y).toBeCloseTo(120, 5);
			expect(bounds.width).toBeCloseTo(200, 5);
			expect(bounds.height).toBeCloseTo(150, 5);
			expect(bounds.rotation).toBeCloseTo(90, 5);
		});

		it("returns an axis-aligned world bounding box", () => {
			const node = createSizedNode("node", 100, 50);
			node.setPivot(0, 0);
			node.setPosition(10, 20);
			node.setRotation(90);

			expectRectToBeCloseTo(node.getWorldAABB(), {
				x: -40,
				y: 20,
				width: 50,
				height: 100,
			});
		});

		it("includes visible descendants in hierarchy-local bounds", () => {
			const root = createSizedNode("root", 100, 100);
			const child = createSizedNode("child", 20, 30);
			child.setPivot(0, 0);
			child.setPosition(120, -10);
			root.addChild(child);

			expectRectToBeCloseTo(root.getHierarchyLocalOBB(), {
				x: 0,
				y: -10,
				width: 140,
				height: 110,
			});
		});

		it("excludes invisible descendants from hierarchy-local bounds", () => {
			const root = createSizedNode("root", 100, 100);
			const child = createSizedNode("child", 20, 30);
			child.setPivot(0, 0);
			child.setPosition(120, -10);
			root.addChild(child);
			child.setVisible(false);

			expectRectToBeCloseTo(root.getHierarchyLocalOBB(), {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			});
		});

		it("returns hierarchy bounds in world space", () => {
			const root = createSizedNode("root", 100, 100);
			const child = createSizedNode("child", 20, 30);
			root.setPivot(0, 0);
			root.setPosition(10, 20);
			child.setPivot(0, 0);
			child.setPosition(120, -10);
			root.addChild(child);

			const obb = root.getHierarchyWorldOBB();
			expect(obb.center.x).toBeCloseTo(80, 5);
			expect(obb.center.y).toBeCloseTo(65, 5);
			expect(obb.width).toBeCloseTo(140, 5);
			expect(obb.height).toBeCloseTo(110, 5);
			expect(obb.rotation).toBeCloseTo(0, 5);

			expectRectToBeCloseTo(root.getHierarchyWorldAABB(), {
				x: 10,
				y: 10,
				width: 140,
				height: 110,
			});
		});
	});

	describe("cache invalidation", () => {
		it("caches hierarchy bounds while the hierarchy is unchanged", () => {
			const root = createSizedNode("root", 100, 100);

			const firstLocal = root.getHierarchyLocalOBB();
			const firstWorld = root.getHierarchyWorldAABB();

			expect(root.getHierarchyLocalOBB()).toBe(firstLocal);
			expect(root.getHierarchyWorldAABB()).toBe(firstWorld);
		});

		it("invalidates ancestor hierarchy bounds when a descendant changes", () => {
			const root = createSizedNode("root", 100, 100);
			const child = createSizedNode("child", 20, 20);
			child.setPivot(0, 0);
			child.setPosition(120, 0);
			root.addChild(child);
			const first = root.getHierarchyLocalOBB();

			child.translateX(20);
			const second = root.getHierarchyLocalOBB();

			expect(second).not.toBe(first);
			expectRectToBeCloseTo(second, {
				x: 0,
				y: 0,
				width: 160,
				height: 100,
			});
		});

		it("invalidates hierarchy bounds when child visibility changes", () => {
			const root = createSizedNode("root", 100, 100);
			const child = createSizedNode("child", 20, 20);
			child.setPivot(0, 0);
			child.setPosition(120, 0);
			root.addChild(child);
			const first = root.getHierarchyLocalOBB();

			child.setVisible(false);
			const second = root.getHierarchyLocalOBB();

			expect(second).not.toBe(first);
			expectRectToBeCloseTo(second, {
				x: 0,
				y: 0,
				width: 100,
				height: 100,
			});
		});

		it("invalidates hierarchy bounds without invalidating the world matrix", () => {
			const node = createSizedNode();
			const matrix = node.getWorldMatrix();
			const bounds = node.getHierarchyWorldAABB();

			node.setHierarchyBoundsDirty();

			expect(node.getWorldMatrix()).toBe(matrix);
			expect(node.getHierarchyWorldAABB()).not.toBe(bounds);
		});
	});

	describe("hit testing", () => {
		it("accepts points inside and on the boundary of a transformed node", () => {
			const node = createSizedNode("node", 100, 50);
			node.setPivot(0, 0);
			node.setPosition(10, 20);
			node.setRotation(90);

			expect(node.hitTest({ x: -15, y: 45 })).toBe(true);
			expect(node.hitTest({ x: 10, y: 20 })).toBe(true);
		});

		it("rejects points outside a transformed node", () => {
			const node = createSizedNode("node", 100, 50);
			node.setPivot(0, 0);
			node.setPosition(10, 20);
			node.setRotation(90);

			expect(node.hitTest({ x: -15, y: 130 })).toBe(false);
			expect(node.hitTest({ x: 20, y: 20 })).toBe(false);
		});

		it("returns false when the world matrix is not invertible", () => {
			const node = createSizedNode();
			node.setScale(0, 1);

			expect(node.hitTest({ x: 0, y: 0 })).toBe(false);
		});
	});

	describe("serialization", () => {
		it("serializes base state and hierarchy references", () => {
			const parent = createNode("parent");
			const node = createSizedNode("node", 120, 80);
			const child = createNode(7);
			node.setName("Main node");
			node.setPosition(10, 20);
			node.setScale(2, 3);
			node.setRotation(30);
			node.setVisible(false);
			node.setLocked(true);
			parent.addChild(node);
			node.addChild(child);

			expect(node.toJSON()).toEqual({
				id: "node",
				type: NodeType.Base,
				name: "Main node",
				x: 10,
				y: 20,
				width: 120,
				height: 80,
				rotation: expect.closeTo(30, 5),
				scaleX: 2,
				scaleY: 3,
				visible: false,
				locked: true,
				parentId: "parent",
				children: [7],
			});
		});

		it("deserializes the state represented by NodeJSON", () => {
			const source = new SerializableNode("node", "Serialized node");
			source.setPosition(10, 20);
			source.setSize(120, 80);
			source.setRotation(30);
			source.setScale(2, 3);
			source.setVisible(false);
			source.setLocked(true);

			const restored = SerializableNode.fromJSON(
				createDeserializationData(source.toJSON()),
			);

			expect(restored).toBeInstanceOf(SerializableNode);
			expect(restored.id).toBe("node");
			expect(restored.type).toBe(NodeType.Base);
			expect(restored.getName()).toBe("Serialized node");
			expect(restored.getPosition()).toEqual({ x: 10, y: 20 });
			expect(restored.getSize()).toEqual({ width: 120, height: 80 });
			expect(restored.getRotation()).toBeCloseTo(30, 5);
			expect(restored.getScale()).toEqual({ x: 2, y: 3 });
			expect(restored.isVisible()).toBe(false);
			expect(restored.isLocked()).toBe(true);
			expect(restored.getParent()).toBeNull();
			expect(restored.getChildren()).toEqual([]);
		});

		it.todo("round-trips a concrete NodeBase instance directly");
		it.todo("serializes and restores opacity and pivot");
	});
});
