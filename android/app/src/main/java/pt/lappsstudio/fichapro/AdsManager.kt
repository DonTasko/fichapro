package pt.lappsstudio.fichapro

import android.app.Activity
import android.view.View
import android.widget.FrameLayout
import com.google.android.gms.ads.AdRequest
import com.google.android.gms.ads.AdSize
import com.google.android.gms.ads.AdView
import com.google.android.gms.ads.FullScreenContentCallback
import com.google.android.gms.ads.LoadAdError
import com.google.android.gms.ads.MobileAds
import com.google.android.gms.ads.interstitial.InterstitialAd
import com.google.android.gms.ads.interstitial.InterstitialAdLoadCallback
import com.google.android.ump.ConsentInformation
import com.google.android.ump.ConsentRequestParameters
import com.google.android.ump.UserMessagingPlatform
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Anúncios AdMob para o plano gratuito: banner no fundo do ecrã e intersticial ocasional
 * (depois de exportar ou imprimir, no máximo de 4 em 4 minutos — controlado no JavaScript).
 * O consentimento (RGPD) é pedido com o User Messaging Platform antes de pedir anúncios.
 */
class AdsManager(private val act: Activity, private val container: FrameLayout) {

    private val consent: ConsentInformation = UserMessagingPlatform.getConsentInformation(act)
    private val sdkStarted = AtomicBoolean(false)
    private var ready = false
    private var enabled = false
    private var banner: AdView? = null
    private var interstitial: InterstitialAd? = null

    private val bannerId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/9214589741" else BuildConfig.ADMOB_BANNER_ID
    private val interstitialId get() = if (BuildConfig.DEBUG) "ca-app-pub-3940256099942544/1033173712" else BuildConfig.ADMOB_INTERSTITIAL_ID

    fun init() {
        consent.requestConsentInfoUpdate(act, ConsentRequestParameters.Builder().build(), {
            UserMessagingPlatform.loadAndShowConsentFormIfRequired(act) { _ ->
                if (consent.canRequestAds()) startSdk()
            }
        }, { _ ->
            if (consent.canRequestAds()) startSdk()
        })
        // consentimento já dado numa sessão anterior: não é preciso esperar
        if (consent.canRequestAds()) startSdk()
    }

    private fun startSdk() {
        if (!sdkStarted.compareAndSet(false, true)) return
        Thread {
            MobileAds.initialize(act) {
                act.runOnUiThread { ready = true; if (enabled) load() }
            }
        }.start()
    }

    /** Chamado pelo JavaScript: true no plano gratuito, false no plano Pro. */
    fun setEnabled(on: Boolean) {
        enabled = on
        if (!on) {
            banner?.destroy(); banner = null
            container.removeAllViews(); container.visibility = View.GONE
            interstitial = null
        } else if (ready) load()
    }

    private fun load() {
        if (!enabled) return
        if (banner == null) {
            val ad = AdView(act)
            ad.adUnitId = bannerId
            val widthDp = (act.resources.displayMetrics.widthPixels / act.resources.displayMetrics.density).toInt()
            ad.setAdSize(AdSize.getCurrentOrientationAnchoredAdaptiveBannerAdSize(act, widthDp))
            container.removeAllViews()
            container.addView(ad)
            container.visibility = View.VISIBLE
            ad.loadAd(AdRequest.Builder().build())
            banner = ad
        }
        if (interstitial == null) loadInterstitial()
    }

    private fun loadInterstitial() {
        InterstitialAd.load(act, interstitialId, AdRequest.Builder().build(), object : InterstitialAdLoadCallback() {
            override fun onAdLoaded(ad: InterstitialAd) { interstitial = ad }
            override fun onAdFailedToLoad(error: LoadAdError) { interstitial = null }
        })
    }

    fun showInterstitial() {
        if (!enabled) return
        val ad = interstitial ?: return
        ad.fullScreenContentCallback = object : FullScreenContentCallback() {
            override fun onAdDismissedFullScreenContent() { interstitial = null; loadInterstitial() }
        }
        ad.show(act)
        interstitial = null
    }

    fun privacyOptionsRequired(): Boolean =
        consent.privacyOptionsRequirementStatus == ConsentInformation.PrivacyOptionsRequirementStatus.REQUIRED

    /** Permite ao utilizador rever o consentimento (obrigatório disponibilizar na UE). */
    fun showPrivacyOptions() = UserMessagingPlatform.showPrivacyOptionsForm(act) { _ -> }

    fun destroy() { banner?.destroy(); banner = null }
}
