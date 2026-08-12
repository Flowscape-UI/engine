/** ManagerLayerUI registry and lifecycle contract. */
import { describe, expect, it, vi } from "vitest";
import { IModuleBaseLayerUI, ManagerLayerUI } from "../../../src/scene/layers";


const createModule = (type: string): IModuleBaseLayerUI => ({
  getType: vi.fn(() => type),
  isEnabled: vi.fn(() => true),
  setEnabled: vi.fn(),
  attach: vi.fn(),
  detach: vi.fn(),
  clear: vi.fn(),
  update: vi.fn(),
  destroy: vi.fn(),
});

describe("ManagerLayerUI", () => {
  it("registers and resolves modules in insertion order", () => {
    const manager = new ManagerLayerUI();
    const ruler = createModule("ruler");
    const minimap = createModule("minimap");

    manager.register(ruler);
    manager.register(minimap);

    expect(manager.has("ruler")).toBe(true);
    expect(manager.get("ruler")).toBe(ruler);
    expect(manager.get("missing")).toBeNull();
    expect(manager.getAll()).toEqual([ruler, minimap]);
  });

  it("rejects duplicate module types without replacing the original", () => {
    const manager = new ManagerLayerUI();
    const first = createModule("ruler");
    const duplicate = createModule("ruler");
    manager.register(first);

    expect(() => manager.register(duplicate)).toThrow(
      'UI module "ruler" is already registered.',
    );
    expect(manager.get("ruler")).toBe(first);
    expect(duplicate.destroy).not.toHaveBeenCalled();
  });

  it("returns a detached registry snapshot", () => {
    const manager = new ManagerLayerUI();
    const module = createModule("ruler");
    manager.register(module);

    const modules = manager.getAll();
    modules.length = 0;

    expect(manager.getAll()).toEqual([module]);
  });

  it("unregisters an existing module only after destroying it", () => {
    const manager = new ManagerLayerUI();
    const module = createModule("ruler");
    manager.register(module);

    expect(manager.unregister("missing")).toBe(false);
    expect(manager.unregister("ruler")).toBe(true);
    expect(module.destroy).toHaveBeenCalledOnce();
    expect(manager.has("ruler")).toBe(false);
  });

  it("clears module state without unregistering modules", () => {
    const manager = new ManagerLayerUI();
    const ruler = createModule("ruler");
    const minimap = createModule("minimap");
    manager.register(ruler);
    manager.register(minimap);

    manager.clear();

    expect(ruler.clear).toHaveBeenCalledOnce();
    expect(minimap.clear).toHaveBeenCalledOnce();
    expect(manager.getAll()).toEqual([ruler, minimap]);
  });

  it("destroys every module and empties the registry", () => {
    const manager = new ManagerLayerUI();
    const ruler = createModule("ruler");
    const minimap = createModule("minimap");
    manager.register(ruler);
    manager.register(minimap);

    manager.destroy();

    expect(ruler.destroy).toHaveBeenCalledOnce();
    expect(minimap.destroy).toHaveBeenCalledOnce();
    expect(manager.getAll()).toEqual([]);
  });
});
