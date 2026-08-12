export enum MediaKind {
	Image = "image",
	Video = "video",
}

export enum MediaImportErrorCode {
	UnsupportedSource = "unsupported-source",
	UnsupportedMediaType = "unsupported-media-type",
	EnvironmentUnavailable = "environment-unavailable",
	MetadataLoadFailed = "metadata-load-failed",
}

export type MediaImportSource = Blob | File | string | URL;

export type MediaImportOptions = {
	/**
	 * Explicit media kind for sources whose MIME type or file extension does
	 * not identify the resource, such as extensionless URLs.
	 */
	kind?: MediaKind;

	/** Display name used instead of the filename inferred from the source. */
	name?: string;
};

export interface ImportedMedia {
	readonly kind: MediaKind;
	readonly source: MediaImportSource;
	readonly src: string;
	readonly name: string;
	readonly mimeType: string;
	readonly width: number;
	readonly height: number;
	readonly duration: number | null;
	readonly ownsObjectUrl: boolean;

	/** Returns whether release() has already been called. */
	isReleased(): boolean;

	/**
	 * Releases an object URL created for a Blob/File source.
	 * Call only after every renderer has stopped using src.
	 */
	release(): void;
}

export type MediaImportBatchItem =
	| {
			readonly status: "fulfilled";
			readonly source: MediaImportSource;
			readonly media: ImportedMedia;
	  }
	| {
			readonly status: "rejected";
			readonly source: MediaImportSource;
			readonly error: Error;
	  };
