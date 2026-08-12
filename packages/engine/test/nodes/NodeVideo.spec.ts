/**
 * NodeVideo-specific contract.
 *
 * Generic node, shape, rectangle and image behavior is covered by the base
 * suites. This suite verifies only video playback state and metadata loading.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { NodeType } from "../../src/nodes/base";
import { NodeVideo } from "../../src/nodes/rect/video";

interface FakeVideoElement {
    preload: string;
    src: string;
    duration: number;
    videoWidth: number;
    videoHeight: number;
    onloadedmetadata: (() => void) | null;
    onerror: (() => void) | null;
}

const createFakeVideoElement = (
    duration: number,
    videoWidth: number,
    videoHeight: number,
): FakeVideoElement => ({
    preload: "",
    src: "",
    duration,
    videoWidth,
    videoHeight,
    onloadedmetadata: null,
    onerror: null,
});

const installFakeDocument = (...elements: FakeVideoElement[]): void => {
    let index = 0;

    vi.stubGlobal("document", {
        createElement: vi.fn(() => elements[index++]),
    });
};

const dispatchLoadedMetadata = async (
    element: FakeVideoElement,
): Promise<void> => {
    element.onloadedmetadata?.();
    await Promise.resolve();
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("NodeVideo", () => {
    it("creates a video with video-specific identity and defaults", () => {
        const video = new NodeVideo(7, "Intro");

        expect(video.id).toBe(7);
        expect(video.type).toBe(NodeType.Video);
        expect(video.getName()).toBe("Intro");
        expect(video.getPoster()).toBe("");
        expect(video.isAutoplay()).toBe(false);
        expect(video.isLooping()).toBe(false);
        expect(video.isPaused()).toBe(true);
        expect(video.getPlaybackSpeed()).toBe(1);
        expect(video.getCurrentTime()).toBe(0);
        expect(video.getDuration()).toBe(0);
        expect(video.getCurrentFrame()).toBe(0);
        expect(video.getTotalFrames()).toBe(0);
        expect(video.getVolume()).toBe(0.2);
        expect(video.isMuted()).toBe(false);
    });

    describe("source and metadata", () => {
        it("resets playback state and intrinsic size when the source changes", () => {
            const video = new NodeVideo("video");
            video.setSize(1920, 1080);
            video.play();

            video.setSrc("movie.mp4");

            expect(video.getSrc()).toBe("movie.mp4");
            expect(video.getSize()).toEqual({ width: 0, height: 0 });
            expect(video.getCurrentTime()).toBe(0);
            expect(video.getCurrentFrame()).toBe(0);
            expect(video.getTotalFrames()).toBe(0);
            expect(video.getDuration()).toBe(0);
            expect(video.isPaused()).toBe(true);

            video.setAutoplay(true);
            video.setSize(640, 360);
            video.setSrc("autoplay.mp4");

            expect(video.getSize()).toEqual({ width: 0, height: 0 });
            expect(video.isPaused()).toBe(false);
        });

        it("loads duration and intrinsic size from video metadata", async () => {
            const element = createFakeVideoElement(12.5, 1920, 1080);
            installFakeDocument(element);
            const video = new NodeVideo("video");

            video.setSrc("movie.mp4");

            expect(element.preload).toBe("metadata");
            expect(element.src).toBe("movie.mp4");

            await dispatchLoadedMetadata(element);

            expect(video.getDuration()).toBe(12.5);
            expect(video.getSize()).toEqual({ width: 1920, height: 1080 });
        });

        it("ignores stale metadata when a newer source is pending", async () => {
            const stale = createFakeVideoElement(10, 640, 360);
            const current = createFakeVideoElement(20, 1280, 720);
            installFakeDocument(stale, current);
            const video = new NodeVideo("video");

            video.setSrc("stale.mp4");
            video.setSrc("current.mp4");

            await dispatchLoadedMetadata(stale);
            expect(video.getDuration()).toBe(0);
            expect(video.getSize()).toEqual({ width: 0, height: 0 });

            await dispatchLoadedMetadata(current);
            expect(video.getDuration()).toBe(20);
            expect(video.getSize()).toEqual({ width: 1280, height: 720 });
        });

        it("clamps current time to the loaded duration", async () => {
            const element = createFakeVideoElement(90, 1920, 1080);
            installFakeDocument(element);
            const video = new NodeVideo("video");
            video.setSrc("movie.mp4");
            await dispatchLoadedMetadata(element);

            video.setCurrentTime(-10);
            expect(video.getCurrentTime()).toBe(0);

            video.setCurrentTime(25.5);
            expect(video.getCurrentTime()).toBe(25.5);

            video.setCurrentTime(120);
            expect(video.getCurrentTime()).toBe(90);
        });
    });

    describe("playback", () => {
        it("controls autoplay, looping and paused state", () => {
            const video = new NodeVideo("video");

            video.setAutoplay(true);
            video.setLooping(true);
            expect(video.isAutoplay()).toBe(true);
            expect(video.isLooping()).toBe(true);
            expect(video.isPaused()).toBe(false);

            video.pause();
            expect(video.isPaused()).toBe(true);

            video.play();
            expect(video.isPaused()).toBe(false);
        });

        it("clamps playback speed to its minimum", () => {
            const video = new NodeVideo("video");

            video.setPlaybackSpeed(2);
            expect(video.getPlaybackSpeed()).toBe(2);

            video.setPlaybackSpeed(0);
            expect(video.getPlaybackSpeed()).toBe(0.1);
        });

        it.todo("rejects non-finite time, speed and volume values");

        it.todo("updates current and total frame counters during playback");
    });

    describe("volume", () => {
        it("clamps volume and synchronizes the muted state", () => {
            const video = new NodeVideo("video");

            video.setVolume(2);
            expect(video.getVolume()).toBe(1);
            expect(video.isMuted()).toBe(false);

            video.setVolume(-1);
            expect(video.getVolume()).toBe(0);
            expect(video.isMuted()).toBe(true);

            video.setVolume(0.6);
            expect(video.getVolume()).toBe(0.6);
            expect(video.isMuted()).toBe(false);
        });

        it("restores the last positive volume after muting", () => {
            const video = new NodeVideo("video");
            video.setVolume(0.75);

            video.mute();
            expect(video.getVolume()).toBe(0);
            expect(video.isMuted()).toBe(true);

            video.unmute();
            expect(video.getVolume()).toBe(0.75);
            expect(video.isMuted()).toBe(false);
        });
    });

    it("stores the poster source", () => {
        const video = new NodeVideo("video");

        video.setPoster("poster.webp");

        expect(video.getPoster()).toBe("poster.webp");
    });
});