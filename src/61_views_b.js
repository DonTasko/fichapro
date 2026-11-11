/* =====================================================================
   VISTAS — Fichas técnicas (lista e editor) e Produtos
   ===================================================================== */
const REC_TYPES = [['prato', 'Prato'], ['entrada', 'Entrada'], ['acompanhamento', 'Acompanhamento'], ['sobremesa', 'Sobremesa'], ['bebida', 'Bebida'], ['molho', 'Molho'], ['base', 'Preparação base / intermédia'], ['pastelaria', 'Pastelaria'], ['artigo', 'Outro artigo']];
const typeLabel = (t) => (REC_TYPES.find((x) => x[0] === t) || [, t || '—'])[1];
function nextRecipeCode() {
  return nextCode('recipes', 'FT', 3);
}
function newRecipe() {
  return { id: U.uid(), code: nextRecipeCode(), name: '', category: 'Pratos principais', type: 'prato', sellable: true, intermediate: false, portions: 1, finalQty: null, finalUnit: 'kg', prepMin: 0, cookMin: 0, platingMin: 0, cleanMin: 0, laborIncludeCook: true, temperature: '', notes: '', lines: [], labor: { mode: 'simultaneo', lines: [{ staffId: 'avg', count: 1 }] }, equipment: [], extras: [], allergenOverrides: { add: [], remove: [], traces: [], confirmed: false }, targetFC: null, vatRate: null, salePrice: null, version: 0, _new: true };
}

