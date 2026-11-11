/* =====================================================================
   MÓDULO 3C — APP ANDROID (ponte nativa) E PLANOS (Gratuito / Pro)
   Na app Android existe window.FichaProAndroid (interface Java/Kotlin).
   No navegador, Native.ok = false e tudo funciona como site normal.
   ===================================================================== */
const Native = (() => {
  const b = typeof window !== 'undefined' ? window.FichaProAndroid : null;
  const ok = !!b;
  let seq = 0;
  const pend = {};
  const purchaseListeners = new Set();
  // chamado pelo lado Android através de evaluateJavascript
  window.FichaProNative = {
    resolve(id, payload) {
      const p = pend[id]; if (!p) return; delete pend[id];
      let r; try { r = typeof payload === 'string' ? JSON.parse(payload) : payload; } catch { r = { error: 'Resposta inválida' }; }
      if (r && r.error) p.rej(new Error(r.error)); else p.res(r ? r.data : null);
    },
    purchases(payload) { let list = []; try { list = JSON.parse(payload); } catch {} purchaseListeners.forEach((fn) => fn(list)); },
  };
  function call(method, ...args) {
    if (!ok) return Promise.reject(new Error('Disponível apenas na app Android'));
    return new Promise((res, rej) => {
      const id = String(++seq);
      pend[id] = { res, rej };
      setTimeout(() => { if (pend[id]) { delete pend[id]; rej(new Error('Sem resposta da app (' + method + ')')); } }, 120000);
      try { b[method](id, ...args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))); } catch (e) { delete pend[id]; rej(e); }
    });
  }
  const blobToBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
  let lastInterstitial = 0;
  return {
    ok,
    info() { try { return ok ? JSON.parse(b.info()) : null; } catch { return null; } },
    setAds(on) { if (ok) try { b.setAds(!!on); } catch {} },
    maybeInterstitial() { if (!ok || Plan.isPro()) return; if (Date.now() - lastInterstitial < 4 * 60000) return; lastInterstitial = Date.now(); try { b.showInterstitial(); } catch {} },
    call,
    print(title) { if (ok) b.print(String(title || 'Documento')); },
    async saveFile(blob, name) { const data = await blobToBase64(blob); return call('saveFile', name, blob.type || 'application/octet-stream', data); },
    products() { return call('getProducts'); },
    purchase(basePlanId, accountId, profileId) { return call('purchase', basePlanId, accountId, profileId); },
    queryPurchases() { return call('queryPurchases'); },
    manageSubscriptions() { if (ok) b.manageSubscriptions(); },
    privacyRequired() { try { return ok && !!b.privacyOptionsRequired(); } catch { return false; } },
    privacyOptions() { if (ok) try { b.privacyOptions(); } catch {} },
    onPurchases(fn) { purchaseListeners.add(fn); },
  };
})();

/* ---------------------------- Planos ---------------------------- */
const Plan = {
  LIMITS: { recipes: 10, ingredients: 50 },
  LABELS: { recipes: 'fichas técnicas', ingredients: 'ingredientes' },
  isPro() { return Sync.mode() === 'cloud' && !!Tenants.current && Tenants.status().paid; },
  usage(store) { return Repo.all(store).filter((o) => !o.demo).length; },
  /** Lança erro se criar um novo registo ultrapassar o limite do plano gratuito. */
  check(store, id) {
    const lim = this.LIMITS[store];
    if (!lim || this.isPro()) return;
    if (id && Repo.get(store, id)) return; // alteração de registo existente
    if (this.usage(store) >= lim) throw new Error(`O plano gratuito permite até ${lim} ${this.LABELS[store]}. Subscreva o FichaPro Pro para ter registos ilimitados (Configurações → Plano).`);
  },
  syncAds() { Native.setAds(!this.isPro()); },
};

