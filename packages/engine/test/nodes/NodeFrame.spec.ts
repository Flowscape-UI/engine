/**
 * NodeFrame-specific contract.
 *
 * Generic node, shape and rectangle behavior is covered by NodeBase,
 * ShapeBase and NodeRect suites. This suite verifies only frame identity and
 * content clipping state.
 */
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/nodes/base";
import { NodeFrame } from "../../src/nodes/rect/frame";

describe("NodeFrame", () => {
  it("creates a frame with frame-specific identity and clipping enabled", () => {
    const frame = new NodeFrame(7, "Viewport");

    expect(frame.id).toBe(7);
    expect(frame.type).toBe(NodeType.Frame);
    expect(frame.getName()).toBe("Viewport");
    expect(frame.getClipsContent()).toBe(true);
  });

  it("toggles content clipping", () => {
    const frame = new NodeFrame("frame");

    frame.setClipsContent(false);
    expect(frame.getClipsContent()).toBe(false);

    frame.setClipsContent(true);
    expect(frame.getClipsContent()).toBe(true);
  });
});
