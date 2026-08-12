/**
 * NodePath-specific contract.
 *
 * Shared shape state is covered by ShapeBase. This suite verifies path command
 * ownership, SVG conversion, render-path generation and contour hit testing.
 */
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/nodes/base";
import {
    NodePath,
    PathCommandType,
    type PathCommand,
} from "../../src/nodes/path";

describe("NodePath", () => {
    it("creates an empty path with path identity", () => {
        const path = new NodePath(7, "Icon");

        expect(path.id).toBe(7);
        expect(path.type).toBe(NodeType.Path);
        expect(path.getName()).toBe("Icon");
        expect(path.getSize()).toEqual({ width: 100, height: 100 });
        expect(path.getCommands()).toEqual([]);
        expect(path.toPathCommands()).toEqual([]);
        expect(path.toString()).toBe("");
        expect(path.isClosed()).toBe(false);
    });

    describe("command state", () => {
        it("builds commands, copies their points and closes only once", () => {
            const path = new NodePath("path");
            const move = { x: 0, y: 0 };
            const line = { x: 100, y: 0 };

            path.moveTo(move);
            path.lineTo(line);
            path.quadTo({ x: 100, y: 50 }, { x: 100, y: 100 });
            path.cubicTo({ x: 75, y: 100 }, { x: 25, y: 100 }, { x: 0, y: 100 });
            path.closePath();
            path.closePath();

            move.x = 99;
            line.y = 99;

            const commands = path.getCommands();

            expect(commands).toHaveLength(5);
            expect(commands[0]).toEqual({
                type: PathCommandType.MoveTo,
                to: { x: 0, y: 0 },
            });
            expect(commands[1]).toEqual({
                type: PathCommandType.LineTo,
                to: { x: 100, y: 0 },
            });
            expect(path.isClosed()).toBe(true);

            if (commands[0]?.type === PathCommandType.MoveTo) {
                commands[0].to.x = 77;
            }
            expect(path.getCommands()[0]).toEqual({
                type: PathCommandType.MoveTo,
                to: { x: 0, y: 0 },
            });

            path.clearPath();
            expect(path.getCommands()).toEqual([]);
            expect(path.isClosed()).toBe(false);
        });

        it("copies command arrays provided through setCommands", () => {
            const path = new NodePath("path");
            const commands: PathCommand[] = [
                {
                    type: PathCommandType.MoveTo,
                    to: { x: 10, y: 20 },
                },
            ];

            path.setCommands(commands);
            if (commands[0]?.type === PathCommandType.MoveTo) {
                commands[0].to.x = 99;
            }

            expect(path.getCommands()).toEqual([
                {
                    type: PathCommandType.MoveTo,
                    to: { x: 10, y: 20 },
                },
            ]);
        });
    });

    describe("SVG conversion", () => {
        it("serializes and reconstructs its supported command set", () => {
            const source = "M 0 0 L 20 0 Q 30 10 20 20 C 15 25 5 25 0 20 Z";
            const path = NodePath.fromString("path", source);

            expect(path.toString()).toBe(source);
            expect(
                NodePath.fromString("copy", path.toString()).getCommands(),
            ).toEqual(path.getCommands());
        });

        it("normalizes relative, implicit, horizontal and vertical segments", () => {
            expect(
                NodePath.parseSvgPathToCommands("M 10 10 20 10 h 10 v 20 l -20 0 z"),
            ).toEqual([
                { type: PathCommandType.MoveTo, to: { x: 10, y: 10 } },
                { type: PathCommandType.LineTo, to: { x: 20, y: 10 } },
                { type: PathCommandType.LineTo, to: { x: 30, y: 10 } },
                { type: PathCommandType.LineTo, to: { x: 30, y: 30 } },
                { type: PathCommandType.LineTo, to: { x: 10, y: 30 } },
                { type: PathCommandType.Close },
            ]);
        });

        it("reflects controls for smooth quadratic and cubic curves", () => {
            const commands = NodePath.parseSvgPathToCommands(
                "M 0 0 Q 10 20 20 0 T 40 0 C 50 10 60 10 70 0 S 90 -10 100 0",
            );

            expect(commands[2]).toEqual({
                type: PathCommandType.QuadTo,
                control: { x: 30, y: -20 },
                to: { x: 40, y: 0 },
            });
            expect(commands[4]).toEqual({
                type: PathCommandType.CubicTo,
                control1: { x: 80, y: -10 },
                control2: { x: 90, y: -10 },
                to: { x: 100, y: 0 },
            });
        });

        it("rejects malformed paths and unsupported SVG arcs", () => {
            expect(() => NodePath.parseSvgPathToCommands("M 10")).toThrow(
                "Unexpected end of SVG path",
            );
            expect(() =>
                NodePath.parseSvgPathToCommands("M 0 0 A 10 10 0 0 0 20 20"),
            ).toThrow("SVG arc commands (A/a) are not supported yet");
        });
    });

    describe("render path", () => {
        it("maps source coordinates into the node's local view", () => {
            const path = NodePath.fromString("path", "M 10 20 L 110 20 L 110 70 Z");
            path.setSize(200, 100);

            expect(path.toPathCommands()).toEqual([
                { type: "moveTo", point: { x: 0, y: 0 } },
                { type: "lineTo", point: { x: 200, y: 0 } },
                { type: "lineTo", point: { x: 200, y: 100 } },
                { type: "closePath" },
            ]);
        });

        it("centers a source path with a collapsed axis", () => {
            const path = NodePath.fromString("path", "M 10 0 L 10 100");

            expect(path.toPathCommands()).toEqual([
                { type: "moveTo", point: { x: 50, y: 0 } },
                { type: "lineTo", point: { x: 50, y: 100 } },
            ]);
        });

        it("flattens quadratic and cubic curves into line segments", () => {
            const quadratic = NodePath.fromString(
                "quadratic",
                "M 0 0 Q 50 100 100 0",
            );
            const cubic = NodePath.fromString("cubic", "M 0 0 C 25 100 75 100 100 0");

            expect(quadratic.toPathCommands()).toHaveLength(17);
            expect(quadratic.toPathCommands().at(-1)).toEqual({
                type: "lineTo",
                point: { x: 100, y: 0 },
            });
            expect(cubic.toPathCommands()).toHaveLength(21);
            expect(cubic.toPathCommands().at(-1)).toEqual({
                type: "lineTo",
                point: { x: 100, y: 0 },
            });
        });
    });

    describe("hit testing", () => {
        it("uses closed contours with an even-odd hole", () => {
            const path = NodePath.fromString(
                "path",
                "M 0 0 L 100 0 L 100 100 L 0 100 Z M 25 25 L 75 25 L 75 75 L 25 75 Z",
            );
            path.setPivot(0, 0);
            path.setPosition(10, 20);

            expect(path.hitTest({ x: 20, y: 30 })).toBe(true);
            expect(path.hitTest({ x: 60, y: 70 })).toBe(false);
            expect(path.hitTest({ x: 120, y: 130 })).toBe(false);
        });

        it.todo("includes visible stroke geometry for open and closed contours");
    });
});