// FichaPro — validação de subscrições Google Play (Supabase Edge Function, Deno)
//
// POST /play-billing/verify   (chamado pela app com o token de sessão do utilizador)
//   body: { purchaseToken, productId, tenantId }
// POST /play-billing/rtdn?key=SEGREDO   (Real-time Developer Notifications via Google Pub/Sub push)
//
// Segredos necessários (Supabase → Edge Functions → Secrets):
//   GOOGLE_SERVICE_ACCOUNT  JSON completo da conta de serviço com acesso à Play Console
//   PLAY_PACKAGE_NAME       ex.: pt.lappsstudio.fichapro
//   RTDN_KEY                texto aleatório, também usado no URL do push do Pub/Sub
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são fornecidos automaticamente.
//
// Implantar com verify_jwt = false (o Pub/Sub não envia JWT do Supabase); /verify valida o utilizador manualmente.

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PKG = Deno.env.get("PLAY_PACKAGE_NAME") ?? "pt.lappsstudio.fichapro";
const RTDN_KEY = Deno.env.get("RTDN_KEY") ?? "";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// ---------- Base de dados (chave de serviço: contorna RLS, usar com cuidado) ----------
async function db(path: string, init: RequestInit = {}) {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`DB ${r.status}: ${t}`);
  return t ? JSON.parse(t) : null;
}

// ---------- Autenticação Google (conta de serviço, JWT RS256) ----------
let gToken: { value: string; exp: number } | null = null;
const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = ""; bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
async function googleAccessToken(): Promise<string> {
  if (gToken && gToken.exp > Date.now() / 1000 + 60) return gToken.value;
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT não configurado");
  const sa = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${b64url(sig)}` }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error("Google OAuth: " + JSON.stringify(j));
  gToken = { value: j.access_token, exp: now + (j.expires_in ?? 3600) };
  return gToken.value;
}

const API = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}`;
async function getSubscription(token: string) {
  const r = await fetch(`${API}/purchases/subscriptionsv2/tokens/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${await googleAccessToken()}` },
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error("Google Play: " + (j.error?.message ?? r.status)), { status: r.status });
  return j;
}
async function acknowledge(productId: string, token: string) {
  const r = await fetch(`${API}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}:acknowledge`, {
    method: "POST", headers: { Authorization: `Bearer ${await googleAccessToken()}`, "Content-Type": "application/json" }, body: "{}",
  });
  if (!r.ok && r.status !== 400) throw new Error("Falha a confirmar a compra: " + r.status); // 400 = já confirmada
}

const ENTITLED = ["SUBSCRIPTION_STATE_ACTIVE", "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"];
function expiryOf(sub: any): string | null {
  const times = (sub.lineItems ?? []).map((l: any) => l.expiryTime).filter(Boolean).sort();
  return times.length ? times[times.length - 1] : null;
}
const entitled = (state: string, expiry: string | null) =>
  ENTITLED.includes(state) || (state === "SUBSCRIPTION_STATE_CANCELED" && !!expiry && new Date(expiry) > new Date());

