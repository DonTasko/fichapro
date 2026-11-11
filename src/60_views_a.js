/* =====================================================================
   VISTAS — Dashboard, Ingredientes, Importação
   ===================================================================== */

/* ------------------------------ 1. DASHBOARD ------------------------------ */
Views.dashboard = (el) => {
  const st = getSettings();
  const ings = Repo.all('ingredients');
  const all = computeAll();
  const products = all.filter((x) => x.r.sellable !== false);
  const priced = products.filter((x) => x.p.current && !x.c.errors.length);
  const stale = ings.filter((i) => U.daysSince(i.priceUpdatedAt) > st.staleDays);
  const below = priced.filter((x) => x.s.key === 'acima' || x.s.key === 'prejuizo');
  const okCost = products.filter((x) => U.ok(x.c.perDose.total) && !x.c.errors.length);
  const avgCost = U.avg(okCost.map((x) => x.c.perDose.total));
  const avgFC = U.avg(priced.map((x) => x.p.current.foodCostPct));
  const avgMargin = U.avg(priced.map((x) => x.p.current.profitPct));
  const avgContrib = U.avg(priced.map((x) => x.p.current.contributionPct));
  const kpi = (l, v, s = '', cls = '') => `<div class="kpi ${cls}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`;
  const comp = okCost.length ? [
    { label: 'Matérias-primas', value: U.avg(okCost.map((x) => x.c.perDose.materials)), color: '#15a06d' },
    { label: 'Mão de obra', value: U.avg(okCost.map((x) => x.c.perDose.labor)), color: '#1f4b7e' },
    { label: 'Energia', value: U.avg(okCost.map((x) => x.c.perDose.energy)), color: '#c98a00' },
    { label: 'Outros operacionais', value: U.avg(okCost.map((x) => x.c.perDose.operational)), color: '#8a99ab' },
  ] : [];
  const fcItems = priced.map((x) => ({ label: x.r.name, value: x.p.current.foodCostPct })).sort((a, b) => b.value - a.value).slice(0, 15);
  el.innerHTML = `
    ${Sync.mode() === 'cloud' && !Tenants.status().canWrite ? '<div class="alert err"><b>Modo só de leitura.</b> O seu perfil neste estabelecimento é de consulta: pode ver os dados, mas não alterá-los.</div>' : ''}
    ${!Plan.isPro() && Object.keys(Plan.LIMITS).some((s) => Plan.usage(s) >= Plan.LIMITS[s] * 0.8) ? `<div class="alert warn">Plano gratuito: ${Object.keys(Plan.LIMITS).map((s) => `${Plan.usage(s)}/${Plan.LIMITS[s]} ${Plan.LABELS[s]}`).join(' · ')}. <a href="#/configuracoes">Ver plano Pro</a></div>` : ''}
    ${Demo.has() ? `<div class="alert info">Está a ver <b>dados de demonstração</b> (preços fictícios). Pode eliminá-los em <a href="#/configuracoes">Configurações</a> sem afetar os seus dados.</div>` : ''}
    ${!ings.length && !all.length ? `<div class="card"><h2>Bem-vindo</h2><p>Comece por <a href="#/importacao">importar os seus ingredientes</a> ou <a href="#/ingredientes">criá-los manualmente</a>. Para explorar a aplicação, pode <button class="btn sm green" id="loadDemo">carregar dados de demonstração</button>.</p></div>` : ''}
    <div class="kpis">
      ${kpi('Ingredientes cadastrados', ings.length, `${U.num(ings.filter((i) => !i.demo).length, 0)} reais`)}
      ${kpi('Fichas técnicas criadas', all.length, `${all.filter((x) => x.r.intermediate).length} preparações intermédias`)}
      ${kpi('Pratos e artigos produzidos', products.length, `${priced.length} com preço de venda`)}
      ${kpi('Custo médio de produção', U.eur(avgCost), 'por dose (custo total)')}
      ${kpi('Food Cost médio', U.pct(avgFC), `objetivo ${U.num(st.targetFC, 0)} %`, U.ok(avgFC) ? (avgFC > st.targetFC ? 'red' : 'green') : '')}
      ${kpi('Margem de lucro média', U.pct(avgMargin), `contribuição média ${U.pct(avgContrib)}`, U.ok(avgMargin) ? (avgMargin < 0 ? 'red' : 'green') : '')}
      ${kpi('Abaixo do objetivo', below.length, 'Food Cost acima do alvo ou prejuízo', below.length ? 'amber' : 'green')}
      ${kpi('Preços desatualizados', stale.length, `há mais de ${st.staleDays} dias`, stale.length ? 'amber' : 'green')}
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Food Cost por produto (preço atual)</h3></div>${barChart(fcItems, { target: st.targetFC })}</div>
      <div class="card"><div class="card-h"><h3>Composição média do custo</h3></div>${donut(comp, { label: U.eur(avgCost) })}
        <div class="help">Food Cost = custo das matérias-primas ÷ preço de venda sem IVA. A margem de lucro mostrada é estimada sobre o custo de produção imputado à ficha — não é o lucro líquido do negócio.</div></div>
    </div>
    <div class="grid g2">
      <div class="card"><div class="card-h"><h3>Produtos que exigem atenção</h3><a class="btn sm" href="#/produtos">Ver todos</a></div>
        ${below.length ? `<div class="table-wrap"><table><thead><tr><th>Produto</th><th class="r">Food Cost</th><th class="r">Lucro/dose</th><th>Estado</th></tr></thead><tbody>${below.sort((a, b) => a.p.current.profit - b.p.current.profit).slice(0, 10).map((x) => `<tr><td><a href="#/ficha/${x.r.id}">${h(x.r.name)}</a>${demoTag(x.r)}</td><td class="r ${pctClass(x.p.current.foodCostPct, x.p.target)}">${U.pct(x.p.current.foodCostPct)}</td><td class="r ${x.p.current.profit < 0 ? 'red' : ''}">${U.eur(x.p.current.profit)}</td><td>${statusBadge(x.s)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Todos os produtos com preço estão dentro do objetivo.</div>'}
      </div>
      <div class="card"><div class="card-h"><h3>Ingredientes com preço desatualizado</h3><a class="btn sm" href="#/ingredientes?stale">Ver lista</a></div>
        ${stale.length ? `<div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th>Fornecedor</th><th>Atualizado</th></tr></thead><tbody>${stale.sort((a, b) => String(a.priceUpdatedAt).localeCompare(String(b.priceUpdatedAt))).slice(0, 10).map((i) => `<tr><td>${h(i.name)}${demoTag(i)}</td><td>${h(i.supplier || '—')}</td><td class="red">${U.fmtDate(i.priceUpdatedAt)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum preço desatualizado.</div>'}
      </div>
    </div>
    ${(() => { const errs = all.filter((x) => x.c.errors.length); return errs.length ? `<div class="alert err"><b>${errs.length} ficha(s) com erros de dados</b> (custos possivelmente incompletos): ${errs.slice(0, 6).map((x) => `<a href="#/ficha/${x.r.id}">${h(x.r.name)}</a>`).join(', ')}</div>` : ''; })()}
    ${Sync.mode() !== 'cloud' && (!st.lastBackup || U.daysSince(st.lastBackup) > 14) ? `<div class="alert warn">Os dados estão guardados apenas neste navegador. ${st.lastBackup ? 'A última cópia de segurança foi há ' + U.daysSince(st.lastBackup) + ' dias.' : 'Ainda não exportou nenhuma cópia de segurança.'} <button class="btn sm" id="dashBackup">Exportar agora</button></div>` : ''}
  `;
  const ld = $('#loadDemo', el); if (ld) ld.onclick = async () => { await Demo.load(); toast('Dados de demonstração carregados', 'ok'); route(); };
  const db = $('#dashBackup', el); if (db) db.onclick = () => { backupDownload(); route(); };
};

/* ------------------------------ 2. INGREDIENTES ------------------------------ */
const IngUI = {
  state: { q: '', cat: '', sup: '', stale: false, origin: '', sort: 'name', dir: 1, limit: 200 },
  baseLabel(ing) { const b = Calc.ingredientBase(ing); return b ? BASE_LABEL[b.dim] : '?'; },
  purchaseText(i) { return i.purchaseUnit === 'emb' ? `${U.numMax(i.purchaseQty)} emb. × ${U.numMax(i.packQty)} ${UNITS[i.packUnit] ? UNITS[i.packUnit].label : '?'}` : `${U.numMax(i.purchaseQty)} ${UNITS[i.purchaseUnit] ? UNITS[i.purchaseUnit].label : i.purchaseUnit}`; },
};
Views.ingredientes = (el) => {
  const st = getSettings();
  if (location.hash.includes('?stale')) IngUI.state.stale = true;
  const S = IngUI.state;
  const ings = Repo.all('ingredients');
  const cats = [...new Set([...st.ingredientCategories, ...ings.map((i) => i.category).filter(Boolean)])].sort();
  const sups = [...new Set(ings.map((i) => i.supplier).filter(Boolean))].sort();
  el.innerHTML = `<div class="card">
    <div class="toolbar">
      <input class="search" id="iq" placeholder="Pesquisar por nome, código ou fornecedor…" value="${h(S.q)}">
      <select id="icat">${options(cats, S.cat, { empty: 'Todas as categorias' })}</select>
      <select id="isup">${options(sups, S.sup, { empty: 'Todos os fornecedores' })}</select>
      <select id="iorig">${options([['real', 'Só dados reais'], ['demo', 'Só demonstração']], S.origin, { empty: 'Todos os registos' })}</select>
      <label class="check"><input type="checkbox" id="istale" ${S.stale ? 'checked' : ''}> Desatualizados</label>
      <span class="grow"></span>
      <button class="btn" id="iexp">⤓ Excel</button>
      <a class="btn" href="#/importacao">Importar</a>
      <button class="btn primary" id="inew">+ Novo ingrediente</button>
    </div>
    <div class="help">Edite o preço diretamente na tabela: as fichas técnicas que usam o ingrediente são recalculadas automaticamente e a alteração fica no histórico.</div>
    <div id="itable"></div></div>`;
  const draw = () => {
    const q = U.normalize(S.q);
    let list = ings.filter((i) => (!q || U.normalize(`${i.name} ${i.code} ${i.supplier}`).includes(q)) && (!S.cat || i.category === S.cat) && (!S.sup || i.supplier === S.sup) && (!S.stale || U.daysSince(i.priceUpdatedAt) > st.staleDays) && (!S.origin || (S.origin === 'demo' ? i.demo : !i.demo)));
    const uc = new Map(list.map((i) => [i.id, Calc.ingredientUnitCost(i, st)]));
    const key = { name: (i) => U.normalize(i.name), code: (i) => i.code || '', cat: (i) => i.category || '', unit: (i) => uc.get(i.id).cost || 0, date: (i) => i.priceUpdatedAt || '', waste: (i) => Number(i.wastePct) || 0 }[S.sort];
    list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0) * S.dir);
    const shown = list.slice(0, S.limit);
    const th = (k, l, cls = '') => `<th class="sortable ${cls}" data-sort="${k}">${l}${S.sort === k ? (S.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    $('#itable', el).innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr>${th('code', 'Código')}${th('name', 'Ingrediente')}${th('cat', 'Categoria')}<th>Fornecedor</th><th>Compra</th><th class="r">Preço compra</th><th class="r">IVA</th>${th('unit', 'Custo/base', 'r')}${th('waste', 'Desp.', 'r')}<th class="r">Rend.</th><th>Alergénios</th>${th('date', 'Atualizado')}<th></th></tr></thead><tbody>
      ${shown.map((i) => { const c = uc.get(i.id); const old = U.daysSince(i.priceUpdatedAt) > st.staleDays; return `<tr data-id="${i.id}">
        <td class="small">${h(i.code || '')}</td><td><b>${h(i.name)}</b>${demoTag(i)}</td><td class="small">${h(i.category || '—')}</td><td class="small">${h(i.supplier || '—')}</td>
        <td class="small nowrap">${h(IngUI.purchaseText(i))}</td>
        <td class="r"><input class="num inline-edit" data-price value="${h(vNum(i.price))}" title="Preço ${i.priceIncludesVat ? 'com' : 'sem'} IVA"> <span class="small muted">${i.priceIncludesVat ? 'c/IVA' : 's/IVA'}</span></td>
        <td class="r small">${U.num(Number(i.vat) || 0, 0)} %</td>
        <td class="r nowrap ${c.error ? 'red' : ''}">${c.error ? h(c.error) : U.eur4(c.cost) + '/' + h(IngUI.baseLabel(i))}</td>
        <td class="r small">${U.num(Number(i.wastePct) || 0, 1)} %</td><td class="r small">${U.num(100 - (Number(i.wastePct) || 0), 1)} %</td>
        <td>${algList(i.allergens || [], i.traces || [])}</td>
        <td class="small nowrap ${old ? 'red' : ''}">${U.fmtDate(i.priceUpdatedAt)}</td>
        <td class="nowrap"><button class="btn sm" data-act="edit">Editar</button> <button class="btn sm" data-act="hist" title="Histórico de preços">Histórico</button> <button class="btn sm" data-act="use" title="Fichas que usam este ingrediente">Uso</button> <button class="btn sm danger" data-act="del" title="Eliminar">✕</button></td></tr>`; }).join('')}
      </tbody></table></div>${list.length > S.limit ? `<div class="empty"><button class="btn" id="imore">Mostrar mais (${list.length - S.limit} restantes)</button></div>` : ''}<div class="small muted" style="margin-top:6px">${list.length} de ${ings.length} ingredientes</div>`
      : `<div class="empty">${ings.length ? 'Nenhum ingrediente corresponde aos filtros.' : 'Ainda não há ingredientes. Crie um novo ou importe uma lista.'}</div>`;
    $$('[data-sort]', el).forEach((t) => (t.onclick = () => { S.dir = S.sort === t.dataset.sort ? -S.dir : 1; S.sort = t.dataset.sort; draw(); }));
    const more = $('#imore', el); if (more) more.onclick = () => { S.limit += 200; draw(); };
    $$('tr[data-id]', el).forEach((tr) => {
      const ing = Repo.get('ingredients', tr.dataset.id);
      $('[data-price]', tr).addEventListener('change', async (e) => {
        const v = U.parseNum(e.target.value);
        if (!(v >= 0)) { e.target.classList.add('bad'); toast('Preço inválido', 'err'); return; }
        e.target.classList.remove('bad');
        if (Math.abs(v - Number(ing.price)) < 1e-9) return;
        const res = await Services.saveIngredient({ ...ing, price: v, priceUpdatedAt: U.todayISO() }, { source: 'tabela' });
        toast(res.entry ? `Preço atualizado (${signPct(res.entry.diffPct)}). ${res.entry.impacts.length} ficha(s) recalculada(s).` : 'Preço atualizado', 'ok');
        draw();
      });
      $$('[data-act]', tr).forEach((b) => (b.onclick = () => ({ edit: () => ingredientForm(ing, draw), hist: () => ingredientHistory(ing), use: () => ingredientUsage(ing), del: () => deleteIngredient(ing, draw) })[b.dataset.act]()));
    });
  };
  const refresh = () => Views.ingredientes(el);
  $('#iq', el).oninput = (e) => { S.q = e.target.value; S.limit = 200; draw(); };
  $('#icat', el).onchange = (e) => { S.cat = e.target.value; draw(); };
  $('#isup', el).onchange = (e) => { S.sup = e.target.value; draw(); };
  $('#iorig', el).onchange = (e) => { S.origin = e.target.value; draw(); };
  $('#istale', el).onchange = (e) => { S.stale = e.target.checked; draw(); };
  $('#inew', el).onclick = () => ingredientForm(null, refresh);
  $('#iexp', el).onclick = () => exportRows('xlsx', 'ingredientes', [Reports.ingredientsSheet()]);
  draw();
};

function ingredientForm(ing, after) {
  const st = getSettings();
  const isNew = !ing;
  const i = ing ? U.clone(ing) : { purchaseUnit: 'kg', purchaseQty: 1, price: null, vat: countryInfo().purchaseVat, priceIncludesVat: false, wastePct: 0, allergens: [], traces: [], priceUpdatedAt: U.todayISO() };
  const ings = Repo.all('ingredients');
  const cats = [...new Set([...st.ingredientCategories, ...ings.map((x) => x.category).filter(Boolean)])].sort();
  const sups = [...new Set(ings.map((x) => x.supplier).filter(Boolean))].sort();
  const algChecks = (name, sel) => `<div class="grid g2" style="gap:4px">${ALLERGENS.map((a) => `<label class="check"><input type="checkbox" name="${name}_${a.id}" ${(sel || []).includes(a.id) ? 'checked' : ''}> ${algBadge(a.id)} ${h(a.name)}</label>`).join('')}</div>`;
  const m = modal({
    title: isNew ? 'Novo ingrediente' : 'Editar ingrediente', size: 'wide',
    body: `<form id="ingf" autocomplete="off">
      ${i.demo ? '<div class="alert info">Registo de demonstração (preço fictício).</div>' : ''}
      <div class="fields">
        <div class="field"><label>Código interno</label><input name="code" value="${h(i.code || (i.id ? '' : nextIngredientCode()))}" placeholder="${h(tr('Automático'))}"></div>
        <div class="field" style="grid-column:span 2"><label>Nome do ingrediente *</label><input name="name" value="${h(i.name || '')}" required></div>
        <div class="field"><label>Categoria</label><input name="category" list="dl-cat" value="${h(i.category || '')}"><datalist id="dl-cat">${cats.map((c) => `<option value="${h(c)}">`).join('')}</datalist></div>
        <div class="field"><label>Fornecedor</label><input name="supplier" list="dl-sup" value="${h(i.supplier || '')}"><datalist id="dl-sup">${sups.map((c) => `<option value="${h(c)}">`).join('')}</datalist></div>
      </div>
      <div class="sep"></div><h4>Compra e preço</h4>
      <div class="fields">
        <div class="field"><label>Unidade de compra *</label><select name="purchaseUnit">${options(PURCHASE_UNITS, i.purchaseUnit)}</select></div>
        <div class="field"><label>Quantidade comprada *</label>${numInput('purchaseQty', i.purchaseQty)}</div>
        <div class="field emb"><label>Conteúdo de cada embalagem *</label>${numInput('packQty', i.packQty)}</div>
        <div class="field emb"><label>Unidade do conteúdo</label><select name="packUnit">${options(Object.keys(UNITS).map((u) => [u, UNITS[u].label]), i.packUnit || 'kg')}</select></div>
        <div class="field"><label>Preço de compra (total) *</label>${numInput('price', i.price)}<span class="hint">Valor pago pela quantidade indicada</span></div>
        <div class="field"><label>IVA da compra (%)</label>${numInput('vat', i.vat, 'list="dl-vat"')}<datalist id="dl-vat">${(VAT_RATES[getSettings().country] || []).map((r) => `<option value="${U.inNum(r)}">`).join('')}</datalist></div>
        <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="priceIncludesVat" ${i.priceIncludesVat ? 'checked' : ''}> O preço inclui IVA</label></div>
        <div class="field"><label>Data da última atualização</label><input type="date" name="priceUpdatedAt" value="${h(i.priceUpdatedAt || '')}"></div>
      </div>
      <div class="alert ok" id="ucalc" style="margin-top:10px"></div>
      <div class="sep"></div><h4>Aproveitamento e conversões</h4>
      <div class="fields">
        <div class="field"><label>Desperdício (%)</label>${numInput('wastePct', i.wastePct)}<span class="hint">Perda na limpeza/preparação</span></div>
        <div class="field"><label>Rendimento aproveitável (%)</label>${numInput('yieldPct', 100 - (Number(i.wastePct) || 0))}</div>
        <div class="field"><label>Densidade (kg/L) — opcional</label>${numInput('density', i.density)}<span class="hint">Para converter peso ↔ volume</span></div>
        <div class="field"><label>Peso por unidade (g) — opcional</label>${numInput('unitWeightG', i.unitWeightG)}<span class="hint">Para converter unidades ↔ peso</span></div>
      </div>
      <div class="sep"></div>
      <div class="grid g2">
        <div><h4>Alergénios — contém</h4>${algChecks('a', i.allergens)}</div>
        <div><h4>Pode conter (contaminação cruzada)</h4>${algChecks('t', i.traces)}</div>
      </div>
      <div class="sep"></div>
      <div class="field"><label>Observações</label><textarea name="notes">${h(i.notes || '')}</textarea></div>
    </form>`,
    footer: `<button class="btn" data-close>Cancelar</button><button class="btn primary" id="ingSave">Guardar</button>`,
  });
  const f = m.$('#ingf');
  const upd = () => {
    const v = readForm(f);
    $$('.emb', f).forEach((x) => (x.style.display = v.purchaseUnit === 'emb' ? '' : 'none'));
    const tmp = { ...i, ...v };
    const c = Calc.ingredientUnitCost(tmp, st);
    const b = Calc.ingredientBase(tmp);
    m.$('#ucalc').innerHTML = c.error || !b ? `<span class="red">${h(c.error || 'Indique quantidade e unidade')}</span>` :
      `Preço por ${BASE_LABEL[b.dim]}: <b>${U.eur4(c.net)}</b> sem IVA · ${U.eur4(c.gross)} com IVA · custo usado nas fichas: <b>${U.eur4(c.cost)}</b> ${st.vatDeductible ? '(IVA dedutível)' : '(IVA não dedutível)'}${Number(v.wastePct) > 0 && Number(v.wastePct) < 100 ? ` · custo efetivo com desperdício: <b>${U.eur4(c.cost / (1 - v.wastePct / 100))}</b>` : ''}`;
  };
  f.addEventListener('input', (e) => {
    if (e.target.name === 'wastePct') { const w = U.parseNum(e.target.value); if (U.ok(w)) $('[name=yieldPct]', f).value = U.inNum(100 - w); }
    if (e.target.name === 'yieldPct') { const y = U.parseNum(e.target.value); if (U.ok(y)) $('[name=wastePct]', f).value = U.inNum(100 - y); }
    upd();
  });
  f.addEventListener('change', upd);
  upd();
  m.$('#ingSave').onclick = async () => {
    const v = readForm(f);
    const bad = [];
    if (!String(v.name || '').trim()) bad.push('name');
    if (!(v.purchaseQty > 0)) bad.push('purchaseQty');
    if (v.price === null || !(v.price >= 0)) bad.push('price');
    if (v.vat !== null && !(v.vat >= 0 && v.vat <= 100)) bad.push('vat');
    if (v.wastePct !== null && !(v.wastePct >= 0 && v.wastePct < 100)) bad.push('wastePct');
    if (v.purchaseUnit === 'emb' && !(v.packQty > 0)) bad.push('packQty');
    if (v.density !== null && !(v.density > 0)) bad.push('density');
    if (v.unitWeightG !== null && !(v.unitWeightG > 0)) bad.push('unitWeightG');
    markInvalid(f, bad);
    if (bad.length) { toast('Corrija os campos assinalados', 'err'); return; }
    const out = { ...i, code: v.code.trim(), name: v.name.trim(), category: v.category.trim(), supplier: v.supplier.trim(), purchaseUnit: v.purchaseUnit, purchaseQty: v.purchaseQty, packQty: v.purchaseUnit === 'emb' ? v.packQty : null, packUnit: v.purchaseUnit === 'emb' ? v.packUnit : null, price: v.price, vat: v.vat || 0, priceIncludesVat: v.priceIncludesVat, wastePct: v.wastePct || 0, density: v.density, unitWeightG: v.unitWeightG, priceUpdatedAt: v.priceUpdatedAt || U.todayISO(), notes: v.notes, allergens: ALLERGENS.filter((a) => v['a_' + a.id]).map((a) => a.id), traces: ALLERGENS.filter((a) => v['t_' + a.id] && !v['a_' + a.id]).map((a) => a.id) };
    delete out.yieldPct;
    const dup = ings.find((x) => x.id !== out.id && ((out.code && x.code && U.normalize(x.code) === U.normalize(out.code)) || U.normalize(x.name) === U.normalize(out.name)));
    if (dup && !(await confirmDlg(`Já existe um ingrediente semelhante: <b>${h(dup.name)}</b>${dup.code ? ' (código ' + h(dup.code) + ')' : ''}. Guardar mesmo assim?`, { ok: 'Guardar duplicado' }))) return;
    const priceChanged = ing && (ing.price !== out.price || ing.purchaseQty !== out.purchaseQty || ing.packQty !== out.packQty || ing.vat !== out.vat || ing.priceIncludesVat !== out.priceIncludesVat || ing.purchaseUnit !== out.purchaseUnit);
    if (priceChanged && out.priceUpdatedAt === ing.priceUpdatedAt) out.priceUpdatedAt = U.todayISO();
    const res = await Services.saveIngredient(out);
    m.close();
    toast(res.entry ? `Guardado. Custo ${signPct(res.entry.diffPct)}; ${res.entry.impacts.length} ficha(s) recalculada(s).` : 'Ingrediente guardado', 'ok');
    after && after();
  };
}
function ingredientHistory(ing) {
  const hist = Repo.all('priceHistory').filter((x) => x.ingredientId === ing.id).sort((a, b) => a.date.localeCompare(b.date));
  const pts = hist.length ? [{ date: ing.createdAt || hist[0].date, value: hist[0].oldUnitCost }, ...hist.map((x) => ({ date: x.date, value: x.newUnitCost }))] : [];
  if (pts.length > 1 && new Date(pts[0].date) >= new Date(pts[1].date)) pts[0].date = new Date(new Date(pts[1].date).getTime() - 86400000).toISOString();
  const bl = IngUI.baseLabel(ing);
  modal({ title: tr('Histórico de preços') + ' — ' + ing.name, size: 'wide', body: `
    ${lineChart(pts)}
    ${hist.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th class="r">Custo anterior</th><th class="r">Custo novo</th><th class="r">Diferença</th><th>Origem</th><th>Impacto nas fichas (custo por dose)</th></tr></thead><tbody>${hist.slice().reverse().map((x) => `<tr><td class="nowrap">${U.fmtDateTime(x.date)}</td><td class="r">${U.eur4(x.oldUnitCost)}/${h(bl)}</td><td class="r">${U.eur4(x.newUnitCost)}/${h(bl)}</td><td class="r ${diffCls(x.diffPct)}">${signPct(x.diffPct)}</td><td class="small">${h(x.source || '')}</td><td class="small">${x.impacts.length ? x.impacts.map((im) => `${h(im.recipeName)}: ${U.eur(im.oldDose)} → <b>${U.eur(im.newDose)}</b> <span class="${diffCls(im.newDose - im.oldDose)}">(${signEur(im.newDose - im.oldDose)})</span>`).join('<br>') : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem alterações de preço registadas.</div>'}` });
}
function ingredientUsage(ing) {
  const data = dataView();
  const u = Calc.usages(data, 'ing', ing.id);
  const ev = Calc.evaluator(data);
  modal({ title: tr('Fichas que usam') + ' — ' + ing.name, body: u.all.length ? `<div class="table-wrap"><table><thead><tr><th>Ficha técnica</th><th>Utilização</th><th class="r">Custo/dose</th></tr></thead><tbody>${u.all.map((id) => { const r = data.recipes.get(id); return `<tr><td><a href="#/ficha/${id}" data-close>${h(r.name)}</a></td><td>${u.direct.includes(id) ? 'Direta' : 'Via preparação intermédia'}</td><td class="r">${U.eur(ev.cost(r).perDose.total)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Este ingrediente não é usado em nenhuma ficha.</div>' });
}
async function deleteIngredient(ing, after) {
  const u = Calc.usages(dataView(), 'ing', ing.id);
  if (u.direct.length) { modal({ title: 'Não é possível eliminar', size: 'small', body: `<p><b>${h(ing.name)}</b> é usado em ${u.direct.length} ficha(s): <span data-notr>${u.direct.map((id) => h(Repo.get('recipes', id).name)).join(', ')}</span>.</p><p>Remova-o dessas fichas primeiro.</p>` }); return; }
  if (!(await confirmDlg(`Eliminar <b>${h(ing.name)}</b>? O histórico de preços também será eliminado.`, { ok: 'Eliminar', danger: true }))) return;
  await Repo.removeMany('priceHistory', Repo.all('priceHistory').filter((x) => x.ingredientId === ing.id).map((x) => x.id));
  await Repo.remove('ingredients', ing.id);
  toast('Ingrediente eliminado'); after && after();
}

/* ------------------------------ 3. IMPORTAÇÃO ------------------------------ */
const IMPORT_FIELDS = [
  { key: 'code', label: 'Código interno', syn: ['codigo', 'cod', 'ref', 'referencia', 'sku', 'artigo', 'codigo', 'code', 'cod', 'ref', 'reference', 'referencia', 'sku', 'item code', 'product code'] },
  { key: 'name', label: 'Nome do ingrediente *', syn: ['nome', 'ingrediente', 'descricao', 'designacao', 'produto', 'materia prima', 'artigo descricao', 'nombre', 'producto', 'ingrediente', 'descripcion', 'articulo', 'nom', 'produit', 'designation', 'libelle', 'name', 'product', 'ingredient', 'description', 'item'] },
  { key: 'category', label: 'Categoria', syn: ['categoria', 'familia', 'grupo', 'tipo', 'categoria', 'familia', 'categorie', 'famille', 'category', 'family', 'group'] },
  { key: 'supplier', label: 'Fornecedor', syn: ['fornecedor', 'marca', 'distribuidor', 'proveedor', 'marca', 'fournisseur', 'marque', 'supplier', 'vendor', 'brand'] },
  { key: 'purchaseUnit', label: 'Unidade de compra', syn: ['unidade', 'un', 'unid', 'unidade compra', 'medida', 'unidad', 'medida', 'unite', 'unit', 'uom', 'unit of measure'] },
  { key: 'purchaseQty', label: 'Quantidade comprada', syn: ['quantidade', 'qtd', 'qtde', 'quant', 'quantidade comprada', 'cantidad', 'cant', 'quantite', 'qte', 'quantity', 'qty'] },
  { key: 'packQty', label: 'Conteúdo da embalagem', syn: ['conteudo', 'conteudo embalagem', 'peso embalagem', 'capacidade', 'formato', 'contenido', 'contenido envase', 'contenu', 'pack size', 'size', 'content'] },
  { key: 'packUnit', label: 'Unidade do conteúdo', syn: ['unidade conteudo', 'unidade embalagem', 'unidad contenido', 'unite contenu', 'pack unit'] },
  { key: 'price', label: 'Preço de compra (total)', syn: ['preco', 'preco compra', 'valor', 'custo', 'preco total', 'pvp', 'preco s iva', 'preco sem iva', 'precio', 'precio compra', 'importe', 'coste', 'prix', 'prix achat', 'cout', 'montant', 'price', 'cost', 'purchase price', 'net price'] },
  { key: 'unitPrice', label: 'Preço por kg/L/un', syn: ['preco kg', 'preco por kg', 'preco unitario', 'preco litro', 'eur kg', 'preco unidade', 'custo unitario', 'precio kg', 'precio por kg', 'precio unitario', 'prix kg', 'prix au kg', 'prix unitaire', 'price per kg', 'unit price', 'price kg'] },
  { key: 'vat', label: 'IVA (%)', syn: ['iva', 'taxa iva', 'iva %', 'imposto', 'iva', 'tva', 'vat', 'tax', 'tipo iva', 'taux tva', 'vat rate'] },
  { key: 'priceIncludesVat', label: 'Preço inclui IVA (sim/não)', syn: ['inclui iva', 'com iva', 'iva incluido', 'iva incluido', 'con iva', 'ttc', 'tva incluse', 'inc vat', 'vat included', 'including vat'] },
  { key: 'wastePct', label: 'Desperdício (%)', syn: ['desperdicio', 'perda', 'quebra', 'desp', 'merma', 'desperdicio', 'perte', 'dechet', 'waste', 'wastage'] },
  { key: 'yieldPct', label: 'Rendimento (%)', syn: ['rendimento', 'aproveitamento', 'rend', 'rendimiento', 'aprovechamiento', 'rendement', 'yield'] },
  { key: 'allergens', label: 'Alergénios', syn: ['alergenios', 'alergenos', 'alergias', 'alergenos', 'alergenos', 'allergenes', 'allergens'] },
  { key: 'priceUpdatedAt', label: 'Data de atualização', syn: ['data', 'data atualizacao', 'atualizado', 'data preco', 'fecha', 'fecha actualizacion', 'date', 'date mise a jour', 'updated', 'last updated'] },
];
const Importer = { rows: null, sheets: null, header: true, map: {}, items: [], source: '' };
function autoMap(headers) {
  const map = {}; const used = new Set();
  const hs = headers.map((x) => U.normalize(x));
  for (const f of IMPORT_FIELDS) {
    let idx = hs.findIndex((x, i) => !used.has(i) && (x === U.normalize(f.label.replace('*', '')) || f.syn.includes(x)));
    if (idx < 0) idx = hs.findIndex((x, i) => !used.has(i) && x && f.syn.some((s) => s.length > 3 && x.includes(s)));
    if (idx >= 0) { map[f.key] = idx; used.add(idx); }
  }
  return map;
}
function rowToIngredient(row, map, settings) {
  const g = (k) => (map[k] !== undefined && map[k] !== '' ? row[map[k]] : undefined);
  const errs = [];
  const name = String(g('name') ?? '').trim();
  if (!name) errs.push('Nome em falta');
  let unit = g('purchaseUnit') !== undefined ? parseUnit(g('purchaseUnit')) : 'kg';
  if (g('purchaseUnit') !== undefined && String(g('purchaseUnit')).trim() && !unit) errs.push('Unidade desconhecida: ' + g('purchaseUnit'));
  if (!unit) unit = 'kg';
  if (unit === 'dz') unit = 'un';
  let qty = g('purchaseQty') !== undefined && String(g('purchaseQty')).trim() !== '' ? U.parseNum(g('purchaseQty')) : 1;
  if (parseUnit(g('purchaseUnit')) === 'dz') qty *= 12;
  let price = g('price') !== undefined && String(g('price')).trim() !== '' ? U.parseNum(g('price')) : NaN;
  const unitPrice = g('unitPrice') !== undefined && String(g('unitPrice')).trim() !== '' ? U.parseNum(g('unitPrice')) : NaN;
  if (!U.ok(price) && U.ok(unitPrice)) { price = unitPrice; qty = 1; }
  if (!U.ok(price) || price < 0) errs.push('Preço inválido');
  if (!(qty > 0)) errs.push('Quantidade inválida');
  let packQty = null, packUnit = null;
  if (unit === 'emb') {
    packQty = U.parseNum(g('packQty')); packUnit = parseUnit(g('packUnit')) || 'kg';
    if (!(packQty > 0)) errs.push('Embalagem sem conteúdo');
  }
  const vatRaw = g('vat'); let vat = vatRaw !== undefined && String(vatRaw).trim() !== '' ? U.parseNum(vatRaw) : countryInfo().purchaseVat;
  if (U.ok(vat) && vat > 0 && vat < 1) vat = vat * 100;
  if (!U.ok(vat) || vat < 0 || vat > 100) { errs.push('IVA inválido'); vat = 0; }
  const incRaw = U.normalize(g('priceIncludesVat'));
  const inc = ['sim', 's', 'yes', 'y', '1', 'true', 'verdadeiro', 'x'].includes(incRaw);
  let waste = U.parseNum(g('wastePct'));
  const yld = U.parseNum(g('yieldPct'));
  if (!U.ok(waste) && U.ok(yld)) waste = (yld > 0 && yld <= 1 ? yld * 100 : yld) <= 100 ? 100 - (yld > 0 && yld <= 1 ? yld * 100 : yld) : NaN;
  else if (U.ok(waste) && waste > 0 && waste < 1) waste = waste * 100;
  if (!U.ok(waste)) waste = 0;
  if (waste < 0 || waste >= 100) { errs.push('Desperdício inválido'); waste = 0; }
  const dateRaw = g('priceUpdatedAt');
  const date = U.parseDate(dateRaw);
  if (dateRaw !== undefined && String(dateRaw).trim() && !date) errs.push('Data inválida');
  return { errs, ing: { code: String(g('code') ?? '').trim(), name, category: String(g('category') ?? '').trim(), supplier: String(g('supplier') ?? '').trim(), purchaseUnit: unit, purchaseQty: qty, packQty, packUnit, price, vat, priceIncludesVat: inc, wastePct: waste, allergens: parseAllergens(g('allergens')), traces: [], priceUpdatedAt: date || U.todayISO() } };
}
Views.importacao = (el) => {
  const step = Importer.rows ? (Importer.items.length ? 3 : 2) : 1;
  const stepsBar = `<div class="steps">${['1. Carregar dados', '2. Associar colunas', '3. Pré-visualizar e corrigir', '4. Concluído'].map((s, i) => `<span class="step ${i + 1 === step ? 'active' : i + 1 < step ? 'done' : ''}">${s}</span>`).join('')}</div>`;
  if (step === 1) {
    el.innerHTML = `<div class="card">${stepsBar}
      <div class="grid g2">
        <div><h3>Ficheiro Excel ou CSV</h3><p class="muted">Formatos aceites: .xlsx, .csv (separador ; , ou tabulação). Ficheiros .xls antigos devem ser guardados como .xlsx.</p>
          <label class="btn primary filebtn">📂 Escolher ficheiro…<input type="file" id="impFile" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
          <p><button class="btn sm" id="impTpl">⤓ Descarregar modelo Excel</button></p></div>
        <div><h3>Copiar e colar</h3><p class="muted">Selecione as células na folha de cálculo (incluindo o cabeçalho), copie e cole aqui.</p>
          <textarea id="impPaste" placeholder="Código	Nome	Unidade	Quantidade	Preço	IVA…" style="min-height:130px;font-family:monospace;font-size:12px"></textarea>
          <button class="btn primary" id="impPasteGo">Continuar</button></div>
      </div></div>`;
    $('#impFile', el).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        if (/\.xlsx$/i.test(file.name)) {
          const sheets = await IO.readXlsx(await file.arrayBuffer());
          const nonEmpty = sheets.filter((s) => s.rows.length);
          if (!nonEmpty.length) throw new Error('O ficheiro não tem dados');
          Importer.sheets = nonEmpty; Importer.rows = nonEmpty[0].rows;
        } else { Importer.sheets = null; Importer.rows = IO.parseCSV(await IO.readAsText(file)); }
        if (!Importer.rows.length) throw new Error('Não foram encontradas linhas');
        Importer.source = file.name; Importer.header = true; Importer.map = autoMap(Importer.rows[0].map(String)); Importer.items = [];
        Views.importacao(el);
      } catch (err) { toast(err.message, 'err'); }
    };
    $('#impPasteGo', el).onclick = () => {
      const t = $('#impPaste', el).value;
      if (!t.trim()) { toast('Cole os dados primeiro', 'err'); return; }
      Importer.rows = IO.parseCSV(t, t.includes('\t') ? '\t' : undefined); Importer.sheets = null; Importer.source = 'colagem';
      Importer.header = true; Importer.map = autoMap(Importer.rows[0].map(String)); Importer.items = [];
      Views.importacao(el);
    };
    $('#impTpl', el).onclick = () => IO.download(IO.writeXlsx([{ name: 'Ingredientes', widths: [10, 32, 18, 18, 10, 10, 12, 12, 12, 8, 12, 14, 22, 14], rows: [
      ['Código', 'Nome', 'Categoria', 'Fornecedor', 'Unidade', 'Quantidade', 'Conteúdo embalagem', 'Unidade conteúdo', 'Preço', 'IVA', 'Inclui IVA', 'Desperdício', 'Alergénios', 'Data'].map((v) => ({ v, t: 'head' })),
      ['A001', 'Exemplo: Peito de frango', 'Carnes', 'Fornecedor X', 'kg', 5, '', '', 24.5, 6, 'não', 5, '', U.fmtDate(U.todayISO())],
      ['A002', 'Exemplo: Natas 1 L', 'Laticínios e ovos', 'Fornecedor Y', 'emb', 6, 1, 'l', 21.6, 6, 'não', 0, 'leite', U.fmtDate(U.todayISO())],
    ] }]), 'modelo-importacao-ingredientes.xlsx');
    return;
  }
  const rows = Importer.rows;
  const headers = Importer.header ? rows[0].map((x, i) => String(x || `Coluna ${i + 1}`)) : rows[0].map((_, i) => `Coluna ${i + 1}`);
  const body = Importer.header ? rows.slice(1) : rows;
  if (step === 2) {
    el.innerHTML = `<div class="card">${stepsBar}
      <div class="toolbar"><b>Origem:</b> ${h(Importer.source)} · ${body.length} linhas
        ${Importer.sheets && Importer.sheets.length > 1 ? `<select id="impSheet">${Importer.sheets.map((s, i) => `<option value="${i}" ${s.rows === rows ? 'selected' : ''}>${h(s.name)}</option>`).join('')}</select>` : ''}
        <label class="check"><input type="checkbox" id="impHdr" ${Importer.header ? 'checked' : ''}> A primeira linha é cabeçalho</label></div>
      <div class="help">As colunas foram associadas automaticamente pelo nome. Confirme ou altere. Se tiver apenas o preço por kg/L/un, associe-o a "Preço por kg/L/un".</div>
      <div class="fields">${IMPORT_FIELDS.map((f) => `<div class="field"><label>${h(f.label)}</label><select data-map="${f.key}">${options(headers.map((x, i) => [i, x]), Importer.map[f.key], { empty: '— não importar —' })}</select></div>`).join('')}</div>
      <h4 style="margin-top:14px">Primeiras linhas do ficheiro</h4>
      <div class="table-wrap"><table><thead><tr>${headers.map((x) => `<th>${h(x)}</th>`).join('')}</tr></thead><tbody>${body.slice(0, 5).map((r) => `<tr>${r.map((c) => `<td class="small">${h(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <div class="toolbar" style="margin-top:12px"><button class="btn" id="impBack">← Recomeçar</button><span class="grow"></span><button class="btn primary" id="impNext">Pré-visualizar →</button></div></div>`;
    $$('[data-map]', el).forEach((s) => (s.onchange = () => { if (s.value === '') delete Importer.map[s.dataset.map]; else Importer.map[s.dataset.map] = Number(s.value); }));
    $('#impHdr', el).onchange = (e) => { Importer.header = e.target.checked; if (Importer.header) Importer.map = autoMap(rows[0].map(String)); Views.importacao(el); };
    const sh = $('#impSheet', el); if (sh) sh.onchange = () => { Importer.rows = Importer.sheets[+sh.value].rows; Importer.map = autoMap(Importer.rows[0].map(String)); Views.importacao(el); };
    $('#impBack', el).onclick = () => { Importer.rows = null; Importer.items = []; Views.importacao(el); };
    $('#impNext', el).onclick = () => {
      if (Importer.map.name === undefined) { toast('Associe pelo menos a coluna do nome', 'err'); return; }
      if (Importer.map.price === undefined && Importer.map.unitPrice === undefined) { toast('Associe a coluna do preço', 'err'); return; }
      const st = getSettings();
      const existing = Repo.all('ingredients');
      const seen = new Map();
      Importer.items = body.filter((r) => r.some((c) => String(c).trim() !== '')).map((r, idx) => {
        const { errs, ing } = rowToIngredient(r, Importer.map, st);
        const nk = U.normalize(ing.name), ck = U.normalize(ing.code);
        const dup = existing.find((x) => (ck && x.code && U.normalize(x.code) === ck) || (nk && U.normalize(x.name) === nk));
        const inFile = seen.get(ck || nk); if (nk) seen.set(ck || nk, idx);
        return { ing, errs, dup: dup ? dup.id : null, dupInFile: inFile !== undefined ? inFile : null, action: errs.length ? 'skip' : dup ? 'update' : 'create' };
      });
      Views.importacao(el);
    };
    return;
  }
  // step 3 — pré-visualização
  const items = Importer.items;
  const count = (a) => items.filter((x) => x.action === a).length;
  el.innerHTML = `<div class="card">${stepsBar}
    <div class="toolbar"><span class="badge green">${count('create')} a criar</span><span class="badge blue">${count('update')} a atualizar</span><span class="badge gray">${count('skip')} a ignorar</span>
      <span class="badge red">${items.filter((x) => x.errs.length).length} com erros</span><span class="badge amber">${items.filter((x) => x.dup || x.dupInFile !== null).length} possíveis duplicados</span>
      <span class="grow"></span><select id="impBulk"><option value="">Ação para todos os duplicados…</option><option value="update">Atualizar existentes</option><option value="create">Criar como novos</option><option value="skip">Ignorar</option></select></div>
    <div class="help">Corrija os valores diretamente na tabela. Linhas com erros não são importadas até serem corrigidas. Duplicados (mesmo código ou nome) são assinalados: escolha atualizar o existente, criar novo ou ignorar. Atualizar o preço regista histórico e recalcula as fichas.</div>
    <div class="table-wrap" style="max-height:60vh"><table><thead><tr><th>#</th><th>Ação</th><th>Código</th><th>Nome</th><th>Categoria</th><th>Fornecedor</th><th>Unid.</th><th class="r">Qtd.</th><th class="r">Emb.</th><th class="r">Preço</th><th class="r">IVA</th><th class="r">Desp.</th><th>Alerg.</th><th>Data</th><th>Validação</th></tr></thead><tbody>
    ${items.map((it, i) => { const g = it.ing; const ex = it.dup ? Repo.get('ingredients', it.dup) : null; return `<tr data-i="${i}">
      <td class="small muted">${i + 1}</td>
      <td><select data-f="action">${options([['create', 'Criar'], ['update', 'Atualizar'], ['skip', 'Ignorar']].filter((o) => o[0] !== 'update' || it.dup), it.action)}</select></td>
      <td><input data-f="code" value="${h(g.code)}" style="width:70px"></td><td><input data-f="name" value="${h(g.name)}" style="width:180px"></td>
      <td><input data-f="category" value="${h(g.category)}" style="width:110px"></td><td><input data-f="supplier" value="${h(g.supplier)}" style="width:110px"></td>
      <td><select data-f="purchaseUnit">${options(PURCHASE_UNITS, g.purchaseUnit)}</select></td>
      <td class="r"><input class="num" data-f="purchaseQty" value="${h(U.inNum(g.purchaseQty))}" style="width:60px"></td>
      <td class="r">${g.purchaseUnit === 'emb' ? `<input class="num" data-f="packQty" value="${h(U.inNum(g.packQty))}" style="width:50px"><select data-f="packUnit">${options(Object.keys(UNITS), g.packUnit)}</select>` : '<span class="muted">—</span>'}</td>
      <td class="r"><input class="num" data-f="price" value="${h(U.inNum(g.price))}" style="width:70px">${ex ? `<div class="small muted">atual: ${U.num(Number(ex.price), 2)}</div>` : ''}</td>
      <td class="r"><input class="num" data-f="vat" value="${h(U.inNum(g.vat))}" style="width:46px"></td>
      <td class="r"><input class="num" data-f="wastePct" value="${h(U.inNum(g.wastePct))}" style="width:46px"></td>
      <td>${algList(g.allergens)}</td><td class="small nowrap">${U.fmtDate(g.priceUpdatedAt)}</td>
      <td class="small">${it.errs.length ? `<span class="red">${h(it.errs.join('; '))}</span>` : '<span class="green-t">OK</span>'}${ex ? `<div class="amber-t">${tr('Já existe')}: ${h(ex.name)}${ex.demo ? ' (demo — passará a registo real se atualizar)' : ''}</div>` : ''}${it.dupInFile !== null ? `<div class="amber-t">Repetido na linha ${it.dupInFile + 1}</div>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="toolbar" style="margin-top:12px"><button class="btn" id="impBack2">← Associação de colunas</button><span class="grow"></span><button class="btn green" id="impGo">Importar ${count('create') + count('update')} ingrediente(s)</button></div></div>`;
  const revalidate = (i) => {
    const it = items[i]; const g = it.ing; const e = [];
    if (!g.name) e.push('Nome em falta'); if (!(g.price >= 0)) e.push('Preço inválido'); if (!(g.purchaseQty > 0)) e.push('Quantidade inválida');
    if (!(g.vat >= 0 && g.vat <= 100)) e.push('IVA inválido'); if (!(g.wastePct >= 0 && g.wastePct < 100)) e.push('Desperdício inválido');
    if (g.purchaseUnit === 'emb' && !(g.packQty > 0)) e.push('Embalagem sem conteúdo');
    it.errs = e;
  };
  $$('tr[data-i]', el).forEach((tr) => {
    const i = +tr.dataset.i;
    $$('[data-f]', tr).forEach((inp) => inp.addEventListener('change', () => {
      const f = inp.dataset.f, it = items[i];
      if (f === 'action') it.action = inp.value;
      else if (inp.classList.contains('num')) it.ing[f] = U.parseNum(inp.value);
      else it.ing[f] = inp.value.trim();
      if (f === 'purchaseUnit' && inp.value === 'emb' && !it.ing.packUnit) it.ing.packUnit = 'kg';
      revalidate(i);
      if (it.errs.length) it.action = 'skip'; else if (f !== 'action' && it.action === 'skip') it.action = it.dup ? 'update' : 'create';
      const y = window.scrollY; Views.importacao(el); window.scrollTo(0, y);
    }));
  });
  $('#impBulk', el).onchange = (e) => { const v = e.target.value; if (!v) return; items.forEach((it) => { if ((it.dup || it.dupInFile !== null) && !it.errs.length) it.action = v === 'update' && !it.dup ? 'create' : v; }); Views.importacao(el); };
  $('#impBack2', el).onclick = () => { Importer.items = []; Views.importacao(el); };
  $('#impGo', el).onclick = async () => {
    const todo = items.filter((x) => x.action !== 'skip' && !x.errs.length);
    if (!todo.length) { toast('Nada para importar', 'err'); return; }
    const nCreate = todo.filter((x) => x.action === 'create').length;
    if (!Plan.isPro() && Plan.usage('ingredients') + nCreate > Plan.LIMITS.ingredients) { toast(`O plano gratuito permite até ${Plan.LIMITS.ingredients} ingredientes (tem ${Plan.usage('ingredients')} e está a criar ${nCreate}). Subscreva o plano Pro ou importe menos linhas.`, 'err'); return; }
    const dupNew = todo.filter((x) => x.action === 'create' && (x.dup || x.dupInFile !== null)).length;
    if (dupNew && !(await confirmDlg(`${dupNew} linha(s) serão criadas apesar de parecerem duplicadas. Continuar?`, { ok: 'Continuar' }))) return;
    let created = 0, updated = 0, recalc = new Set();
    for (const it of todo) {
      if (it.action === 'update' && it.dup) {
        const ex = Repo.get('ingredients', it.dup);
        const merged = { ...ex, ...Object.fromEntries(Object.entries(it.ing).filter(([k, v]) => v !== '' && v !== null && !(Array.isArray(v) && !v.length) && (Importer.map[k] !== undefined || ['purchaseQty', 'price', 'priceUpdatedAt'].includes(k)))) };
        if (Importer.map.allergens !== undefined) merged.allergens = it.ing.allergens;
        merged.demo = false; // dados importados pelo utilizador passam a ser reais
        const r = await Services.saveIngredient(merged, { source: 'importação' });
        if (r.entry) r.entry.impacts.forEach((x) => recalc.add(x.recipeId));
        updated++;
      } else { await Services.saveIngredient({ ...it.ing, id: undefined, createdAt: U.nowISO() }, { source: 'importação' }); created++; }
    }
    Importer.rows = null; Importer.items = [];
    el.innerHTML = `<div class="card">${stepsBar.replace('step active', 'step done')}<div class="alert ok"><b>Importação concluída.</b> ${created} criado(s), ${updated} atualizado(s). ${recalc.size} ficha(s) técnica(s) recalculada(s) por alteração de preço.</div><a class="btn primary" href="#/ingredientes">Ver ingredientes</a> <button class="btn" id="impAgain">Nova importação</button></div>`;
    $('#impAgain', el).onclick = () => Views.importacao(el);
  };
};
