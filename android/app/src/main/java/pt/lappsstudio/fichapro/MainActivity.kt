package pt.lappsstudio.fichapro

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.util.Base64
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Contentor nativo da aplicação web FichaPro.
 * - A app web é servida a partir dos assets em https://appassets.androidplatform.net (origem segura,
 *   necessária para IndexedDB e para os pedidos ao Supabase).
 * - window.FichaProAndroid (WebBridge) dá acesso a: subscrições Google Play, anúncios AdMob,
 *   impressão/PDF e gravação de ficheiros.
 */
class MainActivity : AppCompatActivity() {

    lateinit var web: WebView
        private set
    lateinit var billing: BillingManager
        private set
    lateinit var ads: AdsManager
        private set

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    // <input type="file"> (importação de Excel/CSV, fotografias das fichas, cópias de segurança)
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private val pickFile = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(res.resultCode, res.data))
        fileCallback = null
    }

    // Gravar ficheiros exportados (Excel, CSV, cópias de segurança)
    private var pendingSave: Pair<String, ByteArray>? = null
    private val createDocument = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { res ->
        val pending = pendingSave ?: return@registerForActivityResult
        pendingSave = null
        val uri = res.data?.data
        if (res.resultCode != RESULT_OK || uri == null) {
            reject(pending.first, getString(R.string.save_cancelled)); return@registerForActivityResult
        }
        try {
            contentResolver.openOutputStream(uri)?.use { it.write(pending.second) }
            resolve(pending.first, true)
        } catch (e: Exception) {
            reject(pending.first, e.message ?: getString(R.string.save_error))
        }
    }

    private var printView: WebView? = null // mantém a referência enquanto o trabalho de impressão está ativo

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Ecrã de ponta a ponta (obrigatório a partir do Android 15): respeitar barras do sistema e teclado
        val root = findViewById<android.view.View>(R.id.root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val b = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime())
            v.setPadding(b.left, b.top, b.right, b.bottom)
            WindowInsetsCompat.CONSUMED
        }

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web = findViewById(R.id.web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                assetLoader.shouldInterceptRequest(request.url)

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.host == APP_HOST) return false
                // Links externos (ex.: suporte, política de privacidade) abrem no navegador
                try { startActivity(Intent(Intent.ACTION_VIEW, url)) } catch (_: Exception) {
                    Toast.makeText(this@MainActivity, R.string.no_browser, Toast.LENGTH_SHORT).show()
                }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try { pickFile.launch(params.createIntent()); true } catch (_: Exception) { fileCallback = null; false }
            }
        }

        billing = BillingManager(this) { purchasesJson -> js("FichaProNative.purchases(${JSONObject.quote(purchasesJson)})") }
        billing.start()
        ads = AdsManager(this, findViewById<FrameLayout>(R.id.adContainer))
        ads.init()

        // A interface só existe para a nossa origem: a navegação para outros sites é bloqueada acima
        web.addJavascriptInterface(WebBridge(this), "FichaProAndroid")
        if (savedInstanceState == null) web.loadUrl(START_URL) else web.restoreState(savedInstanceState)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() }
            }
        })
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() { super.onResume(); web.onResume(); billing.refreshPurchases() }
    override fun onPause() { web.onPause(); super.onPause() }
    override fun onDestroy() { billing.end(); ads.destroy(); web.destroy(); super.onDestroy() }

    /* ---------------- Comunicação com o JavaScript ---------------- */
    fun js(code: String) = runOnUiThread { web.evaluateJavascript(code, null) }

    fun resolve(id: String, data: Any?) {
        val payload = JSONObject().put("data", data ?: JSONObject.NULL).toString()
        js("FichaProNative.resolve(${JSONObject.quote(id)}, ${JSONObject.quote(payload)})")
    }

    fun reject(id: String, message: String) {
        val payload = JSONObject().put("error", message).toString()
        js("FichaProNative.resolve(${JSONObject.quote(id)}, ${JSONObject.quote(payload)})")
    }

    /* ---------------- Ficheiros ---------------- */
    fun saveFile(id: String, name: String, mime: String, base64: String) {
        val bytes = try { Base64.decode(base64, Base64.DEFAULT) } catch (e: Exception) { reject(id, "Ficheiro inválido"); return }
        pendingSave?.let { reject(it.first, getString(R.string.save_cancelled)) }
        pendingSave = id to bytes
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = mime.ifBlank { "application/octet-stream" }
            putExtra(Intent.EXTRA_TITLE, name)
        }
        try { createDocument.launch(intent) } catch (e: Exception) { pendingSave = null; reject(id, e.message ?: "Erro") }
    }

    /* ---------------- Impressão / PDF ---------------- */
    @SuppressLint("SetJavaScriptEnabled")
    fun printHtml(id: String, title: String, html: String) {
        val pv = WebView(this)
        pv.settings.javaScriptEnabled = false
        pv.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
                val pm = getSystemService(PRINT_SERVICE) as PrintManager
                val adapter = view.createPrintDocumentAdapter(title)
                pm.print(title, adapter, PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build())
                resolve(id, true)
            }
        }
        printView = pv
        pv.loadDataWithBaseURL("https://$APP_HOST/", html, "text/html", "UTF-8", null)
    }

    fun openSubscriptions() {
        val url = "https://play.google.com/store/account/subscriptions?sku=${BillingManager.PRODUCT_ID}&package=$packageName"
        try { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } catch (_: Exception) {
            Toast.makeText(this, R.string.no_browser, Toast.LENGTH_SHORT).show()
        }
    }

    companion object {
        const val APP_HOST = "appassets.androidplatform.net"
        const val START_URL = "https://$APP_HOST/assets/www/index.html"
    }
}
