# CI/CD

## Tests

The [Tests workflow](../.github/workflows/test.yml) runs on every push to any branch, including `master`, and on pull requests. You can also run it manually from **Actions > Tests > Run workflow**.

It installs dependencies with `npm ci`, runs the Vitest unit tests, checks TypeScript and the production build, and runs the Playwright browser tests in Chromium. Browser setup follows the [Playwright CI instructions](https://playwright.dev/docs/ci). The private comic test is skipped because CI does not have `CBREADER_TEST_CBZ`; the generated-fixture browser tests still run.

Browser reports and failure traces are available in the run's `playwright-report-RUN_NUMBER` artifact for 14 days. This workflow requires no repository secrets.

## Nightly checks

The [nightly workflow](../.github/workflows/nightly.yml) runs every night at 01:17 UTC (02:17 in Warsaw in winter, 03:17 in summer) on `master`. Keep `master` as the default branch: [GitHub schedules run from the default branch](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule), and this workflow restricts scheduled checks to `master`.

To run it manually, open **Actions > nightly > Run workflow**, select the branch in **Use workflow from**, and click **Run workflow**. The nightly and reusable test workflows must exist on that branch; the nightly workflow must also be on the default branch to appear in the UI.

It reuses the Tests workflow for unit tests, TypeScript checks, the production web build, and Chromium browser tests. After tests pass, it builds fresh web assets, syncs Capacitor, and builds an unsigned Android release APK. The workflow uses read-only repository permissions and requires no signing secrets. It creates no tags or published releases and does not upload to Google Play.

Download the unsigned APK from `cbreader-nightly-RUN_NUMBER`; it must be signed before installation. Browser reports and Android build reports are also retained as run artifacts for 14 days, including reports available after failures.

## Releases

All release APKs are built and signed through the [release workflow](../.github/workflows/release.yml), which you start manually in the GitHub Actions UI. The pipeline builds the selected `master` commit, creates its release tag after the signed APK is verified and uploaded, and publishes a GitHub Release with the signed APK attached. Local Android builds are for debug development. Git tags are the source of truth for release versions; use stable [SemVer](https://semver.org/) tags such as `v0.1.0`, `v0.1.1`, or `v1.0.0`. Prerelease and build metadata suffixes are not supported by this pipeline.

Android build reports from `android/build/report/` and `android/build/reports/` are uploaded as `android-build-reports-RUN_NUMBER`, including when the release fails. Reports are retained for 14 days; missing report directories are ignored.

### Signing setup

Reuse your existing release keystore. If this is the first release and you do not have one, create it once with the JDK's `keytool` outside the repository:

```sh
keytool -genkeypair -keystore /path/to/cbreader-release.jks \
  -alias cbreader -keyalg RSA -keysize 2048 -validity 10000
```

Enter the passwords and certificate details when prompted. Keep a backup of the keystore and passwords, and use the same signing key for every release.

Configure these repository secrets under **Settings > Secrets and variables > Actions**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Your release `.jks` keystore encoded as Base64. On Linux, use `base64 -w 0 /path/to/release.jks` and paste the output as the secret. |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password. |
| `ANDROID_KEY_ALIAS` | Alias of the signing key in the keystore. |
| `ANDROID_KEY_PASSWORD` | Signing key password. |

Base64 encoding does not encrypt the keystore; store its encoded value only as a secret. APK building and signing happen in GitHub Actions after this one-time setup. Signing uses [Sign Android release](https://github.com/marketplace/actions/sign-android-release), pinned to the `v1` commit `349ebdef58775b1e0d8099458af0816dc79b6407`, with Build Tools 35.0.0. The action receives the four secrets above; the workflow removes its temporary keystore even if signing fails and uploads only the signed APK.

### Create and build a release

1. Commit and push the release changes to `master`. Ensure its Tests workflow passes.
2. Review existing `v*` tags in GitHub and choose a higher SemVer version: increment patch for fixes, minor for compatible features, or major for breaking changes.
3. Open **Actions > release > Run workflow** in GitHub, select **master**, and enter the new version, such as `0.1.0`, in the **version** field. Omit the `v` prefix.
4. Click **Run workflow**. The pipeline builds the exact `master` commit selected when the run started, then creates and pushes an annotated tag such as `v0.1.0` on that commit. It creates a draft GitHub Release with automatically generated release notes, uploads `CBReader-VERSION.apk` (for example, `CBReader-0.1.0.apk`), and publishes the release as the latest release after the upload succeeds.

Create release tags through this pipeline. Keep published tags unchanged. The workflow must be on the default branch (`master`) to appear in the UI. Runs are serialized to avoid conflicting releases. If building, signing, or artifact upload fails, no tag is created and you can retry the same version. If tag pushing fails, the run fails; check repository tag rules and workflow write permissions before retrying. If release creation, APK upload, or publishing fails after the tag is pushed, the tag remains and there may be a draft release. The version validator rejects existing tags, so finish that release through the GitHub Releases UI: create or edit the draft for the existing tag, attach the signed `CBReader-VERSION.apk` from that exact workflow run if missing, and publish it. Keep the tag on its original commit.

The workflow validates the new version and signing secrets before building. It passes the release version to Gradle as `releaseVersionName` and calculates `releaseVersionCode` as `major * 1000000 + minor * 1000 + patch + 1`. For example, `v1.2.3` produces version name `1.2.3` and version code `1002004`. This preserves SemVer ordering for [Android updates](https://developer.android.com/studio/publish/versioning). Major is limited to 2099 and minor/patch to 999 to stay within Android's version code limit. Existing versions and versions below the highest stable release tag are rejected. No version bump commits or run-number-based versions are needed.

When the run succeeds, open the repository's **Releases** page, select the new release (such as `v0.1.0`), and download the installable `CBReader-0.1.0.apk` from **Assets**. The APK is also available in the workflow run's `cbreader-v0.1.0` artifact (using your tag) for 14 days. Release assets remain available beyond the workflow artifact retention period. The signing action checks APK alignment, signs, and verifies the APK using [Android's APK signing tools](https://developer.android.com/tools/apksigner). The workflow copies the action's `signedReleaseFile` output to `CBReader-VERSION.apk` for upload. The workflow uses the built-in `GITHUB_TOKEN` with `contents: write` to push the tag, create the GitHub Release, and upload its APK asset; no additional publishing secret is needed. APK publishing uses [GitHub CLI](https://cli.github.com/manual/gh_release_create). It does not upload to Google Play or a GitHub Packages registry.
