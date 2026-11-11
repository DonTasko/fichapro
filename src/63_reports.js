/* =====================================================================
   RELATÓRIOS (pré-visualização, impressão/PDF, Excel e CSV)
   ===================================================================== */
const Reports = (() => {
  const H = (v) => ({ v, t: 'head' }), E = (v) => ({ v: U.ok(v) ? U.round(v, 4) : null, t: 'eur' }), P = (v) => ({ v: U.ok(v) ? v : null, t: 'pct' }), N = (v) => ({ v: U.ok(v) ? v : null, t: 'num' });
  const header = (title, sub = '') => { const st = getSettings(); return `<div class="ph"><div><div style="font-size:11px;color:#15a06d;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${h(st.businessName)}</div><h1>${h(title)}</h1>${sub ? `<div>${sub}</div>` : ''}</div><div style="text-align:right;font-size:10.5px">Emitido em ${U.fmtDateTime(U.nowISO())}</div></div>`; };
  const foot = () => `<div class="foot">Documento gerado pela aplicação de fichas técnicas. Valores de custo estimados com base nos dados introduzidos. Margens e lucros apresentados não correspondem ao lucro líquido do negócio.</div>`;
  const toHtmlTable = (rows) => { const [hd, ...body] = rows; const cell = (c) => { const v = c && typeof c === 'object' ? c : { v: c }; if (v.v === null || v.v === undefined || v.v === '') return ''; if (v.t === 'eur' || v.t === 'eurb') return U.eur(v.v); if (v.t === 'pct') return U.pct(v.v); if (v.t === 'num') return U.numMax(v.v, 3); return h(v.v); }; const al = (c) => (c && typeof c === 'object' && ['eur', 'pct', 'num', 'eurb'].includes(c.t) ? ' class="r"' : ''); return `<table><thead><tr>${hd.map((c) => `<th>${h(c && typeof c === 'object' ? c.v : c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td${al(c)}>${cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`; };
  const algNames = (ids) => ids.map((i) => ALLERGEN_BY_ID[i].short).join(', ');
  const sellable = () => computeAll().filter((x) => x.r.sellable !== false).sort((a, b) => a.r.name.localeCompare(b.r.name, 'pt'));

  function recipeDoc(rec, opts = {}) {
    const data = dataView(opts.draft ? { recipe: rec } : undefined);
    const c = Calc.evaluator(data).cost(rec);
    const p = Calc.pricing(rec, c, data.settings);
    const m = Calc.laborMinutes(rec);
    const ul = (u) => (u === 'dose' ? 'dose' : u === 'emb' ? 'emb' : UNITS[u] ? UNITS[u].label : u);
    return `${header('Ficha técnica — ' + rec.name, `${h(rec.code || '')} · ${h(rec.category || '')} · ${h(typeLabel(rec.type))}${rec.demo ? ' · <b>DEMONSTRAÇÃO</b>' : ''}`)}
      <div style="display:flex;gap:14px">${rec.photo ? `<img src="${rec.photo}" style="width:170px;height:128px;object-fit:cover;border-radius:6px">` : ''}
      <div class="meta" style="flex:1"><div><b>Doses:</b> ${U.numMax(rec.portions)}</div><div><b>Quantidade final:</b> ${rec.finalQty ? U.numMax(rec.finalQty) + ' ' + ul(rec.finalUnit) : '—'}</div><div><b>Preparação:</b> ${m.prep} min</div><div><b>Confeção:</b> ${m.cook} min</div>
      <div><b>Empratamento:</b> ${m.plat} min</div><div><b>Limpeza:</b> ${m.clean} min</div><div><b>Tempo total:</b> ${m.total} min</div><div><b>Temperatura:</b> ${h(rec.temperature || '—')}</div></div></div>
      <h2>Ingredientes</h2><table><thead><tr><th>Ingrediente</th><th>Qtd. líquida</th><th>Desp.</th><th>Qtd. bruta</th><th>Preço unit.</th><th>Custo efetivo</th><th>Alergénios</th></tr></thead><tbody>
      ${c.lines.map((L) => `<tr><td>${h(L.name)}${L.kind === 'rec' ? ' (preparação)' : ''}${L.error ? ' — <b style="color:#c00">' + h(L.error) + '</b>' : ''}</td><td>${U.numMax(L.qty)} ${ul(L.unit)}</td><td>${U.num(L.wastePct, 1)} %</td><td>${U.ok(L.grossQty) ? U.numMax(L.grossQty) + ' ' + ul(L.unit) : '—'}</td><td>${h(fmtUnitPrice(L.unitPrice, L.unit))}</td><td class="r">${U.eur(L.effCost)}</td><td>${algNames(L.allergens)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="5">Total matérias-primas</td><td class="r">${U.eur(c.materials)}</td><td></td></tr></tfoot></table>
      ${rec.notes ? `<h2>Modo de preparação</h2><div style="white-space:pre-wrap">${h(rec.notes)}</div>` : ''}
      <h2>Estiva de custos</h2><table><thead><tr><th>Componente</th><th>Lote</th><th>Por dose</th></tr></thead><tbody>
      <tr><td>Matérias-primas</td><td class="r">${U.eur(c.materials)}</td><td class="r">${U.eur(c.perDose.materials)}</td></tr><tr><td>Mão de obra (${c.laborDetail.mode === 'individual' ? 'tempos individuais' : 'tempos simultâneos'}, ${U.numMax(m.counted)} min)</td><td class="r">${U.eur(c.labor)}</td><td class="r">${U.eur(c.perDose.labor)}</td></tr>
      <tr><td>Energia</td><td class="r">${U.eur(c.energy)}</td><td class="r">${U.eur(c.perDose.energy)}</td></tr><tr><td>Outros custos operacionais</td><td class="r">${U.eur(c.operational)}</td><td class="r">${U.eur(c.perDose.operational)}</td></tr>
      <tr><td><b>Custo total de produção</b></td><td class="r"><b>${U.eur(c.total)}</b></td><td class="r"><b>${U.eur(c.perDose.total)}</b></td></tr></tbody></table>
      ${U.ok(c.perBaseUnit) ? `<div>Custo por ${c.perBaseLabel} de produto final: <b>${U.eur(c.perBaseUnit)}</b></div>` : ''}
      ${rec.sellable !== false ? `<h2>Preço de venda</h2><table><thead><tr><th></th><th>Sem IVA</th><th>Com IVA (${U.num(p.vat, 0)} %)</th><th>Food Cost</th><th>Margem contrib.</th><th>Lucro est./dose</th></tr></thead><tbody>${[...p.tiers.map((t) => [t.label + ' (FC ' + U.num(t.targetPct, 0) + ' %)', t]), ...(p.current ? [['Preço praticado', p.current]] : [])].map(([l, t]) => `<tr><td>${h(l)}</td><td class="r">${U.eur(t.net)}</td><td class="r"><b>${U.eur(t.gross)}</b></td><td class="r">${U.pct(t.foodCostPct)}</td><td class="r">${U.eur(t.contribution)}</td><td class="r">${U.eur(t.profit)}</td></tr>`).join('')}</tbody></table>` : ''}
      <h2>Alergénios</h2><div>${c.allergens.present.length ? c.allergens.present.map((i) => `${algBadge(i)} ${h(ALLERGEN_BY_ID[i].name)}`).join(' &nbsp; ') : 'Nenhum alergénio identificado nos ingredientes.'}</div>
      ${c.allergens.traces.length ? `<div style="margin-top:4px"><b>Pode conter:</b> ${c.allergens.traces.map((i) => h(ALLERGEN_BY_ID[i].name)).join(', ')}</div>` : ''}
      <div class="disclaimer">Identificação de alergénios ${c.allergens.confirmed ? 'confirmada pelo responsável' : '<b>não confirmada</b>'}. Baseada nos ingredientes cadastrados; não garante a ausência de alergénios.</div>${foot()}`;
  }
  function allergenDoc(recs, opts = {}) {
    const data = dataView(opts.draft && recs.length === 1 ? { recipe: recs[0] } : undefined);
    const ev = Calc.evaluator(data);
    return `${header('Informação sobre alergénios', 'Regulamento (UE) n.º 1169/2011 — 14 substâncias ou produtos que provocam alergias ou intolerâncias')}
      <table><thead><tr><th style="width:28%">Prato / produto</th>${ALLERGENS.map((a) => `<th style="text-align:center;font-size:9px">${algBadge(a.id)}<br>${h(a.short)}</th>`).join('')}</tr></thead><tbody>
      ${recs.map((r) => { const a = ev.cost(r).allergens; return `<tr><td><b>${h(r.name)}</b></td>${ALLERGENS.map((x) => `<td style="text-align:center">${a.present.includes(x.id) ? algBadge(x.id) : a.traces.includes(x.id) ? algBadge(x.id, true) : ''}</td>`).join('')}</tr>`; }).join('')}
      </tbody></table><div style="font-size:10.5px">Círculo cheio: contém · Círculo tracejado: pode conter vestígios (contaminação cruzada).</div>
      <div class="disclaimer">Se tem alguma alergia ou intolerância alimentar, informe a nossa equipa antes de fazer o pedido. Apesar dos cuidados na preparação, não é possível garantir a ausência total de vestígios de alergénios.</div>${foot()}`;
  }
  function ingredientsSheet() {
    const st = getSettings();
    return { name: 'Ingredientes', widths: [10, 34, 18, 18, 16, 12, 8, 14, 10, 10, 24, 22, 12], rows: [
      ['Código', 'Nome', 'Categoria', 'Fornecedor', 'Compra', 'Preço compra', 'IVA', 'Custo por base', 'Unidade base', 'Desperdício', 'Alergénios', 'Pode conter', 'Atualizado'].map(H),
      ...Repo.all('ingredients').sort((a, b) => a.name.localeCompare(b.name, 'pt')).map((i) => { const c = Calc.ingredientUnitCost(i, st); return [i.code || '', i.name + (i.demo ? ' [DEMO]' : ''), i.category || '', i.supplier || '', IngUI.purchaseText(i), E(Number(i.price)), P(Number(i.vat) || 0), E(c.cost), IngUI.baseLabel(i), P(Number(i.wastePct) || 0), algNames(i.allergens || []), algNames(i.traces || []), U.fmtDate(i.priceUpdatedAt)]; }),
    ] };
  }
  const def = {
    ficha: { title: 'Ficha técnica completa', desc: 'Ficha de um prato pronta para a cozinha', needsRecipe: true,
      html: (r) => recipeDoc(r),
      sheets: (r) => { const data = dataView(); const c = Calc.evaluator(data).cost(r); const p = Calc.pricing(r, c, data.settings); return [{ name: 'Ficha', widths: [34, 12, 10, 10, 14, 14, 24], rows: [[{ v: r.name, t: 'title' }], [], ['Ingrediente', 'Qtd. líquida', 'Unidade', 'Desp. %', 'Preço unit.', 'Custo efetivo', 'Alergénios'].map(H), ...c.lines.map((L) => [L.name, N(L.qty), L.unit, P(L.wastePct), E(L.unitPrice), E(L.effCost), algNames(L.allergens)]), [], ['Componente', 'Lote', 'Por dose'].map(H), ['Matérias-primas', E(c.materials), E(c.perDose.materials)], ['Mão de obra', E(c.labor), E(c.perDose.labor)], ['Energia', E(c.energy), E(c.perDose.energy)], ['Outros operacionais', E(c.operational), E(c.perDose.operational)], ['Custo total', E(c.total), E(c.perDose.total)], [], ['Preço', 'Sem IVA', 'Com IVA', 'Food Cost', 'Margem contribuição', 'Lucro estimado'].map(H), ...p.tiers.map((t) => [t.label, E(t.net), E(t.gross), P(t.foodCostPct), E(t.contribution), E(t.profit)]), ...(p.current ? [['Praticado', E(p.current.net), E(p.current.gross), P(p.current.foodCostPct), E(p.current.contribution), E(p.current.profit)]] : [])] }]; } },
    estiva: { title: 'Estiva de custos por prato', desc: 'Decomposição do custo de todas as fichas',
      sheet: () => ({ name: 'Estiva de custos', widths: [34, 18, 8, 14, 14, 14, 14, 14, 14, 14], rows: [['Ficha', 'Categoria', 'Doses', 'Matérias/dose', 'Mão obra/dose', 'Energia/dose', 'Outros/dose', 'Custo total/dose', 'Custo lote', 'Custo kg/L'].map(H), ...computeAll().sort((a, b) => a.r.name.localeCompare(b.r.name, 'pt')).map((x) => [x.r.name, x.r.category || '', N(Number(x.r.portions)), E(x.c.perDose.materials), E(x.c.perDose.labor), E(x.c.perDose.energy), E(x.c.perDose.operational), E(x.c.perDose.total), E(x.c.total), E(x.c.perBaseUnit)])] }) },
    ingredientes: { title: 'Lista de ingredientes', desc: 'Todos os ingredientes, preços e alergénios', sheet: ingredientsSheet },
    alergenios: { title: 'Alergénios por prato', desc: 'Matriz dos 14 alergénios por ficha',
      sheet: () => ({ name: 'Alergénios', widths: [34, ...ALLERGENS.map(() => 9), 12], rows: [['Ficha', ...ALLERGENS.map((a) => a.short), 'Confirmado'].map(H), ...computeAll().sort((a, b) => a.r.name.localeCompare(b.r.name, 'pt')).map((x) => [x.r.name, ...ALLERGENS.map((a) => (x.c.allergens.present.includes(a.id) ? 'Contém' : x.c.allergens.traces.includes(a.id) ? 'Pode conter' : '')), x.c.allergens.confirmed ? 'Sim' : 'Não'])] }),
      printHtml: () => allergenDoc(sellable().map((x) => x.r)) },
    precos: { title: 'Comparação de preços de venda', desc: 'Preço praticado vs. sugestões',
      sheet: () => ({ name: 'Preços', widths: [34, 14, 14, 14, 14, 14, 12, 12, 16], rows: [['Produto', 'Custo total/dose', 'Económico', 'Recomendado', 'Premium', 'Praticado', 'FC praticado', 'FC objetivo', 'Diferença p/ recom.'].map(H), ...sellable().map((x) => [x.r.name, E(x.c.perDose.total), E(x.p.tiers[0].gross), E(x.p.tiers[1].gross), E(x.p.tiers[2].gross), E(x.p.current ? x.p.current.gross : NaN), P(x.p.current ? x.p.current.foodCostPct : NaN), P(x.p.target), E(x.p.current ? x.p.current.gross - x.p.recommended.gross : NaN)])] }) },
    rentaveis: { title: 'Ranking dos pratos mais rentáveis', desc: 'Ordenado pelo lucro estimado por dose',
      sheet: () => ({ name: 'Mais rentáveis', widths: [6, 34, 14, 14, 14, 14, 12], rows: [['#', 'Produto', 'PV c/IVA', 'Margem contribuição', 'Lucro est./dose', 'Margem %', 'Food Cost'].map(H), ...sellable().filter((x) => x.p.current).sort((a, b) => b.p.current.profit - a.p.current.profit).map((x, i) => [i + 1, x.r.name, E(x.p.current.gross), E(x.p.current.contribution), E(x.p.current.profit), P(x.p.current.profitPct), P(x.p.current.foodCostPct)])] }) },
    fc: { title: 'Ranking dos pratos com maior Food Cost', desc: 'Ordenado pelo Food Cost do preço praticado',
      sheet: () => ({ name: 'Maior Food Cost', widths: [6, 34, 14, 14, 12, 12, 14], rows: [['#', 'Produto', 'Matérias/dose', 'PV s/IVA', 'Food Cost', 'Objetivo', 'Diferença (p.p.)'].map(H), ...sellable().filter((x) => x.p.current).sort((a, b) => b.p.current.foodCostPct - a.p.current.foodCostPct).map((x, i) => [i + 1, x.r.name, E(x.c.perDose.materials), E(x.p.current.net), P(x.p.current.foodCostPct), P(x.p.target), N(U.round(x.p.current.foodCostPct - x.p.target, 2))])] }) },
    evolucao: { title: 'Evolução dos custos de ingredientes', desc: 'Histórico de alterações de preço',
      sheet: () => { const hist = Repo.all('priceHistory').sort((a, b) => b.date.localeCompare(a.date)); return { name: 'Evolução', widths: [18, 34, 16, 16, 12, 14, 40], rows: [['Data', 'Ingrediente', 'Custo anterior', 'Custo novo', 'Variação', 'Origem', 'Fichas afetadas'].map(H), ...hist.map((x) => [U.fmtDateTime(x.date), x.ingredientName, E(x.oldUnitCost), E(x.newUnitCost), P(x.diffPct), x.source || '', x.impacts.map((i) => i.recipeName).join(', ')])] }; } },
    antesdepois: { title: 'Comparação de custos antes e depois de atualizações', desc: 'Impacto das alterações de preço nas fichas',
      sheet: () => { const rows = []; Repo.all('priceHistory').sort((a, b) => b.date.localeCompare(a.date)).forEach((x) => x.impacts.forEach((im) => rows.push([U.fmtDateTime(x.date), x.ingredientName, P(x.diffPct), im.recipeName, E(im.oldDose), E(im.newDose), E(im.newDose - im.oldDose), P(im.oldDose ? ((im.newDose - im.oldDose) / im.oldDose) * 100 : NaN)]))); return { name: 'Antes e depois', widths: [18, 30, 12, 30, 14, 14, 14, 12], rows: [['Data', 'Ingrediente', 'Var. ingrediente', 'Ficha', 'Custo/dose antes', 'Custo/dose depois', 'Diferença', 'Var. ficha'].map(H), ...rows] }; } },
    global: { title: 'Relatório global de rentabilidade', desc: 'Resumo por categoria e produtos com prejuízo',
      sheet: () => { const list = sellable().filter((x) => x.p.current); const cats = [...new Set(list.map((x) => x.r.category || '—'))]; const agg = (l) => [N(l.length), E(U.avg(l.map((x) => x.c.perDose.total))), E(U.avg(l.map((x) => x.p.current.gross))), P(U.avg(l.map((x) => x.p.current.foodCostPct))), E(U.avg(l.map((x) => x.p.current.contribution))), E(U.avg(l.map((x) => x.p.current.profit))), P(U.avg(l.map((x) => x.p.current.profitPct))), N(l.filter((x) => x.p.current.profit < 0).length)]; return { name: 'Rentabilidade', widths: [26, 10, 14, 14, 12, 16, 14, 12, 12], rows: [['Categoria', 'Produtos', 'Custo médio/dose', 'PV médio c/IVA', 'FC médio', 'Contribuição média', 'Lucro médio/dose', 'Margem média', 'Com prejuízo'].map(H), ...cats.map((c) => [c, ...agg(list.filter((x) => (x.r.category || '—') === c))]), ['TOTAL', ...agg(list)].map((v, i) => (i === 0 ? { v, t: 'head' } : v))] }; } },
  };
  function sheetsFor(key, rec) { const d = def[key]; return d.sheets ? d.sheets(rec) : [d.sheet()]; }
  function htmlFor(key, rec) {
    const d = def[key];
    if (d.html) return d.html(rec);
    if (d.printHtml) return d.printHtml();
    const sh = d.sheet();
    return header(d.title) + (sh.rows.length > 1 ? toHtmlTable(sh.rows) : '<p>Sem dados.</p>') + (key === 'global' ? lossList() : '') + foot();
  }
  function lossList() { const l = sellable().filter((x) => x.p.current && x.p.current.profit < 0); return `<h2>Produtos com prejuízo estimado</h2>${l.length ? toHtmlTable([['Produto', 'PV c/IVA', 'Custo total/dose', 'Lucro est./dose', 'PV recomendado'].map(H), ...l.map((x) => [x.r.name, E(x.p.current.gross), E(x.c.perDose.total), E(x.p.current.profit), E(x.p.recommended.gross)])]) : '<p>Nenhum.</p>'}`; }
  return {
    def, sheetsFor, htmlFor, ingredientsSheet, toHtmlTable,
    printRecipe: (rec, opts) => printHTML(recipeDoc(rec, opts), 'Ficha técnica - ' + rec.name),
    printAllergenSheet: (recs, opts) => printHTML(allergenDoc(recs, opts), 'Alergénios'),
  };
})();

/* ------------------------------ 10. RELATÓRIOS ------------------------------ */
const RepUI = { key: 'estiva', rec: '' };
Views.relatorios = (el) => {
  const recs = Repo.all('recipes').sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  if (!RepUI.rec && recs.length) RepUI.rec = recs[0].id;
  el.innerHTML = `<div class="rep-cards">${Object.entries(Reports.def).map(([k, d]) => `<div class="rep-card ${RepUI.key === k ? 'active' : ''}" data-rep="${k}"><b>${h(d.title)}</b><span class="small muted">${h(d.desc)}</span></div>`).join('')}</div>
    <div class="card" style="margin-top:16px"><div class="toolbar">${Reports.def[RepUI.key].needsRecipe ? `<select id="rrec">${options(recs.map((r) => [r.id, r.name]), RepUI.rec)}</select>` : ''}<span class="grow"></span>
      <button class="btn primary" id="rpdf">🖨 Imprimir / PDF</button><button class="btn" id="rxl">⤓ Excel</button><button class="btn" id="rcsv">⤓ CSV</button></div>
      <div class="small muted">Para PDF, escolha "Guardar como PDF" na janela de impressão do navegador.</div><div class="sep"></div><div id="rprev" class="print-doc"></div></div>`;
  const rec = () => Repo.get('recipes', RepUI.rec);
  const need = Reports.def[RepUI.key].needsRecipe;
  const draw = () => { if (need && !rec()) { $('#rprev', el).innerHTML = '<div class="empty">Crie uma ficha técnica primeiro.</div>'; return; } $('#rprev', el).innerHTML = Reports.htmlFor(RepUI.key, rec()); };
  $$('[data-rep]', el).forEach((c) => (c.onclick = () => { RepUI.key = c.dataset.rep; Views.relatorios(el); }));
  const rr = $('#rrec', el); if (rr) rr.onchange = () => { RepUI.rec = rr.value; draw(); };
  const guard = () => { if (need && !rec()) { toast('Escolha uma ficha', 'err'); return false; } return true; };
  const name = () => (need ? 'ficha_' + U.normalize(rec().name).replace(/ /g, '-') : RepUI.key);
  $('#rpdf', el).onclick = () => guard() && printHTML(Reports.htmlFor(RepUI.key, rec()), Reports.def[RepUI.key].title);
  $('#rxl', el).onclick = () => guard() && exportRows('xlsx', name(), Reports.sheetsFor(RepUI.key, rec()));
  $('#rcsv', el).onclick = () => guard() && exportRows('csv', name(), Reports.sheetsFor(RepUI.key, rec()));
  draw();
};

/* ------------------------------ ARRANQUE ------------------------------ */
window.addEventListener('unhandledrejection', (e) => { const m = e.reason && e.reason.message; if (m) toast(m, 'err'); });
(async function boot() {
  $('#view').innerHTML = '<div class="empty">A carregar…</div>';
  try {
    const red = await Auth.handleRedirect();
    if (red && red.error) toast('Link inválido ou expirado: ' + red.error, 'err');
    else if (red) { Sync.setMode('cloud'); if (red.type === 'recovery') await Gate.newPassword(); else toast('Email confirmado', 'ok'); }
  } catch (e) { toast(e.message, 'err'); }
  let mode = Sync.mode();
  if (!mode) mode = await Gate.welcome();
  if (mode === 'cloud') { if (!(await startCloud())) return; }
  else {
    try { await Repo.init(); }
    catch (e) { $('#view').innerHTML = `<div class="alert err">Não foi possível abrir o armazenamento local: ${h(e.message)}</div>`; return; }
    if (!Repo.get('meta', 'settings')) { await saveSettings({ firstRun: U.nowISO() }); if (!Repo.all('ingredients').length && !Repo.all('recipes').length) await Demo.load(); }
  }
  // alterações vindas de outros dispositivos: atualiza o ecrã sem interromper quem está a escrever
  let pendingRender = false;
  const rerender = () => {
    const busy = $('.modal-bg') || (document.activeElement && document.activeElement.closest('#view') && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName));
    if (UI.current === 'ficha') { if (!UI.dirty) { pendingRender = false; route(true); } else toast('Esta ficha foi alterada noutro dispositivo. Ao guardar, a sua versão substitui a outra.'); return; }
    if (busy) { pendingRender = true; return; }
    pendingRender = false; route(true);
  };
  Repo.on((type) => { if (type === 'remote') rerender(); });
  Plan.syncAds();
  Billing.reconcile();
  if (Native.ok) document.body.classList.add('native-app');
  document.addEventListener('focusout', () => setTimeout(() => { if (pendingRender) rerender(); }, 300));
  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  $('#quickBackup').onclick = backupDownload;
  document.addEventListener('click', (e) => { if (window.innerWidth <= 820 && !e.target.closest('#sidebar') && !e.target.closest('#menuBtn')) $('#sidebar').classList.remove('open'); });
  route();
})();
