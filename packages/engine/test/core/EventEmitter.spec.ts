/**
 * EventEmitter contract.
 *
 * This suite verifies event isolation, listener lifecycle and dispatch
 * semantics without coupling the emitter to its consumers.
 */
import { describe, expect, it } from "vitest";
import { EventEmitter } from "../../src/core";

type TestEvents = {
  message: { id: number; text: string };
  progress: number;
  completed: void;
};

describe("EventEmitter", () => {
  it("delivers each payload only to listeners of its event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const messages: TestEvents["message"][] = [];
    const progress: number[] = [];

    emitter.on("message", (payload) => messages.push(payload));
    emitter.on("progress", (payload) => progress.push(payload));

    const payload = { id: 7, text: "ready" };
    emitter.emit("message", payload);
    emitter.emit("progress", 0.75);

    expect(messages).toEqual([payload]);
    expect(progress).toEqual([0.75]);
  });

  it("calls multiple listeners in registration order", () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on("completed", () => calls.push("first"));
    emitter.on("completed", () => calls.push("second"));
    emitter.on("completed", () => calls.push("third"));

    emitter.emit("completed", undefined);

    expect(calls).toEqual(["first", "second", "third"]);
  });

  it("registers the same listener only once per event", () => {
    const emitter = new EventEmitter<TestEvents>();
    const received: number[] = [];
    const listener = (payload: number): void => {
      received.push(payload);
    };

    emitter.on("progress", listener);
    emitter.on("progress", listener);
    emitter.emit("progress", 1);

    expect(received).toEqual([1]);
  });

  it("returns an idempotent disposer for its listener", () => {
    const emitter = new EventEmitter<TestEvents>();
    const received: number[] = [];
    const dispose = emitter.on("progress", (payload) => received.push(payload));

    emitter.emit("progress", 1);
    dispose();
    dispose();
    emitter.emit("progress", 2);

    expect(received).toEqual([1]);
  });

  it("allows a listener to unsubscribe itself during dispatch", () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];
    let disposeFirst = (): void => undefined;

    disposeFirst = emitter.on("completed", () => {
      calls.push("first");
      disposeFirst();
    });
    emitter.on("completed", () => calls.push("second"));

    emitter.emit("completed", undefined);
    emitter.emit("completed", undefined);

    expect(calls).toEqual(["first", "second", "second"]);
  });

  it("clears every event and accepts new subscriptions afterwards", () => {
    const emitter = new EventEmitter<TestEvents>();
    const calls: string[] = [];

    emitter.on("message", () => calls.push("old message"));
    emitter.on("progress", () => calls.push("old progress"));
    emitter.clear();

    emitter.emit("message", { id: 1, text: "ignored" });
    emitter.emit("progress", 1);
    emitter.on("completed", () => calls.push("new completed"));
    emitter.emit("completed", undefined);

    expect(calls).toEqual(["new completed"]);
  });

  it("ignores emissions for events without listeners", () => {
    const emitter = new EventEmitter<TestEvents>();

    expect(() => emitter.emit("progress", 0.5)).not.toThrow();
  });

  it.todo(
    "dispatches over a stable listener snapshot when subscriptions change",
  );
});
