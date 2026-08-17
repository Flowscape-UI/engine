/** ModuleBaseLayerUI state and default lifecycle contract. */
import { describe, expect, it, vi } from "vitest";
import { ModuleBaseLayerUI } from "../../../src/scene/layers";


class TestModule extends ModuleBaseLayerUI {}

describe("ModuleBaseLayerUI", () => {
  it("creates an enabled module with a stable type", () => {
    const module = new TestModule("test-module");

    expect(module.getType()).toBe("test-module");
    expect(module.isEnabled()).toBe(true);
  });

  it("updates enabled state idempotently", () => {
    const module = new TestModule("test-module");

    module.setEnabled(false);
    module.setEnabled(false);
    expect(module.isEnabled()).toBe(false);

    module.setEnabled(true);
    expect(module.isEnabled()).toBe(true);
  });

  it("provides safe no-op lifecycle hooks", () => {
    const module = new TestModule("test-module");
    const root = {} as HTMLElement;

    expect(() => {
      module.attach(root);
      module.update();
      module.clear();
      module.detach();
    }).not.toThrow();
  });

  it("detaches when destroyed", () => {
    const module = new TestModule("test-module");
    const detach = vi.spyOn(module, "detach");

    module.destroy();

    expect(detach).toHaveBeenCalledOnce();
  });
});
