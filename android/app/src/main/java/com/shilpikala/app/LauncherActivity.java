package com.shilpikala.app;

import android.content.pm.ActivityInfo;
import android.os.Build;
import android.os.Bundle;

/**
 * Entry point. All the work (verifying the domain, picking a browser,
 * showing the splash screen, opening the site full screen) is done by
 * android-browser-helper's LauncherActivity, configured from
 * AndroidManifest.xml.
 */
public class LauncherActivity extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Locking orientation on a translucent activity crashes Android 8.0,
        // so only lock it on newer versions. The site itself still follows
        // the manifest's portrait setting.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }
    }
}
