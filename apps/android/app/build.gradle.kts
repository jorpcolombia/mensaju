plugins {
    id("com.android.application")
    kotlin("android")
}

android {
    namespace = "ai.tryatria.messages"
    compileSdk = 34

    defaultConfig {
        applicationId = "ai.tryatria.messages"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "0.0.1"
    }

    buildFeatures {
        compose = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-compose:1.9.2")
    implementation(platform("androidx.compose:compose-bom:2024.09.03"))
    implementation("androidx.compose.material3:material3")

    // Ably Android SDK — realtime subscribe/publish scoped by backend-issued
    // tokens (plan §4): https://github.com/ably/ably-java
    implementation("io.ably:ably-android:1.2.+")

    // Firebase Cloud Messaging — push notifications (plan §11 milestone 7)
    implementation(platform("com.google.firebase:firebase-bom:33.3.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
}
