# CI/CD

## Tests

The [Tests workflow](../.github/workflows/tests.yml) runs on every push to any branch, including `master`, and on pull requests. You can also run it manually from **Actions > Tests > Run workflow**.

It installs dependencies with `npm ci`, runs the Vitest unit tests, checks TypeScript and the production build, and runs the Playwright browser tests in Chromium. Browser setup follows the [Playwright CI instructions](https://playwright.dev/docs/ci). The private comic test is skipped because CI does not have `CBREADER_TEST_CBZ`; the generated-fixture browser tests still run.

Browser reports and failure traces are available in the run's `playwright-report-RUN_NUMBER` artifact for 14 days. This workflow requires no repository secrets.

## Releases

All release APKs are built and signed through the [release workflow](../.github/workflows/release.yml), which you start manually in the GitHub Actions UI. The pipeline builds the selected `master` commit and creates its release tag after the signed APK is verified and uploaded. Local Android builds are for debug development. Git tags are the source of truth for release versions; use stable [SemVer](https://semver.org/) tags such as `v0.1.0`, `v0.1.1`, or `v1.0.0`. Prerelease and build metadata suffixes are not supported by this pipeline.

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

Base64 encoding does not encrypt the keystore; store its encoded value only as a secret. APK building and signing happen in GitHub Actions after this one-time setup.

### Create and build a release

1. Commit and push the release changes to `master`. Ensure its Tests workflow passes.
2. Review existing `v*` tags in GitHub and choose a higher SemVer version: increment patch for fixes, minor for compatible features, or major for breaking changes.
3. Open **Actions > release > Run workflow** in GitHub, select **master**, and enter the new version, such as `0.1.0`, in the **version** field. Omit the `v` prefix.
4. Click **Run workflow**. The pipeline builds the exact `master` commit selected when the run started, then creates and pushes an annotated tag such as `v0.1.0` on that commit.

Create release tags through this pipeline. Keep published tags unchanged. The workflow must be on the default branch (`master`) to appear in the UI. Runs are serialized to avoid conflicting releases. If building, signing, or artifact upload fails, no tag is created and you can retry the same version. If tag pushing fails, the run fails; check repository tag rules and workflow write permissions before retrying.

The workflow validates the new version and signing secrets before building. It passes the release version to Gradle as `releaseVersionName` and calculates `releaseVersionCode` as `major * 1000000 + minor * 1000 + patch + 1`. For example, `v1.2.3` produces version name `1.2.3` and version code `1002004`. This preserves SemVer ordering for [Android updates](https://developer.android.com/studio/publish/versioning). Major is limited to 2099 and minor/patch to 999 to stay within Android's version code limit. Existing versions and versions below the highest stable release tag are rejected. No version bump commits or run-number-based versions are needed.

When the run succeeds, download `cbreader-v0.1.0` (using your tag) from its **Artifacts** section and extract `app-release.apk`. Artifacts are retained for 14 days. The workflow aligns, signs, and verifies the APK using [Android's APK signing tools](https://developer.android.com/tools/apksigner). The workflow requires `contents: write` to push the release tag. It does not publish a GitHub release or upload to Google Play.
