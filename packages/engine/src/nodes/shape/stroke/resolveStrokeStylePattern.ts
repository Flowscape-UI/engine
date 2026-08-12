import type { ResolvedStrokeStylePattern, StrokeStyleGap, StrokeStyleLength } from "../types";

export function resolveStrokeStylePattern(
    length: StrokeStyleLength,
    gap: StrokeStyleGap,
): ResolvedStrokeStylePattern {
    const lengths = typeof length === "number" ? [length] : [...length];

    const gaps = typeof gap === "number" ? [gap] : [...gap];

    if (lengths.length === 0 || gaps.length === 0) {
        return [];
    }

    if (
        lengths.length > 1 &&
        gaps.length > 1 &&
        lengths.length !== gaps.length
    ) {
        throw new RangeError(
            "Stroke style length and gap patterns must have the same number of elements.",
        );
    }

    const count = Math.max(lengths.length, gaps.length);

    return Array.from({ length: count }, (_, index) => ({
        length: lengths.length === 1 ? lengths[0]! : lengths[index]!,

        gap: gaps.length === 1 ? gaps[0]! : gaps[index]!,
    }));
}