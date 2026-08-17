import Konva from "konva";
import { transformTo } from "gradiente";

import {
	registerGradientTransformers,
	type KonvaGradientPaint,
} from "../../transformers/gradients";

import {
	FillMode,
	resolveStrokePatternGeometry,
	ShapeEffectType,
	StrokeDashCap,
	StrokeStyle,
	type IShapeEffectDropShadow,
	type IShapeEffectInnerShadow,
	type IShapeBase,
	type Rect,
	type ResolvedStrokePatternPathSegment,
	type ShapePathCommand,
	type ShapeStrokePath,
	type StrokeDashedStyleProperties,
	type StrokeStyleProperties,
	type ShapeStrokeArea,
} from "../../../../nodes";

import {
	RendererEffectDropShadow,
	RendererEffectInnerShadow,
	RendererShapeEffectLayerBlur,
	RendererEffectBackgroundBlur,
	type CanvasDropShadowState,
	type CanvasShadowArea,
	type CanvasShadowGeometry,
} from "../../effects";
import { getLayerBlurRasterBounds } from "../../effects/blur";
import { getDropShadowRasterBounds } from "../../effects/shadow/renderShadowRaster";
import { RendererCanvasBase } from "../base";
import { EPSILON, type Matrix } from "../../../../core";
import { appendShapePath } from "../../utils";

const FILL_SHAPE_NAME = "shape-fill";
const FILL_SHAPE_SELECTOR = `.${FILL_SHAPE_NAME}`;

const STROKE_SHAPE_NAME = "shape-stroke";
const STROKE_SHAPE_SELECTOR = `.${STROKE_SHAPE_NAME}`;

const DROP_SHADOW_LAYER_NAME = "shape-drop-shadows";
const INNER_SHADOW_LAYER_NAME = "shape-inner-shadows";
const EFFECT_LAYER_NAME = "shape-effects";

const DROP_SHADOW_LAYER_SELECTOR = `.${DROP_SHADOW_LAYER_NAME}`;

const INNER_SHADOW_LAYER_SELECTOR = `.${INNER_SHADOW_LAYER_NAME}`;
const EFFECT_LAYER_SELECTOR = `.${EFFECT_LAYER_NAME}`;

registerGradientTransformers();

type GradientPaintCacheEntry = {
	fillMode: FillMode;
	fillValue: string;
	paint: KonvaGradientPaint;
};

type ShapeEffectRendererState = {
	dropShadows: Map<IShapeEffectDropShadow, RendererEffectDropShadow>;
	innerShadows: Map<IShapeEffectInnerShadow, RendererEffectInnerShadow>;
	layerBlur: RendererShapeEffectLayerBlur;
	backgroundBlur: RendererEffectBackgroundBlur;
};

type CreateShadowGeometryInput = Readonly<{
	commands: readonly ShapePathCommand[];
	fillCommands: readonly ShapePathCommand[];
	fillBounds: Rect;
	viewBounds: Rect;
	strokePath: ShapeStrokePath | null;
	strokePatternPaths: readonly ResolvedStrokePatternPathSegment[];
	strokeWidth: number;
	strokeStyle: StrokeStyle;
	strokeMode: FillMode;
}>;

export class RendererCanvasShape extends RendererCanvasBase<IShapeBase> {
	private readonly _gradientPaintCache = new WeakMap<
		Konva.Shape,
		GradientPaintCacheEntry
	>();
	private readonly _effectRendererStates = new WeakMap<
		Konva.Group,
		ShapeEffectRendererState
	>();

	public create(node: IShapeBase): Konva.Group {
		const group = new Konva.Group({
			id: String(node.id),
		});
		const effectLayer = new Konva.Group({
			name: EFFECT_LAYER_NAME,
			listening: false,
		});

		const dropShadowLayer = new Konva.Group({
			name: DROP_SHADOW_LAYER_NAME,
			listening: false,
		});

		const fillShape = this._createFillShape();

		const innerShadowLayer = new Konva.Group({
			name: INNER_SHADOW_LAYER_NAME,
			listening: false,
		});

		const strokeShape = this._createStrokeShape();

		effectLayer.add(dropShadowLayer);
		effectLayer.add(fillShape);
		effectLayer.add(innerShadowLayer);
		effectLayer.add(strokeShape);
		group.add(effectLayer);

		const backgroundBlur = new RendererEffectBackgroundBlur(
			(context, commands) => {
				appendShapePath(context, commands);
			},
		);

		backgroundBlur.mount(group);

		this._effectRendererStates.set(group, {
			dropShadows: new Map(),
			innerShadows: new Map(),
			layerBlur: new RendererShapeEffectLayerBlur(),
			backgroundBlur,
		});

		return group;
	}

