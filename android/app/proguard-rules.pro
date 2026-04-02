# Dream Weaver ProGuard Rules

# Keep Capacitor WebView bridge
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.getcapacitor.** { *; }
-keep class com.dreamweaver.app.** { *; }

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Keep RevenueCat
-keep class com.revenuecat.** { *; }
-dontwarn com.revenuecat.**

# Keep AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Preserve line numbers for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static int i(...);
}