/** Grava a subscrição e recalcula o plano do estabelecimento a partir de todas as suas subscrições. */
async function apply(token: string, sub: any, tenantId: string, userId: string | null) {
  const li = sub.lineItems?.[0] ?? {};
  const expiry = expiryOf(sub);
  await db("fp_subscriptions?on_conflict=purchase_token", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      purchase_token: token, tenant_id: tenantId, ...(userId ? { user_id: userId } : {}),
      product_id: li.productId ?? null, base_plan_id: li.offerDetails?.basePlanId ?? null,
      state: sub.subscriptionState, expiry_time: expiry, auto_renewing: li.autoRenewingPlan?.autoRenewEnabled ?? null,
      test_purchase: !!sub.testPurchase, raw: sub, updated_at: new Date().toISOString(),
    }),
  });
  // compra que substitui outra (mudança de plano / nova subscrição): a antiga deixa de contar
  if (sub.linkedPurchaseToken) {
    await db(`fp_subscriptions?purchase_token=eq.${encodeURIComponent(sub.linkedPurchaseToken)}`, {
      method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ state: "REPLACED", updated_at: new Date().toISOString() }),
    });
  }
  const all: any[] = await db(`fp_subscriptions?tenant_id=eq.${tenantId}&select=state,expiry_time`);
  const active = all.filter((s) => entitled(s.state, s.expiry_time)).map((s) => s.expiry_time).filter(Boolean).sort();
  const onHold = all.some((s) => s.state === "SUBSCRIPTION_STATE_ON_HOLD");
  const paidUntil = active.length ? active[active.length - 1] : null;
  await db(`fp_tenants?id=eq.${tenantId}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ plan: paidUntil ? "active" : onHold ? "past_due" : "free", paid_until: paidUntil }),
  });
  if (sub.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING" && ENTITLED.includes(sub.subscriptionState) && li.productId) {
    await acknowledge(li.productId, token);
  }
  return { plan: paidUntil ? "active" : "free", paid_until: paidUntil, state: sub.subscriptionState };
}

async function handleVerify(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: SERVICE, Authorization: auth } });
  if (!u.ok) return json({ error: "Sessão inválida" }, 401);
  const user = await u.json();
  const { purchaseToken, tenantId } = await req.json().catch(() => ({}));
  if (!purchaseToken || !tenantId) return json({ error: "Pedido incompleto" }, 400);
  if (!UUID.test(tenantId)) return json({ error: "Estabelecimento inválido" }, 400);
  const mem = await db(`fp_members?tenant_id=eq.${tenantId}&user_id=eq.${user.id}&select=role`);
  if (!mem.length || !["owner", "admin"].includes(mem[0].role)) return json({ error: "Só o proprietário ou um administrador pode ativar a subscrição" }, 403);
  const sub = await getSubscription(purchaseToken);
  const acc = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (acc && acc !== tenantId) return json({ error: "Esta compra pertence a outro estabelecimento" }, 409);
  const existing = await db(`fp_subscriptions?purchase_token=eq.${encodeURIComponent(purchaseToken)}&select=tenant_id`);
  if (existing.length && existing[0].tenant_id !== tenantId) return json({ error: "Esta compra já está associada a outro estabelecimento" }, 409);
  return json({ ok: true, ...(await apply(purchaseToken, sub, tenantId, user.id)) });
}

async function handleRtdn(req: Request, url: URL) {
  if (!RTDN_KEY || url.searchParams.get("key") !== RTDN_KEY) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => null);
  const data = body?.message?.data ? JSON.parse(atob(body.message.data)) : null;
  const n = data?.subscriptionNotification;
  if (!n?.purchaseToken) return json({ ok: true, ignored: true }); // testNotification, compras únicas, etc.
  const sub = await getSubscription(n.purchaseToken);
  let tenantId = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  if (!tenantId) {
    const ex = await db(`fp_subscriptions?purchase_token=eq.${encodeURIComponent(n.purchaseToken)}&select=tenant_id`);
    tenantId = ex[0]?.tenant_id;
  }
  if (!tenantId || !UUID.test(tenantId)) return json({ ok: true, ignored: "sem estabelecimento" });
  const t = await db(`fp_tenants?id=eq.${tenantId}&select=id`);
  if (!t.length) return json({ ok: true, ignored: "estabelecimento inexistente" });
  return json({ ok: true, ...(await apply(n.purchaseToken, sub, tenantId, null)) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  try {
    if (req.method === "POST" && url.pathname.endsWith("/verify")) return await handleVerify(req);
    if (req.method === "POST" && url.pathname.endsWith("/rtdn")) return await handleRtdn(req, url);
    return json({ error: "not found" }, 404);
  } catch (e) {
    console.error(e);
    // erros 5xx fazem o Pub/Sub repetir a notificação mais tarde
    return json({ error: (e as Error).message }, (e as any).status === 410 ? 410 : 500);
  }
});