	public getWorldBounds(node: IShapeBase): Rect {
		let localBounds = node.getLocalViewOBB();
		const sourceBounds = node.getLocalViewOBB();
		const worldMatrix = node.getWorldMatrix();

		for (const effect of node.effectManager.getByType(
			ShapeEffectType.DropShadow,
		)) {
			if (!effect.isVisible() || effect.getOpacity() <= 0) {
				continue;
			}

			const effectState: CanvasDropShadowState = {
				x: effect.getX(),
				y: effect.getY(),
				blur: Math.max(0, effect.getBlur()),
				spread: effect.getSpread(),
				fill: effect.getFill(),
				opacity: Math.max(0, Math.min(1, effect.getOpacity())),
				mode: effect.getMode(),
			};
			const localShadowBounds = getDropShadowRasterBounds(
				sourceBounds,
				effectState,
			);
			localBounds = this._unionRects(localBounds, localShadowBounds);
		}

		localBounds = getLayerBlurRasterBounds(
			localBounds,
			node.effectManager.getByType(ShapeEffectType.LayerBlur),
		);

		return this._transformRectToAABB(localBounds, worldMatrix);
	}

	protected override onUpdate(node: IShapeBase, view: Konva.Group): void {
		const commands = node.toPathCommands();
		const strokeCommands = node.toStrokePathCommands();
		const fillCommands = this._extractClosedFillCommands(commands);
		const fillBounds = node.getLocalOBB();
		const viewBounds = node.getLocalViewOBB();
		const strokePath = node.getStrokePath();
		const effectLayer = this._findOneOrThrow<Konva.Group>(
			view,
			EFFECT_LAYER_SELECTOR,
		);

		const dropShadowLayer = this._findOneOrThrow<Konva.Group>(
			view,
			DROP_SHADOW_LAYER_SELECTOR,
		);

		const innerShadowLayer = this._findOneOrThrow<Konva.Group>(
			view,
			INNER_SHADOW_LAYER_SELECTOR,
		);

		const fillShape = this._findOneOrThrow<Konva.Shape>(
			view,
			FILL_SHAPE_SELECTOR,
		);

		const strokeShape = this._findOneOrThrow<Konva.Shape>(
			view,
			STROKE_SHAPE_SELECTOR,
		);

		const strokeStyle = node.getStrokeStyle();
		const strokeWidths = node.getStrokeWidth();
		const strokeWidth = Math.max(0, strokeWidths[0] ?? 0);

		let strokeStyleProperties: StrokeStyleProperties | null = null;
		let strokePatternPaths: readonly ResolvedStrokePatternPathSegment[] =
			[];

		switch (strokeStyle) {
			case StrokeStyle.Dashed:
				strokeStyleProperties = node.getStrokeStyleProperties(
					StrokeStyle.Dashed,
				);
				break;

			case StrokeStyle.Dotted:
				strokeStyleProperties = node.getStrokeStyleProperties(
					StrokeStyle.Dotted,
				);
				break;

			case StrokeStyle.Custom:
				strokeStyleProperties = node.getStrokeStyleProperties(
					StrokeStyle.Custom,
				);
				break;

			case StrokeStyle.Solid:
				break;
		}

		if (
			(strokeStyle === StrokeStyle.Dashed ||
				strokeStyle === StrokeStyle.Dotted) &&
			strokeStyleProperties &&
			strokeWidth > 0
		) {
			const isDotted = strokeStyle === StrokeStyle.Dotted;
			const length = isDotted
				? EPSILON * 2
				: strokeStyleProperties.length;
			const cap = isDotted
				? StrokeDashCap.Round
				: (strokeStyleProperties as StrokeDashedStyleProperties).cap;

			strokePatternPaths = resolveStrokePatternGeometry(strokeCommands, {
				strokeWidth,
				strokeAlign: node.getStrokeAlign(),
				length,
				gap: strokeStyleProperties.gap,
				cap,
			});
		}

		/*
		 * Fill.
		 *
		 * Важно: используем intrinsic bounds,
		 * а не ViewOBB со stroke.
		 */
		fillShape.setAttrs({
			pathCommands: fillCommands,
			paintBounds: fillBounds,
			fillMode: node.getFillMode(),
			fillValue: node.getFill(),
		});

		/*
		 * Stroke.
		 *
		 * Пока первый элемент StrokeWidth
		 * используется как uniform width.
		 *
		 * [10] -> 10px для всего path.
		 *
		 * [10, 20, ...] добавим позже
		 * как per-segment stroke.
		 */
		strokeShape.setAttrs({
			pathCommands: strokeCommands,
			strokePath,
			strokePatternPaths,
			paintBounds: viewBounds,
			strokeWidths,
			strokeAlign: node.getStrokeAlign(),
			strokeMode: node.getStrokeMode(),
			strokeValue: node.getStrokeFill(),
			strokeStyle,
			strokeStyleProperties,
		});

		const shadowGeometry = this._createShadowGeometry({
			commands: strokeCommands,
			fillCommands,
			fillBounds,
			viewBounds,
			strokePath,
			strokePatternPaths,
			strokeWidth,
			strokeStyle,
			strokeMode: node.getStrokeMode(),
		});

		this._updateEffects(
			node,
			view,
			effectLayer,
			dropShadowLayer,
			innerShadowLayer,
			shadowGeometry,
			fillCommands,
			fillBounds,
		);
	}

