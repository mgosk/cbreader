import { afterEach, expect, test, vi } from "vitest";
import { defaultSettings, loadSettings, saveSettings } from "./settings";

afterEach(() => vi.unstubAllGlobals());

test("invalid stored preferences fall back independently", () => {
  vi.stubGlobal("localStorage", {
    getItem: () =>
      JSON.stringify({
        showTextRegions: false,
        defaultZoom: 999,
        translationLanguage: "invalid language",
      }),
  });
  expect(loadSettings()).toEqual({
    ...defaultSettings,
    showTextRegions: false,
  });
});

test("corrupt data and unavailable storage preserve usable defaults", () => {
  vi.stubGlobal("localStorage", { getItem: () => "{" });
  expect(loadSettings()).toEqual(defaultSettings);
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw new Error("Storage blocked");
    },
    setItem: () => {
      throw new Error("Storage blocked");
    },
  });
  expect(loadSettings()).toEqual(defaultSettings);
  expect(saveSettings(defaultSettings)).toBe(false);
});

test("translation timeout accepts saved whole seconds and migrates older settings", () => {
  for (const value of [0, 5, 15, 3600]) {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ translationTimeout: value }),
    });
    expect(loadSettings().translationTimeout).toBe(value);
  }
  for (const value of [undefined, -1, 1.5, 3601, "15", null]) {
    vi.stubGlobal("localStorage", {
      getItem: () => JSON.stringify({ translationTimeout: value }),
    });
    expect(loadSettings().translationTimeout).toBe(15);
  }
});
