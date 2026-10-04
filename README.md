# CBreader

A local comic reader built with React, TypeScript and Vite. Open a CBZ containing its multilingual translation JSON, tap text regions, and turn pages with the toolbar or arrow keys. Audio is not implemented.

## Run

```sh
npm install
npm run dev
```

Open the URL printed by Vite. For the existing starter content, select `books/dog-man-01.cbz` after packaging it with the command below. The files are read in your browser. They are not uploaded or bundled into the app.

Draft translations are supported for preview and explicitly marked as incomplete. All archive pages remain readable, including those missing translations. Releases must map every image in archive order. Choose a target language using the reader toolbar. The starter draft currently includes Polish.

The reader saves your last page in IndexedDB using the translation's stable book ID. Select the CBZ again after reloading to resume. It loads page images on demand and releases them when navigating. Zoomed pages can be panned by scrolling. Optional font settings apply to text revealed on the page; the sidebar provides a readable translation at any zoom.

## Checks and production build

```sh
npm test
python3 -m unittest discover -s tests -p 'test_*.py'
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

Deploy `dist/` to a static host. There is no backend, audio, offline service worker, or persistent comic library in this first version.

See [translation format](docs/translation-format.md) and [stack proposal](docs/tech-stack.md).

To also run the real archive check, set `CBREADER_TEST_CBZ` to your packaged `books/dog-man-01.cbz` path when running `npm run test:e2e`. Without it, the tests use generated fixtures and skip the private comic check.

## Package a translation

The reader expects version 2 `translations.json` at the CBZ root. Each item contains an original transcript and a language-keyed map of translations. Editable JSON remains in the project for authoring. Package it using Python 3 (standard library only):

```sh
mkdir -p books
python3 scripts/package_cbz.py \
  "/home/mgosk/code/cb/01 - Dog Man.cbz" \
  translations/dog-man-01.draft.json \
  books/dog-man-01.cbz
```

The command creates a new archive and refuses to overwrite an existing output; choose a new output name for subsequent revisions. Images keep their original paths and order. CBZ files are ignored by Git. Imported JSON is limited to 10 MB decompressed.

## Fullscreen and touch reading

Use the fullscreen button in the reader toolbar to focus on the comic. The page fits the available space at 100% zoom, and translations remain available on tap. Use **Exit** or **Escape** to return. Browsers without fullscreen support use a viewport-filling reading mode; browser chrome may remain visible.

Swipe left for the next page and right for the previous page at 100% zoom. Pages follow your finger, with adjacent images preloaded; release a short drag to snap back, or swipe farther (or flick) to turn. The first and last pages resist overscrolling, and reduced-motion settings disable the settling animation. Vertical gestures scroll, and tapping text reveals its translation. Above 100%, drag to pan; reset zoom to enable page swipes again. Browser pinch zoom is preserved and does not turn pages.

The packaging script also accepts version 1 authoring JSON and migrates it to version 2. Repackage older CBZs to replace the former nested translation entry with root `translations.json`.

## Tablet reading

On touch tablets, opening a book shows only the page, fitted to the screen in portrait or landscape. Tap a blank area to reveal floating controls, then tap again or choose **Hide reading controls** to return to the page. Swipe to turn pages; tap text to reveal a translation. The controls include language, zoom, page selection, and **Change comic**. With a keyboard, press **M** to toggle controls or **Escape** to dismiss them. Phone and desktop layouts retain their usual controls.
