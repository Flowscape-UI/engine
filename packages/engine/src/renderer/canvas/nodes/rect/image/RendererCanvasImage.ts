import Konva from "konva";
import { RendererCanvasBase } from "../../base";
import { ImageFit, type NodeImage } from "../../../../../nodes";
import { appendShapePath } from "../../..";

const MEDIA_CONTENT_NAME = "media-content";
const MEDIA_CONTENT_SELECTOR = `.${MEDIA_CONTENT_NAME}`;

const IMAGE_NAME = "image-fill";
const IMAGE_SELECTOR = `.${IMAGE_NAME}`;

export class RendererCanvasImage extends RendererCanvasBase<NodeImage> {
	private readonly _cache = new Map<string, HTMLImageElement>();

	public create(node: NodeImage): Konva.Group {
		const group = new Konva.Group({
			id: String(node.id),
		});
		const mediaContent = new Konva.Group({
			name: MEDIA_CONTENT_NAME,
			listening: false,
		});

		const image = new Konva.Image({
			name: IMAGE_NAME,
			listening: false,
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			image: undefined,
		});

		mediaContent.add(image);
		group.add(mediaContent);

		return group;
	}

	protected onUpdate(node: NodeImage, view: Konva.Group): void {
		const mediaContent = this._findOneOrThrow<Konva.Group>(
			view,
			MEDIA_CONTENT_SELECTOR,
		);

		const image = this._findOneOrThrow<Konva.Image>(
			view,
			IMAGE_SELECTOR,
		);

		const width = Math.max(0, node.getWidth());
		const height = Math.max(0, node.getHeight());

		const clipCommands = node.toPathCommands();

		mediaContent.clipFunc((context) => {
			appendShapePath(context, clipCommands);
		});

		image.width(width);
		image.height(height);


		const src = node.getSrc();

		if (!src) {
			image.image(undefined);
			return;
		}

		let htmlImage = this._cache.get(src);

		if (!htmlImage) {
			htmlImage = new window.Image();
			htmlImage.crossOrigin = "anonymous";

			htmlImage.onload = () => {
				this._cache.set(src, htmlImage!);
				this._applyFit(node, image, htmlImage!);
				image.getLayer()?.batchDraw();
			};

			htmlImage.onerror = () => {
				image.image(undefined);
				image.getLayer()?.batchDraw();
			};

			htmlImage.src = src;
		}

		if (htmlImage.complete) {
			this._applyFit(node, image, htmlImage);
		}
	}

	private _applyFit(
		node: NodeImage,
		imageNode: Konva.Image,
		img: HTMLImageElement,
	): void {
		const width = Math.max(1, node.getWidth());
		const height = Math.max(1, node.getHeight());

		const fit = node.getFit();

		const imgRatio = img.width / img.height;
		const boxRatio = width / height;

		let drawWidth = width;
		let drawHeight = height;
		let offsetX = 0;
		let offsetY = 0;

		if (fit === ImageFit.Fill) {
			// просто растягиваем
			drawWidth = width;
			drawHeight = height;
		} else if (fit === ImageFit.Contain) {
			if (imgRatio > boxRatio) {
				drawWidth = width;
				drawHeight = width / imgRatio;
				offsetY = (height - drawHeight) / 2;
			} else {
				drawHeight = height;
				drawWidth = height * imgRatio;
				offsetX = (width - drawWidth) / 2;
			}
		} else if (fit === ImageFit.Cover) {
			if (imgRatio > boxRatio) {
				drawHeight = height;
				drawWidth = height * imgRatio;
				offsetX = (width - drawWidth) / 2;
			} else {
				drawWidth = width;
				drawHeight = width / imgRatio;
				offsetY = (height - drawHeight) / 2;
			}
		}

		imageNode.image(img);
		imageNode.width(drawWidth);
		imageNode.height(drawHeight);
		imageNode.x(offsetX);
		imageNode.y(offsetY);
	}
}
