/**
 * LayerOverlay-specific contract.
 *
 * Individual handle behavior belongs to handle suites. This file verifies
 * registration, hover, selection and overlay-owned cleanup.
 */
import { describe, expect, it, vi } from "vitest";
import { ID } from "../../../src/core";
import { NodeRect } from "../../../src/nodes";
import { LayerOverlay, LayerType, LayerWorld } from "../../../src/scene/layers";


const createNode = (id: ID): NodeRect => new NodeRect(id);

describe("LayerOverlay", () => {
    it("creates the canonical overlay and registers all default handle groups", () => {
        const world = new LayerWorld();
        const overlay = new LayerOverlay(world);

        expect(overlay.type).toBe(LayerType.Overlay);
        expect(overlay.id).toBe(2);
        expect(overlay.layerWorld).toBe(world);
        expect(overlay.freeHandleManager.getAll()).toEqual([]);
        expect(overlay.shapeHandleManager.getById("hover")).not.toBeNull();
        expect(overlay.shapeHandleManager.getById("focus")).not.toBeNull();
        expect(
            overlay.transformHandleManager.getById("transform-pivot"),
        ).not.toBeNull();
        expect(overlay.handleManager.getAll()).toHaveLength(16);
    });

    it("tracks and clears the hovered node through the hover handle", () => {
        const overlay = new LayerOverlay(new LayerWorld());
        const node = createNode("hovered");
        const hoverHandle = overlay.handleManager.getById("hover");

        overlay.setHoveredNode(node);

        expect(overlay.getHoveredNode()).toBe(node);
        expect(overlay.getHoveredNodeId()).toBe("hovered");
        expect(hoverHandle?.isEnabled()).toBe(true);

        overlay.clearHoveredNode();

        expect(overlay.getHoveredNode()).toBeNull();
        expect(overlay.getHoveredNodeId()).toBeNull();
        expect(hoverHandle?.isEnabled()).toBe(false);
    });

    it("deduplicates replacement selections by node id", () => {
        const overlay = new LayerOverlay(new LayerWorld());
        const first = createNode("first");
        const second = createNode("second");
        const duplicateFirst = createNode("first");

        overlay.setSelectedNodes([first, second, duplicateFirst]);

        expect(overlay.getSelectedNodes()).toEqual([first, second]);
        expect(overlay.getSelectedNodeIds()).toEqual(["first", "second"]);
        expect(overlay.isNodeSelected("first")).toBe(true);
        expect(overlay.isNodeSelected("missing")).toBe(false);
    });

    it("adds and removes selected nodes with explicit success results", () => {
        const overlay = new LayerOverlay(new LayerWorld());
        const first = createNode("first");
        const duplicateFirst = createNode("first");

        expect(overlay.addSelectedNode(first)).toBe(true);
        expect(overlay.addSelectedNode(duplicateFirst)).toBe(false);
        expect(overlay.removeSelectedNode("missing")).toBe(false);
        expect(overlay.removeSelectedNode("first")).toBe(true);
        expect(overlay.getSelectedNodes()).toEqual([]);
    });

    it("returns a detached selection snapshot", () => {
        const overlay = new LayerOverlay(new LayerWorld());
        const node = createNode("node");
        overlay.addSelectedNode(node);

        const selected = overlay.getSelectedNodes();
        selected.length = 0;

        expect(overlay.getSelectedNodes()).toEqual([node]);
    });

    it("clears selection and every registered handle", () => {
        const overlay = new LayerOverlay(new LayerWorld());
        const node = createNode("node");
        const clearSpies = overlay.handleManager
            .getAll()
            .map((handle) => vi.spyOn(handle, "clear"));
        overlay.setSelectedNodes([node]);
        overlay.setHoveredNode(node);

        overlay.clear();

        expect(overlay.getSelectedNodes()).toEqual([]);
        expect(overlay.getHoveredNode()).toBeNull();
        for (const clear of clearSpies) {
            expect(clear).toHaveBeenCalledOnce();
        }
    });

    it("destroys every handle and resets base-layer state", () => {
        const overlay = new LayerOverlay(new LayerWorld());
        const destroySpies = overlay.handleManager
            .getAll()
            .map((handle) => vi.spyOn(handle, "destroy"));
        overlay.setSize(800, 600);
        overlay.addSelectedNode(createNode("selected"));

        overlay.destroy();

        expect(overlay.getSelectedNodes()).toEqual([]);
        expect(overlay.getSize()).toEqual({ width: 0, height: 0 });
        for (const destroy of destroySpies) {
            expect(destroy).toHaveBeenCalledOnce();
        }
    });

    it.todo("replaces the hovered node when a new instance has the same id");
});

