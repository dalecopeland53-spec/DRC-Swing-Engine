plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.dalecopeland.drcswingengine"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.dalecopeland.drcswingengine"
        minSdk = 30
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    buildFeatures { compose = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.10.1")
    implementation("androidx.wear.compose:compose-material3:1.0.0-alpha34")
    implementation("androidx.wear.compose:compose-foundation:1.4.1")
    implementation("com.google.android.gms:play-services-wearable:19.0.0")
}
