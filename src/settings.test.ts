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
