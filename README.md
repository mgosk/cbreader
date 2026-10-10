# CBreader

A local comic reader with multilingual translations. Open a comic, tap a text region to reveal its translation, and keep reading. Comic files stay on your device.

## Open and read a comic

Choose a CBZ with translations included, then select **Start reading**. Draft translations are marked as incomplete; pages without translations remain readable.

- Tap a text region or choose a line in the sidebar to show its translation. Select the target language in the reader controls.
- Turn pages with the toolbar, arrow keys, or swipes at 100% zoom. Swipe left for the next page and right for the previous page.
- Zoom in to read more closely and scroll or drag to pan. Reset zoom to enable page swipes again.
- Use the fullscreen button to focus on the comic. Choose **Exit** or press **Escape** to return.
- Choose **Change comic** to open another book.

Your last page is saved on this device. After restarting or reloading, select the same comic again to resume. Comics are not kept in a persistent library. Audio is not supported.

## Settings

Open **Settings** from the welcome screen or reader controls. Use **Back** or **Escape** to return; the open comic, page, and zoom are preserved.

- **Show text regions by default:** enabled initially.
- **Default zoom:** starts at 100%.
- **Translation timeout (seconds):** wait between translation reveals, initially 15 seconds. Set to 0 to remove the limit. A countdown shows when the next reveal is available. You can always dismiss the current translation.

Settings and your chosen translation language are remembered on this device. Books without your preferred language use their first available translation. If settings cannot be saved, they still apply for the current session. The translation cooldown continues across pages and comics during that session.

## Tablet controls

On touch tablets, the comic fills the screen in portrait or landscape. Tap a blank area to show floating controls; tap again or choose **Hide reading controls** to hide them. Tap text for translations and swipe to turn pages. With a keyboard, press **M** to toggle controls or **Escape** to dismiss them.

## Documentation

- [Development, testing, and web builds](docs/development.md)
- [Translation format and authoring](docs/translation-format.md)
- [Android builds and installation](docs/android-build.md)
- [CI/CD and releases](docs/cicd.md)
- [Technical stack](docs/tech-stack.md)
