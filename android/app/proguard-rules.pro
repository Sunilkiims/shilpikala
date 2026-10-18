# Activities and services are referenced from AndroidManifest.xml, which R8
# already keeps. Keep the browser-helper classes the manifest names by string.
-keep class com.google.androidbrowserhelper.** { *; }
-dontwarn com.google.androidbrowserhelper.**
