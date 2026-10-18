# ShilpiKala Android app

The Android app is a **Trusted Web Activity (TWA)**: a real Play Store app
that opens https://www.shilpikala.com full screen, with no browser bar. It
runs on the phone's Chrome engine, so everything on the website works the
same in the app — sign-in, cart, wishlist, Razorpay, UPI apps, order
tracking — and **every website update appears in the app immediately**,
without a new app release.

| | |
| --- | --- |
| App name | ShilpiKala |
| Package | `com.shilpikala.app` (permanent once published) |
| Opens | `https://www.shilpikala.com/` |
| Min / target Android | 6.0 (API 23) / Android 16 (API 36) |
| Extras | Brand splash screen, terracotta status bar, adaptive + themed icon, launcher shortcuts (Shop, Offers, My orders), `www.shilpikala.com` links open in the app |

The website half lives in the main app:
`src/app/manifest.ts` (web app manifest), `public/icons/` (icons) and
`src/app/.well-known/assetlinks.json/route.ts` (the ownership proof Android
checks).

---

## Release, step by step

### 1. Add the signing secrets to GitHub (once)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | contents of `shilpikala-upload.jks.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | the keystore password |
| `ANDROID_KEY_ALIAS` | `shilpikala-upload` |
| `ANDROID_KEY_PASSWORD` | same as the keystore password |

Keep `shilpikala-upload.jks` and its password somewhere safe (a password
manager). It is your **upload key**: if it's ever lost, Google can reset it
for you, but it's a support request.

To make a keystore yourself instead:

```bash
keytool -genkeypair -v -keystore shilpikala-upload.jks -storetype PKCS12 \
  -alias shilpikala-upload -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 shilpikala-upload.jks > shilpikala-upload.jks.base64.txt   # macOS: base64 -i shilpikala-upload.jks
```

### 2. Tell the website about the app

On your hosting (Vercel / server environment), add and redeploy:

```
ANDROID_SHA256_CERT_FINGERPRINTS=<upload key SHA-256>
```

Then open https://www.shilpikala.com/.well-known/assetlinks.json — it should
show `com.shilpikala.app` and the fingerprint. (Until this is set it shows
`[]`, and the app shows a small URL bar at the top instead of running full
screen. Nothing else breaks.)

Optional: `ANDROID_PACKAGE_NAME` if you ever change the package name.

### 3. Build

GitHub → **Actions → Android app → Run workflow** (enter a version name like
`1.0.0`). It also runs automatically when anything in `android/` changes on
`main`. When it finishes, download the artifact from the run page:

- `shilpikala-release.aab` → for Google Play
- `shilpikala-release.apk` → install on your phone to test (allow
  "install unknown apps" for your file manager)

The version code is the workflow run number, so every build can be uploaded.

### 4. Publish on Google Play

1. Create a developer account at https://play.google.com/console (one-time
   US$25).
2. **Create app** → name *ShilpiKala*, type *App*, *Free*.
3. **Test and release → Production (or Internal testing first) → Create
   release** → upload `shilpikala-release.aab`. Accept **Play App Signing**.
4. Fill in the store listing. Ready-made: `store-listing/play-store-icon-512.png`.
   You'll also need a 1024×500 feature graphic and 2+ phone screenshots
   (take them from the installed app).
5. Complete *App content*: privacy policy URL
   `https://www.shilpikala.com/privacy`, data safety (the app itself
   collects nothing; declare what the website collects: name, email, phone,
   address, purchase history; payments handled by Razorpay), target
   audience 18+, no ads (unless you add them).

### 5. Add Google's signing key to the website (important)

Google re-signs your app with its own key. In Play Console go to
**Test and release → App integrity → App signing**, copy **App signing key
certificate → SHA-256**, and add it next to the upload key:

```
ANDROID_SHA256_CERT_FINGERPRINTS=<upload key SHA-256>,<Play app signing SHA-256>
```

Redeploy. Without this, people who install from the Play Store see the URL
bar at the top. Check it with Google's tester:
https://developers.google.com/digital-asset-links/tools/generator
(site `www.shilpikala.com`, package `com.shilpikala.app`).

---

## Building on your own computer (optional)

Open the `android/` folder in Android Studio, or with JDK 17 and the Android
SDK installed:

```bash
cd android
./gradlew assembleDebug                      # debug APK, no key needed
# release: create android/keystore.properties (git-ignored):
#   storeFile=/full/path/shilpikala-upload.jks
#   storePassword=...
#   keyAlias=shilpikala-upload
#   keyPassword=...
./gradlew bundleRelease assembleRelease
```

## Changing things

| To change | Edit |
| --- | --- |
| Domain / start page | `siteHost` in `app/build.gradle.kts` **and** `site` in `app/src/main/res/values/strings.xml` |
| Colours | `app/src/main/res/values/colors.xml` |
| Icon | `app/src/main/res/mipmap-*`, `drawable/ic_launcher_foreground.xml` |
| Splash image | `app/src/main/res/drawable-nodpi/splash.png` |
| Shortcuts | `app/src/main/res/xml/shortcuts.xml` |

## Troubleshooting

- **URL bar visible in the app** → the fingerprint in
  `/.well-known/assetlinks.json` doesn't match the key that signed the
  installed app. Debug builds use a different key; Play installs use
  Google's key (step 5). After fixing, clear Chrome's data or reinstall.
- **Admin pages** (`/admin`) use browser Basic auth and work in the app,
  but are best used from a desktop browser.
