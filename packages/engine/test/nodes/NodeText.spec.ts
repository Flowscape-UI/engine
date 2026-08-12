/**
 * NodeText-specific contract.
 *
 * Generic node and shape behavior is covered by NodeBase and ShapeBase. This
 * suite verifies text state, layout, path generation and glyph hit testing.
 */
import { describe, expect, it } from "vitest";

import { NodeType } from "../../src/nodes/base";
import { NodeText } from "../../src/nodes/text/NodeText";
import {
  FontDecoration,
  FontDecorationUnderlineStyle,
  FontStyle,
  TextAlign,
  TextVerticalAlign,
  TextWrapMode,
} from "../../src/nodes/text/types";

const createText = (value: string = "Text"): NodeText => {
  const text = new NodeText("text");
  text.setText(value);
  return text;
};

const getSingleLineWidth = (value: string, fontSize: number = 16): number => {
  const text = createText(value);
  text.setFontSize(fontSize);
  text.setWrapMode(TextWrapMode.None);

  return text.getLineHitBoxes()[0]!.width;
};

describe("NodeText", () => {
  it("creates text with text-specific identity and defaults", () => {
    const text = new NodeText(7, "Heading");

    expect(text.id).toBe(7);
    expect(text.type).toBe(NodeType.Text);
    expect(text.getName()).toBe("Heading");
    expect(text.getSize()).toEqual({ width: 160, height: 48 });
    expect(text.getText()).toBe("Text");
    expect(text.getFontFamily()).toBe("Inter");
    expect(text.getFontSize()).toBe(NodeText.TEXT_SCALE.base);
    expect(text.getFontWeight()).toBe(NodeText.FONT_WEIGHT.REGULAR);
    expect(text.getFontStyle()).toBe(FontStyle.Normal);
    expect(text.getTextAlign()).toBe(TextAlign.Left);
    expect(text.getVerticalAlign()).toBe(TextVerticalAlign.Top);
    expect(text.getLineHeight()).toBe(1.2);
    expect(text.getLetterSpacing()).toBe(0);
    expect(text.getWrapMode()).toBe(TextWrapMode.Word);
    expect(text.getFontDecoration()).toBe(FontDecoration.None);
    expect(text.getUnderlineStyle()).toBe(FontDecorationUnderlineStyle.Solid);
    expect(text.isUnderlineSkipInk()).toBe(false);
    expect(text.getUnderlineThickness()).toBe(1);
    expect(text.getUnderlineOffset()).toBe(0.2);
  });

  describe("text style", () => {
    it("stores text, font and layout options", () => {
      const text = createText();

      text.setText("Flowscape");
      text.setFontFamily("JetBrains Mono");
      text.setFontStyle(FontStyle.Italic);
      text.setTextAlign(TextAlign.Center);
      text.setVerticalAlign(TextVerticalAlign.Bottom);
      text.setLetterSpacing(2);
      text.setWrapMode(TextWrapMode.Character);

      expect(text.getText()).toBe("Flowscape");
      expect(text.getFontFamily()).toBe("JetBrains Mono");
      expect(text.getFontStyle()).toBe(FontStyle.Italic);
      expect(text.getTextAlign()).toBe(TextAlign.Center);
      expect(text.getVerticalAlign()).toBe(TextVerticalAlign.Bottom);
      expect(text.getLetterSpacing()).toBe(2);
      expect(text.getWrapMode()).toBe(TextWrapMode.Character);
    });

    it("rounds and clamps font size and weight", () => {
      const text = createText();

      text.setFontSize(-20);
      expect(text.getFontSize()).toBe(1);

      text.setFontSize(24);
      expect(text.getFontSize()).toBe(24);

      text.setFontWeight(49);
      expect(text.getFontWeight()).toBe(100);

      text.setFontWeight(449.5);
      expect(text.getFontWeight()).toBe(450);

      text.setFontWeight(1000);
      expect(text.getFontWeight()).toBe(900);
    });

    it("stores decoration options and clamps non-negative metrics", () => {
      const text = createText();

      text.setFontDecoration(FontDecoration.Underline);
      text.setUnderlineStyle(FontDecorationUnderlineStyle.Wavy);
      text.setUnderlineSkipInk(true);
      text.setLineHeight(-1);
      text.setUnderlineThickness(-2);
      text.setUnderlineOffset(-0.25);

      expect(text.getFontDecoration()).toBe(FontDecoration.Underline);
      expect(text.getUnderlineStyle()).toBe(FontDecorationUnderlineStyle.Wavy);
      expect(text.isUnderlineSkipInk()).toBe(true);
      expect(text.getLineHeight()).toBe(0);
      expect(text.getUnderlineThickness()).toBe(0);
      expect(text.getUnderlineOffset()).toBe(-0.25);
    });

    it.todo("rejects non-finite numeric text-style values");

    it.todo(
      "stores underline color as an unparsed string without culori in the model",
    );
  });

  describe("layout", () => {
    it("normalizes line endings and preserves explicit line positions", () => {
      const text = createText("A\r\nB\rC");
      text.setFontSize(10);
      text.setLineHeight(2);
      text.setWrapMode(TextWrapMode.None);

      const boxes = text.getLineHitBoxes();

      expect(boxes).toHaveLength(3);
      expect(boxes.map(({ y }) => y)).toEqual([10, 30, 50]);
      expect(text.toPathCommands()).toHaveLength(6);
    });

    it("keeps explicit blank lines in vertical layout", () => {
      const text = createText("A\n\nB");
      text.setFontSize(10);
      text.setLineHeight(2);
      text.setWrapMode(TextWrapMode.None);

      const boxes = text.getLineHitBoxes();

      expect(boxes).toHaveLength(2);
      expect(boxes[0]!.y).toBe(10);
      expect(boxes[1]!.y).toBe(50);
    });

    it("wraps complete words when another word exceeds the available width", () => {
      const firstWordWidth = getSingleLineWidth("alpha", 10);
      const text = createText("alpha beta");
      text.setFontSize(10);
      text.setSize(firstWordWidth + 0.1, 100);
      text.setWrapMode(TextWrapMode.Word);

      expect(text.getLineHitBoxes()).toHaveLength(2);
      expect(text.toPathCommands()).toHaveLength(4);
    });

    it("splits text by characters in character-wrap mode", () => {
      const characterWidth = getSingleLineWidth("A", 10);
      const text = createText("ABCD");
      text.setFontSize(10);
      text.setSize(characterWidth + 0.1, 100);
      text.setWrapMode(TextWrapMode.Character);

      expect(text.getLineHitBoxes()).toHaveLength(4);
    });

    it("applies horizontal alignment and justification to line boxes", () => {
      const text = createText("AB");
      text.setFontSize(10);
      text.setSize(100, 100);
      text.setWrapMode(TextWrapMode.None);

      const lineWidth = text.getLineHitBoxes()[0]!.width;

      text.setTextAlign(TextAlign.Center);
      expect(text.getLineHitBoxes()[0]!.x).toBeCloseTo(
        (100 - lineWidth) / 2,
        10,
      );

      text.setTextAlign(TextAlign.Right);
      expect(text.getLineHitBoxes()[0]!.x).toBeCloseTo(100 - lineWidth, 10);

      text.setTextAlign(TextAlign.Justify);
      expect(text.getLineHitBoxes()[0]).toMatchObject({ x: 0, width: 100 });
    });

    it("applies center and bottom vertical alignment", () => {
      const text = createText("AB");
      text.setFontSize(10);
      text.setLineHeight(2);
      text.setSize(100, 100);
      text.setWrapMode(TextWrapMode.None);

      text.setVerticalAlign(TextVerticalAlign.Center);
      expect(text.getLineHitBoxes()[0]!.y).toBe(50);

      text.setVerticalAlign(TextVerticalAlign.Bottom);
      expect(text.getLineHitBoxes()[0]!.y).toBe(90);
    });

    it("adds letter spacing to measured line width", () => {
      const text = createText("ABCD");
      text.setWrapMode(TextWrapMode.None);
      const originalWidth = text.getLineHitBoxes()[0]!.width;

      text.setLetterSpacing(3);

      expect(text.getLineHitBoxes()[0]!.width).toBeCloseTo(
        originalWidth + 9,
        10,
      );
    });

    it("returns defensive copies of line hit boxes", () => {
      const text = createText("AB");
      const boxes = text.getLineHitBoxes();

      boxes[0]!.x = 999;

      expect(text.getLineHitBoxes()[0]!.x).toBe(0);
    });

    it("returns no line geometry for empty text", () => {
      const text = createText("");

      expect(text.getLineHitBoxes()).toEqual([]);
      expect(text.toPathCommands()).toEqual([]);
    });
  });

  describe("hit testing", () => {
    it("hits rendered line boxes instead of the entire text node", () => {
      const text = createText("Hi");
      text.setFontSize(10);
      text.setLineHeight(2);
      text.setWrapMode(TextWrapMode.None);
      text.setSize(100, 80);
      text.setPivot(0, 0);
      text.setPosition(50, 70);

      const [box] = text.getLineHitBoxes();
      const inside = {
        x: 50 + box!.x + box!.width / 2,
        y: 70 + box!.y + box!.height / 2,
      };

      expect(text.hitTest(inside)).toBe(true);
      expect(text.hitTest({ x: 140, y: 110 })).toBe(false);
      expect(text.hitTest({ x: 10, y: 10 })).toBe(false);
    });
  });
});