/* ---------------------------- Subscrição Google Play ---------------------------- */
const Billing = {
  /** Envia a compra para validação no servidor (Edge Function), que confirma junto da Google e ativa o plano. */
  async verify(p) {
    const token = await Auth.token();
    const r = await fetch(CLOUD.url + '/functions/v1/play-billing/verify', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CLOUD.key, Authorization: 'Bearer ' + token }, body: JSON.stringify({ purchaseToken: p.purchaseToken, productId: p.productId, tenantId: Tenants.current.id }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Falha na validação da compra (' + r.status + ')');
    await Tenants.load(); Tenants.select(Tenants.current.id); Plan.syncAds();
    return j;
  },
  /** Ao arrancar na app Android: valida compras que ficaram por confirmar (ex.: sem rede no momento). */
  async reconcile() {
    if (!Native.ok || Sync.mode() !== 'cloud' || !Tenants.current) return;
    try {
      const list = await Native.queryPurchases();
      for (const p of list || []) if (!p.acknowledged && (!p.accountId || p.accountId === Tenants.current.id)) await this.verify(p).catch(() => {});
    } catch {}
  },
};
Native.onPurchases(async (list) => {
  for (const p of list || []) {
    try { await Billing.verify(p); toast('Subscrição Pro ativa. Obrigado!', 'ok'); }
    catch (e) { toast('A compra foi feita mas não foi possível ativá-la ainda: ' + e.message + '. Será tentada de novo automaticamente.', 'err'); }
  }
  if (UI.current === 'configuracoes') route(true);
});

async function renderPlanCard(box) {
  const pro = Plan.isPro();
  const t = Tenants.current;
  const usage = Object.keys(Plan.LIMITS).map((s) => `<div class="sumrow"><span>${h(Plan.LABELS[s][0].toUpperCase() + Plan.LABELS[s].slice(1))}</span><span>${Plan.usage(s)}${pro ? '' : ' / ' + Plan.LIMITS[s]}</span></div>`).join('');
  let action = '';
  if (pro) {
    action = `<div class="alert ok">Plano <b>Pro</b> ativo${t.paid_until ? ' até ' + U.fmtDate(t.paid_until) + ' (renova automaticamente, salvo cancelamento)' : ''}. Sem anúncios e sem limites.</div>${Native.ok ? '<button class="btn" id="plManage">Gerir subscrição no Google Play</button>' : ''}`;
  } else if (Sync.mode() !== 'cloud') {
    action = '<div class="help">Para subscrever o plano Pro, ative primeiro a conta na nuvem (cartão acima). A subscrição fica associada ao estabelecimento e vale em todos os dispositivos.</div>';
  } else if (!['owner', 'admin'].includes(Tenants.role)) {
    action = '<div class="help">Só o proprietário ou um administrador do estabelecimento pode subscrever.</div>';
  } else if (!Native.ok) {
    action = '<div class="help">A subscrição Pro é feita na app <b>FichaPro para Android</b> (Google Play). Depois de subscrever lá, o plano Pro fica ativo também aqui, no navegador.</div>';
  } else {
    action = '<div id="plOffers" class="small muted">A carregar preços do Google Play…</div><button class="btn sm" id="plRestore" style="margin-top:8px">Restaurar compra</button>';
  }
  box.innerHTML = `<div class="card-h"><h3>Plano: ${pro ? 'Pro' : 'Gratuito'}</h3>${pro ? '<span class="badge green">Pro</span>' : '<span class="badge gray">Gratuito</span>'}</div>
    ${usage}
    <div class="help">Gratuito: até ${Plan.LIMITS.recipes} fichas técnicas e ${Plan.LIMITS.ingredients} ingredientes (os dados de demonstração não contam), com anúncios na app Android. Pro: ilimitado, sem anúncios, equipa com vários utilizadores.</div>
    ${action}
    ${Native.privacyRequired() && !pro ? '<button class="btn sm" id="plPrivacy" style="margin-top:8px">Privacidade dos anúncios</button>' : ''}`;
  const pv = $('#plPrivacy', box); if (pv) pv.onclick = () => Native.privacyOptions();
  const mg = $('#plManage', box); if (mg) mg.onclick = () => Native.manageSubscriptions();
  const rs = $('#plRestore', box); if (rs) rs.onclick = async () => { try { const l = await Native.queryPurchases(); if (!l || !l.length) { toast('Não foi encontrada nenhuma subscrição nesta conta Google.'); return; } for (const p of l) await Billing.verify(p); toast('Subscrição restaurada', 'ok'); route(true); } catch (e) { toast(e.message, 'err'); } };
  const offers = $('#plOffers', box);
  if (offers) {
    try {
      const list = await Native.products();
      if (!list || !list.length) { offers.textContent = 'Não há planos disponíveis de momento. Tente mais tarde.'; return; }
      offers.classList.remove('small', 'muted');
      offers.innerHTML = `<div class="tiers">${list.map((o) => `<div class="tier ${o.basePlanId.includes('anual') ? 'rec' : ''}"><h3>${h(o.title || o.basePlanId)}</h3><div class="price">${h(o.price)}</div><div class="small muted">${h(o.period)}${o.freeTrial ? ' · ' + h(o.freeTrial) : ''}</div><button class="btn green" data-bp="${h(o.basePlanId)}" style="margin-top:8px;width:100%">Subscrever</button></div>`).join('')}</div>
        <div class="small muted" style="margin-top:6px">Pagamento e renovação geridos pelo Google Play. Pode cancelar a qualquer momento nas subscrições do Google Play.</div>`;
      $$('[data-bp]', offers).forEach((b) => (b.onclick = async () => {
        try { await Native.purchase(b.dataset.bp, Tenants.current.id, Auth.user.id); }
        catch (e) { if (!/cancel/i.test(e.message)) toast(e.message, 'err'); }
      }));
    } catch (e) { offers.textContent = 'Não foi possível obter os preços: ' + e.message; }
  }
}
