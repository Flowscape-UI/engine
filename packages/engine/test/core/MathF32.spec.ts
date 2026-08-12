import { describe, expect, it } from "vitest";
import { EPSILON, FLOAT32_MAX, FLOAT32_MIN, MathF32, PI } from "../../src/core";


describe("MathF32", () => {
  describe("validation and sanitization", () => {
    it("accepts only finite numbers inside the supported range", () => {
      expect(MathF32.isValidNumber(0)).toBe(true);
      expect(MathF32.isValidNumber(FLOAT32_MAX)).toBe(true);
      expect(MathF32.isValidNumber(FLOAT32_MIN)).toBe(true);

      expect(MathF32.isValidNumber(Number.NaN)).toBe(false);
      expect(MathF32.isValidNumber(Infinity)).toBe(false);
      expect(MathF32.isValidNumber(-Infinity)).toBe(false);
      expect(MathF32.isValidNumber(FLOAT32_MAX * 2)).toBe(false);
      expect(MathF32.isValidNumber(FLOAT32_MIN * 2)).toBe(false);
    });

    it("normalizes non-finite and out-of-range numbers", () => {
      expect(MathF32.toF32(Number.NaN)).toBe(0);
      expect(MathF32.toF32(Infinity)).toBe(FLOAT32_MAX);
      expect(MathF32.toF32(-Infinity)).toBe(FLOAT32_MIN);
      expect(MathF32.toF32(FLOAT32_MAX * 2)).toBe(FLOAT32_MAX);
      expect(MathF32.toF32(FLOAT32_MIN * 2)).toBe(FLOAT32_MIN);
      expect(MathF32.toF32(12.25)).toBe(12.25);
      expect(Object.is(MathF32.toF32(-0), -0)).toBe(true);
    });

    it("is idempotent and always produces a valid number", () => {
      const values = [
        Number.NaN,
        Infinity,
        -Infinity,
        FLOAT32_MIN * 2,
        -12.5,
        -0,
        0,
        12.5,
        FLOAT32_MAX * 2,
      ];

      for (const value of values) {
        const normalized = MathF32.toF32(value);

        expect(MathF32.isValidNumber(normalized)).toBe(true);
        expect(MathF32.toF32(normalized)).toBe(normalized);
      }
    });
  });

  describe("arithmetic", () => {
    it("adds, subtracts and sanitizes operands", () => {
      expect(MathF32.add(1.25, 2.5)).toBe(3.75);
      expect(MathF32.sub(1.25, 2.5)).toBe(-1.25);
      expect(MathF32.add(Number.NaN, 5)).toBe(5);
      expect(MathF32.sub(5, Number.NaN)).toBe(5);
    });

    it("multiplies and divides ordinary values", () => {
      expect(MathF32.mul(1.5, 4)).toBe(6);
      expect(MathF32.mul(-1.5, 4)).toBe(-6);
      expect(MathF32.div(9, 4)).toBe(2.25);
      expect(MathF32.div(-9, 3)).toBe(-3);
    });

    it("saturates overflowing arithmetic results", () => {
      expect(MathF32.add(FLOAT32_MAX, FLOAT32_MAX)).toBe(FLOAT32_MAX);
      expect(MathF32.sub(FLOAT32_MIN, FLOAT32_MAX)).toBe(FLOAT32_MIN);
      expect(MathF32.mul(FLOAT32_MAX, 2)).toBe(FLOAT32_MAX);
      expect(MathF32.mul(FLOAT32_MIN, 2)).toBe(FLOAT32_MIN);
    });

    it("returns zero when dividing by positive or negative zero", () => {
      expect(MathF32.div(10, 0)).toBe(0);
      expect(MathF32.div(10, -0)).toBe(0);
      expect(MathF32.div(0, 0)).toBe(0);
    });

    it("negates and resolves absolute values at numeric boundaries", () => {
      expect(MathF32.neg(5)).toBe(-5);
      expect(MathF32.neg(-5)).toBe(5);
      expect(MathF32.neg(FLOAT32_MIN)).toBe(FLOAT32_MAX);
      expect(MathF32.neg(Infinity)).toBe(FLOAT32_MIN);
      expect(MathF32.abs(-5)).toBe(5);
      expect(MathF32.abs(-Infinity)).toBe(FLOAT32_MAX);
    });

    it("preserves the additive and multiplicative identities", () => {
      const values = [-100.5, -1, 0, 1, 100.5];

      for (const value of values) {
        expect(MathF32.add(value, 0)).toBe(value);
        expect(MathF32.sub(value, 0)).toBe(value);
        expect(MathF32.mul(value, 1)).toBe(value);
        expect(MathF32.div(value, 1)).toBe(value);
        expect(MathF32.add(value, -value)).toBe(0);
      }
    });

    it("keeps addition and multiplication commutative", () => {
      const pairs = [
        [-12.5, 7],
        [0, 14],
        [3.25, 8.5],
      ] as const;

      for (const [a, b] of pairs) {
        expect(MathF32.add(a, b)).toBe(MathF32.add(b, a));
        expect(MathF32.mul(a, b)).toBe(MathF32.mul(b, a));
      }
    });

    it.todo("checks the sanitized divisor for zero before division");
  });

  describe("range and interpolation", () => {
    it("selects minimum and maximum after sanitizing inputs", () => {
      expect(MathF32.min(4, -2)).toBe(-2);
      expect(MathF32.max(4, -2)).toBe(4);
      expect(MathF32.min(Number.NaN, 5)).toBe(0);
      expect(MathF32.max(Number.NaN, -5)).toBe(0);
      expect(MathF32.min(Infinity, 5)).toBe(5);
      expect(MathF32.max(-Infinity, 5)).toBe(5);
    });

    it("clamps values and accepts reversed boundaries", () => {
      expect(MathF32.clamp(5, 0, 10)).toBe(5);
      expect(MathF32.clamp(-5, 0, 10)).toBe(0);
      expect(MathF32.clamp(15, 0, 10)).toBe(10);
      expect(MathF32.clamp(5, 10, 0)).toBe(5);
      expect(MathF32.clamp(-5, 10, 0)).toBe(0);
      expect(MathF32.clamp(15, 10, 0)).toBe(10);
      expect(MathF32.clamp(Number.NaN, -1, 1)).toBe(0);
      expect(MathF32.clamp(Infinity, -1, 1)).toBe(1);
    });

    it("compares values using inclusive absolute epsilon", () => {
      expect(MathF32.nearlyEqual(10, 10 + EPSILON)).toBe(true);
      expect(MathF32.nearlyEqual(10, 10 + EPSILON * 2)).toBe(false);
      expect(MathF32.nearlyEqual(10, 10.01, 0.01)).toBe(true);
      expect(MathF32.nearlyEqual(10, 10.01, -0.01)).toBe(true);
      expect(MathF32.nearlyEqual(10, 10.02, 0.01)).toBe(false);
    });

    it("interpolates endpoints, intermediate values and extrapolation", () => {
      expect(MathF32.lerp(10, 20, 0)).toBe(10);
      expect(MathF32.lerp(10, 20, 1)).toBe(20);
      expect(MathF32.lerp(10, 20, 0.25)).toBe(12.5);
      expect(MathF32.lerp(10, 20, -0.5)).toBe(5);
      expect(MathF32.lerp(10, 20, 1.5)).toBe(25);
    });

    it("keeps interpolation symmetric when endpoints and progress reverse", () => {
      const cases = [0, 0.2, 0.5, 0.75, 1];

      for (const t of cases) {
        expect(MathF32.lerp(-20, 80, t)).toBeCloseTo(
          MathF32.lerp(80, -20, 1 - t),
          10,
        );
      }
    });

    it("defines symmetric min and max behavior for signed zero", () => {
      expect(Object.is(MathF32.min(0, -0), -0)).toBe(true);
      expect(Object.is(MathF32.min(-0, 0), -0)).toBe(true);

      expect(Object.is(MathF32.max(0, -0), 0)).toBe(true);
      expect(Object.is(MathF32.max(-0, 0), 0)).toBe(true);
    });
  });

  describe("rounding", () => {
    it.each([
      [1.4, 1, 1, 2],
      [1.5, 2, 1, 2],
      [-1.4, -1, -2, -1],
      [-1.5, -1, -2, -1],
      [Number.NaN, 0, 0, 0],
    ] as const)(
      "rounds %s with round, floor and ceil",
      (value, rounded, floored, ceiled) => {
        expect(MathF32.round(value)).toBe(rounded);
        expect(MathF32.floor(value)).toBe(floored);
        expect(MathF32.ceil(value)).toBe(ceiled);
      },
    );
  });

  describe("trigonometry", () => {
    it("resolves sine, cosine and tangent at canonical angles", () => {
      expect(MathF32.sin(0)).toBe(0);
      expect(MathF32.sin(PI / 2)).toBeCloseTo(1, 12);
      expect(MathF32.cos(0)).toBe(1);
      expect(MathF32.cos(PI)).toBeCloseTo(-1, 12);
      expect(MathF32.tan(PI / 4)).toBeCloseTo(1, 12);
    });

    it("resolves inverse tangent values and atan2 quadrants", () => {
      expect(MathF32.atan(1)).toBeCloseTo(PI / 4, 12);
      expect(MathF32.atan(-1)).toBeCloseTo(-PI / 4, 12);
      expect(MathF32.atan2(1, 1)).toBeCloseTo(PI / 4, 12);
      expect(MathF32.atan2(1, -1)).toBeCloseTo((PI * 3) / 4, 12);
      expect(MathF32.atan2(-1, -1)).toBeCloseTo((-PI * 3) / 4, 12);
    });

    it("clamps inverse sine and cosine inputs to their domains", () => {
      expect(MathF32.asin(2)).toBeCloseTo(PI / 2, 12);
      expect(MathF32.asin(-2)).toBeCloseTo(-PI / 2, 12);
      expect(MathF32.acos(2)).toBe(0);
      expect(MathF32.acos(-2)).toBeCloseTo(PI, 12);
      expect(MathF32.asin(Number.NaN)).toBe(0);
      expect(MathF32.acos(Number.NaN)).toBeCloseTo(PI / 2, 12);
    });

    it("preserves core trigonometric identities", () => {
      const angles = [-PI, -1, -0.25, 0, 0.25, 1, PI];

      for (const angle of angles) {
        const sin = MathF32.sin(angle);
        const cos = MathF32.cos(angle);

        expect(sin * sin + cos * cos).toBeCloseTo(1, 12);
        expect(MathF32.sin(-angle)).toBeCloseTo(-sin, 12);
        expect(MathF32.cos(-angle)).toBeCloseTo(cos, 12);
      }
    });

    it.todo("sanitizes every trigonometric input before evaluation");
  });

  describe("angles", () => {
    it("converts between degrees and radians", () => {
      expect(MathF32.degToRad(0)).toBe(0);
      expect(MathF32.degToRad(180)).toBeCloseTo(PI, 12);
      expect(MathF32.degToRad(-90)).toBeCloseTo(-PI / 2, 12);
      expect(MathF32.radToDeg(0)).toBe(0);
      expect(MathF32.radToDeg(PI)).toBeCloseTo(180, 12);
      expect(MathF32.radToDeg(-PI / 2)).toBeCloseTo(-90, 12);
    });

    it("round-trips representative degree values", () => {
      const degrees = [-720, -180, -45.5, 0, 45.5, 180, 720];

      for (const value of degrees) {
        expect(MathF32.radToDeg(MathF32.degToRad(value))).toBeCloseTo(
          value,
          10,
        );
      }
    });

    it.each([
      [0, 0],
      [180, 180],
      [-180, -180],
      [181, -179],
      [-181, 179],
      [540, 180],
      [-540, -180],
      [720, 0],
    ] as const)("normalizes %s degrees to %s", (angle, expected) => {
      expect(MathF32.normalizeDeg(angle)).toBeCloseTo(expected, 12);
    });

    it.each([
      [0, 0],
      [PI, PI],
      [-PI, -PI],
      [PI + 0.25, -PI + 0.25],
      [-PI - 0.25, PI - 0.25],
      [PI * 3, PI],
      [-PI * 3, -PI],
      [PI * 4, 0],
    ] as const)("normalizes %s radians to %s", (angle, expected) => {
      expect(MathF32.normalizeRad(angle)).toBeCloseTo(expected, 12);
    });

    it("keeps normalized angles bounded and idempotent", () => {
      const degrees = [-10000, -721, -181, 0, 181, 721, 10000];
      const radians = degrees.map((value) => MathF32.degToRad(value));

      for (const angle of degrees) {
        const normalized = MathF32.normalizeDeg(angle);

        expect(normalized).toBeGreaterThanOrEqual(-180);
        expect(normalized).toBeLessThanOrEqual(180);
        expect(MathF32.normalizeDeg(normalized)).toBe(normalized);
      }

      for (const angle of radians) {
        const normalized = MathF32.normalizeRad(angle);

        expect(normalized).toBeGreaterThanOrEqual(-PI);
        expect(normalized).toBeLessThanOrEqual(PI);
        expect(MathF32.normalizeRad(normalized)).toBe(normalized);
      }
    });
  });
});
