/** LayerUI composition and lifecycle contract. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { LayerUI, LayerWorld, ModuleRulerUI, LayerType } from "../../../src/scene/layers";

const installWindowStub = (): void => {
    vi.stubGlobal("window", {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    });
};

describe("LayerUI", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("creates the canonical UI layer with its ruler module", () => {
        const world = new LayerWorld();
        const layer = new LayerUI(world);
        const ruler = layer.getManager().get(ModuleRulerUI.TYPE);

        expect(layer.type).toBe(LayerType.UI);
        expect(layer.id).toBe(3);
        expect(layer.isEnabled()).toBe(true);
        expect(ruler).toBeInstanceOf(ModuleRulerUI);
        expect(layer.getManager().getAll()).toEqual([ruler]);
    });

    it("clears module state without unregistering the module", () => {
        const layer = new LayerUI(new LayerWorld());
        const ruler = layer.getManager().get(ModuleRulerUI.TYPE);
        expect(ruler).not.toBeNull();
        const clear = vi.spyOn(ruler!, "clear");

        layer.clear();

        expect(clear).toHaveBeenCalledOnce();
        expect(layer.getManager().get(ModuleRulerUI.TYPE)).toBe(ruler);
    });

    it("destroys its modules and resets base-layer dimensions", () => {
        installWindowStub();
        const layer = new LayerUI(new LayerWorld());
        const ruler = layer.getManager().get(ModuleRulerUI.TYPE);
        expect(ruler).not.toBeNull();
        const destroy = vi.spyOn(ruler!, "destroy");
        layer.setSize(800, 600);

        layer.destroy();

        expect(destroy).toHaveBeenCalledOnce();
        expect(layer.getManager().getAll()).toEqual([]);
        expect(layer.getSize()).toEqual({ width: 0, height: 0 });
    });
});