	protected override onDestroy(_: IShapeBase, view: Konva.Group): void {
		const state = this._effectRendererStates.get(view);

		if (!state) {
			return;
		}

		for (const renderer of state.dropShadows.values()) {
			renderer.destroy();
		}

		for (const renderer of state.innerShadows.values()) {
			renderer.destroy();
		}

		state.backgroundBlur.destroy();
		state.layerBlur.destroy();

		state.dropShadows.clear();
		state.innerShadows.clear();
		this._effectRendererStates.delete(view);
	}

	/*********************************************************/
	/*                        Effects                        */
	/*********************************************************/

	private _createShadowGeometry(
		input: CreateShadowGeometryInput,
	): CanvasShadowGeometry {
		const strokeAreas: CanvasShadowArea[] = [];
		let fallbackStroke: CanvasShadowGeometry["fallbackStroke"] = null;

		const usesPatternStroke =
			input.strokeStyle === StrokeStyle.Dashed ||
			input.strokeStyle === StrokeStyle.Dotted;

		if (usesPatternStroke) {
			for (const path of input.strokePatternPaths) {
				strokeAreas.push({
					commands: path.commands,
					fillRule: "evenodd",
				});
			}
			for (const area of input.strokePath?.additionalAreas ?? []) {
				if (area.outer.length === 0) {
					continue;
				}

				strokeAreas.push({
					commands: [
						...area.outer,
						...area.inner,
					],
					fillRule: "evenodd",
				});
			}
		} else {
			if (input.strokePath) {
				const areas: readonly ShapeStrokeArea[] = [
					input.strokePath,
					...(input.strokePath.additionalAreas ?? []),
				];

				for (const area of areas) {
					if (area.outer.length === 0) {
						continue;
					}

					strokeAreas.push({
						commands: [
							...area.outer,
							...area.inner,
						],
						fillRule: "evenodd",
					});
				}
			}

			if (
				strokeAreas.length === 0 &&
				input.strokeMode === FillMode.Color &&
				input.strokeWidth > 0 &&
				input.commands.length > 0
			) {
				fallbackStroke = {
					commands: input.commands,
					width: input.strokeWidth,
					lineCap: "butt",
					lineJoin: "miter",
				};
			}
		}

		const hasStroke = strokeAreas.length > 0 || fallbackStroke !== null;
		const bounds = hasStroke ? input.viewBounds : input.fillBounds;
		const signature = JSON.stringify({
			bounds,
			fillCommands: input.fillCommands,
			strokeAreas,
			fallbackStroke,
		});

		return {
			bounds,
			fillCommands: input.fillCommands,
			strokeAreas,
			fallbackStroke,
			signature,
		};
	}

