# Proposed application stack

## Scope and assumption

The initial app implements local imports, page reading, draft preview, text translations, zoom, and saved page progress. Audio is deferred. The speech and persistent content storage choices below describe possible later work.

Build the first version as a browser app for desktop and tablet reading. A user selects a local CBZ containing `translations.json`. The app displays the original pages, lets the user tap text regions to see translated text and and remembers reading progress. The [translation format](translation-format.md) is the content contract. This proposal does not assume a hosted comic library or user accounts.

## Recommended stack

| Area                   | Choice                                          | Role                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App UI                 | React and TypeScript                            | Reader screens, page navigation, translation controls, and typed content models.                                                                                     |
| Build tool             | Vite                                            | Local development and static production build. Run `tsc --noEmit` separately for type checking.                                                                      |
| CBZ reader             | `@zip.js/zip.js`                                | Read the ZIP directory and extract the current page image on demand from a selected CBZ.                                                                             |
| Translation validation | Zod                                             | Validate JSON structure and field ranges at import; add application checks for image paths and unique IDs.                                                           |
| Page rendering         | HTML image plus positioned DOM elements and CSS | Draw the page and tappable rectangles in the same scaled coordinate space. Render translated text with the item's optional `font` and `fontSize`.                    |
| Speech                 | Browser `speechSynthesis` API                   | Deferred; a future implementation could speak `items[].original` in `languages.original`.                                                                            |
| Local data             | IndexedDB                                       | Store book metadata, imported translation JSON, and reading progress keyed by `bookId`. Add optional CBZ storage only if users need a library that survives reloads. |
| Tests                  | Vitest and Playwright                           | Check schema and coordinate logic; exercise import, navigation, tap targets, and zoom in a browser.                                                                  |

Use a static deployment for the reader. A backend is unnecessary for the initial local file workflow. The app can later become an installable offline PWA by caching its own code with a service worker; that alone does not persist user selected CBZ files.

## File and rendering flow

1. Let the user select a CBZ containing its translation JSON through the browser's File API. Accept drag and drop as a convenience.
2. Read the CBZ entry list, filter to supported image types, and load the JSON. Read `translations.json` from that same archive and verify every `pages[].image` path against it. Report missing or duplicate entries before reading.
3. Validate the JSON schema version, language tags, page numbers, region IDs, rectangle bounds, and positive `fontSize` values. Keep filenames as exact archive paths; do not derive them from page numbers.
4. Decode only the current image and nearby pages. Release object URLs and decoded images as pages leave the working set to control memory use.
5. Place tappable regions over the displayed image. Apply the same fit, zoom, and pan transform to both. Show the selected translation on tap. Audio remains deferred.
6. Save progress under `bookId` in IndexedDB. Treat the CBZ as replaceable content; the stable ID preserves progress if its filename changes.

## Boundaries and decisions

- Keep comic images and translation JSON inside the same CBZ, as specified in [translation-format.md](translation-format.md).
- Import content locally in the first version. If the app later hosts books, add a manifest or API for discovery without changing the translation schema.
- Keep OCR and translation authoring outside the reader. A separate authoring tool can produce the same JSON and run the same validation rules.
- Browser storage has quotas and can be cleared, so imported files should remain available for reimport. Decide whether the library should persist whole CBZ files after testing typical book sizes on target devices.
- Speech voices vary by browser and device. Prerecorded audio is the fallback when consistent pronunciation matters.
- Confirm target platforms before implementation. If native mobile distribution or access to a device file library is required, revisit the browser app choice.

## References

- [Vite React and TypeScript templates](https://vite.dev/guide/)
- [Vite TypeScript type checking](https://vite.dev/guide/features.html#typescript)
- [zip.js ZIP reader](https://github.com/gildas-lormeau/zip.js/)
- [Zod validation](https://zod.dev/basics)
- [Browser File API](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Browser storage quotas](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
- [Vitest](https://vitest.dev/guide/) and [Playwright](https://playwright.dev/docs/intro)
