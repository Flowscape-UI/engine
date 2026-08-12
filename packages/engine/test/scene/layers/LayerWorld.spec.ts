/**
 * LayerWorld-specific contract.
 *
 * Node geometry and Camera math have their own suites. This file verifies
 * world ownership, draw order, viewport projection and spatial queries.
 */
import { describe, expect, it } from "vitest";

import type { ID } from "../../../src/core";
import { NodeRect } from "../../../src/nodes/rect";
import { LayerType, LayerWorld } from "../../../src/scene/layers";

const createRect = (
    id: ID,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
): NodeRect => {
    const node = new NodeRect(id, name);
    node.setPivot(0, 0);
    node.setSize(width, height);
    node.setPosition(x, y);
    return node;
};

describe("LayerWorld", () => {
    it("creates the canonical world layer and synchronizes its camera viewport", () => {
        const world = new LayerWorld();

        expect(world.type).toBe(LayerType.World);
        expect(world.id).toBe(1);
        expect(world.getNodes()).toEqual([]);

        world.setSize(800, 600);
        expect(world.camera.getViewport()).toEqual({ width: 800, height: 600 });

        world.setWidth(1024);
        world.setHeight(768);
        expect(world.camera.getViewport()).toEqual({ width: 1024, height: 768 });
    });

    it("adds unique nodes and supports lookup by id and name", () => {
        const world = new LayerWorld();
        const first = createRect("first", "Card", 0, 0, 10, 10);
        const second = createRect("second", "Card", 20, 0, 10, 10);
        const duplicate = createRect("first", "Duplicate", 40, 0, 10, 10);

        expect(world.addNode(first)).toBe(true);
        expect(world.addNode(second)).toBe(true);
        expect(world.addNode(duplicate)).toBe(false);
        expect(world.hasNode("first")).toBe(true);
        expect(world.findNodeById("second")).toBe(second);
        expect(world.findNodeByName("Card")).toEqual([first, second]);
        expect(() => world.findNodeById("missing")).toThrow(
            'Node with id "missing" was not found.',
        );
    });

    it("replaces, deletes and clears the node collection", () => {
        const world = new LayerWorld();
        const first = createRect("first", "First", 0, 0, 10, 10);
        const second = createRect("second", "Second", 20, 0, 10, 10);

        world.addNode(first);
        world.setNodes([second]);
        expect(world.getNodes()).toEqual([second]);
        expect(world.deleteNode("first")).toBe(false);
        expect(world.deleteNode("second")).toBe(true);
        expect(world.getNodes()).toEqual([]);

        world.setNodes([first, second]);
        world.deleteNodes();
        expect(world.getNodes()).toEqual([]);
    });

    it("returns a detached node-list snapshot", () => {
        const world = new LayerWorld();
        const node = createRect("node", "Node", 0, 0, 10, 10);
        world.addNode(node);

        const nodes = world.getNodes();
        nodes.length = 0;

        expect(world.getNodes()).toEqual([node]);
    });

    it("moves node groups while preserving their relative stack order", () => {
        const world = new LayerWorld();
        const nodes = ["a", "b", "c", "d"].map((id, index) =>
            createRect(id, id, index * 20, 0, 10, 10),
        );
        world.setNodes(nodes);

        expect(world.moveNodesToTop(["b", "d"])).toBe(true);
        expect(world.getNodes()).toEqual([nodes[0], nodes[2], nodes[1], nodes[3]]);

        expect(world.moveNodesToBottom(["c", "d"])).toBe(true);
        expect(world.getNodes()).toEqual([nodes[2], nodes[3], nodes[0], nodes[1]]);

        expect(world.moveNodesTo(["d", "a"], 1)).toBe(false);
        expect(world.getNodes()).toEqual([nodes[2], nodes[3], nodes[0], nodes[1]]);

        expect(world.moveNodesTo(["d", "a"], 0)).toBe(true);
        expect(world.getNodes()).toEqual([nodes[3], nodes[0], nodes[2], nodes[1]]);
        expect(world.moveNodesTo(["unknown"], 1)).toBe(false);
        expect(world.moveNodesTo([], 1)).toBe(false);
    });

    it("returns viewport corners and AABB in world coordinates", () => {
        const world = new LayerWorld();
        world.setSize(200, 100);
        world.camera.update({ x: 10, y: 20, scale: 2 });

        expect(world.getViewportWorldCorners()).toEqual([
            { x: -40, y: -5 },
            { x: 60, y: -5 },
            { x: 60, y: 45 },
            { x: -40, y: 45 },
        ]);
        expect(world.getViewportWorldAABB()).toEqual({
            x: -40,
            y: -5,
            width: 100,
            height: 50,
        });
    });

    it("expands the viewport AABB around a rotated camera", () => {
        const world = new LayerWorld();
        world.setSize(200, 100);
        world.camera.setRotationRadians(Math.PI / 2);

        const aabb = world.getViewportWorldAABB();

        expect(aabb.x).toBeCloseTo(-50, 6);
        expect(aabb.y).toBeCloseTo(-100, 6);
        expect(aabb.width).toBeCloseTo(100, 6);
        expect(aabb.height).toBeCloseTo(200, 6);
    });

    it("hit-tests visible nodes from top to bottom", () => {
        const world = new LayerWorld();
        const bottom = createRect("bottom", "Bottom", 0, 0, 100, 100);
        const top = createRect("top", "Top", 0, 0, 100, 100);
        world.setNodes([bottom, top]);

        expect(world.findTopNodeAt({ x: 50, y: 50 })).toBe(top);
        expect(world.findAllNodesAt({ x: 50, y: 50 })).toEqual([top, bottom]);

        top.setVisible(false);
        expect(world.findTopNodeAt({ x: 50, y: 50 })).toBe(bottom);
        expect(world.findAllNodesAt({ x: 150, y: 150 })).toEqual([]);
    });

    it("distinguishes intersection from full containment in normalized world rects", () => {
        const world = new LayerWorld();
        const contained = createRect("contained", "Contained", 10, 10, 10, 10);
        const crossing = createRect("crossing", "Crossing", 30, 30, 20, 20);
        const outside = createRect("outside", "Outside", 100, 100, 10, 10);
        world.setNodes([contained, crossing, outside]);

        const reversedRect = { x: 40, y: 40, width: -40, height: -40 };

        expect(world.findNodesInRect(reversedRect)).toEqual([crossing, contained]);
        expect(world.findNodesFullyInRect(reversedRect)).toEqual([contained]);
        expect(world.findNodesInRect({ x: 0, y: 0, width: 0, height: 10 })).toEqual(
            [],
        );
    });

    it("converts screen queries through the camera", () => {
        const world = new LayerWorld();
        const node = createRect("node", "Node", 45, 45, 10, 10);
        world.setSize(200, 100);
        world.camera.update({ x: 50, y: 50, scale: 2 });
        world.addNode(node);

        expect(world.findAllNodesAtScreen({ x: 100, y: 50 })).toEqual([node]);
        expect(
            world.findNodesFullyInScreenRect({ x: 90, y: 40, width: 20, height: 20 }),
        ).toEqual([node]);
        expect(
            world.findNodesInScreenRect({ x: 89, y: 39, width: 5, height: 5 }),
        ).toEqual([node]);
    });

    it("clears nodes, camera state and dimensions when destroyed", () => {
        const world = new LayerWorld();
        world.setSize(800, 600);
        world.addNode(createRect("node", "Node", 0, 0, 10, 10));
        world.camera.update({ x: 10, y: 20, scale: 2, rotation: 1 });

        world.destroy();

        expect(world.getNodes()).toEqual([]);
        expect(world.getSize()).toEqual({ width: 0, height: 0 });
        expect(world.camera.getState()).toEqual({
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
        });
    });

    it.todo("deduplicates node ids when replacing the collection with setNodes");
});