/* ------------------------------ 4. LISTA DE FICHAS ------------------------------ */
const FichaUI = { q: '', cat: '', kind: '', view: 'cards' };
Views.fichas = (el) => {
  const st = getSettings();
  const all = computeAll();
  const cats = [...new Set([...st.saleCategories.map((c) => c.name), ...all.map((x) => x.r.category).filter(Boolean)])];
  el.innerHTML = `<div class="card tight"><div class="toolbar" style="margin:0">
    <input class="search" id="fq" placeholder="Pesquisar fichas…" value="${h(FichaUI.q)}">
    <select id="fcat">${options(cats, FichaUI.cat, { empty: 'Todas as categorias' })}</select>
    <select id="fkind">${options([['venda', 'Artigos de venda'], ['inter', 'Preparações intermédias'], ['erro', 'Com erros'], ['demo', 'Demonstração']], FichaUI.kind, { empty: 'Todos os tipos' })}</select>
    <select id="fview">${options([['cards', 'Cartões'], ['table', 'Tabela']], FichaUI.view)}</select>
    <span class="grow"></span><a class="btn primary" href="#/ficha/nova">+ Nova ficha técnica</a></div></div><div id="flist"></div>`;
  const draw = () => {
    const q = U.normalize(FichaUI.q);
    const list = all.filter((x) => (!q || U.normalize(x.r.name + ' ' + x.r.code).includes(q)) && (!FichaUI.cat || x.r.category === FichaUI.cat) &&
      (!FichaUI.kind || (FichaUI.kind === 'venda' ? x.r.sellable !== false : FichaUI.kind === 'inter' ? x.r.intermediate : FichaUI.kind === 'erro' ? x.c.errors.length : x.r.demo))).sort((a, b) => a.r.name.localeCompare(b.r.name, 'pt'));
    const box = $('#flist', el);
    if (!list.length) { box.innerHTML = `<div class="card empty">${all.length ? 'Nenhuma ficha corresponde aos filtros.' : 'Ainda não criou fichas técnicas.'} <a href="#/ficha/nova">Criar ficha</a></div>`; return; }
    if (FichaUI.view === 'table') {
      box.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr><th>Código</th><th>Nome</th><th>Categoria</th><th class="r">Doses</th><th class="r">Matérias/dose</th><th class="r">Custo total/dose</th><th class="r">Custo kg/L</th><th class="r">PV c/IVA</th><th class="r">Food Cost</th><th>Alergénios</th><th></th></tr></thead><tbody>${list.map((x) => `<tr><td class="small">${h(x.r.code || '')}</td><td><a href="#/ficha/${x.r.id}"><b>${h(x.r.name)}</b></a>${demoTag(x.r)}${x.r.intermediate ? ' <span class="badge blue">Intermédia</span>' : ''}${x.c.errors.length ? ' <span class="badge red">Erro</span>' : ''}</td><td class="small">${h(x.r.category || '')}</td><td class="r">${U.numMax(x.r.portions)}</td><td class="r">${U.eur(x.c.perDose.materials)}</td><td class="r b">${U.eur(x.c.perDose.total)}</td><td class="r small">${U.ok(x.c.perBaseUnit) ? U.eur(x.c.perBaseUnit) + '/' + x.c.perBaseLabel : '—'}</td><td class="r">${x.p.current ? U.eur(x.p.current.gross) : '—'}</td><td class="r ${x.p.current ? pctClass(x.p.current.foodCostPct, x.p.target) : ''}">${x.p.current ? U.pct(x.p.current.foodCostPct) : '—'}</td><td>${algList(x.c.allergens.present, x.c.allergens.traces)}</td><td class="nowrap">${actions(x.r)}</td></tr>`).join('')}</tbody></table></div></div>`;
    } else {
      box.innerHTML = `<div class="list-cards">${list.map((x) => `<div class="rcard"><div class="img" style="${x.r.photo ? `background-image:url(${x.r.photo})` : ''}"><span class="tag">${x.r.intermediate ? '<span class="badge blue">Intermédia</span> ' : ''}${x.r.demo ? '<span class="badge demo">DEMO</span>' : ''}</span></div>
        <div class="body"><a href="#/ficha/${x.r.id}" style="text-decoration:none"><b style="color:var(--navy)">${h(x.r.name)}</b></a><div class="small muted" data-notr>${h(x.r.code || '')} · ${h(tr(x.r.category || ''))} · ${h(tr(U.numMax(x.r.portions) + ' dose(s)'))}</div>
        <div class="sumrow"><span>Custo total/dose</span><b>${U.eur(x.c.perDose.total)}</b></div>
        ${x.r.sellable !== false ? `<div class="sumrow"><span>PV c/IVA</span><span>${x.p.current ? U.eur(x.p.current.gross) : '<span class="muted">sem preço</span>'}</span></div><div class="sumrow"><span>Food Cost</span><span class="${x.p.current ? pctClass(x.p.current.foodCostPct, x.p.target) : ''}">${x.p.current ? U.pct(x.p.current.foodCostPct) : '—'}</span></div>` : `<div class="sumrow"><span>Custo por ${x.c.perBaseLabel || 'kg/L'}</span><span>${U.eur(x.c.perBaseUnit)}</span></div>`}
        <div style="margin-top:6px">${algList(x.c.allergens.present, x.c.allergens.traces)}</div>${x.c.errors.length ? `<div class="small red">${h(x.c.errors[0])}</div>` : ''}</div>
        <div class="foot">${actions(x.r)}</div></div>`).join('')}</div>`;
    }
    $$('[data-ract]', box).forEach((b) => (b.onclick = () => recipeAction(b.dataset.ract, b.dataset.id, draw)));
  };
  const actions = (r) => `<a class="btn sm primary" href="#/ficha/${r.id}">Abrir</a> <button class="btn sm" data-ract="dup" data-id="${r.id}">Duplicar</button> <button class="btn sm" data-ract="print" data-id="${r.id}">Imprimir</button> <button class="btn sm danger" data-ract="del" data-id="${r.id}">✕</button>`;
  $('#fq', el).oninput = (e) => { FichaUI.q = e.target.value; draw(); };
  $('#fcat', el).onchange = (e) => { FichaUI.cat = e.target.value; draw(); };
  $('#fkind', el).onchange = (e) => { FichaUI.kind = e.target.value; draw(); };
  $('#fview', el).onchange = (e) => { FichaUI.view = e.target.value; draw(); };
  draw();
};
async function recipeAction(act, id, after) {
  const r = Repo.get('recipes', id);
  if (act === 'print') return Reports.printRecipe(r);
  if (act === 'dup') {
    const c = U.clone(r); c.id = U.uid(); c.name = r.name + ' (cópia)'; c.code = nextRecipeCode(); c.demo = false; c.version = 0; delete c.createdAt;
    c.lines.forEach((l) => (l.id = U.uid()));
    await Services.saveRecipe(c, 'Duplicada de ' + r.name);
    toast('Ficha duplicada', 'ok'); return go('#/ficha/' + c.id);
  }
  if (act === 'del') {
    const u = Calc.usages(dataView(), 'rec', id);
    if (u.direct.length) { modal({ title: 'Não é possível eliminar', size: 'small', body: `<p><b>${h(r.name)}</b> é usada como preparação intermédia em: <span data-notr>${u.direct.map((x) => h(Repo.get('recipes', x).name)).join(', ')}</span>.</p>` }); return; }
    if (!(await confirmDlg(`Eliminar a ficha <b>${h(r.name)}</b> e todas as suas versões?`, { ok: 'Eliminar', danger: true }))) return;
    await Services.deleteRecipe(id); toast('Ficha eliminada'); after && after();
    if (UI.current === 'ficha') { UI.dirty = false; go('#/fichas'); } else Views.fichas($('#view'));
  }
}

/* ------------------------------ EDITOR DE FICHA ------------------------------ */
const Ed = { rec: null, tab: 'geral', orig: null };
Views.ficha = (el, params) => {
  const id = params[0];
  if (!id || id === 'nova') Ed.rec = newRecipe();
  else { const r = Repo.get('recipes', id); if (!r) { el.innerHTML = '<div class="alert err">Ficha não encontrada.</div>'; return; } Ed.rec = U.clone(r); }
  Ed.orig = JSON.stringify(Ed.rec);
  if (!['geral', 'ingredientes', 'mao', 'energia', 'preco', 'alergenios', 'versoes'].includes(Ed.tab)) Ed.tab = 'geral';
  if (Ed.rec._new) Ed.tab = 'geral';
  renderEditor(el);
};
function edCompute() {
  const data = dataView({ recipe: Ed.rec });
  const ev = Calc.evaluator(data);
  const c = ev.cost(Ed.rec);
  const p = Calc.pricing(Ed.rec, c, data.settings);
  return { data, c, p, s: Calc.status(Ed.rec, c, p, data.settings) };
}
function setDirty() { UI.dirty = JSON.stringify(Ed.rec) !== Ed.orig; const b = $('#edSave'); if (b) b.classList.toggle('green', UI.dirty); }
function renderEditor(el) {
  const r = Ed.rec;
  $('#pageTitle').textContent = r._new ? tr('Nova ficha técnica') : tr('Ficha técnica') + ' — ' + r.name;
  const tabs = [['geral', 'Geral'], ['ingredientes', `Ingredientes (${r.lines.length})`], ['mao', 'Tempos e mão de obra'], ['energia', 'Energia e outros custos'], ['preco', 'Preço de venda'], ['alergenios', 'Alergénios'], ['versoes', 'Versões e histórico']];
  el.innerHTML = `${r.demo ? '<div class="alert info">Ficha de demonstração com preços fictícios.</div>' : ''}
    <div class="editor"><div><div class="card"><div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${Ed.tab === k ? 'active' : ''}">${l}</button>`).join('')}</div><div id="edTab"></div></div></div>
    <div class="sticky"><div class="card"><div id="edSum"></div>
      <div class="field" style="margin-top:10px"><label>Nota da alteração (opcional)</label><input id="edNote" placeholder="ex.: novo fornecedor de carne"></div>
      <div class="toolbar" style="margin-top:10px"><button class="btn primary" id="edSave">Guardar</button><button class="btn" id="edPrint">Imprimir ficha</button><button class="btn" id="edAlg">Ficha de alergénios</button>${r._new ? '' : '<button class="btn" id="edDup">Duplicar</button><button class="btn danger" id="edDel">Eliminar</button>'}<a class="btn" href="#/fichas">Voltar</a></div></div></div></div>`;
  $$('[data-tab]', el).forEach((b) => (b.onclick = () => { Ed.tab = b.dataset.tab; $$('[data-tab]', el).forEach((x) => x.classList.toggle('active', x === b)); renderTab(); }));
  $('#edSave', el).onclick = saveEditor;
  $('#edPrint', el).onclick = () => Reports.printRecipe(Ed.rec, { draft: true });
  $('#edAlg', el).onclick = () => Reports.printAllergenSheet([Ed.rec], { draft: true });
  if ($('#edDup', el)) $('#edDup', el).onclick = async () => { if (UI.dirty && !(await confirmDlg('Guarde primeiro as alterações. Duplicar a versão gravada?'))) return; UI.dirty = false; recipeAction('dup', Ed.rec.id); };
  if ($('#edDel', el)) $('#edDel', el).onclick = () => recipeAction('del', Ed.rec.id);
  renderTab(); setDirty();
}
function refreshSummary() {
  const { c, p, s } = edCompute();
  const r = Ed.rec;
  const sum = $('#edSum'); if (!sum) return { c, p };
  sum.innerHTML = `<h3>Estiva de custos</h3>
    <div class="small muted" data-notr>${h(tr(U.numMax(r.portions) + ' dose(s)'))}${c.finalBase ? ' · ' + U.numMax(r.finalQty) + ' ' + UNITS[r.finalUnit].label : ''}</div>
    <table style="margin-top:6px"><thead><tr><th></th><th class="r">Lote</th><th class="r">Por dose</th></tr></thead><tbody>
    <tr><td>Matérias-primas</td><td class="r">${U.eur(c.materials)}</td><td class="r">${U.eur(c.perDose.materials)}</td></tr>
    <tr><td>Mão de obra</td><td class="r">${U.eur(c.labor)}</td><td class="r">${U.eur(c.perDose.labor)}</td></tr>
    <tr><td>Energia${c.energyDetail.excluded ? ' <span class="small muted">(nos indiretos)</span>' : ''}</td><td class="r">${U.eur(c.energy)}</td><td class="r">${U.eur(c.perDose.energy)}</td></tr>
    <tr><td>Outros operacionais</td><td class="r">${U.eur(c.operational)}</td><td class="r">${U.eur(c.perDose.operational)}</td></tr>
    </tbody><tfoot><tr><td>Custo total</td><td class="r">${U.eur(c.total)}</td><td class="r">${U.eur(c.perDose.total)}</td></tr></tfoot></table>
    ${U.ok(c.perBaseUnit) ? `<div class="sumrow"><span>Custo por ${c.perBaseLabel}</span><b>${U.eur(c.perBaseUnit)}</b></div>` : ''}
    ${U.ok(c.yieldPct) ? `<div class="sumrow"><span>Rendimento (final ÷ ingredientes líquidos)</span><span>${U.pct(c.yieldPct)}</span></div>` : ''}
    ${r.sellable !== false ? `<div class="sep"></div><div class="sumrow"><span>Preço recomendado c/IVA</span><b class="green-t">${U.eur(p.recommended.gross)}</b></div>
    ${p.current ? `<div class="sumrow"><span>Preço atual c/IVA</span><b>${U.eur(p.current.gross)}</b></div><div class="sumrow"><span>Food Cost atual</span><span class="${pctClass(p.current.foodCostPct, p.target)}">${U.pct(p.current.foodCostPct)} <span class="muted small">(obj. ${U.num(p.target, 0)} %)</span></span></div><div class="sumrow"><span>Lucro estimado/dose</span><span class="${p.current.profit < 0 ? 'red' : ''}">${U.eur(p.current.profit)}</span></div><div style="margin-top:6px">${statusBadge(s)}</div>` : '<div class="small muted">Sem preço de venda definido.</div>'}` : ''}
    ${c.errors.length ? `<div class="alert err" style="margin-top:10px">${c.errors.map(h).join('<br>')}</div>` : ''}
    ${c.warnings.length ? `<div class="alert warn" style="margin-top:10px">${c.warnings.map(h).join('<br>')}</div>` : ''}`;
  return { c, p };
}
function bindInputs(root, onChange) {
  $$('[data-bind]', root).forEach((inp) => {
    const ev = inp.tagName === 'SELECT' || inp.type === 'checkbox' || inp.type === 'radio' ? 'change' : 'input';
    inp.addEventListener(ev, () => {
      const k = inp.dataset.bind;
      let v;
      if (inp.type === 'checkbox') v = inp.checked;
      else if (inp.type === 'radio') { if (!inp.checked) return; v = inp.value; }
      else if (inp.classList.contains('num')) { v = inp.value.trim() === '' ? null : U.parseNum(inp.value); inp.classList.toggle('bad', inp.value.trim() !== '' && !U.ok(v)); if (!U.ok(v) && v !== null) return; }
      else v = inp.value;
      const path = k.split('.'); let o = Ed.rec; while (path.length > 1) o = o[path.shift()]; o[path[0]] = v;
      setDirty(); onChange && onChange(k, inp);
    });
  });
}
function unitOptionsFor(line, data) {
  if (line.kind === 'rec') {
    const sub = data.recipes.get(line.refId);
    const out = [['dose', 'dose(s)']];
    if (sub && Calc.finalBase(sub)) { const dim = UNITS[sub.finalUnit].dim; Object.keys(UNITS).filter((u) => UNITS[u].dim === dim).forEach((u) => out.push([u, UNITS[u].label])); }
    return out;
  }
  const ing = data.ingredients.get(line.refId);
  if (!ing) return [[line.unit, line.unit]];
  const b = Calc.ingredientBase(ing);
  const conv = Calc.convOf(ing);
  const out = Object.keys(UNITS).filter((u) => b && U.ok(convertToDim(1, u, b.dim, conv))).map((u) => [u, UNITS[u].label]);
  if (ing.purchaseUnit === 'emb') out.push(['emb', 'embalagem']);
  return out;
}
function renderTab() {
  const box = $('#edTab'); if (!box) return;
  const r = Ed.rec;
  const st = getSettings();
  const { data, c, p } = edCompute();
  const T = {
    geral() {
      const cats = [...new Set([...st.saleCategories.map((x) => x.name), r.category].filter(Boolean))];
      box.innerHTML = `<div class="grid" style="grid-template-columns:minmax(0,1fr) 220px">
        <div class="fields">
          <div class="field" style="grid-column:1/-1"><label>Nome do prato ou produto *</label><input data-bind="name" value="${h(r.name)}" placeholder="ex.: Picanha grelhada"></div>
          <div class="field"><label>Código interno</label><input data-bind="code" value="${h(r.code || '')}" placeholder="${h(tr('Automático'))}"></div>
          <div class="field"><label>Categoria (define o IVA de venda)</label><select data-bind="category">${options(cats, r.category)}</select></div>
          <div class="field"><label>Tipo</label><select data-bind="type">${options(REC_TYPES, r.type)}</select></div>
          <div class="field"><label>Número de doses produzidas *</label><input class="num" inputmode="decimal" data-bind="portions" value="${h(vNum(r.portions))}"></div>
          <div class="field"><label>Peso/quantidade final</label><input class="num" inputmode="decimal" data-bind="finalQty" value="${h(vNum(r.finalQty))}"></div>
          <div class="field"><label>Unidade final</label><select data-bind="finalUnit">${options(Object.keys(UNITS).map((u) => [u, UNITS[u].label]), r.finalUnit)}</select></div>
          <div class="field"><label>Temperatura de confeção</label><input data-bind="temperature" value="${h(r.temperature || '')}" placeholder="ex.: 180 °C"></div>
          <div class="field"><label>Tempo total de produção</label><input disabled value="${Calc.laborMinutes(r).total} min"><span class="hint">Definido no separador "Tempos"</span></div>
          <div class="field" style="grid-column:1/-1;flex-direction:row;gap:20px;flex-wrap:wrap">
            <label class="check"><input type="checkbox" data-bind="sellable" ${r.sellable !== false ? 'checked' : ''}> Artigo de venda (tem preço ao cliente)</label>
            <label class="check"><input type="checkbox" data-bind="intermediate" ${r.intermediate ? 'checked' : ''}> Preparação intermédia (pode ser usada noutras fichas)</label></div>
          <div class="field" style="grid-column:1/-1"><label>Modo de preparação / observações</label><textarea data-bind="notes" style="min-height:140px">${h(r.notes || '')}</textarea></div>
        </div>
        <div><label class="small muted">Fotografia (opcional)</label>${r.photo ? `<img class="photo" src="${r.photo}" alt="">` : '<div class="photo muted" style="display:grid;place-items:center">Sem foto</div>'}
          <label class="btn sm filebtn" style="margin-top:6px">📷 ${r.photo ? 'Substituir' : 'Escolher'} fotografia<input type="file" id="edPhoto" accept="image/*"></label>${r.photo ? '<button class="btn sm danger" id="edPhotoDel" style="margin-top:6px">Remover foto</button>' : ''}
          <div class="help">Para ser usada noutras fichas por peso/volume, indique a quantidade final. Sem ela só pode ser usada por dose.</div></div></div>`;
      bindInputs(box, (k) => { refreshSummary(); if (k === 'name') $('#pageTitle').textContent = tr('Ficha técnica') + ' — ' + r.name; });
      $('#edPhoto', box).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { r.photo = await resizeImage(f, 900); setDirty(); renderTab(); } catch { toast('Não foi possível ler a imagem', 'err'); } };
      const pd = $('#edPhotoDel', box); if (pd) pd.onclick = () => { r.photo = null; setDirty(); renderTab(); };
    },
    ingredientes() {
      const linesHtml = c.lines.map((L, i) => {
        const line = r.lines[i];
        const ing = line.kind === 'ing' ? data.ingredients.get(line.refId) : null;
        const defW = ing ? Number(ing.wastePct) || 0 : 0;
        const ulabel = line.unit === 'dose' ? 'dose' : line.unit === 'emb' ? 'emb' : UNITS[line.unit] ? UNITS[line.unit].label : line.unit;
        return `<tr data-li="${i}" class="${L.error ? 'bad-row' : ''}">
          <td class="nowrap"><button class="btn sm icon" data-mv="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn sm icon" data-mv="1" ${i === r.lines.length - 1 ? 'disabled' : ''}>↓</button></td>
          <td style="min-width:170px">${line.kind === 'rec' ? '<span class="badge blue">Ficha</span> ' : ''}<b>${h(L.name)}</b>${ing ? demoTag(ing) : ''}${L.error ? `<div class="small red">${h(L.error)}</div>` : ''}</td>
          <td class="r"><input class="num" inputmode="decimal" data-lf="qty" value="${h(vNum(line.qty))}"></td>
          <td><select data-lf="unit">${options(unitOptionsFor(line, data), line.unit)}</select></td>
          <td class="r nowrap" data-c="up">${h(fmtUnitPrice(L.unitPrice, line.unit))}</td>
          <td class="r" data-c="cost">${U.eur(L.cost)}</td>
          <td class="r"><input class="num" inputmode="decimal" data-lf="wastePct" style="width:60px" value="${line.wastePct === null || line.wastePct === undefined || line.wastePct === '' ? '' : h(vNum(line.wastePct))}" placeholder="${h(U.inNum(defW))}"></td>
          <td class="r b" data-c="eff">${U.eur(L.effCost)}</td>
          <td class="r small muted" data-c="gross">${U.ok(L.grossQty) && L.wastePct > 0 ? U.numMax(L.grossQty) + ' ' + h(ulabel) : ''}</td>
          <td>${algList(L.allergens, L.traces)}</td>
          <td><button class="btn sm danger" data-rm>✕</button></td></tr>`;
      }).join('');
      box.innerHTML = `<div class="ac" style="margin-bottom:10px"><input id="acIn" style="width:100%" placeholder="🔍 Pesquisar ingrediente ou preparação intermédia para adicionar… (Enter para adicionar)"><div class="ac-list" id="acList"></div></div>
        ${r.lines.length ? `<div class="table-wrap"><table><thead><tr><th></th><th>Ingrediente</th><th class="r">Qtd. líquida</th><th>Unid.</th><th class="r">Preço unit.</th><th class="r">Custo</th><th class="r">Desp. %</th><th class="r">Custo efetivo</th><th class="r">Qtd. bruta</th><th>Alerg.</th><th></th></tr></thead><tbody>${linesHtml}</tbody>
        <tfoot><tr><td></td><td colspan="4">Total matérias-primas</td><td class="r" id="totCost">${U.eur(U.sum(c.lines, (l) => l.cost))}</td><td></td><td class="r" id="totEff">${U.eur(c.materials)}</td><td colspan="3"></td></tr></tfoot></table></div>` : '<div class="empty">Adicione ingredientes ou preparações intermédias com a pesquisa acima.</div>'}
        <div class="help">Quantidade líquida = o que entra efetivamente no prato. Custo efetivo = custo ÷ (1 − desperdício). O desperdício vazio usa o valor do ingrediente; pode ser alterado só nesta ficha. Nas preparações intermédias, o custo inclui também a mão de obra e a energia dessa preparação.</div>`;
      $$('tr[data-li]', box).forEach((tr) => {
        const i = +tr.dataset.li;
        $$('[data-lf]', tr).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => {
          const f = inp.dataset.lf;
          if (f === 'unit') r.lines[i].unit = inp.value;
          else { const t = inp.value.trim(); const v = t === '' ? null : U.parseNum(t); inp.classList.toggle('bad', t !== '' && !U.ok(v)); if (t !== '' && !U.ok(v)) return; r.lines[i][f] = f === 'qty' ? v || 0 : v; }
          setDirty();
          const { c: c2 } = refreshSummary();
          c2.lines.forEach((L, j) => {
            const row = $(`tr[data-li="${j}"]`, box); if (!row) return;
            const ln = r.lines[j];
            const ul = ln.unit === 'dose' ? 'dose' : ln.unit === 'emb' ? 'emb' : UNITS[ln.unit] ? UNITS[ln.unit].label : ln.unit;
            $('[data-c=up]', row).textContent = fmtUnitPrice(L.unitPrice, ln.unit);
            $('[data-c=cost]', row).textContent = U.eur(L.cost); $('[data-c=eff]', row).textContent = U.eur(L.effCost);
            $('[data-c=gross]', row).textContent = U.ok(L.grossQty) && L.wastePct > 0 ? U.numMax(L.grossQty) + ' ' + ul : '';
          });
          $('#totCost', box).textContent = U.eur(U.sum(c2.lines, (l) => l.cost)); $('#totEff', box).textContent = U.eur(c2.materials);
          if (f === 'unit') renderTab();
        }));
        $('[data-rm]', tr).onclick = () => { r.lines.splice(i, 1); setDirty(); renderTab(); refreshSummary(); };
        $$('[data-mv]', tr).forEach((b) => (b.onclick = () => { const j = i + Number(b.dataset.mv); [r.lines[i], r.lines[j]] = [r.lines[j], r.lines[i]]; setDirty(); renderTab(); }));
      });
      setupAutocomplete(box, data);
    },
    mao() {
      const m = Calc.laborMinutes(r);
      const staff = Repo.all('staff').filter((s) => s.active !== false);
      const ld = c.laborDetail;
      box.innerHTML = `<h3>Tempos de produção (minutos, para o lote de ${U.numMax(r.portions)} dose(s))</h3>
        <div class="fields">
          <div class="field"><label>Preparação</label><input class="num" inputmode="decimal" data-bind="prepMin" value="${h(U.inNum(m.prep))}"></div>
          <div class="field"><label>Confeção</label><input class="num" inputmode="decimal" data-bind="cookMin" value="${h(U.inNum(m.cook))}"></div>
          <div class="field"><label>Finalização e empratamento</label><input class="num" inputmode="decimal" data-bind="platingMin" value="${h(U.inNum(m.plat))}"></div>
          <div class="field"><label>Limpeza associada</label><input class="num" inputmode="decimal" data-bind="cleanMin" value="${h(U.inNum(m.clean))}"></div>
          <div class="field"><label>Tempo total</label><input disabled id="mTot" value="${m.total} min"></div>
        </div>
        <label class="check" style="margin-top:10px"><input type="checkbox" data-bind="laborIncludeCook" ${r.laborIncludeCook !== false ? 'checked' : ''}> Contar o tempo de confeção como trabalho (desmarque se a confeção decorre sem acompanhamento, ex.: forno ou cozedura lenta)</label>
        <div class="sep"></div><h3>Equipa envolvida</h3>
        <div class="toolbar"><label class="check"><input type="radio" name="lmode" data-bind="labor.mode" value="simultaneo" ${ld.mode === 'simultaneo' ? 'checked' : ''}> Tempos simultâneos — todos trabalham durante o tempo indicado</label>
          <label class="check"><input type="radio" name="lmode" data-bind="labor.mode" value="individual" ${ld.mode === 'individual' ? 'checked' : ''}> Tempos individuais — os minutos já são a soma do trabalho de todos</label></div>
        <div class="table-wrap"><table><thead><tr><th>Funcionário / custo</th><th class="r">N.º de pessoas</th><th class="r">Custo horário</th><th></th></tr></thead><tbody>
          ${(r.labor.lines || []).map((l, i) => `<tr data-ll="${i}"><td><select data-llf="staffId">${options([['avg', `${tr('Média da equipa')} (${U.eur(ld.avgRate)}/h)`], ...staff.map((s) => [s.id, `${s.name} (${U.eur(Calc.staffHourly(s))}/h)`])], l.staffId)}</select></td><td class="r"><input class="num" inputmode="decimal" data-llf="count" value="${h(vNum(l.count))}"></td><td class="r">${U.eur(ld.lines[i] ? ld.lines[i].rate : NaN)}/h</td><td><button class="btn sm danger" data-llrm>✕</button></td></tr>`).join('')}
        </tbody></table></div>
        <button class="btn sm" id="llAdd" style="margin-top:8px">+ Adicionar funcionário</button>
        <div class="alert ok" style="margin-top:12px" id="labRes"></div>
        <div class="help">Exemplo: 2 funcionários a 9 €/h durante 30 minutos em simultâneo = 2 × 9 € × 0,5 h = <b>9 €</b>. Se os 30 minutos já forem a soma do tempo dos dois (15 min cada), use "tempos individuais": 9 € × 0,5 h = 4,50 €. Gerir funcionários em <a href="#/mao-de-obra">Custos de mão de obra</a>.</div>`;
      const labRes = () => { const { c: c2 } = refreshSummary(); const d = c2.laborDetail; const mm = Calc.laborMinutes(r); $('#mTot', box).value = mm.total + ' min'; $('#labRes', box).innerHTML = `Tempo de trabalho considerado: <b>${U.numMax(mm.counted)} min</b> · Mão de obra desta ficha: <b>${U.eur(c2.ownLabor)}</b>${c2.subLabor > 0 ? ` + preparações intermédias: ${U.eur(c2.subLabor)}` : ''} · por dose: <b>${U.eur(c2.perDose.labor)}</b>`; };
      bindInputs(box, labRes);
      $$('tr[data-ll]', box).forEach((tr) => {
        const i = +tr.dataset.ll;
        $$('[data-llf]', tr).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { r.labor.lines[i][inp.dataset.llf] = inp.tagName === 'SELECT' ? inp.value : U.parseNum(inp.value) || 0; setDirty(); if (inp.tagName === 'SELECT') renderTab(); else labRes(); }));
        $('[data-llrm]', tr).onclick = () => { r.labor.lines.splice(i, 1); setDirty(); renderTab(); refreshSummary(); };
      });
      $('#llAdd', box).onclick = () => { r.labor.lines = r.labor.lines || []; r.labor.lines.push({ staffId: 'avg', count: 1 }); setDirty(); renderTab(); refreshSummary(); };
      labRes();
    },
    energia() {
      const eqs = Repo.all('equipment');
      const ind = st.indirect;
      box.innerHTML = `<h3>Utilização de equipamentos</h3>
        ${c.energyDetail.excluded ? '<div class="alert warn">As Configurações indicam que a percentagem de custos indiretos já inclui a energia: o custo dos equipamentos não é somado, para evitar duplicação.</div>' : ''}
        ${eqs.length ? '' : '<div class="alert info">Ainda não há equipamentos. Crie-os em <a href="#/custos">Custos energéticos e operacionais</a>.</div>'}
        <div class="table-wrap"><table><thead><tr><th>Equipamento</th><th class="r">Minutos</th><th class="r">Custo/hora</th><th class="r">Custo</th><th></th></tr></thead><tbody>
        ${(r.equipment || []).map((e, i) => { const d = c.energyDetail.lines[i] || {}; return `<tr data-eq="${i}"><td><select data-eqf="equipId">${options(eqs.map((x) => [x.id, x.name]), e.equipId, { empty: '— escolher —' })}</select></td><td class="r"><input class="num" inputmode="decimal" data-eqf="minutes" value="${h(vNum(e.minutes))}"></td><td class="r">${U.eur(d.perHour)}</td><td class="r" data-c="eqc">${U.eur(d.cost)}</td><td><button class="btn sm danger" data-eqrm>✕</button></td></tr>`; }).join('')}
        </tbody></table></div><button class="btn sm" id="eqAdd" style="margin-top:8px" ${eqs.length ? '' : 'disabled'}>+ Adicionar equipamento</button>
        <div class="sep"></div><h3>Outros custos diretos (embalagens, consumíveis…)</h3>
        ${ind.includesPackaging && ind.method !== 'none' ? '<div class="alert warn">Os custos indiretos já incluem embalagens e consumíveis: linhas desses tipos não são somadas.</div>' : ''}
        <div class="table-wrap"><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Aplicação</th><th class="r">Valor (€)</th><th class="r">Total no lote</th><th></th></tr></thead><tbody>
        ${(r.extras || []).map((x, i) => { const d = c.extrasDetail[i] || {}; return `<tr data-ex="${i}"><td><input data-exf="name" value="${h(x.name || '')}"></td><td><select data-exf="type">${options([['embalagem', 'Embalagem'], ['consumivel', 'Consumível'], ['outro', 'Outro']], x.type)}</select></td><td><select data-exf="per">${options([['dose', 'Por dose'], ['lote', 'Por lote']], x.per)}</select></td><td class="r"><input class="num" inputmode="decimal" data-exf="value" value="${h(vNum(x.value))}"></td><td class="r">${d.excluded ? '<span class="muted small">nos indiretos</span>' : U.eur(d.batch)}</td><td><button class="btn sm danger" data-exrm>✕</button></td></tr>`; }).join('')}
        </tbody></table></div><button class="btn sm" id="exAdd" style="margin-top:8px">+ Adicionar custo</button>
        <div class="sep"></div><h3>Custos indiretos (gerais)</h3>
        <p>${ind.method === 'none' ? 'Não estão a ser aplicados custos indiretos.' : ind.method === 'percent' ? `Aplicada uma percentagem de <b>${U.num(ind.percent, 1)} %</b> sobre o custo direto (matérias + mão de obra + energia + outros).` : `Aplicado um rateio de <b>${U.eur(Calc.indirectPerDose(data).perDose)}</b> por dose.`} Nesta ficha: <b>${U.eur(c.indirect)}</b> no lote. <a href="#/custos">Alterar</a></p>
        <div class="help">Os custos indiretos são aplicados apenas à ficha final. Quando uma preparação intermédia é usada noutra ficha, entra só com os seus custos diretos, para não contar os indiretos duas vezes.</div>`;
      const re = () => { renderTab(); refreshSummary(); };
      $$('tr[data-eq]', box).forEach((tr) => { const i = +tr.dataset.eq; $$('[data-eqf]', tr).forEach((inp) => inp.addEventListener('change', () => { r.equipment[i][inp.dataset.eqf] = inp.dataset.eqf === 'minutes' ? U.parseNum(inp.value) || 0 : inp.value; setDirty(); re(); })); $('[data-eqrm]', tr).onclick = () => { r.equipment.splice(i, 1); setDirty(); re(); }; });
      $$('tr[data-ex]', box).forEach((tr) => { const i = +tr.dataset.ex; $$('[data-exf]', tr).forEach((inp) => inp.addEventListener('change', () => { r.extras[i][inp.dataset.exf] = inp.dataset.exf === 'value' ? U.parseNum(inp.value) || 0 : inp.value; setDirty(); re(); })); $('[data-exrm]', tr).onclick = () => { r.extras.splice(i, 1); setDirty(); re(); }; });
      $('#eqAdd', box).onclick = () => { r.equipment = r.equipment || []; r.equipment.push({ equipId: eqs[0].id, minutes: 10 }); setDirty(); re(); };
      $('#exAdd', box).onclick = () => { r.extras = r.extras || []; r.extras.push({ name: 'Embalagem', type: 'embalagem', per: 'dose', value: 0 }); setDirty(); re(); };
    },
    preco() {
      if (r.sellable === false) { box.innerHTML = '<div class="alert info">Esta ficha não está marcada como artigo de venda (separador Geral). Não é calculado preço ao cliente.</div>'; return; }
      const tgt = Number(r.targetFC) > 0 ? Number(r.targetFC) : null;
      const preset = [25, 30, 35, 40];
      const catVat = Calc.vatFor({ category: r.category }, st);
      box.innerHTML = `<div class="fields">
        <div class="field"><label>Food Cost pretendido</label><select id="pTgtSel">${options([['', `Padrão das configurações (${U.num(st.targetFC, 0)} %)`], ...preset.map((x) => [x, x + ' %']), ['custom', 'Personalizado']], tgt === null ? '' : preset.includes(tgt) ? tgt : 'custom')}</select></div>
        <div class="field" id="pTgtCustomBox" style="${tgt !== null && !preset.includes(tgt) ? '' : 'display:none'}"><label>Food Cost personalizado (%)</label><input class="num" id="pTgtCustom" inputmode="decimal" value="${h(U.inNum(tgt))}"></div>
        <div class="field"><label>IVA de venda</label><select id="pVat">${options([['', `${tr('Da categoria')} "${tr(r.category)}" (${U.num(catVat, catVat % 1 ? 1 : 0)} %)`], ...(VAT_RATES[st.country] || [0, 6, 13, 23]).map((r) => [r, U.num(r, r % 1 ? 1 : 0) + ' %'])], r.vatRate === null || r.vatRate === undefined || r.vatRate === '' ? '' : r.vatRate)}</select></div>
        <div class="field"><label>Preço de venda atual (com IVA)</label><input class="num" id="pSale" inputmode="decimal" value="${h(vNum(r.salePrice))}" placeholder="ex.: 14,90"></div>
      </div>
      <div class="small muted" style="margin:8px 0">Base do cálculo: ${st.fcBase === 'total' ? 'custo total de produção por dose' : 'custo das matérias-primas por dose'} (${U.eur(p.baseCost)}) ÷ Food Cost pretendido. ${st.roundingEnabled ? 'Arredondamento comercial ativo (' + h(st.roundingEndings) + ').' : 'Sem arredondamento.'} <a href="#/configuracoes">Alterar</a></div>
      <div id="pTiers"></div><div id="pCurrent" style="margin-top:14px"></div>
      <div class="help"><b>Food Cost</b> = matérias-primas ÷ preço sem IVA. <b>Margem bruta</b> = preço sem IVA − matérias-primas. <b>Margem de contribuição</b> = preço sem IVA − custos variáveis (matérias, energia, embalagens/consumíveis). <b>Lucro estimado</b> = preço sem IVA − custo total imputado à ficha (inclui mão de obra e indiretos). Nenhum destes valores é o lucro líquido do negócio: faltam custos fixos não imputados (renda, gestão, marketing, amortizações) e impostos sobre o lucro.</div>`;
      const metricRows = (m) => `<div class="row"><span>Preço sem IVA</span><b>${U.eur(m.net)}</b></div><div class="row"><span>IVA</span><span>${U.eur(m.vatValue)}</span></div><div class="row"><span>Custo total de produção</span><span>${U.eur(m.totalCost)}</span></div><div class="row"><span>Food Cost</span><span>${U.pct(m.foodCostPct)}</span></div><div class="row"><span>Margem bruta</span><span>${U.eur(m.grossMargin)}</span></div><div class="row"><span>Margem de contribuição</span><span>${U.eur(m.contribution)} (${U.pct(m.contributionPct)})</span></div><div class="row"><span>Lucro estimado/dose</span><b class="${m.profit < 0 ? 'red' : 'green-t'}">${U.eur(m.profit)}</b></div><div class="row"><span>Margem de lucro</span><span>${U.pct(m.profitPct)}</span></div>`;
      const draw = () => {
        const { p: p2 } = refreshSummary();
        $('#pTiers', box).innerHTML = `<div class="tiers">${p2.tiers.map((t) => `<div class="tier ${t.key === 'rec' ? 'rec' : ''}"><h3>${h(t.label)}</h3><div class="small muted">${t.key === 'econ' ? 'Maior competitividade' : t.key === 'rec' ? 'Equilíbrio margem/competitividade' : 'Maior margem de contribuição'} · FC alvo ${U.num(t.targetPct, 0)} %</div><div class="price">${U.eur(t.gross)}</div><div class="small muted">com IVA ${U.num(p2.vat, 0)} %${st.roundingEnabled ? ` · cálculo exato ${U.eur(t.rawGross)}` : ''}</div><div class="sep" style="margin:8px 0"></div>${metricRows(t)}<button class="btn sm ${t.key === 'rec' ? 'green' : ''}" data-use="${t.gross}" style="margin-top:8px;width:100%">Usar este preço</button></div>`).join('')}</div>`;
        $('#pCurrent', box).innerHTML = p2.current ? `<div class="tier"><h3>Preço atual: ${U.eur(p2.current.gross)}</h3>${metricRows(p2.current)}</div>` : '<div class="alert info">Indique o preço de venda atual (ou escolha uma sugestão) para ver os indicadores reais.</div>';
        $$('[data-use]', box).forEach((b) => (b.onclick = () => { r.salePrice = U.round(Number(b.dataset.use), 2); $('#pSale', box).value = U.inNum(r.salePrice); setDirty(); draw(); }));
      };
      $('#pTgtSel', box).onchange = (e) => { const v = e.target.value; $('#pTgtCustomBox', box).style.display = v === 'custom' ? '' : 'none'; if (v !== 'custom') r.targetFC = v === '' ? null : Number(v); setDirty(); draw(); };
      $('#pTgtCustom', box).oninput = (e) => { const v = U.parseNum(e.target.value); const okv = v > 0 && v < 100; e.target.classList.toggle('bad', !okv); if (okv) { r.targetFC = v; setDirty(); draw(); } };
      $('#pVat', box).onchange = (e) => { r.vatRate = e.target.value === '' ? null : Number(e.target.value); setDirty(); draw(); };
      $('#pSale', box).oninput = (e) => { const t = e.target.value.trim(); const v = t === '' ? null : U.parseNum(t); const okv = v === null || v > 0; e.target.classList.toggle('bad', !okv); if (okv) { r.salePrice = v; setDirty(); draw(); } };
      draw();
    },
    alergenios() {
      const a = c.allergens;
      const ov = r.allergenOverrides = r.allergenOverrides || { add: [], remove: [], traces: [], confirmed: false };
      box.innerHTML = `<div class="alert warn"><b>Apoio à identificação.</b> Os alergénios são detetados a partir dos ingredientes cadastrados. Confirme e corrija: a aplicação não garante a ausência de alergénios (rótulos de fornecedores, contaminações e alterações de receita podem não estar refletidos).</div>
        <div class="table-wrap"><table class="matrix"><thead><tr><th></th><th>Alergénio</th><th class="c">Contém</th><th class="c">Pode conter</th><th>Origem (ingredientes responsáveis)</th></tr></thead><tbody>
        ${ALLERGENS.map((x) => { const auto = a.auto.includes(x.id); const pres = a.present.includes(x.id); const trc = a.traces.includes(x.id); return `<tr><td>${algBadge(x.id)}</td><td><b>${h(x.name)}</b></td>
          <td class="c"><input type="checkbox" data-ap="${x.id}" ${pres ? 'checked' : ''}></td><td class="c"><input type="checkbox" data-at="${x.id}" ${trc || pres ? (trc ? 'checked' : '') : ''} ${pres ? 'disabled' : ''}></td>
          <td class="small">${auto ? tr('Automático') + ': ' + h((a.sources[x.id] || []).join(', ')) : ''}${(ov.add || []).includes(x.id) ? '<span class="badge amber">Adicionado manualmente</span>' : ''}${(ov.remove || []).includes(x.id) && auto ? ' <span class="badge red">Removido manualmente — confirme!</span>' : ''}${a.traceSources[x.id] ? '<div class="muted">Pode conter via: <span data-notr>' + h(a.traceSources[x.id].join(', ')) + '</span></div>' : ''}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="toolbar" style="margin-top:12px"><label class="check"><input type="checkbox" id="algConf" ${ov.confirmed ? 'checked' : ''}> <span>Confirmei os alergénios desta ficha</span>${ov.confirmedAt ? ` <span data-notr>(${h(tr('em'))} ${U.fmtDate(ov.confirmedAt)})</span>` : ''}</label><span class="grow"></span><button class="btn" id="algPrint">Imprimir ficha de alergénios para clientes</button></div>
        <div class="field"><label>Notas sobre contaminação cruzada / manipulação</label><textarea id="algNotes" placeholder="ex.: Fritadeira partilhada com produtos panados (glúten)">${h(ov.notes || '')}</textarea></div>`;
      $$('[data-ap]', box).forEach((cb) => (cb.onchange = () => {
        const id = +cb.dataset.ap; const auto = c.allergens.auto.includes(id);
        ov.add = (ov.add || []).filter((x) => x !== id); ov.remove = (ov.remove || []).filter((x) => x !== id);
        if (cb.checked && !auto) ov.add.push(id);
        if (!cb.checked && auto) ov.remove.push(id);
        ov.confirmed = false; setDirty(); renderTab(); refreshSummary();
      }));
      $$('[data-at]', box).forEach((cb) => (cb.onchange = () => { const id = +cb.dataset.at; ov.traces = (ov.traces || []).filter((x) => x !== id); if (cb.checked) ov.traces.push(id); ov.confirmed = false; setDirty(); renderTab(); }));
      $('#algConf', box).onchange = (e) => { ov.confirmed = e.target.checked; ov.confirmedAt = e.target.checked ? U.todayISO() : null; setDirty(); };
      $('#algNotes', box).oninput = (e) => { ov.notes = e.target.value; setDirty(); };
      $('#algPrint', box).onclick = () => Reports.printAllergenSheet([r], { draft: true });
    },
    versoes() {
      const vers = Repo.all('recipeVersions').filter((v) => v.recipeId === r.id).sort((a, b) => b.version - a.version);
      const ingIds = new Set(r.lines.filter((l) => l.kind === 'ing').map((l) => l.refId));
      const hist = Repo.all('priceHistory').filter((x) => ingIds.has(x.ingredientId)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
      box.innerHTML = `<h3>Versões gravadas</h3>${vers.length ? `<div class="table-wrap"><table><thead><tr><th>Versão</th><th>Data</th><th>Nota</th><th class="r">Custo/dose na altura</th><th class="r">PV c/IVA</th><th></th></tr></thead><tbody>${vers.map((v) => `<tr><td>v${v.version}</td><td class="nowrap">${U.fmtDateTime(v.date)}</td><td class="small">${h(v.note || '')}</td><td class="r">${U.eur(v.costDose)}</td><td class="r">${v.salePrice ? U.eur(v.salePrice) : '—'}</td><td><button class="btn sm" data-cmp="${v.id}">Comparar com atual</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Ainda não há versões (são criadas a cada gravação).</div>'}
        <div class="sep"></div><h3>Alterações de preço dos ingredientes desta ficha</h3>
        ${hist.length ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Ingrediente</th><th class="r">Variação</th><th class="r">Impacto nesta ficha (por dose)</th></tr></thead><tbody>${hist.map((x) => { const im = x.impacts.find((i) => i.recipeId === r.id); return `<tr><td class="nowrap">${U.fmtDateTime(x.date)}</td><td>${h(x.ingredientName)}</td><td class="r ${diffCls(x.diffPct)}">${signPct(x.diffPct)}</td><td class="r">${im ? `${U.eur(im.oldDose)} → ${U.eur(im.newDose)} <span class="${diffCls(im.newDose - im.oldDose)}">(${signEur(im.newDose - im.oldDose)})</span>` : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Sem alterações de preço registadas.</div>'}`;
      $$('[data-cmp]', box).forEach((b) => (b.onclick = () => compareVersion(Repo.get('recipeVersions', b.dataset.cmp))));
    },
  };
  T[Ed.tab]();
  refreshSummary();
}
function setupAutocomplete(box, data) {
  const inp = $('#acIn', box), list = $('#acList', box);
  let items = [], hl = 0;
  const st = data.settings;
  const show = () => {
    const q = U.normalize(inp.value);
    const ings = [...data.ingredients.values()].filter((i) => !q || U.normalize(i.name + ' ' + (i.code || '')).includes(q)).map((i) => ({ kind: 'ing', id: i.id, name: i.name, sub: `${tr(i.category || '')} · ${U.eur4(Calc.ingredientUnitCost(i, st).cost)}/${IngUI.baseLabel(i)}`, demo: i.demo }));
    const recs = [...data.recipes.values()].filter((x) => x.intermediate && x.id !== Ed.rec.id && !Calc.wouldCycle(data, Ed.rec.id, x.id) && (!q || U.normalize(x.name).includes(q))).map((x) => ({ kind: 'rec', id: x.id, name: x.name, sub: 'Preparação intermédia', demo: x.demo }));
    items = [...recs, ...ings].sort((a, b) => { const as = U.normalize(a.name).startsWith(q) ? 0 : 1, bs = U.normalize(b.name).startsWith(q) ? 0 : 1; return as - bs || a.name.localeCompare(b.name, 'pt'); }).slice(0, 40);
    hl = 0;
    list.innerHTML = items.length ? items.map((it, i) => `<div class="ac-item ${i === hl ? 'hl' : ''}" data-i="${i}"><span>${it.kind === 'rec' ? '<span class="badge blue">Ficha</span> ' : ''}${h(it.name)}${it.demo ? ' <span class="badge demo">DEMO</span>' : ''}</span><span class="small muted">${h(it.sub)}</span></div>`).join('') : `<div class="ac-item muted">Sem resultados. <a href="#/ingredientes" style="margin-left:6px">Criar ingrediente</a></div>`;
    list.classList.add('show');
    $$('.ac-item[data-i]', list).forEach((d) => d.addEventListener('mousedown', (e) => { e.preventDefault(); add(items[+d.dataset.i]); }));
  };
  const add = (it) => {
    if (!it) return;
    let unit = 'kg', qty = 0;
    if (it.kind === 'ing') { const ing = data.ingredients.get(it.id); const b = Calc.ingredientBase(ing); unit = b ? (b.dim === 'mass' ? 'g' : b.dim === 'vol' ? 'ml' : 'un') : 'kg'; }
    else unit = 'dose';
    Ed.rec.lines.push({ id: U.uid(), kind: it.kind, refId: it.id, qty, unit, wastePct: null });
    setDirty(); renderTab();
    const rows = $$('tr[data-li]', $('#edTab')); const last = rows[rows.length - 1]; if (last) { const q = $('[data-lf=qty]', last); q.focus(); q.select(); }
  };
  inp.addEventListener('input', show); inp.addEventListener('focus', show);
  inp.addEventListener('blur', () => setTimeout(() => list.classList.remove('show'), 150));
  inp.addEventListener('keydown', (e) => {
    if (!list.classList.contains('show')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); hl = Math.max(0, Math.min(items.length - 1, hl + (e.key === 'ArrowDown' ? 1 : -1))); $$('.ac-item', list).forEach((d, i) => d.classList.toggle('hl', i === hl)); const el = $$('.ac-item', list)[hl]; el && el.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter') { e.preventDefault(); add(items[hl]); }
    if (e.key === 'Escape') list.classList.remove('show');
  });
}
function resizeImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); resolve(cv.toDataURL('image/jpeg', 0.82)); };
    img.onerror = reject; img.src = url;
  });
}
async function saveEditor() {
  const r = Ed.rec;
  const bad = [];
  if (!String(r.name || '').trim()) bad.push('Indique o nome da ficha');
  if (!(Number(r.portions) > 0)) bad.push('O número de doses tem de ser superior a 0');
  if (r.finalQty !== null && r.finalQty !== undefined && r.finalQty !== '' && !(Number(r.finalQty) > 0)) bad.push('Quantidade final inválida');
  if (r.lines.some((l) => !(Number(l.qty) > 0))) bad.push('Há ingredientes com quantidade 0');
  const dupCode = r.code && Repo.all('recipes').find((x) => x.id !== r.id && x.code && x.code === r.code);
  if (dupCode) bad.push(`O código ${r.code} já é usado por "${dupCode.name}"`);
  if (bad.length) { toast(bad[0], 'err'); if (bad[0].includes('nome') || bad[0].includes('doses')) { Ed.tab = 'geral'; renderEditor($('#view')); } return; }
  const { c } = edCompute();
  if (c.errors.length && !(await confirmDlg(`A ficha tem erros que tornam o custo incompleto:<br><br>${c.errors.map(h).join('<br>')}<br><br>Guardar mesmo assim?`, { ok: 'Guardar' }))) return;
  if (r.intermediate && !Calc.finalBase(r)) toast('Nota: sem quantidade final, esta preparação só pode ser usada por dose noutras fichas.');
  const isNew = r._new; delete r._new;
  r.name = r.name.trim();
  await Services.saveRecipe(r, ($('#edNote') || {}).value || (isNew ? 'Criação' : ''));
  Ed.orig = JSON.stringify(r); UI.dirty = false;
  toast('Ficha guardada (versão ' + r.version + ')', 'ok');
  if (isNew) { lastHash = '#/ficha/' + r.id; history.replaceState(null, '', lastHash); }
  renderEditor($('#view'));
}
function compareVersion(v) {
  const data = dataView();
  const cur = Repo.get('recipes', v.recipeId);
  const ev = Calc.evaluator(data);
  const cNow = ev.cost(cur);
  const oldNowPrices = Calc.evaluator(dataView({ recipe: { ...v.snapshot } })).cost(v.snapshot);
  const name = (l) => (l.kind === 'rec' ? (data.recipes.get(l.refId) || {}).name : (data.ingredients.get(l.refId) || {}).name) || '(removido)';
  const key = (l) => l.kind + ':' + l.refId;
  const oldMap = new Map(v.snapshot.lines.map((l) => [key(l), l])), newMap = new Map(cur.lines.map((l) => [key(l), l]));
  const keys = [...new Set([...oldMap.keys(), ...newMap.keys()])];
  const fmtQ = (l) => (l ? `${U.numMax(Number(l.qty))} ${l.unit === 'dose' ? 'dose' : UNITS[l.unit] ? UNITS[l.unit].label : l.unit}` : '—');
  modal({ title: `Comparar v${v.version} com a versão atual (v${cur.version})`, size: 'wide', body: `
    <div class="grid g3"><div class="kpi"><div class="l">Custo/dose em ${U.fmtDate(v.date)}</div><div class="v">${U.eur(v.costDose)}</div><div class="s">receita e preços dessa data</div></div>
      <div class="kpi"><div class="l">Receita v${v.version} a preços atuais</div><div class="v">${U.eur(oldNowPrices.perDose.total)}</div><div class="s">efeito só de preços: ${signEur(oldNowPrices.perDose.total - v.costDose)}</div></div>
      <div class="kpi green"><div class="l">Versão atual</div><div class="v">${U.eur(cNow.perDose.total)}</div><div class="s">diferença total: <span class="${diffCls(cNow.perDose.total - v.costDose)}">${signEur(cNow.perDose.total - v.costDose)}</span></div></div></div>
    <h3 style="margin-top:14px">Ingredientes</h3><div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th class="r">v${v.version}</th><th class="r">Atual</th><th>Alteração</th></tr></thead><tbody>
    ${keys.map((k) => { const o = oldMap.get(k), n = newMap.get(k); const ch = !o ? '<span class="badge green">Adicionado</span>' : !n ? '<span class="badge red">Removido</span>' : (o.qty !== n.qty || o.unit !== n.unit || o.wastePct !== n.wastePct) ? '<span class="badge amber">Alterado</span>' : ''; return `<tr><td>${h(name(o || n))}</td><td class="r">${fmtQ(o)}</td><td class="r">${fmtQ(n)}</td><td>${ch}</td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="grid g2" style="margin-top:12px"><div><b>Doses:</b> ${U.numMax(v.snapshot.portions)} → ${U.numMax(cur.portions)}</div><div><b>Preço de venda:</b> ${v.salePrice ? U.eur(v.salePrice) : '—'} → ${cur.salePrice ? U.eur(cur.salePrice) : '—'}</div></div>` });
}

/* ------------------------------ 5. PRODUTOS ------------------------------ */
const ProdUI = { q: '', status: '', sort: 'name', dir: 1 };
Views.produtos = (el) => {
  const st = getSettings();
  const rows = computeAll().filter((x) => x.r.sellable !== false);
  el.innerHTML = `<div class="card"><div class="toolbar"><input class="search" id="pq" placeholder="Pesquisar…" value="${h(ProdUI.q)}">
    <select id="pst">${options([['prejuizo', 'Com prejuízo'], ['acima', 'Food Cost acima do objetivo'], ['ok', 'Dentro do objetivo'], ['sempreco', 'Sem preço'], ['erro', 'Com erros']], ProdUI.status, { empty: 'Todos os estados' })}</select>
    <span class="grow"></span><button class="btn" id="pexp">⤓ Excel</button><a class="btn primary" href="#/ficha/nova">+ Nova ficha</a></div>
    <div class="help">Altere o preço de venda (com IVA) diretamente na tabela: todos os indicadores são recalculados e o preço fica gravado na ficha.</div><div id="ptab"></div></div>`;
  const draw = () => {
    const q = U.normalize(ProdUI.q);
    const list = rows.filter((x) => (!q || U.normalize(x.r.name).includes(q)) && (!ProdUI.status || x.s.key === ProdUI.status));
    const k = { name: (x) => U.normalize(x.r.name), cost: (x) => x.c.perDose.total, fc: (x) => (x.p.current ? x.p.current.foodCostPct : -1), profit: (x) => (x.p.current ? x.p.current.profit : -1e9), contrib: (x) => (x.p.current ? x.p.current.contribution : -1e9) }[ProdUI.sort];
    list.sort((a, b) => (k(a) > k(b) ? 1 : k(a) < k(b) ? -1 : 0) * ProdUI.dir);
    const th = (key, l, cls = 'r') => `<th class="sortable ${cls}" data-sort="${key}">${l}${ProdUI.sort === key ? (ProdUI.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`;
    $('#ptab', el).innerHTML = list.length ? `<div class="table-wrap"><table><thead><tr>${th('name', 'Produto', '')}<th>Categoria</th>${th('cost', 'Custo total/dose')}<th class="r">PV c/IVA</th><th class="r">PV s/IVA</th>${th('fc', 'Food Cost')}<th class="r">Objetivo</th><th class="r">Margem bruta</th>${th('contrib', 'Margem contrib.')}${th('profit', 'Lucro est./dose')}<th class="r">Margem %</th><th class="r">Recomendado</th><th>Estado</th></tr></thead><tbody>
      ${list.map((x) => { const m = x.p.current; return `<tr data-id="${x.r.id}"><td><a href="#/ficha/${x.r.id}"><b>${h(x.r.name)}</b></a>${demoTag(x.r)}</td><td class="small">${h(x.r.category || '')}</td>
        <td class="r" title="Matérias ${U.eur(x.c.perDose.materials)} · MO ${U.eur(x.c.perDose.labor)} · Energia ${U.eur(x.c.perDose.energy)} · Outros ${U.eur(x.c.perDose.operational)}">${U.eur(x.c.perDose.total)}</td>
        <td class="r"><input class="num inline-edit" data-sp value="${h(vNum(x.r.salePrice))}" placeholder="—"></td>
        <td class="r">${m ? U.eur(m.net) : '—'}</td><td class="r b ${m ? pctClass(m.foodCostPct, x.p.target) : ''}">${m ? U.pct(m.foodCostPct) : '—'}</td><td class="r small">${U.num(x.p.target, 0)} %</td>
        <td class="r">${m ? U.eur(m.grossMargin) : '—'}</td><td class="r">${m ? U.eur(m.contribution) : '—'}</td><td class="r b ${m && m.profit < 0 ? 'red' : ''}">${m ? U.eur(m.profit) : '—'}</td><td class="r">${m ? U.pct(m.profitPct) : '—'}</td>
        <td class="r"><button class="btn sm" data-rec="${x.p.recommended.gross}" title="Aplicar preço recomendado">${U.eur(x.p.recommended.gross)}</button></td><td>${statusBadge(x.s)}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<div class="empty">Sem produtos para mostrar.</div>';
    $$('[data-sort]', el).forEach((t) => (t.onclick = () => { ProdUI.dir = ProdUI.sort === t.dataset.sort ? -ProdUI.dir : 1; ProdUI.sort = t.dataset.sort; draw(); }));
    $$('tr[data-id]', el).forEach((tr) => {
      const setPrice = async (v) => { const r = Repo.get('recipes', tr.dataset.id); r.salePrice = v; await Services.saveRecipe(r, 'Preço de venda alterado para ' + (v ? U.eur(v) : '—')); toast('Preço atualizado', 'ok'); Views.produtos(el); };
      $('[data-sp]', tr).onchange = (e) => { const t = e.target.value.trim(); const v = t === '' ? null : U.parseNum(t); if (v !== null && !(v > 0)) { e.target.classList.add('bad'); toast('Preço inválido', 'err'); return; } setPrice(v === null ? null : U.round(v, 2)); };
      $('[data-rec]', tr).onclick = (e) => setPrice(U.round(Number(e.target.dataset.rec), 2));
    });
  };
  $('#pq', el).oninput = (e) => { ProdUI.q = e.target.value; draw(); };
  $('#pst', el).onchange = (e) => { ProdUI.status = e.target.value; draw(); };
  $('#pexp', el).onclick = () => exportRows('xlsx', 'produtos', [Reports.def.precos.sheet()]);
  draw();
};
