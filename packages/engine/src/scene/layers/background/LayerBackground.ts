import { MathF32 } from "../../../core/math";
import { LayerType, LayerBase } from "../base";
import type {
	ILayerBackground,
	ImageOffset,
	ImagePosition,
	ImageSize,
	PercentValue,
	PixelValue,
} from "./types";

export class LayerBackground extends LayerBase implements ILayerBackground {
	private static readonly DEFAULT_FILL: string = "#1E1E1E";

	private _fill: string;
	private _image: string;

	// Raw user values
	private _imageOpacity: number;

	private _imageWidth: ImageSize;
	private _imageHeight: ImageSize;

	private _imageX: ImagePosition;
	private _imageY: ImagePosition;

	private _imageOffsetX: ImageOffset;
	private _imageOffsetY: ImageOffset;

	constructor() {
		super(LayerType.Background, 0);
		this._fill = LayerBackground.DEFAULT_FILL;
		this._image = "";
		this._imageWidth = "100%";
		this._imageHeight = "100%";
		this._imageX = "50%";
		this._imageY = "50%";

		this._imageOffsetX = 0;
		this._imageOffsetY = 0;

		this._imageOpacity = 1;
	}

	/*****************************************************************/
	/*                              Fill                             */
	/*****************************************************************/

	public getImageOpacity(): number {
		return this._imageOpacity;
	}

	public setImageOpacity(value: number): void {
		const newValue = MathF32.clamp(value, 0, 1);
		if (this._imageOpacity === newValue) {
			return;
		}
		this._imageOpacity = newValue;
	}

	public getFill(): string {
		return this._fill;
	}

	public setFill(value: string): void {
		const newValue = value.trim();

		if (!newValue || newValue === this._fill) {
			return;
		}

		this._fill = newValue;
	}

	/*****************************************************************/
	/*                              Image                            */
	/*****************************************************************/

	public getImage(): string {
		return this._image;
	}

	public setImage(value: string): void {
		if (value === this._image) {
			return;
		}
		this._image = value;
	}

	public getImageWidth(): PixelValue {
		return this._computeImageWidth(this._imageWidth);
	}

	public getImageHeight(): PixelValue {
		return this._computeImageHeight(this._imageHeight);
	}

	public getImageSize(): { width: PixelValue; height: PixelValue } {
		return {
			width: this.getImageWidth(),
			height: this.getImageHeight(),
		};
	}

	public setImageWidth(value: ImageSize): void {
		if (value === this._imageWidth) {
			return;
		}

		this._imageWidth = value;
	}

	public setImageHeight(value: ImageSize): void {
		if (value === this._imageHeight) {
			return;
		}

		this._imageHeight = value;
	}

	public setImageSize(width: ImageSize, height: ImageSize): void {
		const isSame =
			width === this._imageWidth && height === this._imageHeight;

		if (isSame) {
			return;
		}

		this._imageWidth = width;
		this._imageHeight = height;
	}

	public getImageX(): PixelValue {
		return this._computeImageX(this._imageX);
	}

	public getImageY(): PixelValue {
		return this._computeImageY(this._imageY);
	}

	public getImagePosition(): { x: PixelValue; y: PixelValue } {
		return {
			x: this.getImageX(),
			y: this.getImageY(),
		};
	}

	public setImageX(value: ImagePosition): void {
		if (value === this._imageX) {
			return;
		}

		this._imageX = value;
	}

	public setImageY(value: ImagePosition): void {
		if (value === this._imageY) {
			return;
		}

		this._imageY = value;
	}

	public setImagePosition(x: ImagePosition, y: ImagePosition): void {
		const isSame = x === this._imageX && y === this._imageY;

		if (isSame) {
			return;
		}

		this._imageX = x;
		this._imageY = y;
	}

	public override destroy(): void {
		this._fill = LayerBackground.DEFAULT_FILL;
		this._image = "";
		this._imageWidth = 0;
		this._imageHeight = 0;
		this._imageX = 0;
		this._imageY = 0;
		super.destroy();
	}

	public getImageOffsetX(): PixelValue {
		return this._computeImageOffsetX(this._imageOffsetX);
	}

	public getImageOffsetY(): PixelValue {
		return this._computeImageOffsetY(this._imageOffsetY);
	}

	public getImageOffset(): { x: PixelValue; y: PixelValue } {
		return {
			x: this.getImageOffsetX(),
			y: this.getImageOffsetY(),
		};
	}

	public setImageOffsetX(value: ImageOffset): void {
		if (value === this._imageOffsetX) {
			return;
		}

		this._imageOffsetX = value;
	}

	public setImageOffsetY(value: ImageOffset): void {
		if (value === this._imageOffsetY) {
			return;
		}

		this._imageOffsetY = value;
	}

	public setImageOffset(x: ImageOffset, y: ImageOffset): void {
		const isSame = x === this._imageOffsetX && y === this._imageOffsetY;

		if (isSame) {
			return;
		}

		this._imageOffsetX = x;
		this._imageOffsetY = y;
	}

	/*****************************************************************/
	/*                            Private                            */
	/*****************************************************************/

	private _computeImageWidth(value: ImageSize): number {
		return this._resolveSize(value, this.getWidth());
	}

	private _computeImageHeight(value: ImageSize): number {
		return this._resolveSize(value, this.getHeight());
	}

	private _computeImageX(value: ImagePosition): number {
		return this._resolvePosition(value, this.getWidth());
	}

	private _computeImageY(value: ImagePosition): number {
		return this._resolvePosition(value, this.getHeight());
	}

	private _resolveSize(value: ImageSize, base: number): number {
		if (typeof value === "number") {
			return Math.max(0, value);
		}

		return this._resolvePercent(value, base);
	}

	private _resolvePosition(value: ImagePosition, base: number): number {
		if (typeof value === "number") {
			return value;
		}

		return this._resolvePercent(value, base);
	}

	private _computeImageOffsetX(value: ImageOffset): number {
		return this._resolveOffset(value, this.getImageWidth());
	}

	private _computeImageOffsetY(value: ImageOffset): number {
		return this._resolveOffset(value, this.getImageHeight());
	}

	private _resolveOffset(value: ImageOffset, base: number): number {
		if (typeof value === "number") {
			return value;
		}

		return this._resolvePercent(value, base);
	}

	private _resolvePercent(value: PercentValue, base: number): number {
		const numeric = Number.parseFloat(value);

		if (!Number.isFinite(numeric)) {
			return 0;
		}

		return (base * numeric) / 100;
	}
}
