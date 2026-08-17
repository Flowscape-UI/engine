import {
	DEG_TO_RAD,
	EPSILON,
	FLOAT32_MAX,
	FLOAT32_MIN,
	PI,
	RAD_TO_DEG,
} from "./constants";

export class MathF32 {
	public static isValidNumber(value: number): boolean {
		return (
			Number.isFinite(value) &&
			value <= FLOAT32_MAX &&
			value >= FLOAT32_MIN
		);
	}

	public static toF32(value: number): number {
		if (Number.isNaN(value)) {
			return 0;
		}

		if (value === Infinity) {
			return FLOAT32_MAX;
		}

		if (value === -Infinity) {
			return FLOAT32_MIN;
		}

		if (value > FLOAT32_MAX) {
			return FLOAT32_MAX;
		}

		if (value < FLOAT32_MIN) {
			return FLOAT32_MIN;
		}

		return value;
	}

	public static add(a: number, b: number): number {
		return this.toF32(this.toF32(a) + this.toF32(b));
	}

	public static sub(a: number, b: number): number {
		return this.toF32(this.toF32(a) - this.toF32(b));
	}

	public static mul(a: number, b: number): number {
		return this.toF32(this.toF32(a) * this.toF32(b));
	}

	public static div(a: number, b: number): number {
		if (b === 0) {
			return 0;
		}
		return this.toF32(this.toF32(a) / this.toF32(b));
	}

	public static neg(value: number): number {
		return -this.toF32(value);
	}

	public static abs(value: number): number {
		return Math.abs(this.toF32(value));
	}

	public static min(a: number, b: number): number {
		return this.toF32(Math.min(this.toF32(a), this.toF32(b)));
	}

	public static max(a: number, b: number): number {
		return this.toF32(Math.max(this.toF32(a), this.toF32(b)));
	}

	public static clamp(value: number, min: number, max: number): number {
		let valueF32 = this.toF32(value);
		let minF32 = this.toF32(min);
		let maxF32 = this.toF32(max);

		if (minF32 > maxF32) {
			const tmp = minF32;
			minF32 = maxF32;
			maxF32 = tmp;
		}

		if (valueF32 < minF32) return minF32;
		if (valueF32 > maxF32) return maxF32;

		return valueF32;
	}

	public static nearlyEqual(
		a: number,
		b: number,
		epsilon = EPSILON,
	): boolean {
		return this.abs(this.toF32(a) - this.toF32(b)) <= this.abs(epsilon);
	}

	public static lerp(a: number, b: number, t: number): number {
		const af32 = this.toF32(a);
		const bf32 = this.toF32(b);
		const tf32 = this.toF32(t);
		return this.toF32(af32 + (bf32 - af32) * tf32);
	}

	public static round(value: number): number {
		return Math.round(this.toF32(value));
	}

	public static floor(value: number): number {
		return Math.floor(this.toF32(value));
	}

	public static ceil(value: number): number {
		return Math.ceil(this.toF32(value));
	}

	public static sin(value: number): number {
		return this.toF32(Math.sin(this.toF32(value)));
	}

	public static cos(value: number): number {
		return this.toF32(Math.cos(value));
	}

	public static tan(value: number): number {
		return this.toF32(Math.tan(value));
	}

	public static atan(value: number): number {
		return this.toF32(Math.atan(value));
	}

	public static atan2(y: number, x: number): number {
		return this.toF32(Math.atan2(y, x));
	}

	public static asin(value: number): number {
		const v = this.clamp(value, -1, 1);
		return this.toF32(Math.asin(v));
	}

	public static acos(value: number): number {
		const v = this.clamp(value, -1, 1);
		return this.toF32(Math.acos(v));
	}

	/**
	 * Converts radians to degrees.
	 * Конвертирует радианы в градусы.
	 */
	public static radToDeg(rad: number): number {
		return MathF32.toF32(rad * RAD_TO_DEG);
	}

	/**
	 * Converts degrees to radians.
	 *
	 * Конвертирует градусы в радианы.
	 */
	public static degToRad(deg: number): number {
		return MathF32.toF32(deg * DEG_TO_RAD);
	}

	/**
	 * Normalizes angle in radians to the range [-PI, PI].
	 *
	 * Нормализует угол в радианах в диапазон [-PI, PI].
	 */
	public static normalizeRad(angle: number): number {
		const TWO_PI = PI * 2;
		const a = MathF32.toF32(angle);
		let result = a % TWO_PI;

		if (result > PI) {
			result -= TWO_PI;
		} else if (result < -PI) {
			result += TWO_PI;
		}

		return MathF32.toF32(result);
	}

	/**
	 * Normalizes angle in degrees to the range [-180, 180].
	 *
	 * Нормализует угол в градусах в диапазон [-180, 180].
	 */
	public static normalizeDeg(angle: number): number {
		const a = MathF32.toF32(angle);
		let result = a % 360;

		if (result > 180) {
			result -= 360;
		} else if (result < -180) {
			result += 360;
		}

		return MathF32.toF32(result);
	}
}
