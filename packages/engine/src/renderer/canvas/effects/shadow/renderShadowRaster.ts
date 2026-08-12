import type { Rect } from "../../../../nodes";
import { DropShadowMode } from "../../../../nodes";
import { appendShapePath } from "../../utils";
import type {
	CanvasDropShadowState,
	CanvasInnerShadowState,
	CanvasShadowGeometry,
	CanvasShadowRaster,
} from "./types";

const BLUR_PADDING_FACTOR = 3;
const RASTER_PADDING = 2;
const MAX_RASTER_SCALE = 4;
const MAX_RASTER_DIMENSION = 4096;
const MAX_RASTER_PIXELS = 8_388_608;
const CHAMFER_STRAIGHT_COST = 3;
const CHAMFER_DIAGONAL_COST = 4;

export function getDropShadowRasterBounds(
	sourceBounds: Rect,
	effect: CanvasDropShadowState,
): Rect {
	const spreadOutset = Math.max(0, effect.spread);
	const blurPadding = Math.ceil(effect.blur * BLUR_PADDING_FACTOR);
	const padding = spreadOutset + blurPadding + RASTER_PADDING;

	return {
		x: sourceBounds.x + effect.x - padding,
		y: sourceBounds.y + effect.y - padding,
		width: Math.max(1, sourceBounds.width + padding * 2),
		height: Math.max(1, sourceBounds.height + padding * 2),
	};
}

export function getInnerShadowRasterBounds(
	sourceBounds: Rect,
	effect: CanvasInnerShadowState,
): Rect {
	const spreadOutset = Math.max(0, effect.spread);
	const blurPadding = Math.ceil(effect.blur * BLUR_PADDING_FACTOR);
	const offsetPadding = Math.max(Math.abs(effect.x), Math.abs(effect.y));
	const padding = spreadOutset + blurPadding + offsetPadding + RASTER_PADDING;

	return {
		x: sourceBounds.x - padding,
		y: sourceBounds.y - padding,
		width: Math.max(1, sourceBounds.width + padding * 2),
		height: Math.max(1, sourceBounds.height + padding * 2),
	};
}

export function resolveShadowRasterScale(
	requestedScale: number,
	bounds: Rect,
): number {
	const normalizedRequestedScale = Math.min(
		MAX_RASTER_SCALE,
		Math.max(1, requestedScale),
	);

	const dimensionScale = Math.min(
		MAX_RASTER_DIMENSION / Math.max(1, bounds.width),
		MAX_RASTER_DIMENSION / Math.max(1, bounds.height),
	);

	const pixelScale = Math.sqrt(
		MAX_RASTER_PIXELS / Math.max(1, bounds.width * bounds.height),
	);

	const scale = Math.min(
		normalizedRequestedScale,
		dimensionScale,
		pixelScale,
	);

	if (scale >= 0.25) {
		return Math.floor(scale * 4) / 4;
	}

	return Math.max(Number.EPSILON, scale);
}

export function renderDropShadowRaster(
	geometry: CanvasShadowGeometry,
	effect: CanvasDropShadowState,
	requestedScale: number,
): CanvasShadowRaster | null {
	if (effect.opacity <= 0 || !hasVisibleGeometry(geometry)) {
		return null;
	}

	const requestedBounds = getDropShadowRasterBounds(geometry.bounds, effect);
	const scale = resolveShadowRasterScale(requestedScale, requestedBounds);
	const raster = createRaster(requestedBounds, scale);
	const shiftedMask = renderGeometryMask(
		geometry,
		raster.bounds,
		scale,
		effect.x,
		effect.y,
		Math.max(0, effect.spread),
	);

	if (effect.spread < 0) {
		applySpread(shiftedMask, effect.spread * scale);
	}

	drawBlurredMask(raster.context, shiftedMask, effect.blur * scale, 0, 0);
	tintMask(raster.context, raster.canvas, effect.fill, effect.opacity);

	if (effect.mode === DropShadowMode.Cutout) {
		const sourceMask = renderGeometryMask(
			geometry,
			raster.bounds,
			scale,
			0,
			0,
		);

		raster.context.save();
		raster.context.globalCompositeOperation = "destination-out";
		raster.context.drawImage(sourceMask, 0, 0);
		raster.context.restore();
	}

	return {
		canvas: raster.canvas,
		bounds: raster.bounds,
		scale,
	};
}

