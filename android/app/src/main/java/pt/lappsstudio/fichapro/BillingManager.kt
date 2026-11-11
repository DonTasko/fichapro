package pt.lappsstudio.fichapro

import android.app.Activity
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.widget.Toast
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.PendingPurchasesParams
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import org.json.JSONArray
import org.json.JSONObject

/**
 * Subscrições Google Play (Play Billing Library 9).
 *
 * Produto na Play Console: subscrição com o ID [PRODUCT_ID] e planos base, por exemplo "mensal" e "anual".
 * A confirmação (acknowledge) e a ativação do plano são feitas no SERVIDOR (Edge Function play-billing),
 * depois de verificar o token de compra junto da Google. A app nunca ativa o plano sozinha.
 * O estabelecimento é associado à compra através de obfuscatedAccountId (= id do estabelecimento).
 */
class BillingManager(
    private val ctx: Context,
    private val onPurchases: (String) -> Unit,
) : PurchasesUpdatedListener {

    companion object {
        const val PRODUCT_ID = "fichapro_pro"
    }

    private val main = Handler(Looper.getMainLooper())
    private val client: BillingClient = BillingClient.newBuilder(ctx)
        .setListener(this)
        .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
        .enableAutoServiceReconnection()
        .build()

    private var details: ProductDetails? = null

    fun start() {
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode == BillingClient.BillingResponseCode.OK) refreshPurchases()
            }
            override fun onBillingServiceDisconnected() { /* religação automática ativada */ }
        })
    }

    fun end() = client.endConnection()

    /** Lista de planos (um por plano base) com preços localizados. */
    fun getOffers(callback: (JSONArray?, String?) -> Unit) {
        val params = QueryProductDetailsParams.newBuilder()
            .setProductList(listOf(
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(PRODUCT_ID)
                    .setProductType(BillingClient.ProductType.SUBS)
                    .build()
            )).build()
        client.queryProductDetailsAsync(params) { result, productResult ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                callback(null, message(result)); return@queryProductDetailsAsync
            }
            val d = productResult.productDetailsList.firstOrNull()
            details = d
            if (d == null) { callback(JSONArray(), null); return@queryProductDetailsAsync }
            val out = JSONArray()
            bestOffers(d).forEach { (basePlanId, offer) ->
                val phases = offer.pricingPhases.pricingPhaseList
                val recurring = phases.last()
                val trial = phases.firstOrNull { it.priceAmountMicros == 0L }
                out.put(JSONObject()
                    .put("basePlanId", basePlanId)
                    .put("title", planTitle(basePlanId, recurring.billingPeriod))
                    .put("price", recurring.formattedPrice)
                    .put("period", periodLabel(recurring.billingPeriod))
                    .put("freeTrial", trial?.let { trialLabel(it.billingPeriod) } ?: JSONObject.NULL))
            }
            callback(out, null)
        }
    }

    /** Escolhe, para cada plano base, a oferta elegível com mais fases (ex.: com período gratuito), ou o plano base. */
    private fun bestOffers(d: ProductDetails): Map<String, ProductDetails.SubscriptionOfferDetails> =
        (d.subscriptionOfferDetails ?: emptyList())
            .groupBy { it.basePlanId }
            .mapValues { (_, list) -> list.maxByOrNull { it.pricingPhases.pricingPhaseList.size }!! }

    fun launch(activity: Activity, basePlanId: String, accountId: String, profileId: String, done: (String?) -> Unit) {
        val d = details ?: run { done("Planos ainda não carregados. Tente de novo."); return }
        val offer = bestOffers(d)[basePlanId] ?: run { done("Plano não disponível"); return }
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(listOf(
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(d)
                    .setOfferToken(offer.offerToken)
                    .build()
            ))
            .setObfuscatedAccountId(accountId.take(64))
            .setObfuscatedProfileId(profileId.take(64))
            .build()
        val r = client.launchBillingFlow(activity, params)
        done(if (r.responseCode == BillingClient.BillingResponseCode.OK) null else message(r))
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> purchases?.let { deliver(it) }
            BillingClient.BillingResponseCode.USER_CANCELED -> Unit
            else -> main.post { Toast.makeText(ctx, message(result), Toast.LENGTH_LONG).show() }
        }
    }

    /** Compras ativas desta conta Google (para restaurar e para validar compras que ficaram por confirmar). */
    fun queryPurchases(callback: (JSONArray?, String?) -> Unit) {
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { result, list ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK) callback(null, message(result))
            else callback(toJson(list.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }), null)
        }
    }

    /** Ao voltar à app: compras pagas mas ainda não confirmadas são enviadas para validação. */
    fun refreshPurchases() {
        if (!client.isReady) return
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { result, list ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK) {
                val pending = list.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED && !it.isAcknowledged }
                if (pending.isNotEmpty()) deliver(pending)
            }
        }
    }

    private fun deliver(list: List<Purchase>) {
        val paid = list.filter { it.purchaseState == Purchase.PurchaseState.PURCHASED }
        if (list.any { it.purchaseState == Purchase.PurchaseState.PENDING }) {
            main.post { Toast.makeText(ctx, "Pagamento pendente. O plano Pro fica ativo quando o pagamento for confirmado.", Toast.LENGTH_LONG).show() }
        }
        if (paid.isNotEmpty()) onPurchases(toJson(paid).toString())
    }

    private fun toJson(list: List<Purchase>) = JSONArray().apply {
        list.forEach { p ->
            put(JSONObject()
                .put("purchaseToken", p.purchaseToken)
                .put("productId", p.products.firstOrNull() ?: PRODUCT_ID)
                .put("accountId", p.accountIdentifiers?.obfuscatedAccountId ?: JSONObject.NULL)
                .put("acknowledged", p.isAcknowledged)
                .put("autoRenewing", p.isAutoRenewing))
        }
    }

    private fun message(r: BillingResult): String = when (r.responseCode) {
        BillingClient.BillingResponseCode.BILLING_UNAVAILABLE -> "Pagamentos do Google Play indisponíveis neste dispositivo."
        BillingClient.BillingResponseCode.SERVICE_UNAVAILABLE, BillingClient.BillingResponseCode.SERVICE_DISCONNECTED -> "Google Play indisponível. Verifique a ligação."
        BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED -> "Esta conta Google já tem a subscrição. Use \"Restaurar compra\"."
        BillingClient.BillingResponseCode.USER_CANCELED -> "Compra cancelada"
        else -> r.debugMessage.ifBlank { "Erro do Google Play (${r.responseCode})" }
    }

    private fun periodLabel(iso: String) = when {
        iso.endsWith("Y") -> if (iso == "P1Y") "por ano" else "a cada ${iso.drop(1).dropLast(1)} anos"
        iso.endsWith("M") -> if (iso == "P1M") "por mês" else "a cada ${iso.drop(1).dropLast(1)} meses"
        iso.endsWith("W") -> if (iso == "P1W") "por semana" else "a cada ${iso.drop(1).dropLast(1)} semanas"
        else -> iso
    }
    private fun trialLabel(iso: String): String {
        val n = iso.drop(1).dropLast(1)
        return when { iso.endsWith("D") -> "$n dias grátis"; iso.endsWith("W") -> "$n semana(s) grátis"; iso.endsWith("M") -> "$n mês(es) grátis"; else -> "período grátis" }
    }
    private fun planTitle(basePlanId: String, period: String) = when {
        basePlanId.contains("anual", true) || period == "P1Y" -> "Pro anual"
        basePlanId.contains("mensal", true) || period == "P1M" -> "Pro mensal"
        else -> "Pro"
    }
}
