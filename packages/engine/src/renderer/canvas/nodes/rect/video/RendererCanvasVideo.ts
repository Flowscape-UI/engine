import Konva from "konva";
import { RendererCanvasBase } from "../../base";
import { appendShapePath } from "../../../utils";
import { ImageFit, type NodeVideo } from "../../../../../nodes";

const MEDIA_CONTENT_NAME = "media-content";
const MEDIA_CONTENT_SELECTOR = `.${MEDIA_CONTENT_NAME}`;

const VIDEO_NAME = "video-fill";
const VIDEO_SELECTOR = `.${VIDEO_NAME}`;

export class RendererCanvasVideo extends RendererCanvasBase<NodeVideo> {
	private readonly _videoCache = new Map<string, HTMLVideoElement>();
	private readonly _posterCache = new Map<string, HTMLImageElement>();

	public create(node: NodeVideo): Konva.Group {
		const group = new Konva.Group({
			id: String(node.id),
		});

		const mediaContent = new Konva.Group({
			name: MEDIA_CONTENT_NAME,
			listening: false,
		});

		const video = new Konva.Image({
			name: VIDEO_NAME,
			listening: false,
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			image: undefined,
		});

		mediaContent.add(video);
		group.add(mediaContent);

		return group;
	}

	protected onUpdate(node: NodeVideo, view: Konva.Group): void {
		const mediaContent = this._findOneOrThrow<Konva.Group>(
			view,
			MEDIA_CONTENT_SELECTOR,
		);
		const videoShape = this._findOneOrThrow<Konva.Image>(
			view,
			VIDEO_SELECTOR,
		);

		const clipCommands = node.toPathCommands();

		mediaContent.clipFunc((context) => {
			appendShapePath(context, clipCommands);
		});

		const width = Math.max(0, node.getWidth());
		const height = Math.max(0, node.getHeight());

		videoShape.width(width);
		videoShape.height(height);

		const src = node.getSrc();
		const poster = node.getPoster();

		if (!src) {
			if (poster) {
				this._applyPoster(node, videoShape, poster);
			} else {
				videoShape.image(undefined);
			}
			return;
		}

		let video = this._videoCache.get(src);

		if (!video) {
			video = document.createElement("video");
			video.src = src;
			video.crossOrigin = "anonymous";
			video.preload = "auto";
			video.playsInline = true;
			video.muted = node.isMuted();
			video.loop = node.isLooping();
			video.autoplay = node.isAutoplay();
			video.playbackRate = node.getPlaybackSpeed();
			video.volume = node.isMuted() ? 0 : node.getVolume();

			video.onloadeddata = () => {
				this._applyFit(node, videoShape, video!);
				videoShape.getLayer()?.batchDraw();
			};

			video.ontimeupdate = () => {
				node.setCurrentTime(video!.currentTime);
				videoShape.getLayer()?.batchDraw();
			};

			video.onended = () => {
				node.pause();
				videoShape.getLayer()?.batchDraw();
			};

			video.onerror = () => {
				if (poster) {
					this._applyPoster(node, videoShape, poster);
				} else {
					videoShape.image(undefined);
					videoShape.getLayer()?.batchDraw();
				}
			};

			this._videoCache.set(src, video);
		}

		this._syncVideoState(node, video);

		if (video.readyState >= 2) {
			this._applyFit(node, videoShape, video);
			videoShape.image(video);

			const layer = videoShape.getLayer();
			if (layer) {
				layer.batchDraw();
			}
		} else if (poster) {
			this._applyPoster(node, videoShape, poster);
		} else {
			videoShape.image(undefined);
		}
	}

	private _syncVideoState(node: NodeVideo, video: HTMLVideoElement): void {
		video.loop = node.isLooping();
		video.autoplay = node.isAutoplay();
		video.playbackRate = node.getPlaybackSpeed();
		video.muted = node.isMuted();
		video.volume = node.isMuted() ? 0 : node.getVolume();

		const targetTime = node.getCurrentTime();

		if (node.isPaused()) {
			if (
				Number.isFinite(targetTime) &&
				Math.abs(video.currentTime - targetTime) > 0.05
			) {
				try {
					video.currentTime = targetTime;
				} catch {
					// ignore
				}
			}

			if (!video.paused) {
				video.pause();
			}
			return;
		}

		// playing: не трогаем currentTime, иначе будет дёрганье/откат
		if (video.paused) {
			void video.play().catch(() => {
				// не делай node.pause() здесь
			});
		}

		// можно обновлять node-time плавно
		node.setCurrentTime(video.currentTime);
	}

	private _applyPoster(
		node: NodeVideo,
		videoShape: Konva.Image,
		posterSrc: string,
	): void {
		let poster = this._posterCache.get(posterSrc);

		if (!poster) {
			poster = new window.Image();
			poster.crossOrigin = "anonymous";

			poster.onload = () => {
				this._posterCache.set(posterSrc, poster!);
				this._applyFit(node, videoShape, poster!);
				videoShape.getLayer()?.batchDraw();
			};

			poster.onerror = () => {
				videoShape.image(undefined);
				videoShape.getLayer()?.batchDraw();
			};

			poster.src = posterSrc;
		}

		if (poster.complete) {
			this._applyFit(node, videoShape, poster);
		}
	}

	private _applyFit(
		node: NodeVideo,
		imageNode: Konva.Image,
		source: CanvasImageSource & {
			width?: number;
			height?: number;
			videoWidth?: number;
			videoHeight?: number;
		},
	): void {
		const boxWidth = Math.max(1, node.getWidth());
		const boxHeight = Math.max(1, node.getHeight());

		const fit = node.getFit();

		const sourceWidth =
			"videoWidth" in source && source.videoWidth
				? source.videoWidth
				: (source.width ?? 1);

		const sourceHeight =
			"videoHeight" in source && source.videoHeight
				? source.videoHeight
				: (source.height ?? 1);

		const sourceRatio = sourceWidth / sourceHeight;
		const boxRatio = boxWidth / boxHeight;

		let drawWidth = boxWidth;
		let drawHeight = boxHeight;
		let offsetX = 0;
		let offsetY = 0;

		if (fit === ImageFit.Fill) {
			drawWidth = boxWidth;
			drawHeight = boxHeight;
		} else if (fit === ImageFit.Contain) {
			if (sourceRatio > boxRatio) {
				drawWidth = boxWidth;
				drawHeight = boxWidth / sourceRatio;
				offsetY = (boxHeight - drawHeight) / 2;
			} else {
				drawHeight = boxHeight;
				drawWidth = boxHeight * sourceRatio;
				offsetX = (boxWidth - drawWidth) / 2;
			}
		} else if (fit === ImageFit.None) {
			drawWidth = sourceWidth;
			drawHeight = sourceHeight;
			offsetX = 0;
			offsetY = 0;
		} else {
			// Cover
			if (sourceRatio > boxRatio) {
				drawHeight = boxHeight;
				drawWidth = boxHeight * sourceRatio;
				offsetX = (boxWidth - drawWidth) / 2;
			} else {
				drawWidth = boxWidth;
				drawHeight = boxWidth / sourceRatio;
				offsetY = (boxHeight - drawHeight) / 2;
			}
		}

		imageNode.image(source);
		imageNode.width(drawWidth);
		imageNode.height(drawHeight);
		imageNode.x(offsetX);
		imageNode.y(offsetY);
	}
}