	private _extractClosedFillCommands(
		commands: readonly ShapePathCommand[],
	): readonly ShapePathCommand[] {
		const result: ShapePathCommand[] = [];
		let current: ShapePathCommand[] = [];

		for (const command of commands) {
			if (command.type === "moveTo") {
				current = [command];
				continue;
			}

			if (current.length === 0) {
				continue;
			}

			current.push(command);

			if (command.type !== "closePath") {
				continue;
			}

			result.push(...current);
			current = [];
		}

		return result;
	}

	private _updateEffects(
		node: IShapeBase,
		view: Konva.Group,
		effectLayer: Konva.Group,
		dropShadowLayer: Konva.Group,
		innerShadowLayer: Konva.Group,
		geometry: CanvasShadowGeometry,
		fillCommands: readonly ShapePathCommand[],
		fillBounds: Rect,
	): void {
		let state = this._effectRendererStates.get(view);

		if (!state) {
			state = {
				backgroundBlur: new RendererEffectBackgroundBlur(
					(context, commands) => {
						appendShapePath(context, commands);
					},
				),
				dropShadows: new Map(),
				innerShadows: new Map(),
				layerBlur: new RendererShapeEffectLayerBlur(),
			};

			this._effectRendererStates.set(view, state);
		}

		/*
		 * BackgroundBlur находится снаружи effectLayer.
		 * Он размывает только уже нарисанное содержимое за нодой.
		 */
		const backgroundBlurEffects = node.effectManager.getByType(
			ShapeEffectType.BackgroundBlur,
		);

		state.backgroundBlur.mount(view);
		state.backgroundBlur.update(
			backgroundBlurEffects,
			fillCommands,
			fillBounds,
		);

		const activeDropShadows = new Set<IShapeEffectDropShadow>();
		const activeInnerShadows = new Set<IShapeEffectInnerShadow>();

		for (const effect of node.effectManager.getAll()) {
			switch (effect.type) {
				case ShapeEffectType.DropShadow: {
					activeDropShadows.add(effect);

					let renderer = state.dropShadows.get(effect);

					if (!renderer) {
						renderer = new RendererEffectDropShadow();
						state.dropShadows.set(effect, renderer);
					}

					renderer.mount(dropShadowLayer);
					renderer.getView().moveToTop();
					renderer.update(effect, geometry);
					break;
				}

				case ShapeEffectType.InnerShadow: {
					activeInnerShadows.add(effect);

					let renderer = state.innerShadows.get(effect);

					if (!renderer) {
						renderer = new RendererEffectInnerShadow();
						state.innerShadows.set(effect, renderer);
					}

					renderer.mount(innerShadowLayer);
					renderer.getView().moveToTop();
					renderer.update(effect, geometry);
					break;
				}
			}
		}

		for (const [effect, renderer] of state.dropShadows) {
			if (activeDropShadows.has(effect)) {
				continue;
			}

			renderer.destroy();
			state.dropShadows.delete(effect);
		}

		for (const [effect, renderer] of state.innerShadows) {
			if (activeInnerShadows.has(effect)) {
				continue;
			}

			renderer.destroy();
			state.innerShadows.delete(effect);
		}

		/*
		 * LayerBlur применяется только к effectLayer:
		 * DropShadow + Fill + InnerShadow + Stroke.
		 *
		 * BackgroundBlur сюда намеренно не входит.
		 */
		const layerBlurEffects = node.effectManager.getByType(
			ShapeEffectType.LayerBlur,
		);
		const contentSignature = this._createLayerContentSignature(
			node,
			geometry,
		);

		state.layerBlur.mount(effectLayer);
		state.layerBlur.update(
			layerBlurEffects,
			this._getLayerContentBounds(node, geometry),
			this._resolveRequestedLayerScale(view),
			contentSignature,
		);
	}

