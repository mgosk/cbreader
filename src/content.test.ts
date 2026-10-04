import { describe, expect, it } from "vitest";
import { parseTranslation, matchTranslation } from "./content";
const fixture = () => ({
  schemaVersion: 2,
  bookId: "test-book",
  languages: { original: "en", translations: ["pl", "de"] },
  pages: [
    {
      number: 1,
      image: "001.png",
      items: [
        {
          id: "one",
          kind: "speech",
          order: 1,
          rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.2 },
          original: "Hello",
          translations: { pl: "Cześć", de: "Hallo" },
        },
      ],
    },
  ],
});
describe("translation validation", () => {
  it("matches a complete translation to its actual archive", () => {
    expect(() =>
      matchTranslation(parseTranslation(fixture()), ["001.png"]),
    ).not.toThrow();
  });
  it("rejects boxes outside the image", () => {
    const f = fixture();
    f.pages[0].items[0].rect.width = 1;
    expect(() => parseTranslation(f)).toThrow(/Rectangle/);
  });
  it("rejects repeated region IDs", () => {
    const f = fixture();
    f.pages[0].items.push({ ...f.pages[0].items[0], order: 2 });
    expect(() => parseTranslation(f)).toThrow(/Duplicate text ID/);
  });
  it("rejects missing release pages", () => {
    expect(() =>
      matchTranslation(parseTranslation(fixture()), ["001.png", "002.png"]),
    ).toThrow(/every page/);
  });
  it("accepts sparse drafts but rejects incorrect page mappings", () => {
    const f = { ...fixture(), draft: true };
    f.pages[0].number = 3;
    f.pages[0].image = "003.png";
    const parsed = parseTranslation(f);
    expect(() =>
      matchTranslation(parsed, ["001.png", "002.png", "003.png"]),
    ).not.toThrow();
    expect(() =>
      matchTranslation(parsed, ["001.png", "003.png", "002.png"]),
    ).toThrow(/does not match/);
  });
  it("rejects out-of-order releases and unsupported versions", () => {
    const f = fixture();
    f.pages[0].number = 2;
    expect(() => parseTranslation(f)).toThrow(/consecutive/);
    expect(() => parseTranslation({ ...fixture(), schemaVersion: 3 })).toThrow(
      /Invalid translation/,
    );
  });
});

it("supports several target languages and non-English originals", () => {
  const f = fixture();
  f.languages.original = "fr";
  expect(parseTranslation(f).languages.translations).toEqual(["pl", "de"]);
});
it("rejects duplicate, original, undeclared, and invalid language tags", () => {
  const f = fixture();
  f.languages.translations = ["pl", "pl"];
  expect(() => parseTranslation(f)).toThrow(/unique/);
  f.languages.translations = ["en"];
  expect(() => parseTranslation(f)).toThrow(/unique/);
  f.languages.translations = ["pl"];
  expect(() => parseTranslation(f)).toThrow(/undeclared/);
  f.languages.translations = ["pt_br"];
  expect(() => parseTranslation(f)).toThrow(/canonical/);
});
it("allows missing languages only in drafts", () => {
  const f = fixture();
  f.languages.translations.push("fr");
  expect(() => parseTranslation(f)).toThrow(/every declared/);
  expect(() => parseTranslation({ ...f, draft: true })).not.toThrow();
});
