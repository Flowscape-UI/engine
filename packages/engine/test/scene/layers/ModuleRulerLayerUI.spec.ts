/**
 * ModuleRulerUI public contract.
 *
 * The small DOM double below exercises the module through attach, update and
 * pointer events without coupling tests to a browser-specific DOM package.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LayerWorld, ModuleRulerUI } from "../../../src/scene/layers";


type FakeListener = EventListenerOrEventListenerObject;

class FakeElement {
  public readonly tagName: string;
  public readonly style = { cssText: "" } as CSSStyleDeclaration;
  public readonly dataset = {} as DOMStringMap;
  public readonly children: FakeElement[] = [];
  public className = "";
  public clientWidth = 0;
  public clientHeight = 0;
  public width = 300;
  public height = 150;

  private readonly _listeners = new Map<string, Set<FakeListener>>();
  private _parent: FakeElement | null = null;

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  public get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  public appendChild(child: FakeElement): FakeElement {
    child.remove();
    child._parent = this;
    this.children.push(child);
    return child;
  }

  public remove(): void {
    if (!this._parent) return;
    const index = this._parent.children.indexOf(this);
    if (index !== -1) this._parent.children.splice(index, 1);
    this._parent = null;
  }

  public addEventListener(type: string, listener: FakeListener): void {
    const listeners = this._listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  public removeEventListener(type: string, listener: FakeListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  public emit(type: string, event: Record<string, unknown>): void {
    const payload = event as unknown as Event;
    for (const listener of this._listeners.get(type) ?? []) {
      if (typeof listener === "function") {
        listener(payload);
      } else {
        listener.handleEvent(payload);
      }
    }
  }

  public closest(selector: string): FakeElement | null {
    if (
      selector === "[data-ruler-guide='true']" &&
      this.dataset["rulerGuide"] === "true"
    ) {
      return this;
    }
    return this._parent?.closest(selector) ?? null;
  }

  public getBoundingClientRect(): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
      toJSON: () => ({}),
    };
  }

  public setPointerCapture(_pointerId: number): void {}

  public releasePointerCapture(_pointerId: number): void {}

  public getContext(_contextId: string): null {
    return null;
  }
}

class FakeWindow {
  public devicePixelRatio = 2;
  private readonly _listeners = new Map<string, Set<FakeListener>>();

  public addEventListener(type: string, listener: FakeListener): void {
    const listeners = this._listeners.get(type) ?? new Set<FakeListener>();
    listeners.add(listener);
    this._listeners.set(type, listeners);
  }

  public removeEventListener(type: string, listener: FakeListener): void {
    this._listeners.get(type)?.delete(listener);
  }

  public emit(type: string, event: Record<string, unknown>): void {
    const payload = event as unknown as Event;
    for (const listener of [...(this._listeners.get(type) ?? [])]) {
      if (typeof listener === "function") {
        listener(payload);
      } else {
        listener.handleEvent(payload);
      }
    }
  }

  public listenerCount(type: string): number {
    return this._listeners.get(type)?.size ?? 0;
  }
}

const createRoot = (width = 800, height = 600): FakeElement => {
  const root = new FakeElement("div");
  root.clientWidth = width;
  root.clientHeight = height;
  return root;
};

const asHTMLElement = (element: FakeElement): HTMLElement =>
  element as unknown as HTMLElement;

const pointerEvent = (
  pointerId: number,
  clientX: number,
  clientY: number,
): Record<string, unknown> => ({
  pointerId,
  clientX,
  clientY,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
});

describe("ModuleRulerUI", () => {
  let fakeWindow: FakeWindow;

  beforeEach(() => {
    fakeWindow = new FakeWindow();
    vi.stubGlobal("HTMLElement", FakeElement);
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", {
      createElement: (tagName: string) => new FakeElement(tagName),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates an enabled ruler with canonical appearance and draw limits", () => {
    const module = new ModuleRulerUI(new LayerWorld());

    expect(module.getType()).toBe(ModuleRulerUI.TYPE);
    expect(module.isEnabled()).toBe(true);
    expect(module.isCornerVisible()).toBe(true);
    expect(module.getThickness()).toBe(22);
    expect(module.getBackground()).toBe("rgba(30,30,30,0.92)");
    expect(module.getTickColor()).toBe("rgba(255,255,255,0.55)");
    expect(module.getTextColor()).toBe("rgba(255,255,255,0.80)");
    expect(module.getFont()).toContain("11px system-ui");
    expect(module.getMinLabelPx()).toBe(110);
    expect(module.getMinTickPx()).toBe(8);
    expect(module.getMinMajorTickPx()).toBe(20);
  });

  it("normalizes public configuration values", () => {
    const module = new ModuleRulerUI(new LayerWorld());

    module.setCornerVisible(false);
    module.setThickness(-10);
    module.setBackground("  #222  ");
    module.setTickColor("  red  ");
    module.setTextColor("  white  ");
    module.setFont("  12px monospace  ");
    module.setMinLabelPx(-1);
    module.setMinTickPx(4.5);
    module.setMinMajorTickPx(16);

    expect(module.isCornerVisible()).toBe(false);
    expect(module.getThickness()).toBe(0);
    expect(module.getBackground()).toBe("#222");
    expect(module.getTickColor()).toBe("red");
    expect(module.getTextColor()).toBe("white");
    expect(module.getFont()).toBe("12px monospace");
    expect(module.getMinLabelPx()).toBe(0);
    expect(module.getMinTickPx()).toBe(4.5);
    expect(module.getMinMajorTickPx()).toBe(16);
  });

  it("attaches one styled portal, supports reattachment and detaches cleanly", () => {
    const module = new ModuleRulerUI(new LayerWorld());
    const firstRoot = createRoot();
    const secondRoot = createRoot();

    module.attach(asHTMLElement(firstRoot));

    const firstPortal = firstRoot.children[0]!;
    const [topWrap, leftWrap, corner] = firstPortal.children;
    expect(firstRoot.children).toHaveLength(1);
    expect(topWrap?.style.left).toBe("22px");
    expect(topWrap?.style.height).toBe("22px");
    expect(leftWrap?.style.top).toBe("22px");
    expect(leftWrap?.style.width).toBe("22px");
    expect(corner?.style.background).toBe("rgba(30,30,30,0.92)");
    expect(fakeWindow.listenerCount("pointerdown")).toBe(1);
    expect(fakeWindow.listenerCount("keydown")).toBe(1);

    module.setThickness(30);
    module.setBackground("navy");
    module.setCornerVisible(false);
    expect(topWrap?.style.left).toBe("30px");
    expect(leftWrap?.style.top).toBe("30px");
    expect(corner?.style.background).toBe("navy");
    expect(corner?.style.display).toBe("none");

    module.attach(asHTMLElement(secondRoot));
    expect(firstRoot.children).toEqual([]);
    expect(secondRoot.children).toHaveLength(1);
    expect(fakeWindow.listenerCount("pointerdown")).toBe(1);

    module.detach();
    expect(secondRoot.children).toEqual([]);
    expect(fakeWindow.listenerCount("pointerdown")).toBe(0);
    expect(fakeWindow.listenerCount("keydown")).toBe(0);
  });

  it("updates visibility and canvas backing sizes from module and root state", () => {
    const module = new ModuleRulerUI(new LayerWorld());
    const root = createRoot(800, 600);
    module.attach(asHTMLElement(root));
    const portal = root.children[0]!;
    const topCanvas = portal.children[0]!.children[0]!;
    const leftCanvas = portal.children[1]!.children[0]!;

    module.update();

    expect(portal.style.display).toBe("block");
    expect(topCanvas.width).toBe(1556);
    expect(topCanvas.height).toBe(44);
    expect(leftCanvas.width).toBe(44);
    expect(leftCanvas.height).toBe(1156);

    module.setEnabled(false);
    module.update();
    expect(portal.style.display).toBe("none");
  });

  it("adds, resolves, removes and clears horizontal and vertical guides", () => {
    const module = new ModuleRulerUI(new LayerWorld());
    const root = createRoot();
    module.attach(asHTMLElement(root));

    expect(module.addGuideForHorizontalRuler(10)).toBe(true);
    expect(module.addGuideForVerticalRuler(20)).toBe(true);

    const horizontal = module.getGuidesHorizontalRuler()[0]!;
    const vertical = module.getGuidesVerticalRuler()[0]!;
    expect(horizontal.getId()).toBe(1);
    expect(horizontal.getValue()).toBe(10);
    expect(vertical.getId()).toBe(2);
    expect(vertical.getValue()).toBe(20);
    expect(module.getGuideHorizontalRulerById(1)).toBe(horizontal);
    expect(module.getGuideVerticalRulerById(2)).toBe(vertical);

    const snapshot = module.getGuidesHorizontalRuler();
    snapshot.length = 0;
    expect(module.getGuidesHorizontalRuler()).toEqual([horizontal]);

    expect(module.removeGuideFromHorizontalRuler(999)).toBe(false);
    expect(module.removeGuideFromHorizontalRuler(1)).toBe(true);
    expect(module.getGuidesHorizontalRuler()).toEqual([]);

    module.clearGuides();
    expect(module.getGuidesVerticalRuler()).toEqual([]);
  });

  it("synchronizes guide visibility, style and camera-projected position", () => {
    const world = new LayerWorld();
    world.setSize(200, 100);
    const module = new ModuleRulerUI(world);
    const root = createRoot();
    module.attach(asHTMLElement(root));
    module.addGuideForHorizontalRuler(10);
    module.addGuideForVerticalRuler(20);

    const horizontal = module.getGuidesHorizontalRuler()[0]!;
    const vertical = module.getGuidesVerticalRuler()[0]!;
    horizontal.setVisible(false);
    vertical.setColor("red");
    vertical.setThickness(4);
    world.camera.setPosition(10, 20);

    module.update();

    const portal = root.children[0]!;
    const horizontalElement = portal.children[3]!;
    const verticalElement = portal.children[4]!;
    expect(horizontalElement.style.display).toBe("none");
    expect(horizontalElement.style.top).toBe("35px");
    expect(verticalElement.style.left).toBe("105px");
    expect(verticalElement.children[0]?.style.background).toBe(
      "rgb(255, 0, 0)",
    );
    expect(verticalElement.children[0]?.style.width).toBe("4px");
  });

  it("creates guides from ruler drags and respects the ruler cancel zone", () => {
    const world = new LayerWorld();
    world.setSize(200, 100);
    const module = new ModuleRulerUI(world);
    const root = createRoot();
    module.attach(asHTMLElement(root));
    const portal = root.children[0]!;
    const topWrap = portal.children[0]!;
    const leftWrap = portal.children[1]!;

    topWrap.emit("pointerdown", pointerEvent(1, 100, 10));
    fakeWindow.emit("pointerup", pointerEvent(1, 100, 80));

    expect(module.getGuidesHorizontalRuler()).toHaveLength(1);
    expect(module.getGuidesHorizontalRuler()[0]?.getValue()).toBe(30);

    leftWrap.emit("pointerdown", pointerEvent(2, 10, 50));
    fakeWindow.emit("pointerup", pointerEvent(2, 150, 50));

    expect(module.getGuidesVerticalRuler()).toHaveLength(1);
    expect(module.getGuidesVerticalRuler()[0]?.getValue()).toBe(50);

    topWrap.emit("pointerdown", pointerEvent(3, 100, 10));
    fakeWindow.emit("pointerup", pointerEvent(3, 100, 20));
    expect(module.getGuidesHorizontalRuler()).toHaveLength(1);
  });

  it("moves a focused guide with the pointer and deletes it from the keyboard", () => {
    const world = new LayerWorld();
    world.setSize(200, 100);
    const module = new ModuleRulerUI(world);
    const root = createRoot();
    module.attach(asHTMLElement(root));
    module.addGuideForVerticalRuler(0);

    const portal = root.children[0]!;
    const guideElement = portal.children[3]!;
    guideElement.emit("pointerdown", pointerEvent(7, 100, 50));
    fakeWindow.emit("pointermove", pointerEvent(7, 130, 50));
    fakeWindow.emit("pointerup", pointerEvent(7, 130, 50));

    expect(module.getGuidesVerticalRuler()[0]?.getValue()).toBe(30);

    const keyEvent = {
      key: "Delete",
      preventDefault: vi.fn(),
    };
    fakeWindow.emit("keydown", keyEvent);

    expect(keyEvent.preventDefault).toHaveBeenCalledOnce();
    expect(module.getGuidesVerticalRuler()).toEqual([]);
  });

  it("clears guides and DOM resources when destroyed", () => {
    const module = new ModuleRulerUI(new LayerWorld());
    const root = createRoot();
    module.attach(asHTMLElement(root));
    module.addGuideForHorizontalRuler(10);
    module.addGuideForVerticalRuler(20);

    module.destroy();

    expect(module.getGuidesHorizontalRuler()).toEqual([]);
    expect(module.getGuidesVerticalRuler()).toEqual([]);
    expect(root.children).toEqual([]);
    expect(fakeWindow.listenerCount("pointerdown")).toBe(0);
    expect(fakeWindow.listenerCount("keydown")).toBe(0);
  });

  it.todo("stores guide state before the ruler is attached to a DOM root");
  it.todo("uses minTickPx and minMajorTickPx when choosing ruler tick steps");
  it.todo("preserves custom guide colors across focus changes");
});