	private _getLayerContentBounds(
		node: IShapeBase,
		geometry: CanvasShadowGeometry,
	): Rect {
		let bounds = geometry.bounds;

		for (const effect of node.effectManager.getByType(
			ShapeEffectType.DropShadow,
		)) {
			if (!effect.isVisible() || effect.getOpacity() <= 0) {
				continue;
			}

			bounds = this._unionRects(
				bounds,
				getDropShadowRasterBounds(geometry.bounds, {
					x: effect.getX(),
					y: effect.getY(),
					blur: Math.max(0, effect.getBlur()),
					spread: effect.getSpread(),
					fill: effect.getFill(),
					opacity: Math.max(0, Math.min(1, effect.getOpacity())),
					mode: effect.getMode(),
				}),
			);
		}

		return bounds;
	}

	private _createLayerContentSignature(
		node: IShapeBase,
		geometry: CanvasShadowGeometry,
	): string {
		const effects: unknown[] = [];

		for (const effect of node.effectManager.getAll()) {
			switch (effect.type) {
				case ShapeEffectType.DropShadow:
					effects.push({
						type: effect.type,
						visible: effect.isVisible(),
						x: effect.getX(),
						y: effect.getY(),
						blur: effect.getBlur(),
						spread: effect.getSpread(),
						fill: effect.getFill(),
						opacity: effect.getOpacity(),
						mode: effect.getMode(),
					});
					break;

				case ShapeEffectType.InnerShadow:
					effects.push({
						type: effect.type,
						visible: effect.isVisible(),
						x: effect.getX(),
						y: effect.getY(),
						blur: effect.getBlur(),
						spread: effect.getSpread(),
						fill: effect.getFill(),
						opacity: effect.getOpacity(),
					});
					break;

				default:
					break;
			}
		}

		return JSON.stringify({
			geometry: geometry.signature,
			fillMode: node.getFillMode(),
			fill: node.getFill(),
			strokeMode: node.getStrokeMode(),
			strokeFill: node.getStrokeFill(),
			strokeWidth: node.getStrokeWidth(),
			strokeAlign: node.getStrokeAlign(),
			strokeStyle: node.getStrokeStyle(),
			effects,
		});
	}

	private _resolveRequestedLayerScale(view: Konva.Group): number {
		const pixelRatio = view.getLayer()?.getCanvas().getPixelRatio() ?? 1;
		const absoluteScale = view.getAbsoluteScale();

		return Math.max(
			1,
			pixelRatio *
			Math.max(Math.abs(absoluteScale.x), Math.abs(absoluteScale.y)),
		);
	}

	/*********************************************************/
	/*                         Fill                          */
	/*********************************************************/

