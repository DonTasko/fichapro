/* =====================================================================
   ENTRADA: escolha de modo, conta, estabelecimento + gestão da conta/equipa
   ===================================================================== */
const Gate = (() => {
  const el = () => $('#gate');
  const show = (html) => {
    $('#app').style.display = 'none'; el().hidden = false;
    el().innerHTML = `<div class="gate-card"><div class="gate-brand"><span class="dot"></span>FichaPro<small>Fichas técnicas &amp; Food Cost</small><select id="gLang" data-notr class="gate-lang" aria-label="Language">${options(Object.entries(I18N.LANGS), I18N.lang)}</select></div>${html}</div>`;
    $('#gLang', el()).onchange = (e) => { I18N.setLang(e.target.value); location.reload(); };
    const f = $('input', el()); if (f) f.focus();
  };
  const hide = () => { el().hidden = true; el().innerHTML = ''; $('#app').style.display = ''; };
  const busy = (btn, on, label) => { if (!btn) return; btn.disabled = on; if (on) { btn.dataset.l = btn.textContent; btn.textContent = label || 'Aguarde…'; } else if (btn.dataset.l) btn.textContent = btn.dataset.l; };
  const msg = (text, cls = 'err') => { const m = $('#gateMsg', el()); if (m) m.innerHTML = text ? `<div class="alert ${cls}">${text}</div>` : ''; };

  function welcome() {
    return new Promise((resolve) => {
      show(`<h2>Bem-vindo</h2><p class="muted">Como quer usar a aplicação?</p>
        <button class="btn primary gate-big" id="gCloud"><b>Entrar ou criar conta</b><span>Dados na nuvem, sincronizados entre computador, tablet e telemóvel. Pode convidar a sua equipa.</span></button>
        <button class="btn gate-big" id="gLocal"><b>Usar só neste dispositivo</b><span>Sem conta. Os dados ficam apenas neste navegador. Pode ativar a conta mais tarde.</span></button>`);
      $('#gCloud', el()).onclick = () => { Sync.setMode('cloud'); resolve('cloud'); };
      $('#gLocal', el()).onclick = () => { Sync.setMode('local'); hide(); resolve('local'); };
    });
  }

  function auth(tab = 'login', info = '') {
    return new Promise((resolve) => {
      const render = () => {
        show(`<div class="tabs" style="margin-bottom:16px"><button data-t="login" class="${tab === 'login' ? 'active' : ''}">Entrar</button><button data-t="signup" class="${tab === 'signup' ? 'active' : ''}">Criar conta</button></div>
          <div id="gateMsg">${info ? `<div class="alert ok">${info}</div>` : ''}</div>
          <form id="gForm" class="grid" style="gap:10px">
            <div class="field"><label>Email</label><input type="email" name="email" autocomplete="email" required value="${h(LS.get('fp_last_email') || '')}"></div>
            <div class="field"><label>Palavra-passe</label><input type="password" name="password" autocomplete="${tab === 'login' ? 'current-password' : 'new-password'}" required minlength="6"></div>
            ${tab === 'signup' ? '<div class="field"><label>Repetir palavra-passe</label><input type="password" name="password2" autocomplete="new-password" required minlength="6"></div>' : ''}
            <button class="btn primary" type="submit" style="justify-content:center;padding:10px">${tab === 'login' ? 'Entrar' : 'Criar conta'}</button>
          </form>
          <div class="gate-links">${tab === 'login' ? '<a href="#" id="gForgot">Esqueci-me da palavra-passe</a>' : '<span class="small muted">Plano gratuito disponível.</span>'}<a href="#" id="gBack">Usar sem conta</a></div>`);
        $$('[data-t]', el()).forEach((b) => (b.onclick = () => { tab = b.dataset.t; info = ''; render(); }));
        $('#gBack', el()).onclick = (e) => { e.preventDefault(); Sync.setMode('local'); location.reload(); };
        const fg = $('#gForgot', el());
        if (fg) fg.onclick = async (e) => {
          e.preventDefault();
          const email = $('[name=email]', el()).value.trim();
          if (!email) { msg('Escreva primeiro o seu email.'); return; }
          try { await Auth.recover(email); msg('Se existir uma conta com este email, receberá um link para definir uma nova palavra-passe.', 'ok'); } catch (err) { msg(h(err.message)); }
        };
        $('#gForm', el()).onsubmit = async (e) => {
          e.preventDefault();
          const f = readForm(e.target); const btn = $('button[type=submit]', el());
          const email = f.email.trim().toLowerCase();
          if (tab === 'signup' && f.password !== f.password2) { msg('As palavras-passe não coincidem.'); return; }
          busy(btn, true); msg('');
          try {
            LS.set('fp_last_email', email);
            if (tab === 'login') { await Auth.signIn(email, f.password); resolve(); }
            else {
              const r = await Auth.signUp(email, f.password);
              if (r.confirmed) resolve();
              else { tab = 'login'; info = `Conta criada. Enviámos um email para <b>${h(email)}</b>: clique no link de confirmação e depois entre aqui.`; render(); }
            }
          } catch (err) { msg(h(err.message)); busy(btn, false); }
        };
      };
      render();
    });
  }

  function newPassword() {
    return new Promise((resolve) => {
      show(`<h2>Nova palavra-passe</h2><div id="gateMsg"></div><form id="gForm" class="grid" style="gap:10px">
        <div class="field"><label>Nova palavra-passe</label><input type="password" name="p1" minlength="6" required autocomplete="new-password"></div>
        <div class="field"><label>Repetir</label><input type="password" name="p2" minlength="6" required autocomplete="new-password"></div>
        <button class="btn primary" type="submit" style="justify-content:center;padding:10px">Guardar</button></form>`);
      $('#gForm', el()).onsubmit = async (e) => {
        e.preventDefault(); const f = readForm(e.target);
        if (f.p1 !== f.p2) { msg('As palavras-passe não coincidem.'); return; }
        try { await Auth.updatePassword(f.p1); toast('Palavra-passe alterada', 'ok'); resolve(); } catch (err) { msg(h(err.message)); }
      };
    });
  }

  /** Escolher ou criar estabelecimento. Devolve { id, demo, upload }. */
  function tenants(localCount = 0) {
    return new Promise((resolve) => {
      const list = Tenants.list;
      show(`<h2>${list.length ? 'Escolha o estabelecimento' : 'Crie o seu estabelecimento'}</h2>
        <div class="small muted" style="margin-bottom:10px">Sessão: <span data-notr>${h(Auth.user.email)}</span> · <a href="#" id="gOut">terminar sessão</a></div>
        ${list.length ? `<div class="grid" style="gap:8px;margin-bottom:16px">${list.map((t) => `<button class="btn gate-big" data-id="${t.id}"><b>${h(t.name)}</b><span>${h(Tenants.roleLabel(t.role))} · ${h(Tenants.status(t).label)}</span></button>`).join('')}</div><h3>Ou criar um novo</h3>` : '<p class="muted">Cada estabelecimento tem os seus próprios ingredientes, fichas e equipa.</p>'}
        <div id="gateMsg"></div>
        <form id="gForm" class="grid" style="gap:10px">
          <div class="field"><label>Nome do estabelecimento</label><input name="name" required maxlength="120" placeholder="ex.: Restaurante Don Tasko"></div>
          <div class="field"><label>País</label><select name="country" data-notr>${options(Object.entries(COUNTRIES).map(([k, c]) => [k, c.name]), COUNTRY_BY_LANG[I18N.lang] || 'PT')}</select></div>
          ${localCount ? `<label class="check"><input type="checkbox" name="upload" checked> Enviar os ${localCount} registos que já existem neste dispositivo</label>` : ''}
          <label class="check"><input type="checkbox" name="demo" ${localCount ? '' : 'checked'}> Carregar dados de demonstração (pode apagá-los depois)</label>
          <button class="btn primary" type="submit" style="justify-content:center;padding:10px">Criar estabelecimento</button>
        </form>`);
      $('#gOut', el()).onclick = async (e) => { e.preventDefault(); await Auth.signOut(); location.reload(); };
      $$('[data-id]', el()).forEach((b) => (b.onclick = () => resolve({ id: b.dataset.id })));
      $('#gForm', el()).onsubmit = async (e) => {
        e.preventDefault(); const f = readForm(e.target); const btn = $('button[type=submit]', el());
        busy(btn, true, 'A criar…');
        try { const id = await Tenants.create(f.name.trim()); await Tenants.load(); resolve({ id, demo: f.demo, upload: f.upload, name: f.name.trim(), country: f.country }); }
        catch (err) { msg(h(err.message)); busy(btn, false); }
      };
    });
  }
  function loading(text) { show(`<div class="empty">${h(text)}</div>`); }
  return { welcome, auth, newPassword, tenants, loading, hide };
})();

