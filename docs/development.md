# Development

CBreader uses React, TypeScript, and Vite. The Android app packages the web reader with Capacitor. See the [technical stack](tech-stack.md) for architecture background.

## Local setup

Use Node.js 24, matching the GitHub Actions workflows, and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Select a CBZ containing root `translations.json` to exercise the reader. Comics are read locally and are not uploaded or bundled with the app. See the [translation format](translation-format.md) for archive structure, authoring, and migration of older content.

## Checks

Run unit tests and the type check with production build:

```sh
npm test
npm run build
```

Install Chromium once, then run the browser tests:

```sh
npx playwright install chromium
npm run test:e2e
```

On supported Linux systems that need Chromium system dependencies, use `npx playwright install --with-deps chromium`.

Browser tests use generated CBZ fixtures. To include the optional private comic check, set `CBREADER_TEST_CBZ` to the path of a compatible packaged `books/dog-man-01.cbz`:

```sh
CBREADER_TEST_CBZ=/absolute/path/to/books/dog-man-01.cbz npm run test:e2e
```

Without that variable, the private comic check is skipped. It expects the starter draft with 242 images and three translated pages; an arbitrary comic will not satisfy its assertions. Private comic archives are ignored by Git.

## Production web build

```sh
npm run build
npm run preview
```

The build checks TypeScript and writes production assets to `dist/`. Deploy that directory to a static host. The reader has no backend or offline service worker. It loads page images on demand and releases them when navigating. Reading progress is stored in IndexedDB by stable book ID; user preferences are stored in local storage.

## Android and CI/CD

Follow [Android build instructions](android-build.md) for SDK and JDK setup, debug APK builds, device installation, and troubleshooting. Rebuild the web assets and run `npx cap sync android` before building the native app so the APK includes current code.

Signed releases are built through GitHub Actions. See [CI/CD instructions](cicd.md) for automated checks, nightly artifacts, signing setup, and releases.
