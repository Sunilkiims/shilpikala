import java.util.Properties

plugins {
    id("com.android.application")
}

// ---------------------------------------------------------------------------
// App settings — change these here, everything else reads from them.
// ---------------------------------------------------------------------------
val siteHost = "www.shilpikala.com"
val launchUrl = "https://$siteHost/"

// Release signing. Values come from (first match wins):
//   1. environment variables (used by the GitHub Actions workflow)
//   2. android/keystore.properties (local builds; git-ignored)
val keystoreProps = Properties().apply {
    val file = rootProject.file("keystore.properties")
    if (file.exists()) file.inputStream().use { load(it) }
}
fun signingValue(env: String, prop: String): String? =
    System.getenv(env)?.takeIf { it.isNotBlank() } ?: keystoreProps.getProperty(prop)

val releaseStoreFile = signingValue("ANDROID_KEYSTORE_PATH", "storeFile")
val hasReleaseSigning = releaseStoreFile != null && file(releaseStoreFile).exists()

android {
    namespace = "com.shilpikala.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.shilpikala.app"
        minSdk = 23
        targetSdk = 36
        // CI passes the run number so every Play upload gets a higher code.
        versionCode = (System.getenv("VERSION_CODE") ?: "1").toInt()
        versionName = System.getenv("VERSION_NAME") ?: "1.0.0"

        manifestPlaceholders["hostName"] = siteHost
        manifestPlaceholders["launchUrl"] = launchUrl
        resValue("string", "launch_url", launchUrl)
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(releaseStoreFile!!)
                storePassword = signingValue("ANDROID_KEYSTORE_PASSWORD", "storePassword")
                keyAlias = signingValue("ANDROID_KEY_ALIAS", "keyAlias")
                keyPassword = signingValue("ANDROID_KEY_PASSWORD", "keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (hasReleaseSigning) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        resValues = true
    }

    lint {
        // Pure web-wrapper app: keep lint from blocking CI on advisory checks.
        abortOnError = false
    }
}

dependencies {
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.7.3")
}