export function renderInnerShadowRaster(
	geometry: CanvasShadowGeometry,
	effect: CanvasInnerShadowState,
	requestedScale: number,
): CanvasShadowRaster | null {
	if (effect.opacity <= 0 || !hasVisibleGeometry(geometry)) {
		return null;
	}

	const requestedBounds = getInnerShadowRasterBounds(geometry.bounds, effect);
	const scale = resolveShadowRasterScale(requestedScale, requestedBounds);
	const raster = createRaster(requestedBounds, scale);
	const sourceMask = renderGeometryMask(geometry, raster.bounds, scale, 0, 0);
	const inverseMask = createCanvas(raster.canvas.width, raster.canvas.height);
	const inverseContext = getCanvasContext(inverseMask);

	inverseContext.fillStyle = "#ffffff";
	inverseContext.fillRect(0, 0, inverseMask.width, inverseMask.height);
	inverseContext.globalCompositeOperation = "destination-out";
	inverseContext.drawImage(sourceMask, 0, 0);
	inverseContext.globalCompositeOperation = "source-over";

	applySpread(inverseMask, effect.spread * scale);
	drawBlurredMask(
		raster.context,
		inverseMask,
		effect.blur * scale,
		effect.x * scale,
		effect.y * scale,
	);
	tintMask(raster.context, raster.canvas, effect.fill, effect.opacity);

	raster.context.save();
	raster.context.globalCompositeOperation = "destination-in";
	raster.context.drawImage(sourceMask, 0, 0);
	raster.context.restore();

	return {
		canvas: raster.canvas,
		bounds: raster.bounds,
		scale,
	};
}

function createRaster(
	bounds: Rect,
	scale: number,
): {
	canvas: HTMLCanvasElement;
	context: CanvasRenderingContext2D;
	bounds: Rect;
} {
	const width = Math.max(1, Math.ceil(bounds.width * scale));
	const height = Math.max(1, Math.ceil(bounds.height * scale));
	const canvas = createCanvas(width, height);

	return {
		canvas,
		context: getCanvasContext(canvas),
		bounds: {
			x: bounds.x,
			y: bounds.y,
			width: width / scale,
			height: height / scale,
		},
	};
}

function renderGeometryMask(
	geometry: CanvasShadowGeometry,
	bounds: Rect,
	scale: number,
	offsetX: number,
	offsetY: number,
	spread = 0,
): HTMLCanvasElement {
	const canvas = createCanvas(
		Math.max(1, Math.ceil(bounds.width * scale)),
		Math.max(1, Math.ceil(bounds.height * scale)),
	);
	const context = getCanvasContext(canvas);

	context.setTransform(
		scale,
		0,
		0,
		scale,
		(-bounds.x + offsetX) * scale,
		(-bounds.y + offsetY) * scale,
	);
	context.fillStyle = "#ffffff";
	context.strokeStyle = "#ffffff";

	if (geometry.fillCommands.length > 0) {
		context.beginPath();
		appendShapePath(context, geometry.fillCommands);
		context.fill();
		expandCurrentPath(context, spread);
	}

	for (const area of geometry.strokeAreas) {
		if (area.commands.length === 0) {
			continue;
		}

		context.beginPath();
		appendShapePath(context, area.commands);
		context.fill(area.fillRule);
		expandCurrentPath(context, spread);
	}

	if (geometry.fallbackStroke && geometry.fallbackStroke.width > 0) {
		context.beginPath();
		appendShapePath(context, geometry.fallbackStroke.commands);

		context.lineWidth = geometry.fallbackStroke.width + spread * 2;

		context.lineCap = geometry.fallbackStroke.lineCap;
		context.lineJoin = geometry.fallbackStroke.lineJoin;
		context.stroke();
	}

	context.resetTransform();

	return canvas;
}

function expandCurrentPath(
	context: CanvasRenderingContext2D,
	spread: number,
): void {
	if (spread <= 0) {
		return;
	}

	context.lineWidth = spread * 2;
	context.lineCap = "square";
	context.lineJoin = "miter";
	context.miterLimit = 10;
	context.stroke();
}

function drawBlurredMask(
	context: CanvasRenderingContext2D,
	mask: HTMLCanvasElement,
	blur: number,
	offsetX: number,
	offsetY: number,
): void {
	context.save();
	context.filter = blur > 0 ? `blur(${blur}px)` : "none";
	context.drawImage(mask, offsetX, offsetY);
	context.restore();
}

