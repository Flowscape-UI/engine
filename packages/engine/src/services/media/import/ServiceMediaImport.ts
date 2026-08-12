import {
	MediaImportErrorCode,
	MediaKind,
	type ImportedMedia,
	type MediaImportBatchItem,
	type MediaImportOptions,
	type MediaImportSource,
} from "./types";

type MediaMetadata = {
	width: number;
	height: number;
	duration: number | null;
};

type ResolvedSource = {
	src: string;
	mimeType: string;
	name: string;
	kind: MediaKind;
	ownsObjectUrl: boolean;
};

const EXTENSION_MIME_TYPES: Readonly<Record<string, string>> = {
	avif: "image/avif",
	bmp: "image/bmp",
	gif: "image/gif",
	ico: "image/x-icon",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	png: "image/png",
	svg: "image/svg+xml",
	webp: "image/webp",
	m4v: "video/x-m4v",
	mov: "video/quicktime",
	mp4: "video/mp4",
	ogv: "video/ogg",
	webm: "video/webm",
};

export class MediaImportError extends Error {
	public readonly code: MediaImportErrorCode;

	constructor(code: MediaImportErrorCode, message: string) {
		super(message);
		this.name = "MediaImportError";
		this.code = code;
	}
}

export class ServiceMediaImport {
	public supports(
		source: MediaImportSource,
		options?: MediaImportOptions,
	): boolean {
		try {
			this._resolveMediaKind(source, options?.kind);
			return true;
		} catch {
			return false;
		}
	}

	public async import(
		source: MediaImportSource,
		options?: MediaImportOptions,
	): Promise<ImportedMedia> {
		const resolved = this._resolveSource(source, options);

		try {
			const metadata = await this._loadMetadata(resolved.kind, resolved.src);

			let released = false;
			const release = (): void => {
				if (released) {
					return;
				}

				released = true;
				if (resolved.ownsObjectUrl) {
					globalThis.URL.revokeObjectURL(resolved.src);
				}
			};

			return {
				kind: resolved.kind,
				source,
				src: resolved.src,
				name: resolved.name,
				mimeType: resolved.mimeType,
				width: metadata.width,
				height: metadata.height,
				duration: metadata.duration,
				ownsObjectUrl: resolved.ownsObjectUrl,
				isReleased: () => released,
				release,
			};
		} catch (error) {
			if (resolved.ownsObjectUrl) {
				globalThis.URL.revokeObjectURL(resolved.src);
			}

			throw error;
		}
	}

	public async importMany(
		sources: readonly MediaImportSource[],
		options?: MediaImportOptions,
	): Promise<readonly MediaImportBatchItem[]> {
		return Promise.all(
			sources.map(async (source): Promise<MediaImportBatchItem> => {
				try {
					return {
						status: "fulfilled",
						source,
						media: await this.import(source, options),
					};
				} catch (error) {
					return {
						status: "rejected",
						source,
						error: this._toError(error),
					};
				}
			}),
		);
	}

	private _resolveSource(
		source: MediaImportSource,
		options?: MediaImportOptions,
	): ResolvedSource {
		const kind = this._resolveMediaKind(source, options?.kind);
		const mimeType = this._resolveMimeType(source);
		const name = this._resolveName(source, options?.name, kind);

		if (this._isBlob(source)) {
			if (
				typeof globalThis.URL?.createObjectURL !== "function" ||
				typeof globalThis.URL?.revokeObjectURL !== "function"
			) {
				throw new MediaImportError(
					MediaImportErrorCode.EnvironmentUnavailable,
					"Object URLs are unavailable in this environment.",
				);
			}

			return {
				kind,
				mimeType,
				name,
				src: globalThis.URL.createObjectURL(source),
				ownsObjectUrl: true,
			};
		}

		if (typeof source === "string") {
			return {
				kind,
				mimeType,
				name,
				src: source,
				ownsObjectUrl: false,
			};
		}

		if (source instanceof URL) {
			return {
				kind,
				mimeType,
				name,
				src: source.href,
				ownsObjectUrl: false,
			};
		}

		throw new MediaImportError(
			MediaImportErrorCode.UnsupportedSource,
			"The provided media source is not supported.",
		);
	}

