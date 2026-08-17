import { describe, expect, it } from "vitest";
import { Matrix, Transform, Vector2 } from "../../src/core";

const expectVectorToBeCloseTo = (actual: Vector2, expected: Vector2): void => {
  expect(actual.x).toBeCloseTo(expected.x, 6);
  expect(actual.y).toBeCloseTo(expected.y, 6);
};

const expectMatrixToBeCloseTo = (actual: Matrix, expected: Matrix): void => {
  expect(actual.a).toBeCloseTo(expected.a, 6);
  expect(actual.b).toBeCloseTo(expected.b, 6);
  expect(actual.c).toBeCloseTo(expected.c, 6);
  expect(actual.d).toBeCloseTo(expected.d, 6);
  expect(actual.tx).toBeCloseTo(expected.tx, 6);
  expect(actual.ty).toBeCloseTo(expected.ty, 6);
};

const applyMatrix = (matrix: Matrix, point: Vector2): Vector2 => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
  y: matrix.b * point.x + matrix.d * point.y + matrix.ty,
});

describe("Transform", () => {
  it("creates an identity transform around the normalized center pivot", () => {
    const transform = new Transform();

    expect(transform.getPosition()).toEqual({ x: 0, y: 0 });
    expect(transform.getScale()).toEqual({ x: 1, y: 1 });
    expect(transform.getRotation()).toBe(0);
    expect(transform.getPivot()).toEqual({ x: 0.5, y: 0.5 });
    expectMatrixToBeCloseTo(transform.getLocalMatrix(100, 60), {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: -50,
      ty: -30,
    });
  });

  it("sets and translates the position through axis and vector methods", () => {
    const transform = new Transform();

    transform.setX(10);
    transform.setY(-5);
    expect(transform.getPosition()).toEqual({ x: 10, y: -5 });

    transform.setPosition(20, 30);
    transform.translateX(2);
    transform.translateY(-3);
    transform.translate(5, 7);

    expect(transform.getX()).toBe(27);
    expect(transform.getY()).toBe(34);
  });

  it("sets independent, negative and zero scale components", () => {
    const transform = new Transform();

    transform.setScaleX(2);
    transform.setScaleY(3);
    expect(transform.getScale()).toEqual({ x: 2, y: 3 });

    transform.setScale(-1.5, 0);

    expect(transform.getScaleX()).toBe(-1.5);
    expect(transform.getScaleY()).toBe(0);
  });

  it("normalizes absolute and accumulated rotation to [-PI, PI]", () => {
    const transform = new Transform();

    transform.setRotation((Math.PI * 5) / 2);
    expect(transform.getRotation()).toBeCloseTo(Math.PI / 2, 6);

    transform.rotate(Math.PI);
    expect(transform.getRotation()).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("sets the normalized pivot through axis and vector methods", () => {
    const transform = new Transform();

    transform.setPivotX(0.25);
    transform.setPivotY(0.75);
    expect(transform.getPivot()).toEqual({ x: 0.25, y: 0.75 });

    transform.setPivot(-0.5, 1.5);

    expect(transform.getPivotX()).toBe(-0.5);
    expect(transform.getPivotY()).toBe(1.5);
  });

  it("returns detached position, scale and pivot vectors", () => {
    const transform = new Transform();
    const position = transform.getPosition();
    const scale = transform.getScale();
    const pivot = transform.getPivot();

    position.x = 100;
    scale.x = 100;
    pivot.x = 100;

    expect(transform.getPosition()).toEqual({ x: 0, y: 0 });
    expect(transform.getScale()).toEqual({ x: 1, y: 1 });
    expect(transform.getPivot()).toEqual({ x: 0.5, y: 0.5 });
  });

  it("includes local bounds when resolving the pivot translation", () => {
    const transform = new Transform();
    transform.setPosition(5, 7);

    expectMatrixToBeCloseTo(transform.getLocalMatrix(100, 60, 10, -20), {
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      tx: -55,
      ty: -3,
    });
  });

  it("composes scale and rotation around a top-left pivot", () => {
    const transform = new Transform();
    transform.setPosition(10, 20);
    transform.setScale(2, 3);
    transform.setRotation(Math.PI / 2);
    transform.setPivot(0, 0);

    expectMatrixToBeCloseTo(transform.getLocalMatrix(100, 50), {
      a: 0,
      b: 2,
      c: -3,
      d: 0,
      tx: 10,
      ty: 20,
    });
  });

  it("maps the resolved local pivot to the transform position", () => {
    const transform = new Transform();
    transform.setPosition(120, -40);
    transform.setScale(-1.5, 0.75);
    transform.setRotation(Math.PI / 3);
    transform.setPivot(0.25, 0.8);

    const matrix = transform.getLocalMatrix(200, 100, -30, 10);
    const localPivot = {
      x: -30 + 200 * 0.25,
      y: 10 + 100 * 0.8,
    };

    expectVectorToBeCloseTo(applyMatrix(matrix, localPivot), {
      x: 120,
      y: -40,
    });
  });
});