	private _createFillShape(): Konva.Shape {
		return new Konva.Shape({
			name: FILL_SHAPE_NAME,
			listening: false,

			sceneFunc: (ctx, shape) => {
				const commands = shape.getAttr("pathCommands") as
					readonly ShapePathCommand[] | undefined;

				if (!commands || commands.length === 0) {
					return;
				}

				const bounds = shape.getAttr("paintBounds") as Rect | undefined;

				if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
					return;
				}

				const fillMode =
					(shape.getAttr("fillMode") as FillMode | undefined) ??
					FillMode.Color;

				const fillValue = String(
					shape.getAttr("fillValue") ?? "#000000",
				);

				ctx.beginPath();

				appendShapePath(ctx, commands);

				this._drawFill(ctx, shape, bounds, fillMode, fillValue);
			},
		});
	}

	/*********************************************************/
	/*                        Stroke                         */
	/*********************************************************/

	private _createStrokeShape(): Konva.Shape {
		return new Konva.Shape({
			name: STROKE_SHAPE_NAME,
			listening: false,

			sceneFunc: (ctx, shape) => {
				const strokeMode =
					(shape.getAttr("strokeMode") as FillMode | undefined) ??
					FillMode.Color;

				const strokeValue = String(
					shape.getAttr("strokeValue") ?? "#000000",
				);

				const strokeStyle =
					(shape.getAttr("strokeStyle") as StrokeStyle | undefined) ??
					StrokeStyle.Solid;

				const strokePath = shape.getAttr("strokePath") as
					ShapeStrokePath | null | undefined;

				if (
					strokeStyle === StrokeStyle.Dashed ||
					strokeStyle === StrokeStyle.Dotted
				) {
					const paths = shape.getAttr("strokePatternPaths") as
						readonly ResolvedStrokePatternPathSegment[] | undefined;

					if (paths && paths.length > 0) {
						ctx.beginPath();

						for (const path of paths) {
							appendShapePath(ctx, path.commands);
						}

						this._drawStrokeArea(
							ctx,
							shape,
							strokeMode,
							strokeValue,
						);
					}

					/*
					 * Ending остаются цельными независимо
					 * от паттерна основной линии.
					 */
					for (const area of strokePath?.additionalAreas ?? []) {
						if (area.outer.length === 0) {
							continue;
						}

						ctx.beginPath();

						appendShapePath(ctx, area.outer);

						if (area.inner.length > 0) {
							appendShapePath(ctx, area.inner);
						}

						this._drawStrokeArea(
							ctx,
							shape,
							strokeMode,
							strokeValue,
						);
					}

					return;
				}

				if (strokePath) {
					const areas: readonly ShapeStrokeArea[] = [
						strokePath,
						...(strokePath.additionalAreas ?? []),
					];

					for (const area of areas) {
						if (area.outer.length === 0) {
							continue;
						}

						ctx.beginPath();

						appendShapePath(ctx, area.outer);

						if (area.inner.length > 0) {
							appendShapePath(ctx, area.inner);
						}

						this._drawStrokeArea(
							ctx,
							shape,
							strokeMode,
							strokeValue,
						);
					}

					return;
				}

				/*
				 * Fallback для Shape, которые пока
				 * не реализуют getStrokePath().
				 *
				 * Gradient stroke здесь пока
				 * невозможен корректно, потому что
				 * у нас нет stroke-area для clipping.
				 */
				if (strokeMode !== FillMode.Color) {
					return;
				}

				const strokeWidths = shape.getAttr("strokeWidths") as
					readonly number[] | undefined;

				if (!strokeWidths || strokeWidths.length === 0) {
					return;
				}

				const width = Math.max(0, strokeWidths[0] ?? 0);

				if (width <= 0) {
					return;
				}

				const commands = shape.getAttr("pathCommands") as
					readonly ShapePathCommand[] | undefined;

				if (!commands || commands.length === 0) {
					return;
				}

				ctx.beginPath();

				appendShapePath(ctx, commands);

				ctx.strokeStyle = strokeValue;

				ctx.lineWidth = width;

				ctx.lineJoin = "miter";

				ctx.lineCap = "butt";

				ctx.stroke();
			},
		});
	}

	private _drawStrokeArea(
		ctx: Konva.Context,
		shape: Konva.Shape,
		strokeMode: FillMode,
		strokeValue: string,
	): void {
		switch (strokeMode) {
			case FillMode.Color:
				ctx.fillStyle = strokeValue;

				ctx.fill("evenodd");

				return;

			case FillMode.LinearGradient:
			case FillMode.RadialGradient:
			case FillMode.ConicGradient:
			case FillMode.DiamondGradient:
			case FillMode.MeshGradient: {
				const bounds = shape.getAttr("paintBounds") as Rect | undefined;

				if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
					return;
				}

				this._drawGradientStroke(
					ctx,
					shape,
					bounds,
					strokeMode,
					strokeValue,
				);

				return;
			}

			default:
				ctx.fillStyle = "#000000";

				ctx.fill("evenodd");
		}
	}

	/*********************************************************/
	/*                         Path                          */
	/*********************************************************/

	private _drawGradientStroke(
		ctx: Konva.Context,
		shape: Konva.Shape,
		bounds: Rect,
		strokeMode: FillMode,
		strokeValue: string,
	): void {
		const gradientPaint = this._getGradientPaint(
			shape,
			strokeMode,
			strokeValue,
		);

		const renderScale = this._resolveGradientRenderScale(
			strokeMode,
			ctx,
			shape,
		);

		ctx.save();

		/*
		 * Текущий path уже содержит:
		 *
		 * outer contour
		 * inner contour
		 *
		 * Поэтому clipping должен быть именно evenodd,
		 * иначе внутренняя область может не стать дыркой.
		 */
		ctx.clip("evenodd");

		ctx.translate(bounds.x, bounds.y);

		gradientPaint.draw(ctx, bounds.width, bounds.height, renderScale);

		ctx.restore();
	}

	/*********************************************************/
	/*                     Fill Drawing                      */
	/*********************************************************/

	private _drawFill(
		ctx: Konva.Context,
		shape: Konva.Shape,
		bounds: Rect,
		fillMode: FillMode,
		fillValue: string,
	): void {
		switch (fillMode) {
			case FillMode.Color:
				ctx.fillStyle = fillValue;

				ctx.fill();
				return;

			case FillMode.LinearGradient:
			case FillMode.RadialGradient:
			case FillMode.ConicGradient:
			case FillMode.DiamondGradient:
			case FillMode.MeshGradient:
				this._drawGradient(ctx, shape, bounds, fillMode, fillValue);
				return;

			default:
				ctx.fillStyle = "#000000";

				ctx.fill();
		}
	}

	private _drawGradient(
		ctx: Konva.Context,
		shape: Konva.Shape,
		bounds: Rect,
		fillMode: FillMode,
		fillValue: string,
	): void {
		const gradientPaint = this._getGradientPaint(
			shape,
			fillMode,
			fillValue,
		);

		const renderScale = this._resolveGradientRenderScale(
			fillMode,
			ctx,
			shape,
		);

		ctx.save();

		ctx.clip();

		ctx.translate(bounds.x, bounds.y);

		gradientPaint.draw(ctx, bounds.width, bounds.height, renderScale);

		ctx.restore();
	}

	private _getGradientPaint(
		shape: Konva.Shape,
		fillMode: FillMode,
		fillValue: string,
	): KonvaGradientPaint {
		const cached = this._gradientPaintCache.get(shape);

		if (
			cached &&
			cached.fillMode === fillMode &&
			cached.fillValue === fillValue
		) {
			return cached.paint;
		}

		const paint = transformTo<KonvaGradientPaint>("konvajs", fillValue);

		this._gradientPaintCache.set(shape, {
			fillMode,
			fillValue,
			paint,
		});

		return paint;
	}

	private _resolveGradientRenderScale(
		fillMode: FillMode,
		ctx: Konva.Context,
		shape: Konva.Shape,
	): number {
		const pixelRatio = ctx.getCanvas().getPixelRatio();

		const absoluteScale = shape.getAbsoluteScale();

		const nodeScale = Math.max(
			Math.abs(absoluteScale.x),
			Math.abs(absoluteScale.y),
		);

		const requestedScale = Math.max(1, pixelRatio * nodeScale);

		switch (fillMode) {
			case FillMode.LinearGradient:
			case FillMode.RadialGradient:
				return requestedScale >= 1.5 ? 2 : 1;

			case FillMode.ConicGradient:
			case FillMode.DiamondGradient:
			case FillMode.MeshGradient:
			default:
				return 1;
		}
	}

	/*********************************************************/
	/*                        Helpers                        */
	/*********************************************************/

	private _transformRectToAABB(bounds: Rect, matrix: Matrix): Rect {
		const points = [
			this._transformPoint(bounds.x, bounds.y, matrix),
			this._transformPoint(bounds.x + bounds.width, bounds.y, matrix),
			this._transformPoint(
				bounds.x + bounds.width,
				bounds.y + bounds.height,
				matrix,
			),
			this._transformPoint(bounds.x, bounds.y + bounds.height, matrix),
		];
		const xs = points.map((point) => point.x);
		const ys = points.map((point) => point.y);
		const minX = Math.min(...xs);
		const minY = Math.min(...ys);
		const maxX = Math.max(...xs);
		const maxY = Math.max(...ys);

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}

	private _transformPoint(
		x: number,
		y: number,
		matrix: Matrix,
	): { x: number; y: number } {
		return {
			x: matrix.a * x + matrix.c * y + matrix.tx,
			y: matrix.b * x + matrix.d * y + matrix.ty,
		};
	}

	private _unionRects(first: Rect, second: Rect): Rect {
		const minX = Math.min(first.x, second.x);
		const minY = Math.min(first.y, second.y);
		const maxX = Math.max(first.x + first.width, second.x + second.width);
		const maxY = Math.max(first.y + first.height, second.y + second.height);

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY,
		};
	}
}
