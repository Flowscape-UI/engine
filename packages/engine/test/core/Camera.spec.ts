/**
 * Camera contract.
 *
 * MathF32 owns primitive numeric behavior and EventEmitter owns generic
 * listener lifecycle. This suite verifies camera state, coordinate conversion,
 * anchored screen operations, fitting and component locks.
 */
import { describe, expect, it } from "vitest";
import { Camera, CameraState, Point } from "../../src/core";

const expectPointToBeCloseTo = (actual: Point, expected: Point): void => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
};

const expectStateToBeCloseTo = (
  actual: CameraState,
  expected: CameraState,
): void => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
  expect(actual.scale).toBeCloseTo(expected.scale, 6);
  expect(actual.rotation).toBeCloseTo(expected.rotation, 6);
};

describe("Camera", () => {
  describe("state and events", () => {
    it("creates the default camera, viewport and unlocked state", () => {
      const camera = new Camera();

      expect(Camera.DEFAULT_MIN_SCALE).toBe(0.01);
      expect(Camera.DEFAULT_MAX_SCALE).toBe(500);
      expect(camera.getState()).toEqual({
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      });
      expect(camera.getViewport()).toEqual({ width: 1, height: 1 });
      expect(camera.getLocks()).toEqual({
        x: false,
        y: false,
        scale: false,
        rotation: false,
      });
      expect(camera.isLocked()).toBe(false);
    });

    it("updates position, scale and rotation through direct and partial APIs", () => {
      const camera = new Camera();
      camera.setLimits(0.5, 4);

      camera.setPosition(10, -20);
      camera.setScale(10);
      camera.setRotationRadians(Math.PI / 4);

      expectStateToBeCloseTo(camera.getState(), {
        x: 10,
        y: -20,
        scale: 4,
        rotation: Math.PI / 4,
      });

      camera.update({ x: 25, scale: 0.1 });

      expectStateToBeCloseTo(camera.getState(), {
        x: 25,
        y: -20,
        scale: 0.5,
        rotation: Math.PI / 4,
      });
    });

    it("returns detached state and lock snapshots", () => {
      const camera = new Camera();
      const state = camera.getState();
      const locks = camera.getLocks();

      state.x = 100;
      locks.x = true;

      expect(camera.getState().x).toBe(0);
      expect(camera.getLocks().x).toBe(false);
    });

    it("resets changed state to defaults", () => {
      const camera = new Camera();
      camera.update({ x: 10, y: 20, scale: 3, rotation: 1 });

      camera.reset();

      expect(camera.getState()).toEqual({
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      });
    });

    it("emits one complete state after each real state transition", () => {
      const camera = new Camera();
      const states: CameraState[] = [];
      const dispose = camera.onChange((state) => states.push({ ...state }));

      camera.setPosition(10, 20);
      camera.setPosition(10, 20);
      camera.update({ x: 10, scale: 2 });
      camera.update({ scale: 2 });
      dispose();
      camera.setRotationRadians(1);

      expect(states).toEqual([
        { x: 10, y: 20, scale: 1, rotation: 0 },
        { x: 10, y: 20, scale: 2, rotation: 0 },
      ]);
    });

    it("updates state before notifying listeners", () => {
      const camera = new Camera();
      const observations: Array<{
        payload: CameraState;
        current: CameraState;
      }> = [];

      camera.onChange((payload) => {
        observations.push({
          payload: { ...payload },
          current: camera.getState(),
        });
      });
      camera.update({ x: 5, y: 7 });

      expect(observations).toEqual([
        {
          payload: { x: 5, y: 7, scale: 1, rotation: 0 },
          current: { x: 5, y: 7, scale: 1, rotation: 0 },
        },
      ]);
    });

    it.todo("returns a detached viewport snapshot");
    it.todo("sanitizes non-finite position and rotation updates");
    it.todo("normalizes scale limits and reclamps the current scale");
  });

  describe("coordinate conversion", () => {
    it("sets a positive viewport and maps the camera center to screen center", () => {
      const camera = new Camera();
      camera.setViewportSize(800, 600);
      camera.setPosition(125, -40);

      expect(camera.getViewport()).toEqual({ width: 800, height: 600 });
      expectPointToBeCloseTo(camera.worldToScreen({ x: 125, y: -40 }), {
        x: 400,
        y: 300,
      });
      expectPointToBeCloseTo(camera.screenToWorld({ x: 400, y: 300 }), {
        x: 125,
        y: -40,
      });
    });

    it("applies camera translation and scale in both directions", () => {
      const camera = new Camera();
      camera.setViewportSize(800, 600);
      camera.update({ x: 100, y: 50, scale: 2 });

      expectPointToBeCloseTo(camera.worldToScreen({ x: 125, y: 70 }), {
        x: 450,
        y: 340,
      });
      expectPointToBeCloseTo(camera.screenToWorld({ x: 450, y: 340 }), {
        x: 125,
        y: 70,
      });
    });

    it("rotates the visible world opposite to camera rotation", () => {
      const camera = new Camera();
      camera.setViewportSize(200, 100);
      camera.setRotationRadians(Math.PI / 2);

      expectPointToBeCloseTo(camera.worldToScreen({ x: 10, y: 0 }), {
        x: 100,
        y: 40,
      });
      expectPointToBeCloseTo(camera.screenToWorld({ x: 100, y: 40 }), {
        x: 10,
        y: 0,
      });
    });

    it("round-trips arbitrary points with translation, scale and rotation", () => {
      const camera = new Camera();
      camera.setViewportSize(917, 613);
      camera.update({ x: -123.5, y: 87.25, scale: 2.75, rotation: 0.73 });

      const worldPoints: Point[] = [
        { x: 0, y: 0 },
        { x: -480.25, y: 190.75 },
        { x: 1000, y: -750 },
      ];

      for (const world of worldPoints) {
        expectPointToBeCloseTo(
          camera.screenToWorld(camera.worldToScreen(world)),
          world,
        );
      }
    });

    it.todo("clamps invalid viewport dimensions to at least one pixel");
  });

  describe("screen-space operations", () => {
    it("pans by inverse screen delta adjusted for scale", () => {
      const camera = new Camera();
      camera.update({ x: 10, y: 20, scale: 2 });

      camera.panByScreen(40, -10);

      expectStateToBeCloseTo(camera.getState(), {
        x: -10,
        y: 25,
        scale: 2,
        rotation: 0,
      });
    });

    it("rotates the pan delta into world space", () => {
      const camera = new Camera();
      camera.update({ scale: 2, rotation: Math.PI / 2 });

      camera.panByScreen(20, 0);

      expectStateToBeCloseTo(camera.getState(), {
        x: 0,
        y: -10,
        scale: 2,
        rotation: Math.PI / 2,
      });
    });

    it("zooms within limits while preserving the world point under the anchor", () => {
      const camera = new Camera();
      camera.setViewportSize(800, 600);
      camera.setLimits(0.5, 3);
      camera.update({ x: 100, y: 50, scale: 2, rotation: 0.3 });
      const anchor = { x: 610, y: 455 };
      const worldBefore = camera.screenToWorld(anchor);

      camera.zoomAtScreen(anchor, 10);

      expect(camera.getState().scale).toBe(3);
      expectPointToBeCloseTo(camera.screenToWorld(anchor), worldBefore);
    });

    it("rotates while preserving the world point under the anchor", () => {
      const camera = new Camera();
      camera.setViewportSize(800, 600);
      camera.update({ x: 100, y: 50, scale: 2, rotation: 0.2 });
      const anchor = { x: 610, y: 455 };
      const worldBefore = camera.screenToWorld(anchor);

      camera.rotateAtScreen(anchor, Math.PI / 3);

      expect(camera.getState().rotation).toBeCloseTo(0.2 + Math.PI / 3, 6);
      expectPointToBeCloseTo(camera.screenToWorld(anchor), worldBefore);
    });
  });

  describe("fitToRect", () => {
    it("centers and scales an unrotated rect with padding", () => {
      const camera = new Camera();
      camera.setViewportSize(800, 600);

      camera.fitToRect(
        { x: 100, y: 200, width: 400, height: 100 },
        { padding: 50 },
      );

      expectStateToBeCloseTo(camera.getState(), {
        x: 300,
        y: 250,
        scale: 1.6,
        rotation: 0,
      });
    });

    it("optionally resets rotation while fitting", () => {
      const camera = new Camera();
      camera.setViewportSize(800, 600);
      camera.setRotationRadians(Math.PI / 4);

      camera.fitToRect(
        { x: -200, y: -100, width: 400, height: 200 },
        { resetRotation: true },
      );

      expectStateToBeCloseTo(camera.getState(), {
        x: 0,
        y: 0,
        scale: 2,
        rotation: 0,
      });
    });

    it.todo("fits every rotated rect corner inside the viewport");
  });

  describe("locks", () => {
    it("locks and unlocks each state component independently", () => {
      const camera = new Camera();
      camera.update({ x: 1, y: 2, scale: 2, rotation: 0.25 });
      camera.lockX();
      camera.lockY();
      camera.lockScale();
      camera.lockRotation();

      expect(camera.isLocked()).toBe(true);
      expect(camera.getLocks()).toEqual({
        x: true,
        y: true,
        scale: true,
        rotation: true,
      });

      camera.update({ x: 10, y: 20, scale: 3, rotation: 1 });
      expectStateToBeCloseTo(camera.getState(), {
        x: 1,
        y: 2,
        scale: 2,
        rotation: 0.25,
      });

      camera.unlockX();
      camera.update({ x: 10, y: 20, scale: 3, rotation: 1 });
      expectStateToBeCloseTo(camera.getState(), {
        x: 10,
        y: 2,
        scale: 2,
        rotation: 0.25,
      });
      expect(camera.isLocked()).toBe(false);

      camera.unlockY();
      camera.unlockScale();
      camera.unlockRotation();
      camera.update({ y: 20, scale: 3, rotation: 1 });

      expectStateToBeCloseTo(camera.getState(), {
        x: 10,
        y: 20,
        scale: 3,
        rotation: 1,
      });
      expect(camera.getLocks()).toEqual({
        x: false,
        y: false,
        scale: false,
        rotation: false,
      });
    });

    it("locks all updates and restores them through the aggregate shortcuts", () => {
      const camera = new Camera();
      camera.update({ x: 5, y: 7, scale: 2, rotation: 0.5 });
      camera.lock();

      camera.reset();
      expectStateToBeCloseTo(camera.getState(), {
        x: 5,
        y: 7,
        scale: 2,
        rotation: 0.5,
      });

      camera.unlock();
      camera.reset();

      expect(camera.isLocked()).toBe(false);
      expect(camera.getState()).toEqual({
        x: 0,
        y: 0,
        scale: 1,
        rotation: 0,
      });
    });
  });
});
