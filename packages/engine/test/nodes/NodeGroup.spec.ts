/**
 * NodeGroup-specific contract.
 *
 * Generic hierarchy and shape behavior are covered by NodeBase and ShapeBase.
 * This suite verifies only child-derived bounds, group resizing and hit testing.
 */
import { describe, expect, it } from "vitest";

import type { ID } from "../../src/core/types";
import { NodeType, type Rect } from "../../src/nodes/base";
import { NodeGroup, type GroupResizeSnapshot } from "../../src/nodes/group";
import { NodeRect } from "../../src/nodes/rect";

const createChild = (
  id: ID,
  x: number,
  y: number,
  width: number,
  height: number,
): NodeRect => {
  const child = new NodeRect(id);
  child.setPivot(0, 0);
  child.setSize(width, height);
  child.setPosition(x, y);
  return child;
};

const createResizableGroup = (): {
  group: NodeGroup;
  first: NodeRect;
  second: NodeRect;
} => {
  const group = new NodeGroup("group");
  const first = createChild("first", 0, 0, 10, 10);
  const second = createChild("second", 20, 10, 10, 10);

  group.addChild(first);
  group.addChild(second);

  return { group, first, second };
};

const expectRectToBeCloseTo = (actual: Rect, expected: Rect): void => {
  expect(actual.x).toBeCloseTo(expected.x, 5);
  expect(actual.y).toBeCloseTo(expected.y, 5);
  expect(actual.width).toBeCloseTo(expected.width, 5);
  expect(actual.height).toBeCloseTo(expected.height, 5);
};

describe("NodeGroup", () => {
  it("creates an empty group with group identity", () => {
    const group = new NodeGroup(7, "Selection");

    expect(group.id).toBe(7);
    expect(group.type).toBe(NodeType.Group);
    expect(group.getName()).toBe("Selection");
    expect(group.createResizeSnapshot()).toBeNull();
    expect(group.hitTest({ x: 0, y: 0 })).toBe(false);
  });

  describe("child-derived bounds", () => {
    it("derives local bounds and size from its children", () => {
      const group = new NodeGroup("group");
      group.addChild(createChild("first", 10, 20, 20, 10));
      group.addChild(createChild("second", -5, 5, 30, 40));

      expect(group.getLocalOBB()).toEqual({
        x: -5,
        y: 5,
        width: 35,
        height: 40,
      });
      expect(group.getSize()).toEqual({ width: 35, height: 40 });
    });

    it("includes a child's local transform when deriving bounds", () => {
      const group = new NodeGroup("group");
      const child = createChild("child", 10, 20, 20, 10);
      child.setRotation(90);
      group.addChild(child);

      expectRectToBeCloseTo(group.getLocalOBB(), {
        x: 0,
        y: 20,
        width: 10,
        height: 20,
      });
    });
  });

  describe("resizing", () => {
    it("scales children from a stable resize-session snapshot", () => {
      const { group, first, second } = createResizableGroup();

      group.beginResizeSession();
      expect(group.hasActiveResizeSession()).toBe(true);

      group.setSize(60, 40);
      group.setSize(90, 60);

      expect(first.getPosition()).toEqual({ x: 0, y: 0 });
      expect(first.getScale()).toEqual({ x: 3, y: 3 });
      expect(second.getPosition()).toEqual({ x: 60, y: 30 });
      expect(second.getScale()).toEqual({ x: 3, y: 3 });
      expect(group.getSize()).toEqual({ width: 90, height: 60 });

      group.endResizeSession();
      expect(group.hasActiveResizeSession()).toBe(false);
    });

    it("applies an explicit snapshot to arbitrary target bounds", () => {
      const { group, first, second } = createResizableGroup();
      const snapshot = group.createResizeSnapshot();

      expect(snapshot).not.toBeNull();

      group.applyResizeFromSnapshot(snapshot as GroupResizeSnapshot, {
        x: 10,
        y: 20,
        width: 60,
        height: 40,
      });

      expect(first.getPosition()).toEqual({ x: 10, y: 20 });
      expect(second.getPosition()).toEqual({ x: 50, y: 40 });
      expect(first.getScale()).toEqual({ x: 2, y: 2 });
      expect(second.getScale()).toEqual({ x: 2, y: 2 });
      expect(group.getLocalOBB()).toEqual({
        x: 10,
        y: 20,
        width: 60,
        height: 40,
      });
    });

    it("preserves a collapsed target axis", () => {
      const { group, first, second } = createResizableGroup();

      group.setSize(0, 40);

      expect(group.getLocalOBB()).toEqual({
        x: 0,
        y: 0,
        width: 0,
        height: 40,
      });
      expect(first.getScale()).toEqual({ x: 0, y: 2 });
      expect(second.getScale()).toEqual({ x: 0, y: 2 });
      expect(second.getPosition()).toEqual({ x: 0, y: 20 });
    });

    it("does not start or apply group resizing while locked", () => {
      const { group, second } = createResizableGroup();
      group.setLocked(true);

      group.beginResizeSession();
      group.setSize(60, 40);

      expect(group.hasActiveResizeSession()).toBe(false);
      expect(group.getSize()).toEqual({ width: 30, height: 20 });
      expect(second.getPosition()).toEqual({ x: 20, y: 10 });
      expect(second.getScale()).toEqual({ x: 1, y: 1 });
    });

    it.todo(
      "resizes child dimensions without changing transform scale in size mode",
    );
  });

  it("hit-tests visible child geometry instead of the group box", () => {
    const group = new NodeGroup("group");
    const child = createChild("child", 10, 20, 20, 10);
    group.addChild(child);

    const childCenter = child.getWorldOBB().center;

    expect(group.hitTest(childCenter)).toBe(true);
    expect(group.hitTest({ x: 100, y: 100 })).toBe(false);

    child.setVisible(false);
    expect(group.hitTest(childCenter)).toBe(false);
  });
});
