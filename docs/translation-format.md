# Comic translation format

Version 2 stores all languages in one UTF-8 JSON file named `translations.json` at the **root of the CBZ**. The reader opens the CBZ as a single file. Page images, transcripts, and translations travel together.

## Archive layout

```text
comic.cbz
├── translations.json
└── pages/
    ├── 001.jpg
    └── 002.jpg
```

Image paths may use any directory layout. Copy the actual, case-sensitive archive entry paths into `pages[].image`. The reader requires exactly one root `translations.json`, rejects invalid JSON, and limits its decompressed size to 10 MB.

## Example

```json
{
  "schemaVersion": 2,
  "bookId": "example-comic",
  "languages": {
    "original": "en",
    "translations": ["pl", "de"]
  },
  "pages": [
    {
      "number": 1,
      "image": "pages/001.jpg",
      "items": [
        {
          "id": "p001-01",
          "kind": "speech",
          "order": 1,
          "rect": { "x": 0.12, "y": 0.08, "width": 0.31, "height": 0.16 },
          "original": "Hello!",
          "translations": { "pl": "Cześć!", "de": "Hallo!" },
          "font": "sans-serif",
          "fontSize": 32
        }
      ]
    },
    {
      "number": 2,
      "image": "pages/002.jpg",
      "items": []
    }
  ]
}
```

The dialogue and rectangles above are illustrative.

## Fields

| Field                    | Required | Meaning                                                                                                                    |
| ------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`          | Yes      | Integer `2`.                                                                                                               |
| `draft`                  | No       | `true` permits incomplete pages and missing target translations. Defaults to a release.                                    |
| `bookId`                 | Yes      | Stable ID, unique across books; lowercase letters, digits, and hyphens. Progress uses this ID even if the CBZ is renamed.  |
| `languages.original`     | Yes      | Language of the printed text.                                                                                              |
| `languages.translations` | Yes      | Nonempty ordered list of unique target language tags. The first is selected initially. Must exclude the original language. |
| `pages`                  | Yes      | Pages in archive image-entry order.                                                                                        |
| `pages[].number`         | Yes      | One-based archive page number.                                                                                             |
| `pages[].image`          | Yes      | Exact image entry path relative to the CBZ root.                                                                           |
| `pages[].items`          | Yes      | Text regions; `[]` means a reviewed page without translated text.                                                          |
| `items[].id`             | Yes      | Stable text region ID, unique within the book.                                                                             |
| `items[].kind`           | Yes      | `speech`, `caption`, `sign`, or `sound_effect`.                                                                            |
| `items[].order`          | Yes      | Consecutive one-based reading order within the page.                                                                       |
| `items[].rect`           | Yes      | Tappable rectangle in normalized page coordinates.                                                                         |
| `items[].original`       | Yes      | Nonempty transcript in `languages.original`.                                                                               |
| `items[].translations`   | Yes      | Map from declared target language tags to nonempty translated strings.                                                     |
| `items[].font`           | No       | Preferred font family for revealed text in all target languages; the app falls back when unavailable.                      |
| `items[].fontSize`       | No       | Positive font size in pixels at the original page image size. The app scales it with the image.                            |

Use canonical language tags accepted by the browser's `Intl.getCanonicalLocales`, such as `en`, `pl`, `de`, or `pt-BR`. Tags and map keys must match exactly. Undeclared language keys, duplicate target languages, blank strings, and invalid tags are rejected.

## Completeness and interaction

A release includes every archive image with consecutive page numbers and every declared language in every item's `translations` map. Text-free pages still have `items: []`.

A draft sets `draft: true`. It may omit unfinished pages while preserving their archive numbers, and omit unfinished languages from an item's map. Use an empty map when none of the target translations is prepared. The original transcript remains required. The reader labels drafts, distinguishes missing pages, and displays an explicit message for a missing selected translation. It does not substitute text from another language.

The reader's language selector switches all revealed text, including fullscreen captions, without changing the original transcript or reading progress. Language tags and automatic text direction are applied to the displayed text. Audio is not implemented.

## Coordinates and authoring

`rect` uses the original image as its coordinate system: `(0, 0)` is the top-left corner and `(1, 1)` is the bottom-right. `x` and `y` locate the rectangle; `width` and `height` must be positive. Each coordinate is within `0`–`1`, with `x + width <= 1` and `y + height <= 1`.

Apply the same fit, zoom, and pan transform to the image and tap areas. Give each speech bubble or text region its own item. Set reading order by the intended reading sequence. Verify transcripts, translations, tap areas, and fonts against the images before releasing a book. OCR is an authoring aid; it does not replace review.

## Packaging and migration

Keep editable authoring JSON outside the comic archive. Package it into a CBZ at root `translations.json`, preserving other entries and image order. The reader repository does not include a packaging script or starter comic; see [development instructions](development.md#local-setup) for opening prepared archives locally.

To migrate version 1 JSON, turn `languages.translation` into a one-element `languages.translations` list, move each item's language-specific fields (formerly `en` and `pl`) into `original` and `translations`, remove the obsolete `source` object, and set version `2`. When repackaging, remove the old `translations/en-pl.json` entry and replace any existing root translation entry. The reader requires version 2 at the new root path; old CBZs need repackaging.