async function localRecordCount() {
  try {
    const a = await new IDBAdapter(LOCAL_DB_NAME).open();
    let n = 0; for (const s of ['ingredients', 'recipes', 'staff', 'equipment', 'opcosts']) n += (await a.getAll(s)).filter((o) => !o.demo).length;
    a.db.close(); return n;
  } catch { return 0; }
}
async function localExport() {
  const a = await new IDBAdapter(LOCAL_DB_NAME).open();
  const out = { app: 'fichas-tecnicas-hotelaria', schema: SCHEMA_VERSION, exportedAt: U.nowISO(), data: {} };
  for (const s of STORES) out.data[s] = (await a.getAll(s)).filter((o) => !o.demo); // só dados reais
  a.db.close(); return out;
}

/** Arranque no modo nuvem. Devolve false se não foi possível continuar. */
async function startCloud() {
  if (!Auth.session) await Gate.auth();
  for (;;) {
    try { await Tenants.load(); break; }
    catch (e) {
      if (e.code === 'offline' && Tenants.loadCached().length) { toast('Sem ligação: a trabalhar com os dados guardados neste dispositivo.'); break; }
      if (e.status === 401) { await Gate.auth('login', 'A sessão expirou. Entre novamente.'); continue; }
      Gate.loading('Não foi possível ligar à nuvem: ' + e.message); return false;
    }
  }
  let choice = null;
  let id = Tenants.savedId();
  if (!id || !Tenants.list.some((t) => t.id === id)) {
    if (Tenants.list.length === 1) id = Tenants.list[0].id;
    else { choice = await Gate.tenants(await localRecordCount()); id = choice.id; }
  }
  Tenants.select(id);
  Gate.loading(tr('A carregar os dados de') + ' ' + Tenants.current.name + '…');
  const adapter = new CloudAdapter(id);
  await Repo.init(adapter);
  if (!LS.get(adapter.cursorKey)) await adapter.pull();
  if (choice && choice.name) {
    const ds = defaultSettings(choice.country);
    await saveSettings({ ...ds, businessName: choice.name, firstRun: U.nowISO() });
    applyCountry();
    if (choice.upload) { const d = await localExport(); d.data.meta = (d.data.meta || []).map((m) => (m.id === 'settings' ? { ...m, businessName: choice.name } : m)); await Repo.importAll(d, 'merge'); toast('Dados deste dispositivo enviados para a conta', 'ok'); }
    if (choice.demo) await Demo.load();
  }
  Sync.start(adapter);
  Gate.hide();
  return true;
}

