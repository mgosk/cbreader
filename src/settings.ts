export type UserSettings = {
  showTextRegions: boolean;
  defaultZoom: number;
  translationLanguage: string;
};

export const defaultSettings: UserSettings = {
  showTextRegions: true,
  defaultZoom: 100,
  translationLanguage: "",
};

const storageKey = "CBreader.settings";

export function loadSettings(): UserSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return {
      showTextRegions:
        typeof saved?.showTextRegions === "boolean"
          ? saved.showTextRegions
          : defaultSettings.showTextRegions,
      defaultZoom: [100, 125, 150, 175, 200, 225, 250].includes(
        saved?.defaultZoom,
      )
        ? saved.defaultZoom
        : defaultSettings.defaultZoom,
      translationLanguage:
        typeof saved?.translationLanguage === "string" &&
        /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(saved.translationLanguage)
          ? saved.translationLanguage
          : defaultSettings.translationLanguage,
    };
  } catch {
    return { ...defaultSettings };
  }
}

export function saveSettings(settings: UserSettings): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
