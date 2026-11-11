/* =====================================================================
   MÓDULO 3B — NUVEM (Supabase) — autenticação, multi-cliente e sincronização
   Sem bibliotecas externas: usa diretamente as APIs REST do Supabase
   (Auth/GoTrue e PostgREST). A chave publicável é pública por natureza;
   a segurança está nas políticas RLS da base de dados.
   ===================================================================== */
const CLOUD = {
  url: 'https://pqrqxvpzxqwblhxtmdns.supabase.co',
  key: 'sb_publishable_Vuk6Fzf26IbLGjjTGNL_5A_8vzr9B2U',
};
const LS = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
class CloudError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }

/* ---------------------------- Autenticação ---------------------------- */
const Auth = (() => {
  let session = LS.get('fp_session');
  const save = (s) => { session = s; LS.set('fp_session', s); };
  const errMsg = (j, status) => {
    const m = (j && (j.msg || j.error_description || j.message || j.error)) || 'Erro ' + status;
    const map = {
      'Invalid login credentials': 'Email ou palavra-passe incorretos.',
      'Email not confirmed': 'Ainda não confirmou o email. Abra a mensagem que recebeu e clique no link.',
      'User already registered': 'Já existe uma conta com este email. Use "Entrar".',
    };
    for (const [k, v] of Object.entries(map)) if (m.includes(k)) return v;
    if (/Password should be at least/i.test(m)) return 'A palavra-passe tem de ter pelo menos 6 caracteres.';
    if (/rate limit/i.test(m)) return 'Demasiadas tentativas. Aguarde alguns minutos.';
    return m;
  };
  async function call(path, { method = 'POST', body, token } = {}) {
    let r;
    try {
      r = await fetch(CLOUD.url + '/auth/v1' + path, { method, headers: { apikey: CLOUD.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch { throw new CloudError('Sem ligação à internet', 0, 'offline'); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new CloudError(errMsg(j, r.status), r.status, j.error_code || j.code);
    return j;
  }
  const fromToken = (j) => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Math.floor(Date.now() / 1000) + (Number(j.expires_in) || 3600), user: { id: j.user.id, email: j.user.email } });
  // Links dos emails (confirmação, recuperação) abrem no navegador: na app Android ou num ficheiro local usa-se o site público
  const PUBLIC_URL = 'https://dontasko.github.io/fichapro/';
  const redirectTo = () => (/^https?:$/.test(location.protocol) && location.hostname !== 'appassets.androidplatform.net' && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? location.origin + location.pathname : PUBLIC_URL);
  return {
    get session() { return session; },
    get user() { return session && session.user; },
    async signUp(email, password) {
      const j = await call('/signup?redirect_to=' + encodeURIComponent(redirectTo()), { body: { email, password } });
      if (j.access_token) { save(fromToken(j)); return { confirmed: true }; }
      return { confirmed: false };
    },
    async signIn(email, password) { save(fromToken(await call('/token?grant_type=password', { body: { email, password } }))); },
    async recover(email) { await call('/recover?redirect_to=' + encodeURIComponent(redirectTo()), { body: { email } }); },
    async updatePassword(password) { await call('/user', { method: 'PUT', body: { password }, token: await this.token() }); },
    async signOut() { const t = session && session.access_token; save(null); if (t) await call('/logout', { token: t }).catch(() => {}); },
    /** Token válido (renova automaticamente). */
    async token(force = false) {
      if (!session) throw new CloudError('Sessão terminada. Entre novamente.', 401, 'no_session');
      if (force || session.expires_at - 60 < Date.now() / 1000) {
        try { save(fromToken(await call('/token?grant_type=refresh_token', { body: { refresh_token: session.refresh_token } }))); }
        catch (e) { if (e.code !== 'offline') { save(null); throw new CloudError('Sessão expirada. Entre novamente.', 401, 'expired'); } throw e; }
      }
      return session.access_token;
    },
    /** Trata o regresso de links de email (confirmação de conta, recuperação de palavra-passe). */
    async handleRedirect() {
      const hsh = location.hash;
      if (!/access_token=|error_description=/.test(hsh)) return null;
      const p = new URLSearchParams(hsh.slice(1));
      history.replaceState(null, '', location.pathname + location.search);
      if (p.get('error_description')) return { error: p.get('error_description').replace(/\+/g, ' ') };
      const u = await call('/user', { method: 'GET', token: p.get('access_token') });
      save({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + (Number(p.get('expires_in')) || 3600), user: { id: u.id, email: u.email } });
      return { type: p.get('type') || 'signup' };
    },
  };
})();

/* ---------------------------- API REST (PostgREST) ---------------------------- */
const Api = {
  async req(path, { method = 'GET', body, prefer, retry = true } = {}) {
    const token = await Auth.token();
    let r;
    try {
      r = await fetch(CLOUD.url + '/rest/v1/' + path, { method, headers: { apikey: CLOUD.key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(prefer ? { Prefer: prefer } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch { throw new CloudError('Sem ligação à internet', 0, 'offline'); }
    if (r.status === 401 && retry) { await Auth.token(true); return this.req(path, { method, body, prefer, retry: false }); }
    const txt = await r.text();
    const j = txt ? JSON.parse(txt) : null;
    if (!r.ok) {
      const code = j && j.code;
      if (code === '42501' || r.status === 403) throw new CloudError('Sem permissão para esta operação.', 403, 'forbidden');
      if (j && j.message && j.message.startsWith('FP_LIMIT')) throw new CloudError('Limite do plano gratuito atingido. Subscreva o plano Pro.', r.status, 'limit');
      throw new CloudError((j && (j.message || j.hint)) || 'Erro do servidor (' + r.status + ')', r.status, code);
    }
    return j;
  },
  rpc(fn, args = {}) { return this.req('rpc/' + fn, { method: 'POST', body: args }); },
};

/* ---------------------------- Estabelecimentos (tenants) ---------------------------- */
const Tenants = {
  list: [], current: null, role: null,
  async load() {
    await Api.rpc('fp_accept_invites').catch(() => 0);
    const [tenants, mem] = await Promise.all([Api.req('fp_tenants?select=*&order=created_at'), Api.req('fp_members?select=tenant_id,role&user_id=eq.' + Auth.user.id)]);
    const roles = Object.fromEntries(mem.map((m) => [m.tenant_id, m.role]));
    this.list = tenants.map((t) => ({ ...t, role: roles[t.id] }));
    LS.set('fp_tenants_cache_' + Auth.user.id, this.list);
    return this.list;
  },
  loadCached() { this.list = LS.get('fp_tenants_cache_' + (Auth.user && Auth.user.id), []); return this.list; },
  select(id) {
    const t = this.list.find((x) => x.id === id);
    if (!t) return null;
    this.current = t; this.role = t.role;
    LS.set('fp_tenant_' + Auth.user.id, id);
    return t;
  },
  savedId() { return Auth.user ? LS.get('fp_tenant_' + Auth.user.id) : null; },
  async create(name) { return Api.rpc('fp_create_tenant', { p_name: name }); },
  status(t = this.current) {
    if (!t) return { canWrite: false, roleOk: false, paid: false, label: '—' };
    const roleOk = ['owner', 'admin', 'editor'].includes(t.role);
    const paid = !!t.paid_until && new Date(t.paid_until).getTime() > Date.now();
    return { canWrite: roleOk, roleOk, paid, label: paid ? 'Plano Pro' : t.plan === 'past_due' ? 'Plano gratuito (pagamento Pro pendente)' : 'Plano gratuito' };
  },
  roleLabel: (r) => ({ owner: 'Proprietário', admin: 'Administrador', editor: 'Editor', viewer: 'Só consulta' }[r] || r),
};

/* ---------------------------- Adaptador de nuvem com cache local ---------------------------- */
/* Escreve primeiro localmente (funciona sem rede) e envia para a nuvem em segundo plano
   (fila "outbox"). Recebe alterações de outros dispositivos por consulta periódica. */
class CloudAdapter {
  constructor(tenantId) {
    this.tenantId = tenantId;
    this.local = new IDBAdapter('fichapro-nuvem-' + tenantId, [...STORES, 'outbox']);
    this.kind = 'Nuvem (Supabase)';
    this.cursorKey = 'fp_cursor_' + tenantId;
    this.state = { online: navigator.onLine, pending: 0, lastSync: LS.get('fp_lastsync_' + tenantId), error: null, syncing: false };
    this.listeners = new Set();
    this.seq = 0;
  }
  async open() { await this.local.open(); await this.countPending(); return this; }
  on(fn) { this.listeners.add(fn); }
  emit() { this.listeners.forEach((fn) => fn(this.state)); }
  async countPending() { this.state.pending = (await this.local.getAll('outbox')).length; this.emit(); }
  guard() { if (!Tenants.status().canWrite) throw new CloudError('O seu perfil neste estabelecimento é só de consulta.', 403, 'readonly'); }
  getAll(store) { return this.local.getAll(store); }
  async queue(entries) {
    const stamp = Date.now() + '-' + ++this.seq;
    await this.local.bulkPut('outbox', entries.map((e) => ({ id: e.store + '|' + e.id, store: e.store, rid: e.id, data: e.deleted ? {} : e.data, deleted: !!e.deleted, stamp })));
    await this.countPending();
    this.scheduleFlush();
  }
  async put(store, obj) { this.guard(); await this.local.put(store, obj); await this.queue([{ store, id: obj.id, data: obj }]); }
  async bulkPut(store, arr) { this.guard(); await this.local.bulkPut(store, arr); await this.queue(arr.map((o) => ({ store, id: o.id, data: o }))); }
  async delete(store, id) { this.guard(); await this.local.delete(store, id); await this.queue([{ store, id, deleted: true }]); }
  async bulkDelete(store, ids) { this.guard(); await this.local.bulkDelete(store, ids); await this.queue(ids.map((id) => ({ store, id, deleted: true }))); }
  async clear(store) { this.guard(); const ids = (await this.local.getAll(store)).map((o) => o.id); await this.local.clear(store); if (ids.length) await this.queue(ids.map((id) => ({ store, id, deleted: true }))); }
  scheduleFlush(ms = 400) { clearTimeout(this._ft); this._ft = setTimeout(() => this.flush(), ms); }

  /** Envia a fila pendente. */
  async flush() {
    if (this._flushing) { this._again = true; return; }
    if (!navigator.onLine) { this.state.online = false; this.emit(); return; }
    this._flushing = true;
    try {
      let items = await this.local.getAll('outbox');
      while (items.length) {
        const batch = items.slice(0, 200);
        await Api.req('fp_records?on_conflict=tenant_id,store,id', { method: 'POST', prefer: 'resolution=merge-duplicates,return=minimal', body: batch.map((o) => ({ tenant_id: this.tenantId, store: o.store, id: o.rid, data: o.data, deleted: o.deleted })) });
        // remove só as entradas que não mudaram entretanto
        const now = new Map((await this.local.getAll('outbox')).map((o) => [o.id, o.stamp]));
        await this.local.bulkDelete('outbox', batch.filter((o) => now.get(o.id) === o.stamp).map((o) => o.id));
        items = items.slice(200);
      }
      this.state.error = null; this.state.online = true;
      this.state.lastSync = U.nowISO(); LS.set('fp_lastsync_' + this.tenantId, this.state.lastSync);
    } catch (e) {
      this.state.error = e.message; this.state.online = e.code !== 'offline';
      if (e.code === 'forbidden') { toast('A nuvem recusou a gravação: ' + e.message, 'err'); }
      else this.scheduleFlush(15000);
    } finally {
      this._flushing = false;
      await this.countPending();
      if (this._again) { this._again = false; this.scheduleFlush(50); }
    }
  }

  /** Recebe alterações feitas noutros dispositivos. */
  async pull() {
    if (!navigator.onLine) { this.state.online = false; this.emit(); return 0; }
    if (this._pulling) return 0;
    this._pulling = true; this.state.syncing = true; this.emit();
    let total = 0;
    try {
      const saved = LS.get(this.cursorKey);
      let cursor = saved, offset = 0;
      const since = saved ? '&updated_at=gt.' + encodeURIComponent(new Date(new Date(saved).getTime() - 3000).toISOString()) : '&deleted=eq.false';
      for (;;) {
        const rows = await Api.req(`fp_records?select=store,id,data,deleted,updated_at&tenant_id=eq.${this.tenantId}${since}&order=updated_at.asc,store.asc,id.asc&limit=1000&offset=${offset}`);
        const pending = new Set((await this.local.getAll('outbox')).map((o) => o.id));
        const changes = rows.filter((r) => STORES.includes(r.store) && !pending.has(r.store + '|' + r.id)).map((r) => ({ store: r.store, id: r.id, data: r.data, deleted: r.deleted }));
        for (const st of STORES) {
          const ch = changes.filter((c) => c.store === st);
          const up = ch.filter((c) => !c.deleted).map((c) => c.data), del = ch.filter((c) => c.deleted).map((c) => c.id);
          if (up.length) await this.local.bulkPut(st, up);
          if (del.length) await this.local.bulkDelete(st, del);
        }
        const fresh = changes.filter((c) => { const cur = Repo.get(c.store, c.id); return c.deleted ? !!cur : JSON.stringify(cur) !== JSON.stringify(c.data); });
        if (fresh.length) Repo.applyRemote(fresh);
        total += fresh.length;
        for (const r of rows) if (!cursor || r.updated_at > cursor) cursor = r.updated_at;
        if (rows.length < 1000) break;
        offset += 1000;
      }
      LS.set(this.cursorKey, cursor);
      this.state.online = true; this.state.error = null;
      this.state.lastSync = U.nowISO(); LS.set('fp_lastsync_' + this.tenantId, this.state.lastSync);
    } catch (e) {
      this.state.error = e.message; this.state.online = e.code !== 'offline';
      if (e.status === 401) Sync.sessionLost();
    } finally { this._pulling = false; this.state.syncing = false; this.emit(); }
    return total;
  }
  async syncNow() { await this.flush(); return this.pull(); }
}

/* ---------------------------- Coordenação da sincronização ---------------------------- */
const Sync = {
  mode() { return LS.get('fp_mode'); },
  setMode(m) { LS.set('fp_mode', m); },
  adapter: null,
  start(adapter) {
    this.adapter = adapter;
    adapter.on(() => this.render());
    const tick = () => { if (document.visibilityState === 'visible') adapter.syncNow(); };
    this._iv = setInterval(tick, 20000);
    window.addEventListener('online', () => { adapter.state.online = true; adapter.syncNow(); });
    window.addEventListener('offline', () => { adapter.state.online = false; adapter.emit(); });
    document.addEventListener('visibilitychange', tick);
    adapter.flush();
    this.render();
  },
  render() {
    const el = $('#syncBadge'); if (!el) return;
    if (!this.adapter) { el.innerHTML = ''; return; }
    const s = this.adapter.state;
    const [cls, txt] = !s.online ? ['amber', 'Sem ligação' + (s.pending ? ` · ${s.pending} por enviar` : '')] : s.error ? ['red', 'Erro de sincronização'] : s.pending || s.syncing ? ['blue', 'A sincronizar…'] : ['green', 'Sincronizado'];
    el.innerHTML = `<span class="badge ${cls}" title="${h(s.error || (s.lastSync ? tr('Última sincronização') + ': ' + U.fmtDateTime(s.lastSync) : ''))}">● ${h(txt)}</span>`;
  },
  sessionLost() { if (this._lost) return; this._lost = true; toast('A sessão expirou. Entre novamente para continuar a sincronizar.', 'err'); },
};
