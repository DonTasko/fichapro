plugins {
    alias(libs.plugins.android.application)
    // AGP 9 inclui suporte Kotlin integrado: não é preciso o plugin org.jetbrains.kotlin.android
}

android {
    namespace = "pt.lappsstudio.fichapro"
    compileSdk = 36

    defaultConfig {
        // ATENÇÃO: o applicationId não pode ser alterado depois da primeira publicação na Play Store.
        applicationId = "pt.lappsstudio.fichapro"
        minSdk = 26 // Android 8.0 (ícone adaptativo; cobre a quase totalidade dos aparelhos ativos)
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"

        val p = project.properties
        manifestPlaceholders["admobAppId"] = p["admobAppId"] as String
        buildConfigField("String", "ADMOB_BANNER_ID", "\"${p["admobBannerId"]}\"")
        buildConfigField("String", "ADMOB_INTERSTITIAL_ID", "\"${p["admobInterstitialId"]}\"")
    }

    buildTypes {
        debug {
            // IDs de teste oficiais da Google (nunca clicar em anúncios reais durante testes)
            manifestPlaceholders["admobAppId"] = "ca-app-pub-3940256099942544~3347511713"
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures { buildConfig = true }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Copia a aplicação web (index.html na raiz do repositório) para dentro da app em cada compilação
val copyWebApp by tasks.registering(Copy::class) {
    from(rootProject.file("../index.html"))
    into(layout.projectDirectory.dir("src/main/assets/www"))
}
tasks.named("preBuild") { dependsOn(copyWebApp) }

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.activity)
    implementation(libs.androidx.webkit)
    implementation(libs.billing)
    implementation(libs.play.services.ads)
}