	private _resolveMediaKind(
		source: MediaImportSource,
		explicitKind?: MediaKind,
	): MediaKind {
		const mimeType = this._resolveMimeType(source);
		const inferredKind = this._kindFromMimeType(mimeType);

		if (explicitKind && inferredKind && explicitKind !== inferredKind) {
			throw new MediaImportError(
				MediaImportErrorCode.UnsupportedMediaType,
				`The media source is ${inferredKind}, not ${explicitKind}.`,
			);
		}

		if (explicitKind) {
			return explicitKind;
		}

		if (inferredKind) {
			return inferredKind;
		}

		throw new MediaImportError(
			MediaImportErrorCode.UnsupportedMediaType,
			"Unable to determine whether the source is an image or a video.",
		);
	}

	private _resolveMimeType(source: MediaImportSource): string {
		if (this._isBlob(source) && source.type) {
			return source.type.toLowerCase();
		}

		const value =
			typeof source === "string"
				? source
				: source instanceof URL
					? source.href
					: this._getFileName(source);

		const dataMimeType = /^data:([^;,]+)/i.exec(value)?.[1];
		if (dataMimeType) {
			return dataMimeType.toLowerCase();
		}

		const cleanValue = value.split(/[?#]/, 1)[0] ?? "";
		const extension = cleanValue.split(".").pop()?.toLowerCase() ?? "";

		return EXTENSION_MIME_TYPES[extension] ?? "";
	}

	private _resolveName(
		source: MediaImportSource,
		explicitName: string | undefined,
		kind: MediaKind,
	): string {
		const normalizedName = explicitName?.trim();
		if (normalizedName) {
			return normalizedName;
		}

		const filename = this._getFileName(source).trim();
		if (filename) {
			return filename;
		}

		return kind === MediaKind.Image ? "Image" : "Video";
	}

	private _getFileName(source: MediaImportSource): string {
		if (typeof File !== "undefined" && source instanceof File) {
			return source.name;
		}

		if (this._isBlob(source)) {
			return "";
		}

		const value = typeof source === "string" ? source : source.href;
		if (value.startsWith("data:")) {
			return "";
		}

		const cleanValue = value.split(/[?#]/, 1)[0] ?? "";
		const filename = cleanValue.split("/").pop() ?? "";

		try {
			return decodeURIComponent(filename);
		} catch {
			return filename;
		}
	}

	private _kindFromMimeType(mimeType: string): MediaKind | null {
		if (mimeType.startsWith("image/")) {
			return MediaKind.Image;
		}
		if (mimeType.startsWith("video/")) {
			return MediaKind.Video;
		}
		return null;
	}

	private _isBlob(source: MediaImportSource): source is Blob | File {
		return typeof Blob !== "undefined" && source instanceof Blob;
	}

	private async _loadMetadata(
		kind: MediaKind,
		src: string,
	): Promise<MediaMetadata> {
		if (typeof document === "undefined") {
			throw new MediaImportError(
				MediaImportErrorCode.EnvironmentUnavailable,
				"Media metadata can only be loaded in a browser environment.",
			);
		}

		return kind === MediaKind.Image
			? this._loadImageMetadata(src)
			: this._loadVideoMetadata(src);
	}

	private _loadImageMetadata(src: string): Promise<MediaMetadata> {
		const image = document.createElement("img");

		return new Promise<MediaMetadata>((resolve, reject) => {
			const cleanup = (): void => {
				image.onload = null;
				image.onerror = null;
			};

			image.onload = () => {
				cleanup();
				if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
					reject(this._metadataError(src));
					return;
				}

				resolve({
					width: image.naturalWidth,
					height: image.naturalHeight,
					duration: null,
				});
			};

			image.onerror = () => {
				cleanup();
				reject(this._metadataError(src));
			};

			image.src = src;
		});
	}

	private _loadVideoMetadata(src: string): Promise<MediaMetadata> {
		const video = document.createElement("video");
		video.preload = "metadata";

		return new Promise<MediaMetadata>((resolve, reject) => {
			const cleanup = (): void => {
				video.onloadedmetadata = null;
				video.onerror = null;
			};

			video.onloadedmetadata = () => {
				cleanup();
				if (video.videoWidth <= 0 || video.videoHeight <= 0) {
					reject(this._metadataError(src));
					return;
				}

				resolve({
					width: video.videoWidth,
					height: video.videoHeight,
					duration: Number.isFinite(video.duration) ? video.duration : null,
				});
			};

			video.onerror = () => {
				cleanup();
				reject(this._metadataError(src));
			};

			video.src = src;
		});
	}

	private _metadataError(src: string): MediaImportError {
		return new MediaImportError(
			MediaImportErrorCode.MetadataLoadFailed,
			`Failed to load media metadata from "${src}".`,
		);
	}

	private _toError(error: unknown): Error {
		return error instanceof Error ? error : new Error(String(error));
	}
}