function tintMask(
	context: CanvasRenderingContext2D,
	canvas: HTMLCanvasElement,
	fill: string,
	opacity: number,
): void {
	context.save();
	context.globalCompositeOperation = "source-in";
	context.globalAlpha = Math.max(0, Math.min(1, opacity));
	context.fillStyle = fill;
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.restore();
}

function applySpread(canvas: HTMLCanvasElement, spread: number): void {
	const radius = Math.round(Math.abs(spread));

	if (radius <= 0 || canvas.width <= 0 || canvas.height <= 0) {
		return;
	}

	const context = getCanvasContext(canvas);
	const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	const alpha = new Uint8ClampedArray(canvas.width * canvas.height);

	for (let index = 0; index < alpha.length; index += 1) {
		alpha[index] = imageData.data[index * 4 + 3] ?? 0;
	}

	const distances = buildChamferDistances(
		alpha,
		canvas.width,
		canvas.height,
		spread < 0,
	);
	const limit = radius * CHAMFER_STRAIGHT_COST;

	for (let index = 0; index < alpha.length; index += 1) {
		const originalAlpha = alpha[index] ?? 0;
		const distance = distances[index] ?? Number.POSITIVE_INFINITY;
		const nextAlpha =
			spread > 0
				? distance <= limit
					? 255
					: originalAlpha
				: originalAlpha > 0 && distance > limit
					? 255
					: 0;
		const dataIndex = index * 4;

		imageData.data[dataIndex] = 255;
		imageData.data[dataIndex + 1] = 255;
		imageData.data[dataIndex + 2] = 255;
		imageData.data[dataIndex + 3] = nextAlpha;
	}

	context.putImageData(imageData, 0, 0);
}

function buildChamferDistances(
	alpha: Uint8ClampedArray,
	width: number,
	height: number,
	distanceToTransparent: boolean,
): Uint16Array {
	const maxDistance = 0xffff;
	const distances = new Uint16Array(alpha.length);

	for (let index = 0; index < alpha.length; index += 1) {
		const isOpaque = (alpha[index] ?? 0) >= 128;
		const isTarget = distanceToTransparent ? !isOpaque : isOpaque;
		distances[index] = isTarget ? 0 : maxDistance;
	}

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;
			let distance = distances[index] ?? maxDistance;

			if (x > 0) {
				distance = Math.min(
					distance,
					(distances[index - 1] ?? maxDistance) +
						CHAMFER_STRAIGHT_COST,
				);
			}

			if (y > 0) {
				distance = Math.min(
					distance,
					(distances[index - width] ?? maxDistance) +
						CHAMFER_STRAIGHT_COST,
				);

				if (x > 0) {
					distance = Math.min(
						distance,
						(distances[index - width - 1] ?? maxDistance) +
							CHAMFER_DIAGONAL_COST,
					);
				}

				if (x + 1 < width) {
					distance = Math.min(
						distance,
						(distances[index - width + 1] ?? maxDistance) +
							CHAMFER_DIAGONAL_COST,
					);
				}
			}

			distances[index] = Math.min(maxDistance, distance);
		}
	}

	for (let y = height - 1; y >= 0; y -= 1) {
		for (let x = width - 1; x >= 0; x -= 1) {
			const index = y * width + x;
			let distance = distances[index] ?? maxDistance;

			if (x + 1 < width) {
				distance = Math.min(
					distance,
					(distances[index + 1] ?? maxDistance) +
						CHAMFER_STRAIGHT_COST,
				);
			}

			if (y + 1 < height) {
				distance = Math.min(
					distance,
					(distances[index + width] ?? maxDistance) +
						CHAMFER_STRAIGHT_COST,
				);

				if (x > 0) {
					distance = Math.min(
						distance,
						(distances[index + width - 1] ?? maxDistance) +
							CHAMFER_DIAGONAL_COST,
					);
				}

				if (x + 1 < width) {
					distance = Math.min(
						distance,
						(distances[index + width + 1] ?? maxDistance) +
							CHAMFER_DIAGONAL_COST,
					);
				}
			}

			distances[index] = Math.min(maxDistance, distance);
		}
	}

	return distances;
}

function hasVisibleGeometry(geometry: CanvasShadowGeometry): boolean {
	return (
		geometry.fillCommands.length > 0 ||
		geometry.strokeAreas.length > 0 ||
		geometry.fallbackStroke !== null
	);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
	const context = canvas.getContext("2d");

	if (!context) {
		throw new Error("Canvas 2D context is not available.");
	}

	return context;
}
