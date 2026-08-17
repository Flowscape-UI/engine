/**
 * Enableable contract.
 *
 * EventEmitter owns generic listener behavior. This suite verifies only the
 * enabled-state lifecycle and the protected change hook exposed to subclasses.
 */
import { describe, expect, it } from "vitest";
import { Enableable } from "../../src/core";


class TestEnableable extends Enableable {}

class HookedEnableable extends Enableable {
  public readonly hookValues: boolean[] = [];

  protected override _onEnabledChanged(value: boolean): void {
    this.hookValues.push(value);
    super._onEnabledChanged(value);
  }
}

describe("Enableable", () => {
  it("is enabled by default", () => {
    const enableable = new TestEnableable();

    expect(enableable.isEnabled()).toBe(true);
  });

  it("disables and enables while emitting each changed state", () => {
    const enableable = new TestEnableable();
    const states: boolean[] = [];
    enableable.onChange((state) => states.push(state));

    enableable.disable();
    expect(enableable.isEnabled()).toBe(false);

    enableable.enable();
    expect(enableable.isEnabled()).toBe(true);
    expect(states).toEqual([false, true]);
  });

  it("sets the enabled state directly", () => {
    const enableable = new TestEnableable();
    const states: boolean[] = [];
    enableable.onChange((state) => states.push(state));

    enableable.setEnabled(false);

    expect(enableable.isEnabled()).toBe(false);
    expect(states).toEqual([false]);
  });

  it("does not emit when the requested state is already active", () => {
    const enableable = new TestEnableable();
    const states: boolean[] = [];
    enableable.onChange((state) => states.push(state));

    enableable.enable();
    enableable.setEnabled(true);
    enableable.disable();
    enableable.disable();
    enableable.setEnabled(false);

    expect(states).toEqual([false]);
  });

  it("updates the state before notifying listeners", () => {
    const enableable = new TestEnableable();
    const observations: Array<{ payload: boolean; current: boolean }> = [];

    enableable.onChange((payload) => {
      observations.push({ payload, current: enableable.isEnabled() });
    });

    enableable.disable();

    expect(observations).toEqual([{ payload: false, current: false }]);
  });

  it("returns a disposer that stops change notifications", () => {
    const enableable = new TestEnableable();
    const states: boolean[] = [];
    const dispose = enableable.onChange((state) => states.push(state));

    enableable.disable();
    dispose();
    enableable.enable();

    expect(enableable.isEnabled()).toBe(true);
    expect(states).toEqual([false]);
  });

  it("runs an overridden change hook once per real transition", () => {
    const enableable = new HookedEnableable();
    const states: boolean[] = [];
    enableable.onChange((state) => states.push(state));

    enableable.disable();
    enableable.disable();
    enableable.enable();

    expect(enableable.hookValues).toEqual([false, true]);
    expect(states).toEqual([false, true]);
  });
});
