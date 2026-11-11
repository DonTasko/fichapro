package pt.lappsstudio.fichapro

import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * Métodos disponíveis no JavaScript como window.FichaProAndroid.
 * Os métodos assíncronos recebem um "id" e respondem com FichaProNative.resolve(id, json).
 * Nota: estes métodos correm numa thread do WebView; o que mexe na interface passa para a thread principal.
 */
class WebBridge(private val a: MainActivity) {

    @JavascriptInterface
    fun info(): String = JSONObject()
        .put("platform", "android")
        .put("version", BuildConfig.VERSION_NAME)
        .put("debug", BuildConfig.DEBUG)
        .toString()

    @JavascriptInterface
    fun setAds(on: Boolean) = a.runOnUiThread { a.ads.setEnabled(on) }

    @JavascriptInterface
    fun showInterstitial() = a.runOnUiThread { a.ads.showInterstitial() }

    @JavascriptInterface
    fun privacyOptions() = a.runOnUiThread { a.ads.showPrivacyOptions() }

    @JavascriptInterface
    fun privacyOptionsRequired(): Boolean = a.ads.privacyOptionsRequired()

    @JavascriptInterface
    fun manageSubscriptions() = a.runOnUiThread { a.openSubscriptions() }

    @JavascriptInterface
    fun getProducts(id: String) {
        a.billing.getOffers { offers, error ->
            if (error != null) a.reject(id, error) else a.resolve(id, offers)
        }
    }

    @JavascriptInterface
    fun purchase(id: String, basePlanId: String, accountId: String, profileId: String) = a.runOnUiThread {
        a.billing.launch(a, basePlanId, accountId, profileId) { error ->
            if (error != null) a.reject(id, error) else a.resolve(id, true)
        }
    }

    @JavascriptInterface
    fun queryPurchases(id: String) {
        a.billing.queryPurchases { list, error ->
            if (error != null) a.reject(id, error) else a.resolve(id, list)
        }
    }

    @JavascriptInterface
    fun saveFile(id: String, name: String, mime: String, base64: String) = a.runOnUiThread { a.saveFile(id, name, mime, base64) }

    @JavascriptInterface
    fun printHtml(id: String, title: String, html: String) = a.runOnUiThread { a.printHtml(id, title, html) }
}
