/**
 * LayerBase contract.
 *
 * Enableable owns enabled-state events and MathF32 owns primitive numeric
 * sanitization. This suite verifies layer identity, size state and cleanup.
 */
import { describe, expect, it } from "vitest";
import { LayerBase, LayerType } from "../../../src/scene/layers";
import { FLOAT32_MAX } from "../../../src/core";


describe("LayerBase", () => {
    it("creates an enabled zero-sized layer with stable identity", () => {
        const layer = new LayerBase(LayerType.World, "world-main");

        expect(layer.type).toBe(LayerType.World);
        expect(layer.id).toBe("world-main");
        expect(layer.isEnabled()).toBe(true);
        expect(layer.getSize()).toEqual({ width: 0, height: 0 });
    });

    it("sets dimensions independently and together", () => {
        const layer = new LayerBase(LayerType.Overlay, 12);

        layer.setWidth(640);
        layer.setHeight(360);
        expect(layer.getWidth()).toBe(640);
        expect(layer.getHeight()).toBe(360);

        layer.setSize(1280, 720);
        expect(layer.getSize()).toEqual({ width: 1280, height: 720 });
    });

    it("stores sanitized finite dimensions", () => {
        const layer = new LayerBase(LayerType.UI, "ui");

        layer.setSize(Number.NaN, Number.POSITIVE_INFINITY);

        expect(layer.getSize()).toEqual({ width: 0, height: FLOAT32_MAX });
    });

    it("returns a detached size snapshot", () => {
        const layer = new LayerBase(LayerType.Background, 0);
        layer.setSize(100, 50);

        const size = layer.getSize();
        size.width = 999;

        expect(layer.getSize()).toEqual({ width: 100, height: 50 });
    });

    it("resets dimensions when destroyed", () => {
        const layer = new LayerBase(LayerType.World, 1);
        layer.setSize(800, 600);
        layer.disable();

        layer.destroy();

        expect(layer.getSize()).toEqual({ width: 0, height: 0 });
        expect(layer.isEnabled()).toBe(false);
    });

    it.todo("clamps negative layer dimensions to zero");
});