/* ---------------------------- Cartão "Conta e sincronização" ---------------------------- */
async function renderAccountCard(box) {
  if (Sync.mode() !== 'cloud') {
    box.innerHTML = `<div class="card-h"><h3>Sincronização entre dispositivos</h3></div>
      <p>Os dados estão guardados apenas neste dispositivo. Com uma conta, ficam na nuvem e pode usá-los no computador, tablet e telemóvel, e convidar a equipa.</p>
      <button class="btn green" id="acOn">Ativar conta na nuvem</button>
      <div class="help">Os dados atuais podem ser enviados para a conta quando criar o estabelecimento. Nada é apagado deste dispositivo.</div>`;
    $('#acOn', box).onclick = () => { Sync.setMode('cloud'); location.reload(); };
    return;
  }
  const t = Tenants.current, st = Tenants.status(), a = Sync.adapter, admin = ['owner', 'admin'].includes(Tenants.role);
  box.innerHTML = `<div class="card-h"><h3>Conta e sincronização</h3><span id="acSync"></span></div>
    <div class="sumrow"><span>Sessão</span><span>${h(Auth.user.email)}</span></div>
    <div class="sumrow"><span>Estabelecimento</span><span><b>${h(t.name)}</b> · ${h(Tenants.roleLabel(t.role))}</span></div>
    <div class="sumrow"><span>Subscrição</span><span class="${st.canWrite ? '' : 'red'}">${h(st.label)}</span></div>
    <div class="sumrow"><span>Por enviar</span><span>${a.state.pending} alteração(ões)</span></div>
    <div class="sumrow"><span>Última sincronização</span><span>${U.fmtDateTime(a.state.lastSync)}</span></div>
    ${a.state.error ? `<div class="alert err" style="margin-top:8px">${h(a.state.error)}</div>` : ''}
    <div class="toolbar" style="margin-top:12px"><button class="btn primary" id="acSyncNow">Sincronizar agora</button>${admin ? '<button class="btn" id="acRename">Mudar nome</button>' : ''}<button class="btn" id="acSwitch">Mudar/criar estabelecimento</button><button class="btn" id="acOut">Terminar sessão</button><button class="btn danger" id="acLocal">Usar sem conta</button></div>
    ${admin ? '<div class="sep"></div><h4>Equipa</h4><div id="acTeam" class="small muted">A carregar…</div>' : ''}`;
  const sync = () => { $('#acSync', box) && ($('#acSync', box).innerHTML = $('#syncBadge').innerHTML); };
  sync();
  $('#acSyncNow', box).onclick = async () => { const n = await a.syncNow(); toast(a.state.error ? 'Erro: ' + a.state.error : `Sincronizado (${n} alteração(ões) recebida(s))`, a.state.error ? 'err' : 'ok'); renderAccountCard(box); };
  $('#acOut', box).onclick = async () => {
    if (a.state.pending && !(await confirmDlg(`Há ${a.state.pending} alteração(ões) ainda por enviar. Se terminar a sessão agora, ficam guardadas neste dispositivo e são enviadas quando voltar a entrar. Continuar?`))) return;
    await Auth.signOut(); location.reload();
  };
  $('#acSwitch', box).onclick = () => { LS.set('fp_tenant_' + Auth.user.id, null); location.reload(); };
  $('#acLocal', box).onclick = async () => { if (await confirmDlg('Passar a usar a aplicação sem conta neste dispositivo? Verá os dados locais (não os da nuvem). Os dados da nuvem não são apagados.', { ok: 'Usar sem conta' })) { Sync.setMode('local'); location.reload(); } };
  const rn = $('#acRename', box);
  if (rn) rn.onclick = () => {
    const m = modal({ title: 'Nome do estabelecimento', size: 'small', body: `<div class="field"><label>Nome</label><input id="rnv" value="${h(t.name)}" maxlength="120"></div>`, footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="rnok">Guardar</button>' });
    m.$('#rnok').onclick = async () => { const v = m.$('#rnv').value.trim(); if (!v) return; try { await Api.rpc('fp_rename_tenant', { t: t.id, p_name: v }); await Tenants.load(); Tenants.select(t.id); m.close(); toast('Nome alterado', 'ok'); renderAccountCard(box); } catch (e) { toast(e.message, 'err'); } };
  };
  if (!admin) return;
  try {
    const [mem, inv] = await Promise.all([Api.req(`fp_members?tenant_id=eq.${t.id}&select=user_id,email,role&order=created_at`), Api.req(`fp_invites?tenant_id=eq.${t.id}&accepted_at=is.null&select=id,email,role,created_at`)]);
    const roles = [['admin', 'Administrador'], ['editor', 'Editor'], ['viewer', 'Só consulta']];
    $('#acTeam', box).classList.remove('small', 'muted');
    $('#acTeam', box).innerHTML = `<div class="table-wrap"><table><thead><tr><th>Email</th><th>Função</th><th></th></tr></thead><tbody>
      ${mem.map((m) => `<tr><td>${h(m.email || m.user_id)}${m.user_id === Auth.user.id ? ' <span class="badge gray">eu</span>' : ''}</td><td>${m.role === 'owner' ? 'Proprietário' : `<select data-role="${m.user_id}">${options(roles, m.role)}</select>`}</td><td>${m.role === 'owner' ? '' : `<button class="btn sm danger" data-rm="${m.user_id}">Remover</button>`}</td></tr>`).join('')}
      ${inv.map((i) => `<tr><td>${h(i.email)} <span class="badge amber">convite pendente</span></td><td>${h(Tenants.roleLabel(i.role))}</td><td><button class="btn sm" data-cancel="${i.id}">Cancelar</button></td></tr>`).join('')}
      </tbody></table></div>
      ${Plan.isPro() ? '' : '<div class="alert info" style="margin-top:10px">Convidar outras pessoas é uma funcionalidade do plano Pro.</div>'}
      <form id="invF" class="toolbar" style="margin-top:10px;${Plan.isPro() ? '' : 'display:none'}"><input type="email" name="email" placeholder="email@exemplo.pt" required style="flex:1;min-width:180px"><select name="role">${options(roles, 'editor')}</select><button class="btn green" type="submit">Convidar</button></form>
      <div class="help">A pessoa convidada cria uma conta (ou entra) com este email e passa a ter acesso automaticamente. Editor: cria e altera dados. Só consulta: vê, sem alterar.</div>`;
    $$('[data-role]', box).forEach((s) => (s.onchange = async () => { try { await Api.rpc('fp_set_member_role', { t: t.id, u: s.dataset.role, p_role: s.value }); toast('Função alterada', 'ok'); } catch (e) { toast(e.message, 'err'); } }));
    $$('[data-rm]', box).forEach((b) => (b.onclick = async () => { if (!(await confirmDlg('Remover este utilizador do estabelecimento?', { danger: true, ok: 'Remover' }))) return; try { await Api.rpc('fp_remove_member', { t: t.id, u: b.dataset.rm }); renderAccountCard(box); } catch (e) { toast(e.message, 'err'); } }));
    $$('[data-cancel]', box).forEach((b) => (b.onclick = async () => { try { await Api.req('fp_invites?id=eq.' + b.dataset.cancel, { method: 'DELETE' }); renderAccountCard(box); } catch (e) { toast(e.message, 'err'); } }));
    $('#invF', box).onsubmit = async (e) => {
      e.preventDefault(); const f = readForm(e.target);
      try { await Api.req('fp_invites', { method: 'POST', body: { tenant_id: t.id, email: f.email.trim().toLowerCase(), role: f.role }, prefer: 'return=minimal' }); toast('Convite registado. Avise a pessoa para criar conta com este email.', 'ok'); renderAccountCard(box); }
      catch (err) { toast(/duplicate|unique/i.test(err.message) ? 'Já existe um convite pendente para este email.' : err.message, 'err'); }
    };
  } catch (e) { $('#acTeam', box).textContent = 'Não foi possível carregar a equipa: ' + e.message; }
}
