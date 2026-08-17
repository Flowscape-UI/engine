/**
 * Scene orchestration contract.
 *
 * Layer, renderer, host and input-manager internals are tested only where
 * Scene owns their coordination, ordering and lifecycle.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ID } from "../../src/core/types";
import { InputControllerBase } from "../../src/input/controllers/base/InputControllerBase";
import type { InputEventInfo } from "../../src/input/types";
import { Input } from "../../src/input/Input";
import type { IRendererLayerBase } from "../../src/renderer/canvas/scene/layers/types";
import type { IRendererHost } from "../../src/renderer/hosts/types";
import { Scene } from "../../src/scene/Scene";
import { LayerBase } from "../../src/scene/layers/base/LayerBase";
import { LayerType } from "../../src/scene/layers/base/types";
import type { IScene } from "../../src/scene/types";

class TestInputController extends InputControllerBase<LayerBase> {
  public readonly id: ID;

  constructor(id: ID) {
    super();
    this.id = id;
  }
}

const createLayer = (id: ID): LayerBase => new LayerBase(LayerType.World, id);

const createRenderer = (id: ID) => {
  return {
    id,
    type: null,
    attach: vi.fn<(layer: LayerBase) => void>(),
    detach: vi.fn<() => void>(),
    destroy: vi.fn<() => void>(),
    update: vi.fn<() => void>(),
    render: vi.fn<() => void>(),
    getRenderNode: vi.fn(() => null),
  } satisfies IRendererLayerBase<LayerBase>;
};

const createHost = (id: number) => {
  const surface = {} as HTMLElement;
  const host = {
    id,
    type: null,
    getSurface: vi.fn(() => surface),
    attach: vi.fn<(scene: IScene) => void>(),
    detach: vi.fn<() => void>(),
    destroy: vi.fn<() => void>(),
    update: vi.fn<() => void>(),
    render: vi.fn<() => void>(),
  } satisfies IRendererHost;

  return { host, surface };
};

describe("Scene", () => {
  let scheduledFrames: FrameRequestCallback[];
  let inputCallback: ((event: InputEventInfo) => void) | null;

  const runNextFrame = (): void => {
    const callback = scheduledFrames.shift();
    expect(callback).toBeDefined();
    callback?.(0);
  };

  beforeEach(() => {
    scheduledFrames = [];
    inputCallback = null;

    vi.spyOn(Input, "_initialize").mockImplementation(() => undefined);
    vi.spyOn(Input, "onInput").mockImplementation((callback) => {
      inputCallback = callback;
    });
    vi.spyOn(Input, "_registerSurface").mockImplementation(() => undefined);
    vi.spyOn(Input, "_unregisterSurface").mockImplementation(() => undefined);
    vi.spyOn(Input, "_endFrame").mockImplementation(() => undefined);

    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        scheduledFrames.push(callback);
        return scheduledFrames.length;
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("construction and frame scheduling", () => {
    it("initializes dimensions, managers and the shared input hook", () => {
      const scene = new Scene(1280, 720);

      expect(scene.getWidth()).toBe(1280);
      expect(scene.getHeight()).toBe(720);
      expect(scene.getLayers()).toEqual([]);
      expect(scene.getLayerRendererBindings()).toEqual([]);
      expect(scene.hostManager.getAll()).toEqual([]);
      expect(scene.inputManager.getAll()).toEqual([]);
      expect(Input._initialize).toHaveBeenCalledOnce();
      expect(Input.onInput).toHaveBeenCalledOnce();
      expect(inputCallback).toBeTypeOf("function");
    });

    it("coalesces invalidations into one update-render frame and rearms afterwards", () => {
      const scene = new Scene(100, 100);
      const calls: string[] = [];
      vi.spyOn(scene, "update").mockImplementation(() => calls.push("update"));
      vi.spyOn(scene, "render").mockImplementation(() => calls.push("render"));

      scene.invalidate();
      scene.invalidate();
      inputCallback?.({ type: "mousemove" });

      expect(requestAnimationFrame).toHaveBeenCalledOnce();
      expect(scheduledFrames).toHaveLength(1);

      runNextFrame();

      expect(calls).toEqual(["update", "render"]);

      scene.invalidate();
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
      expect(scheduledFrames).toHaveLength(1);
    });

    it.todo(
      "keeps input invalidation subscriptions independent for multiple scenes",
    );
    it.todo("releases all owned resources and its input hook when destroyed");
  });

  describe("frame work and size", () => {
    it("updates and renders enabled bindings in scene order around hosts", () => {
      const scene = new Scene(100, 100);
      const enabledLayer = createLayer("enabled");
      const disabledLayer = createLayer("disabled");
      const enabledRenderer = createRenderer("enabled-renderer");
      const disabledRenderer = createRenderer("disabled-renderer");
      const { host } = createHost(1);
      const calls: string[] = [];

      scene.addLayer(enabledLayer);
      scene.addLayer(disabledLayer);
      disabledLayer.disable();
      scene.bindLayerRenderer(enabledLayer, enabledRenderer);
      scene.bindLayerRenderer(disabledLayer, disabledRenderer);
      scene.addHost(host);
      runNextFrame();

      vi.spyOn(scene.inputManager, "update").mockImplementation(() => {
        calls.push("input:update");
      });
      enabledRenderer.update.mockImplementation(() => {
        calls.push("renderer:update");
      });
      enabledRenderer.render.mockImplementation(() => {
        calls.push("renderer:render");
      });
      host.update.mockImplementation(() => calls.push("host:update"));
      host.render.mockImplementation(() => calls.push("host:render"));
      vi.mocked(Input._endFrame).mockImplementation(() => {
        calls.push("input:end-frame");
      });
      vi.clearAllMocks();

      scene.update();
      scene.render();

      expect(calls).toEqual([
        "input:update",
        "renderer:update",
        "host:update",
        "renderer:render",
        "host:render",
        "input:end-frame",
      ]);
      expect(disabledRenderer.update).not.toHaveBeenCalled();
      expect(disabledRenderer.render).not.toHaveBeenCalled();
    });

    it("resizes every layer, updates only enabled bindings and invalidates", () => {
      const scene = new Scene(100, 50);
      const enabledLayer = createLayer("enabled");
      const disabledLayer = createLayer("disabled");
      const enabledRenderer = createRenderer("enabled-renderer");
      const disabledRenderer = createRenderer("disabled-renderer");
      vi.spyOn(enabledLayer, "setSize");
      vi.spyOn(disabledLayer, "setSize");

      scene.addLayer(enabledLayer);
      scene.addLayer(disabledLayer);
      scene.bindLayerRenderer(enabledLayer, enabledRenderer);
      scene.bindLayerRenderer(disabledLayer, disabledRenderer);
      disabledLayer.disable();
      runNextFrame();
      vi.clearAllMocks();

      scene.setSize(640, 480);

      expect(scene.getWidth()).toBe(640);
      expect(scene.getHeight()).toBe(480);
      expect(enabledLayer.setSize).toHaveBeenCalledWith(640, 480);
      expect(disabledLayer.setSize).toHaveBeenCalledWith(640, 480);
      expect(enabledRenderer.update).toHaveBeenCalledOnce();
      expect(disabledRenderer.update).not.toHaveBeenCalled();
      expect(requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it.todo("normalizes scene dimensions before storing and propagating them");
  });

  describe("layer management", () => {
    it("sizes, stores and resolves layers through canonical string IDs", () => {
      const scene = new Scene(800, 600);
      const layer = createLayer(7);
      const duplicate = createLayer("7");
      vi.spyOn(layer, "setSize");
      vi.spyOn(duplicate, "setSize");

      expect(scene.addLayer(layer)).toBe(true);
      expect(scene.addLayer(duplicate)).toBe(false);

      expect(layer.setSize).toHaveBeenCalledWith(800, 600);
      expect(duplicate.setSize).not.toHaveBeenCalled();
      expect(scene.hasLayer(7)).toBe(true);
      expect(scene.hasLayer("7")).toBe(true);
      expect(scene.getLayerById(7)).toBe(layer);
      expect(scene.getLayerById("7")).toBe(layer);
      expect(scene.getLayerById("missing")).toBeNull();
    });

    it("returns a detached layer-list snapshot in insertion order", () => {
      const scene = new Scene(100, 100);
      const first = createLayer("first");
      const second = createLayer("second");
      scene.addLayer(first);
      scene.addLayer(second);

      const snapshot = scene.getLayers();
      (snapshot as LayerBase[]).pop();

      expect(snapshot).toEqual([first]);
      expect(scene.getLayers()).toEqual([first, second]);
    });

    it("returns false without side effects for an unknown layer", () => {
      const scene = new Scene(100, 100);

      expect(scene.removeLayer("missing")).toBe(false);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it("removes a layer with its controllers and renderer while retaining others", () => {
      const scene = new Scene(100, 100);
      const removedLayer = createLayer("removed");
      const retainedLayer = createLayer("retained");
      const removedRenderer = createRenderer("removed-renderer");
      const retainedRenderer = createRenderer("retained-renderer");
      const removedController = new TestInputController("removed-controller");
      const retainedController = new TestInputController("retained-controller");
      const { host } = createHost(1);
      vi.spyOn(removedLayer, "destroy");
      vi.spyOn(retainedLayer, "destroy");
      vi.spyOn(removedController, "detach");
      vi.spyOn(removedController, "destroy");
      vi.spyOn(retainedController, "detach");
      vi.spyOn(retainedController, "destroy");

      scene.addLayer(removedLayer);
      scene.addLayer(retainedLayer);
      scene.bindLayerRenderer(removedLayer, removedRenderer);
      scene.bindLayerRenderer(retainedLayer, retainedRenderer);
      scene.inputManager.add(removedLayer, removedController, removedLayer);
      scene.inputManager.add(retainedLayer, retainedController, retainedLayer);
      scene.addHost(host);
      runNextFrame();
      vi.clearAllMocks();

      expect(scene.removeLayer(removedLayer.id)).toBe(true);

      expect(removedController.detach).toHaveBeenCalled();
      expect(removedController.destroy).toHaveBeenCalledOnce();
      expect(scene.inputManager.getById(removedController.id)).toBeNull();
      expect(retainedController.detach).not.toHaveBeenCalled();
      expect(retainedController.destroy).not.toHaveBeenCalled();
      expect(
        scene.inputManager.getById(retainedController.id)?.controller,
      ).toBe(retainedController);

      expect(removedRenderer.detach).toHaveBeenCalledOnce();
      expect(removedRenderer.destroy).toHaveBeenCalledOnce();
      expect(retainedRenderer.detach).not.toHaveBeenCalled();
      expect(retainedRenderer.destroy).not.toHaveBeenCalled();
      expect(scene.getLayerRendererBindings()).toEqual([
        { layer: retainedLayer, renderer: retainedRenderer },
      ]);

      expect(removedLayer.destroy).toHaveBeenCalledOnce();
      expect(retainedLayer.destroy).not.toHaveBeenCalled();
      expect(scene.hasLayer(removedLayer.id)).toBe(false);
      expect(scene.getLayers()).toEqual([retainedLayer]);
      expect(host.detach).toHaveBeenCalledOnce();
      expect(host.attach).toHaveBeenCalledWith(scene);
      expect(requestAnimationFrame).toHaveBeenCalledOnce();
    });
  });

  describe("renderer bindings", () => {
    it("rejects unregistered and different same-ID layer instances", () => {
      const scene = new Scene(100, 100);
      const registered = createLayer("layer");
      const sameId = createLayer("layer");
      const unregistered = createLayer("missing");
      const renderer = createRenderer("renderer");
      scene.addLayer(registered);

      expect(() => scene.bindLayerRenderer(unregistered, renderer)).toThrow(
        'Layer "missing" is not registered in Scene.',
      );
      expect(() => scene.bindLayerRenderer(sameId, renderer)).toThrow(
        'Layer "layer" is registered with a different instance.',
      );
      expect(renderer.attach).not.toHaveBeenCalled();
      expect(scene.getLayerRendererBindings()).toEqual([]);
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it("attaches and stores a renderer before reattaching every host", () => {
      const scene = new Scene(100, 100);
      const layer = createLayer("layer");
      const renderer = createRenderer("renderer");
      const firstHost = createHost(1).host;
      const secondHost = createHost(2).host;
      scene.addLayer(layer);
      scene.addHost(firstHost);
      scene.addHost(secondHost);
      runNextFrame();
      vi.clearAllMocks();

      scene.bindLayerRenderer(layer, renderer);

      expect(renderer.attach).toHaveBeenCalledWith(layer);
      expect(scene.getLayerRendererBindings()).toEqual([{ layer, renderer }]);
      expect(firstHost.detach).toHaveBeenCalledOnce();
      expect(firstHost.attach).toHaveBeenCalledWith(scene);
      expect(secondHost.detach).toHaveBeenCalledOnce();
      expect(secondHost.attach).toHaveBeenCalledWith(scene);
      expect(requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it("destroys the previous renderer when replacing a binding", () => {
      const scene = new Scene(100, 100);
      const layer = createLayer("layer");
      const previous = createRenderer("previous");
      const replacement = createRenderer("replacement");
      scene.addLayer(layer);
      scene.bindLayerRenderer(layer, previous);
      runNextFrame();
      vi.clearAllMocks();

      scene.bindLayerRenderer(layer, replacement);

      expect(previous.detach).toHaveBeenCalledOnce();
      expect(previous.destroy).toHaveBeenCalledOnce();
      expect(replacement.attach).toHaveBeenCalledWith(layer);
      expect(scene.getLayerRendererBindings()).toEqual([
        { layer, renderer: replacement },
      ]);
      expect(requestAnimationFrame).toHaveBeenCalledOnce();
    });

    it("detaches, destroys and removes a renderer binding", () => {
      const scene = new Scene(100, 100);
      const layer = createLayer("layer");
      const renderer = createRenderer("renderer");
      const { host } = createHost(1);
      scene.addLayer(layer);
      scene.bindLayerRenderer(layer, renderer);
      scene.addHost(host);
      runNextFrame();
      vi.clearAllMocks();

      expect(scene.unbindLayerRenderer(layer.id)).toBe(true);

      expect(renderer.detach).toHaveBeenCalledOnce();
      expect(renderer.destroy).toHaveBeenCalledOnce();
      expect(scene.getLayerRendererBindings()).toEqual([]);
      expect(host.detach).toHaveBeenCalledOnce();
      expect(host.attach).toHaveBeenCalledWith(scene);
      expect(requestAnimationFrame).toHaveBeenCalledOnce();

      vi.clearAllMocks();
      expect(scene.unbindLayerRenderer(layer.id)).toBe(false);
      expect(renderer.detach).not.toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it.todo(
      "preserves the previous binding when a replacement renderer fails to attach",
    );
  });

  describe("render hosts", () => {
    it("registers, attaches and stores a host, rejecting a duplicate ID", () => {
      const scene = new Scene(100, 100);
      const { host, surface } = createHost(1);
      const duplicate = createHost(1).host;

      scene.addHost(host);

      expect(Input._registerSurface).toHaveBeenCalledWith(surface);
      expect(host.attach).toHaveBeenCalledWith(scene);
      expect(scene.hostManager.getById(1)).toBe(host);
      expect(requestAnimationFrame).toHaveBeenCalledOnce();

      expect(() => scene.addHost(duplicate)).toThrow(
        'Render host "1" already exists.',
      );
      expect(duplicate.getSurface).not.toHaveBeenCalled();
      expect(duplicate.attach).not.toHaveBeenCalled();
      expect(scene.hostManager.getAll()).toEqual([host]);
    });

    it("unregisters, detaches, destroys and removes a host", () => {
      const scene = new Scene(100, 100);
      const { host, surface } = createHost(1);
      scene.addHost(host);
      runNextFrame();
      vi.clearAllMocks();

      expect(scene.removeHost(1)).toBe(true);

      expect(Input._unregisterSurface).toHaveBeenCalledWith(surface);
      expect(host.detach).toHaveBeenCalledOnce();
      expect(host.destroy).toHaveBeenCalledOnce();
      expect(scene.hostManager.getById(1)).toBeNull();
      expect(requestAnimationFrame).toHaveBeenCalledOnce();

      vi.clearAllMocks();
      expect(scene.removeHost(1)).toBe(false);
      expect(Input._unregisterSurface).not.toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it("rolls manager state back when surface registration fails", () => {
      const scene = new Scene(100, 100);
      const { host } = createHost(1);
      vi.mocked(Input._registerSurface).mockImplementationOnce(() => {
        throw new Error("surface failed");
      });

      expect(() => scene.addHost(host)).toThrow("surface failed");

      expect(scene.hostManager.getById(1)).toBeNull();
      expect(host.attach).not.toHaveBeenCalled();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it("rolls manager state back and rethrows when attachment fails", () => {
      const scene = new Scene(100, 100);
      const { host, surface } = createHost(1);
      host.attach.mockImplementationOnce(() => {
        throw new Error("attach failed");
      });

      expect(() => scene.addHost(host)).toThrow("attach failed");

      expect(Input._registerSurface).toHaveBeenCalledWith(surface);
      expect(scene.hostManager.getById(1)).toBeNull();
      expect(requestAnimationFrame).not.toHaveBeenCalled();
    });

    it.todo(
      "unregisters the input surface when host attachment fails after registration",
    );
  });
});
