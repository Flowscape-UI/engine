/**
 * NodeImage-specific contract.
 *
 * Generic node, shape and rectangle behavior is covered by NodeBase,
 * ShapeBase and NodeRect suites. This suite verifies only image identity,
 * source metadata and fitting state.
 */
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/nodes/base";
import { NodeImage } from "../../src/nodes/rect/image";
import { ImageFit } from "../../src/nodes/rect/image/types";

describe("NodeImage", () => {
  it("creates an image with image-specific identity and defaults", () => {
    const image = new NodeImage(7, "Cover image");

    expect(image.id).toBe(7);
    expect(image.type).toBe(NodeType.Image);
    expect(image.getName()).toBe("Cover image");
    expect(image.getSrc()).toBe("");
    expect(image.getAlt()).toBe("");
    expect(image.getFit()).toBe(ImageFit.Cover);
  });

  it("stores source and alternative text strings", () => {
    const image = new NodeImage("image");

    image.setSrc("https://example.com/image.png");
    image.setAlt("Flowscape canvas preview");

    expect(image.getSrc()).toBe("https://example.com/image.png");
    expect(image.getAlt()).toBe("Flowscape canvas preview");
  });

  it.each(Object.values(ImageFit))("stores the %s fitting mode", (fit) => {
    const image = new NodeImage("image");

    image.setFit(fit);

    expect(image.getFit()).toBe(fit);
  });
});
