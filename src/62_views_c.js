/* =====================================================================
   VISTAS — Alergénios, Mão de obra, Custos, Simulador, Configurações
   ===================================================================== */

/* ------------------------------ 6. ALERGÉNIOS ------------------------------ */
const AlgUI = { q: '', only: '', filter: 0 };
Views.alergenios = (el) => {
  const all = computeAll().sort((a, b) => a.r.name.localeCompare(b.r.name, 'pt'));
  const ings = Repo.all('ingredients');
  el.innerHTML = `<div class="alert warn">A identificação automática é um apoio baseado nos ingredientes cadastrados. Confirme sempre os alergénios em cada ficha. A aplicação não pode garantir a ausência de alergénios.</div>
    <div class="card"><div class="card-h"><h3>${h(tr('Legenda'))} (${h(countryInfo().law)})</h3></div>
      <div class="grid g4" style="gap:6px">${ALLERGENS.map((a) => `<div class="alg-big">${algBadge(a.id)}<span class="small">${h(a.name)}</span></div>`).join('')}</div>
      <div class="small muted" style="margin-top:8px">Círculo cheio = contém · círculo tracejado = pode conter (contaminação cruzada)</div></div>
    <div class="card"><div class="toolbar"><input class="search" id="aq" placeholder="Pesquisar ficha…" value="${h(AlgUI.q)}">
      <select id="aonly">${options([['venda', 'Só artigos de venda'], ['inter', 'Só preparações intermédias'], ['nconf', 'Não confirmadas']], AlgUI.only, { empty: 'Todas as fichas' })}</select>
      <select id="afil">${options(ALLERGENS.map((a) => [a.id, 'Sem ' + a.short]), AlgUI.filter || '', { empty: 'Filtrar: sem alergénio…' })}</select>
      <span class="grow"></span><button class="btn" id="aexp">⤓ Excel</button><button class="btn primary" id="aprint">Imprimir ficha para clientes</button></div>
      <div id="amat"></div></div>
    <div class="card"><div class="card-h"><h3>Ingredientes por alergénio</h3></div><div class="grid g2">${ALLERGENS.map((a) => { const list = ings.filter((i) => (i.allergens || []).includes(a.id)); const trl = ings.filter((i) => (i.traces || []).includes(a.id)); return `<div><b>${algBadge(a.id)} ${h(a.name)}</b><div class="small">${list.length ? list.map((i) => h(i.name)).join(', ') : '<span class="muted">nenhum ingrediente</span>'}${trl.length ? `<div class="muted">Pode conter: <span data-notr>${trl.map((i) => h(i.name)).join(', ')}</span></div>` : ''}</div></div>`; }).join('')}</div></div>`;
  const filtered = () => { const q = U.normalize(AlgUI.q); return all.filter((x) => (!q || U.normalize(x.r.name).includes(q)) && (!AlgUI.only || (AlgUI.only === 'venda' ? x.r.sellable !== false : AlgUI.only === 'inter' ? x.r.intermediate : !x.c.allergens.confirmed)) && (!AlgUI.filter || (!x.c.allergens.present.includes(AlgUI.filter) && !x.c.allergens.traces.includes(AlgUI.filter)))); };
  const draw = () => {
    const list = filtered();
    $('#amat', el).innerHTML = list.length ? `<div class="table-wrap"><table class="matrix"><thead><tr><th>Ficha técnica</th>${ALLERGENS.map((a) => `<th class="c" title="${h(a.name)}">${algBadge(a.id)}</th>`).join('')}<th>Confirmado</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td><a href="#/ficha/${x.r.id}">${h(x.r.name)}</a>${demoTag(x.r)}</td>${ALLERGENS.map((a) => { const p = x.c.allergens.present.includes(a.id), t = x.c.allergens.traces.includes(a.id); const src = p ? (x.c.allergens.sources[a.id] || ['manual']).join(', ') : t ? tr('Pode conter') + ': ' + (x.c.allergens.traceSources[a.id] || ['manual']).join(', ') : ''; return `<td class="c">${p ? algBadge(a.id, false, tr(a.name) + ' — ' + src) : t ? algBadge(a.id, true, src) : ''}</td>`; }).join('')}<td>${x.c.allergens.confirmed ? '<span class="badge green">Sim</span>' : '<span class="badge amber">Não</span>'}</td></tr>`).join('')}
      </tbody></table></div><div class="small muted" style="margin-top:6px">Passe o rato sobre um símbolo para ver os ingredientes responsáveis.</div>` : '<div class="empty">Sem fichas para mostrar.</div>';
  };
  $('#aq', el).oninput = (e) => { AlgUI.q = e.target.value; draw(); };
  $('#aonly', el).onchange = (e) => { AlgUI.only = e.target.value; draw(); };
  $('#afil', el).onchange = (e) => { AlgUI.filter = Number(e.target.value) || 0; draw(); };
  $('#aprint', el).onclick = () => { const l = filtered().filter((x) => x.r.sellable !== false).map((x) => x.r); if (!l.length) { toast('Não há artigos de venda na seleção', 'err'); return; } Reports.printAllergenSheet(l); };
  $('#aexp', el).onclick = () => exportRows('xlsx', 'alergenios', [Reports.def.alergenios.sheet()]);
  draw();
};

/* ------------------------------ 7. MÃO DE OBRA ------------------------------ */
Views['mao-de-obra'] = (el) => {
  const st = getSettings();
  const data = dataView();
  const staff = Repo.all('staff').sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const avgAuto = Calc.teamAverageRate({ ...data, settings: { ...st, teamAvgMode: 'auto' } });
  const all = computeAll().filter((x) => x.c.labor > 0).sort((a, b) => b.c.perDose.labor - a.c.perDose.labor);
  el.innerHTML = `<div class="grid g2">
    <div class="card"><div class="card-h"><h3>Custo horário médio da equipa</h3></div>
      <label class="check"><input type="radio" name="am" value="auto" ${st.teamAvgMode !== 'manual' ? 'checked' : ''}> Calcular automaticamente (média dos funcionários ativos): <b>${U.eur(avgAuto)}/h</b></label>
      <label class="check" style="margin-top:6px"><input type="radio" name="am" value="manual" ${st.teamAvgMode === 'manual' ? 'checked' : ''}> Valor manual: <input class="num" id="amv" inputmode="decimal" style="width:90px" value="${h(U.inNum(st.teamAvgManual))}"> €/h</label>
      <div class="help">Use o <b>custo para a empresa</b> (salário + subsídios + TSU + seguros), não o salário líquido. No modo "salário", o custo horário = salário × 14 ÷ 12 × (1 + encargos) ÷ horas mensais.</div></div>
    <div class="card"><div class="card-h"><h3>Calculadora rápida</h3></div>
      <div class="fields"><div class="field"><label>Funcionários</label><input class="num" id="qn" value="2"></div><div class="field"><label>Custo horário (€)</label><input class="num" id="qr" value="9"></div><div class="field"><label>Minutos</label><input class="num" id="qm" value="30"></div><div class="field"><label>Modo</label><select id="qmode"><option value="s">Simultâneo</option><option value="i">Individual (minutos já somados)</option></select></div></div>
      <div class="alert ok" id="qres" style="margin-top:10px"></div></div></div>
    <div class="card"><div class="card-h"><h3>Funcionários</h3><button class="btn primary" id="stNew">+ Novo funcionário</button></div>
      ${staff.length ? `<div class="table-wrap"><table><thead><tr><th>Nome</th><th>Função</th><th>Cálculo</th><th class="r">Custo horário</th><th>Ativo</th><th></th></tr></thead><tbody>${staff.map((s) => `<tr><td><b>${h(s.name)}</b>${demoTag(s)}</td><td>${h(s.role || '')}</td><td class="small">${s.mode === 'salario' ? `Salário ${U.eur(s.monthlySalary)} × ${s.salariesYear || 14} + ${U.num(s.chargesPct, 2)} % encargos ÷ ${U.numMax(s.hoursMonth)} h` : 'Manual'}</td><td class="r b">${U.eur(Calc.staffHourly(s))}/h</td><td>${s.active !== false ? '<span class="badge green">Sim</span>' : '<span class="badge gray">Não</span>'}</td><td class="nowrap"><button class="btn sm" data-st="${s.id}">Editar</button> <button class="btn sm danger" data-stdel="${s.id}">✕</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Sem funcionários. As fichas usarão o custo horário médio.</div>'}</div>
    <div class="card"><div class="card-h"><h3>Mão de obra por ficha técnica</h3></div>
      ${all.length ? `<div class="table-wrap"><table><thead><tr><th>Ficha</th><th>Modo</th><th class="r">Minutos contados</th><th class="r">Mão de obra (lote)</th><th class="r">Por dose</th><th class="r">% do custo total</th></tr></thead><tbody>${all.map((x) => `<tr><td><a href="#/ficha/${x.r.id}">${h(x.r.name)}</a></td><td class="small">${x.c.laborDetail.mode === 'individual' ? 'Individual' : 'Simultâneo'}</td><td class="r">${U.numMax(x.c.laborDetail.minutes.counted)}</td><td class="r">${U.eur(x.c.labor)}</td><td class="r b">${U.eur(x.c.perDose.labor)}</td><td class="r">${U.pct((x.c.labor / x.c.total) * 100)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhuma ficha com mão de obra.</div>'}</div>`;
  const qcalc = () => { const n = U.parseNum($('#qn', el).value) || 0, r = U.parseNum($('#qr', el).value) || 0, m = U.parseNum($('#qm', el).value) || 0; const v = $('#qmode', el).value === 's' ? n * r * m / 60 : r * m / 60; $('#qres', el).innerHTML = $('#qmode', el).value === 's' ? `${U.numMax(n)} × ${U.eur(r)} × ${U.numMax(m)} min ÷ 60 = <b>${U.eur(v)}</b>` : `${U.eur(r)} × ${U.numMax(m)} min ÷ 60 = <b>${U.eur(v)}</b>`; };
  ['qn', 'qr', 'qm', 'qmode'].forEach((i) => $('#' + i, el).addEventListener('input', qcalc)); qcalc();
  $$('[name=am]', el).forEach((r) => (r.onchange = async () => { await saveSettings({ teamAvgMode: r.value }); Views['mao-de-obra'](el); }));
  $('#amv', el).onchange = async (e) => { const v = U.parseNum(e.target.value); if (!(v >= 0)) { e.target.classList.add('bad'); return; } await saveSettings({ teamAvgManual: v }); toast('Guardado', 'ok'); Views['mao-de-obra'](el); };
  const re = () => Views['mao-de-obra'](el);
  $('#stNew', el).onclick = () => staffForm(null, re);
  $$('[data-st]', el).forEach((b) => (b.onclick = () => staffForm(Repo.get('staff', b.dataset.st), re)));
  $$('[data-stdel]', el).forEach((b) => (b.onclick = async () => {
    const s = Repo.get('staff', b.dataset.stdel);
    const used = Repo.all('recipes').filter((r) => ((r.labor && r.labor.lines) || []).some((l) => l.staffId === s.id));
    if (used.length) { modal({ title: 'Não é possível eliminar', size: 'small', body: `<p>${h(s.name)} está associado a: ${used.map((r) => h(r.name)).join(', ')}.</p><p>Pode marcá-lo como inativo ou alterar essas fichas.</p>` }); return; }
    if (await confirmDlg(`Eliminar ${h(s.name)}?`, { danger: true, ok: 'Eliminar' })) { await Repo.remove('staff', s.id); re(); }
  }));
};
function staffForm(s, after) {
  const x = s ? U.clone(s) : { mode: 'manual', hourlyCost: null, salariesYear: 14, chargesPct: 23.75, hoursMonth: 173.33, active: true };
  const m = modal({ title: s ? 'Editar funcionário' : 'Novo funcionário', body: `<form id="stf"><div class="fields">
    <div class="field" style="grid-column:span 2"><label>Nome *</label><input name="name" value="${h(x.name || '')}"></div><div class="field"><label>Função</label><input name="role" value="${h(x.role || '')}"></div>
    <div class="field"><label>Cálculo do custo</label><select name="mode">${options([['manual', 'Custo horário manual'], ['salario', 'A partir do salário']], x.mode)}</select></div>
    <div class="field m-man"><label>Custo horário para a empresa (€) *</label>${numInput('hourlyCost', x.hourlyCost)}</div>
    <div class="field m-sal"><label>Salário base mensal (€)</label>${numInput('monthlySalary', x.monthlySalary)}</div>
    <div class="field m-sal"><label>N.º de salários/ano</label>${numInput('salariesYear', x.salariesYear)}</div>
    <div class="field m-sal"><label>Encargos (%)</label>${numInput('chargesPct', x.chargesPct)}<span class="hint">TSU 23,75 % + seguro, etc.</span></div>
    <div class="field m-sal"><label>Horas por mês</label>${numInput('hoursMonth', x.hoursMonth)}<span class="hint">40 h × 52 ÷ 12 ≈ 173,33</span></div>
    <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="active" ${x.active !== false ? 'checked' : ''}> Ativo</label></div></div>
    <div class="alert ok" id="stRes" style="margin-top:10px"></div></form>`, footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="stSave">Guardar</button>' });
  const f = m.$('#stf');
  const upd = () => { const v = readForm(f); $$('.m-man', f).forEach((e) => (e.style.display = v.mode === 'manual' ? '' : 'none')); $$('.m-sal', f).forEach((e) => (e.style.display = v.mode === 'salario' ? '' : 'none')); m.$('#stRes').innerHTML = `Custo horário: <b>${U.eur(Calc.staffHourly(v))}/h</b>`; };
  f.addEventListener('input', upd); upd();
  m.$('#stSave').onclick = async () => {
    const v = readForm(f); const bad = [];
    if (!v.name.trim()) bad.push('name');
    if (v.mode === 'manual' && !(v.hourlyCost >= 0 && v.hourlyCost !== null)) bad.push('hourlyCost');
    if (v.mode === 'salario') { if (!(v.monthlySalary > 0)) bad.push('monthlySalary'); if (!(v.hoursMonth > 0)) bad.push('hoursMonth'); if (!(v.salariesYear > 0)) bad.push('salariesYear'); }
    markInvalid(f, bad); if (bad.length) return toast('Corrija os campos assinalados', 'err');
    await Repo.save('staff', { ...x, ...v, name: v.name.trim() }); m.close(); toast('Guardado — fichas recalculadas', 'ok'); after();
  };
}

/* ------------------------------ 8. CUSTOS ENERGÉTICOS E OPERACIONAIS ------------------------------ */
const OP_TYPES = [['eletricidade', 'Eletricidade'], ['gas', 'Gás'], ['agua', 'Água'], ['consumiveis', 'Consumíveis'], ['embalagens', 'Embalagens'], ['limpeza', 'Produtos de limpeza'], ['outros', 'Outros custos indiretos']];
Views.custos = (el) => {
  const st = getSettings(); const ind = st.indirect;
  const eqs = Repo.all('equipment').sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const ops = Repo.all('opcosts');
  const data = dataView();
  const ipd = Calc.indirectPerDose(data);
  const usedTypes = new Set(); Repo.all('recipes').forEach((r) => (r.equipment || []).forEach((e) => { const q = data.equipment.get(e.equipId); if (q) usedTypes.add(q.energyType); }));
  const dupWarn = ind.method === 'perDose' && !ind.includesEnergy && ops.some((o) => o.include !== false && (o.type === 'eletricidade' || o.type === 'gas') && usedTypes.has(o.type));
  el.innerHTML = `<div class="grid g2">
    <div class="card"><div class="card-h"><h3>Preço da energia</h3></div><div class="fields">
      <div class="field"><label>Eletricidade (€/kWh, sem IVA)</label><input class="num" id="ep" inputmode="decimal" value="${h(U.inNum(st.electricityPrice))}"></div>
      <div class="field"><label>Gás (€/kWh, sem IVA)</label><input class="num" id="gp" inputmode="decimal" value="${h(U.inNum(st.gasPrice))}"></div></div>
      <div class="help">Custo/hora de um equipamento = potência (kW) × preço do kWh × fator de utilização. O fator traduz o facto de o equipamento não consumir a potência máxima todo o tempo (termóstato). Em alternativa, indique diretamente o custo por hora.</div></div>
    <div class="card"><div class="card-h"><h3>Custos indiretos nas fichas</h3></div>
      <div class="field"><label>Método</label><select id="im">${options([['none', 'Não aplicar'], ['percent', 'Percentagem sobre o custo direto'], ['perDose', 'Rateio por dose (custos mensais ÷ doses/mês)']], ind.method)}</select></div>
      <div class="fields" style="margin-top:8px"><div class="field"><label>Percentagem (%)</label><input class="num" id="ipct" inputmode="decimal" value="${h(U.inNum(ind.percent))}" ${ind.method !== 'percent' ? 'disabled' : ''}></div>
        <div class="field"><label>Doses produzidas por mês</label><input class="num" id="idos" inputmode="decimal" value="${h(U.inNum(ind.dosesPerMonth))}" ${ind.method !== 'perDose' ? 'disabled' : ''}></div></div>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="iinE" ${ind.includesEnergy ? 'checked' : ''}> Os custos indiretos já incluem a energia dos equipamentos (não somar equipamentos)</label>
      <label class="check" style="margin-top:4px"><input type="checkbox" id="iinP" ${ind.includesPackaging ? 'checked' : ''}> Os custos indiretos já incluem embalagens e consumíveis (não somar nas fichas)</label>
      ${ind.method === 'perDose' ? `<div class="alert ok" style="margin-top:10px">Custos mensais incluídos: <b>${U.eur(ipd.monthly)}</b> ÷ ${U.numMax(ipd.doses)} doses = <b>${U.eur(ipd.perDose)} por dose</b></div>` : ''}
      ${dupWarn ? '<div class="alert warn">Atenção: há custos mensais de eletricidade/gás incluídos no rateio e fichas que também somam o consumo de equipamentos com essa energia. Se a fatura mensal inclui esse consumo, está a contar duas vezes. Inclua no rateio apenas a parte não associada aos equipamentos (frio, iluminação, climatização) ou marque a opção acima.</div>' : ''}</div></div>
    <div class="card"><div class="card-h"><h3>Equipamentos</h3><button class="btn primary" id="eqNew">+ Novo equipamento</button></div>
      ${eqs.length ? `<div class="table-wrap"><table><thead><tr><th>Equipamento</th><th>Energia</th><th>Cálculo</th><th class="r">Custo/hora</th><th class="r">Usado em</th><th></th></tr></thead><tbody>${eqs.map((e) => { const n = Repo.all('recipes').filter((r) => (r.equipment || []).some((x) => x.equipId === e.id)).length; return `<tr><td><b>${h(e.name)}</b>${demoTag(e)}</td><td>${h((OP_TYPES.find((t) => t[0] === e.energyType) || [, 'Outra'])[1])}</td><td class="small">${e.mode === 'manual' ? 'Custo/hora manual' : `${U.numMax(e.powerKw)} kW × ${U.numMax(e.usageFactor)} %`}</td><td class="r b">${U.eur(Calc.equipmentHourly(e, st))}</td><td class="r">${n} ficha(s)</td><td class="nowrap"><button class="btn sm" data-eq="${e.id}">Editar</button> <button class="btn sm danger" data-eqdel="${e.id}">✕</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Sem equipamentos.</div>'}</div>
    <div class="card"><div class="card-h"><h3>Custos operacionais mensais</h3><button class="btn" id="opNew">+ Adicionar custo</button></div>
      <div class="help">Usados no método "rateio por dose". Desmarque "incluir" para registar um custo sem o imputar às fichas.</div>
      ${ops.length ? `<div class="table-wrap"><table><thead><tr><th>Tipo</th><th>Descrição</th><th class="r">Valor mensal (€)</th><th class="c">Incluir no rateio</th><th></th></tr></thead><tbody>${ops.map((o) => `<tr data-op="${o.id}"><td><select data-of="type">${options(OP_TYPES, o.type)}</select></td><td><input data-of="name" value="${h(o.name)}" style="width:100%">${o.demo ? '<span class="badge demo">DEMO</span>' : ''}</td><td class="r"><input class="num" data-of="monthly" value="${h(U.inNum(o.monthly))}"></td><td class="c"><input type="checkbox" data-of="include" ${o.include !== false ? 'checked' : ''}></td><td><button class="btn sm danger" data-opdel>✕</button></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="2">Total incluído</td><td class="r">${U.eur(ipd.monthly)}</td><td colspan="2"></td></tr></tfoot></table></div>` : '<div class="empty">Sem custos mensais registados.</div>'}</div>`;
  const re = () => Views.custos(el);
  const numSet = (id, fn) => ($('#' + id, el).onchange = async (e) => { const v = U.parseNum(e.target.value); if (!(v >= 0)) { e.target.classList.add('bad'); toast('Valor inválido', 'err'); return; } await fn(v); toast('Guardado — fichas recalculadas', 'ok'); re(); });
  numSet('ep', (v) => saveSettings({ electricityPrice: v })); numSet('gp', (v) => saveSettings({ gasPrice: v }));
  numSet('ipct', (v) => saveSettings({ indirect: { ...ind, percent: v } })); numSet('idos', (v) => saveSettings({ indirect: { ...ind, dosesPerMonth: v } }));
  $('#im', el).onchange = async (e) => { await saveSettings({ indirect: { ...ind, method: e.target.value } }); re(); };
  $('#iinE', el).onchange = async (e) => { await saveSettings({ indirect: { ...ind, includesEnergy: e.target.checked } }); re(); };
  $('#iinP', el).onchange = async (e) => { await saveSettings({ indirect: { ...ind, includesPackaging: e.target.checked } }); re(); };
  $('#eqNew', el).onclick = () => equipForm(null, re);
  $$('[data-eq]', el).forEach((b) => (b.onclick = () => equipForm(Repo.get('equipment', b.dataset.eq), re)));
  $$('[data-eqdel]', el).forEach((b) => (b.onclick = async () => { const e = Repo.get('equipment', b.dataset.eqdel); const used = Repo.all('recipes').filter((r) => (r.equipment || []).some((x) => x.equipId === e.id)); if (used.length) { modal({ title: 'Não é possível eliminar', size: 'small', body: `<p><b>${h(e.name)}</b> é usado em: <span data-notr>${used.map((r) => h(r.name)).join(', ')}</span>.</p>` }); return; } if (await confirmDlg(`Eliminar ${h(e.name)}?`, { danger: true, ok: 'Eliminar' })) { await Repo.remove('equipment', e.id); re(); } }));
  $('#opNew', el).onclick = async () => { await Repo.save('opcosts', { id: U.uid(), type: 'outros', name: 'Novo custo', monthly: 0, include: true }); re(); };
  $$('tr[data-op]', el).forEach((tr) => {
    const o = Repo.get('opcosts', tr.dataset.op);
    $$('[data-of]', tr).forEach((inp) => (inp.onchange = async () => { const f = inp.dataset.of; let v = inp.type === 'checkbox' ? inp.checked : inp.classList.contains('num') ? U.parseNum(inp.value) : inp.value; if (f === 'monthly' && !(v >= 0)) { inp.classList.add('bad'); return; } await Repo.save('opcosts', { ...o, [f]: v }); re(); }));
    $('[data-opdel]', tr).onclick = async () => { await Repo.remove('opcosts', o.id); re(); };
  });
};
function equipForm(e, after) {
  const st = getSettings();
  const x = e ? U.clone(e) : { energyType: 'eletricidade', mode: 'potencia', powerKw: null, usageFactor: 60 };
  const m = modal({ title: e ? 'Editar equipamento' : 'Novo equipamento', body: `<form id="eqf"><div class="fields">
    <div class="field" style="grid-column:span 2"><label>Nome *</label><input name="name" value="${h(x.name || '')}" placeholder="ex.: Forno, Fogão, Fritadeira, Grelhador"></div>
    <div class="field"><label>Energia</label><select name="energyType">${options([['eletricidade', 'Eletricidade'], ['gas', 'Gás'], ['outro', 'Outra']], x.energyType)}</select></div>
    <div class="field"><label>Cálculo</label><select name="mode">${options([['potencia', 'Pela potência'], ['manual', 'Custo/hora manual']], x.mode)}</select></div>
    <div class="field e-pot"><label>Potência (kW)</label>${numInput('powerKw', x.powerKw)}</div>
    <div class="field e-pot"><label>Fator de utilização (%)</label>${numInput('usageFactor', x.usageFactor)}</div>
    <div class="field e-oth"><label>Preço da energia (€/kWh)</label>${numInput('energyPrice', x.energyPrice)}</div>
    <div class="field e-man"><label>Custo por hora (€)</label>${numInput('costPerHour', x.costPerHour)}</div></div>
    <div class="alert ok" id="eqRes" style="margin-top:10px"></div></form>`, footer: '<button class="btn" data-close>Cancelar</button><button class="btn primary" id="eqSave">Guardar</button>' });
  const f = m.$('#eqf');
  const upd = () => { const v = readForm(f); $$('.e-pot', f).forEach((q) => (q.style.display = v.mode === 'potencia' ? '' : 'none')); $$('.e-man', f).forEach((q) => (q.style.display = v.mode === 'manual' ? '' : 'none')); $$('.e-oth', f).forEach((q) => (q.style.display = v.mode === 'potencia' && v.energyType === 'outro' ? '' : 'none')); m.$('#eqRes').innerHTML = `Custo estimado: <b>${U.eur(Calc.equipmentHourly(v, st))}/hora</b>`; };
  f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
  m.$('#eqSave').onclick = async () => {
    const v = readForm(f); const bad = [];
    if (!v.name.trim()) bad.push('name');
    if (v.mode === 'potencia') { if (!(v.powerKw > 0)) bad.push('powerKw'); if (!(v.usageFactor > 0 && v.usageFactor <= 100)) bad.push('usageFactor'); if (v.energyType === 'outro' && !(v.energyPrice >= 0 && v.energyPrice !== null)) bad.push('energyPrice'); }
    else if (!(v.costPerHour >= 0 && v.costPerHour !== null)) bad.push('costPerHour');
    markInvalid(f, bad); if (bad.length) return toast('Corrija os campos assinalados', 'err');
    await Repo.save('equipment', { ...x, ...v, name: v.name.trim() }); m.close(); toast('Guardado — fichas recalculadas', 'ok'); after();
  };
}

/* ------------------------------ 9. SIMULADOR ------------------------------ */
const Sim = { scope: '', adj: [], elec: 0, gas: 0, labor: 0, priceDelta: 0, targetFC: '', qty: [] };
Views.simulador = (el) => {
  const st = getSettings();
  const recs = Repo.all('recipes').filter((r) => r.sellable !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const ings = Repo.all('ingredients').sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const cats = [...new Set(ings.map((i) => i.category).filter(Boolean))].sort();
  const scopeRec = Sim.scope ? Repo.get('recipes', Sim.scope) : null;
  if (Sim.scope && !scopeRec) Sim.scope = '';
  el.innerHTML = `<div class="card"><div class="card-h"><h3>Cenário</h3><button class="btn" id="simReset">Repor</button></div>
    <div class="fields">
      <div class="field"><label>Âmbito</label><select id="sScope">${options(recs.map((r) => [r.id, r.name]), Sim.scope, { empty: 'Todos os produtos de venda' })}</select></div>
      <div class="field"><label>Eletricidade (variação %)</label><input class="num" data-s="elec" value="${h(U.inNum(Sim.elec))}"></div>
      <div class="field"><label>Gás (variação %)</label><input class="num" data-s="gas" value="${h(U.inNum(Sim.gas))}"></div>
      <div class="field"><label>Custo da mão de obra (variação %)</label><input class="num" data-s="labor" value="${h(U.inNum(Sim.labor))}"></div>
      <div class="field"><label>Preço de venda (+/− € por dose)</label><input class="num" data-s="priceDelta" value="${h(U.inNum(Sim.priceDelta))}"></div>
      <div class="field"><label>Novo Food Cost pretendido (%)</label><input class="num" data-s="targetFC" value="${Sim.targetFC === '' || Sim.targetFC === null ? '' : h(vNum(Sim.targetFC))}" placeholder="atual: ${U.num(st.targetFC, 0)}"></div>
    </div>
    <div class="sep"></div><h4>Variação de preços dos ingredientes</h4>
    <div id="adjList">${Sim.adj.map((a, i) => `<div class="toolbar" data-adj="${i}"><select data-af="kind">${options([['all', 'Todos os ingredientes'], ['cat', 'Categoria'], ['ing', 'Ingrediente']], a.kind)}</select>
      ${a.kind === 'cat' ? `<select data-af="ref">${options(cats, a.ref)}</select>` : a.kind === 'ing' ? `<select data-af="ref">${options(ings.map((x) => [x.id, x.name]), a.ref)}</select>` : ''}
      <input class="num" data-af="pct" value="${h(U.inNum(a.pct))}" style="width:80px"> % <button class="btn sm danger" data-adel>✕</button></div>`).join('')}</div>
    <button class="btn sm" id="adjAdd">+ Adicionar variação</button> <span class="small muted">ex.: Carnes +15 %</span>
    ${scopeRec ? `<div class="sep"></div><h4>${tr('Alterar quantidades em')} "${h(scopeRec.name)}"</h4><div class="table-wrap"><table><thead><tr><th>Ingrediente</th><th class="r">Qtd. atual</th><th class="r">Variação %</th></tr></thead><tbody>${scopeRec.lines.map((l) => { const nm = l.kind === 'rec' ? (Repo.get('recipes', l.refId) || {}).name : (Repo.get('ingredients', l.refId) || {}).name; const q = Sim.qty.find((x) => x.lineId === l.id); return `<tr><td>${h(nm || '?')}</td><td class="r">${U.numMax(Number(l.qty))} ${h(l.unit)}</td><td class="r"><input class="num" data-ql="${l.id}" value="${h(U.inNum(q ? q.pct : 0))}" style="width:80px"></td></tr>`; }).join('')}</tbody></table></div>` : ''}
    </div><div class="card"><div class="card-h"><h3>Impacto</h3></div><div id="simRes"></div></div>`;
  const ctx = () => {
    const adj = Sim.adj.filter((a) => U.ok(a.pct) && a.pct !== 0);
    const qty = new Map(Sim.qty.filter((q) => q.pct).map((q) => [q.lineId, 1 + q.pct / 100]));
    return {
      ingMult: (ing) => adj.reduce((m, a) => m * (a.kind === 'all' || (a.kind === 'cat' && ing.category === a.ref) || (a.kind === 'ing' && ing.id === a.ref) ? 1 + a.pct / 100 : 1), 1),
      energyMult: (t) => (t === 'eletricidade' ? 1 + (Sim.elec || 0) / 100 : t === 'gas' ? 1 + (Sim.gas || 0) / 100 : 1),
      opMult: 1, laborMult: 1 + (Sim.labor || 0) / 100,
      lineQtyMult: (rid, lid) => (Sim.scope && rid === Sim.scope && qty.has(lid) ? qty.get(lid) : 1),
      priceDelta: Sim.priceDelta || 0, targetFC: Number(Sim.targetFC) > 0 ? Number(Sim.targetFC) : null,
    };
  };
  const draw = () => {
    const base = computeAll().filter((x) => x.r.sellable !== false && (!Sim.scope || x.r.id === Sim.scope));
    const simMap = new Map(computeAll(ctx()).map((x) => [x.r.id, x]));
    const rows = base.map((b) => ({ b, s: simMap.get(b.r.id) }));
    const tot = (f) => U.sum(rows, f);
    const priced = rows.filter((x) => x.b.p.current);
    $('#simRes', el).innerHTML = rows.length ? `<div class="kpis">
      <div class="kpi"><div class="l">Custo médio/dose</div><div class="v">${U.eur(tot((x) => x.s.c.perDose.total) / rows.length)}</div><div class="s ${diffCls(tot((x) => x.s.c.perDose.total - x.b.c.perDose.total))}">${signEur(tot((x) => x.s.c.perDose.total - x.b.c.perDose.total) / rows.length)} por dose</div></div>
      <div class="kpi"><div class="l">Food Cost médio (preço atual)</div><div class="v">${U.pct(U.avg(priced.map((x) => x.s.p.current.foodCostPct)))}</div><div class="s">antes: ${U.pct(U.avg(priced.map((x) => x.b.p.current.foodCostPct)))}</div></div>
      <div class="kpi"><div class="l">Lucro estimado médio/dose</div><div class="v">${U.eur(U.avg(priced.map((x) => x.s.p.current.profit)))}</div><div class="s">antes: ${U.eur(U.avg(priced.map((x) => x.b.p.current.profit)))}</div></div>
      <div class="kpi ${priced.filter((x) => x.s.p.current.profit < 0).length ? 'red' : 'green'}"><div class="l">Produtos com prejuízo</div><div class="v">${priced.filter((x) => x.s.p.current.profit < 0).length}</div><div class="s">antes: ${priced.filter((x) => x.b.p.current.profit < 0).length}</div></div></div>
      <div class="table-wrap"><table><thead><tr><th>Produto</th><th class="r">Custo/dose atual</th><th class="r">Simulado</th><th class="r">Δ</th><th class="r">PV recomendado atual</th><th class="r">Simulado</th><th class="r">PV praticado</th><th class="r">FC atual</th><th class="r">FC simulado</th><th class="r">Lucro/dose atual</th><th class="r">Simulado</th></tr></thead><tbody>
      ${rows.map(({ b, s }) => { const d = s.c.perDose.total - b.c.perDose.total; return `<tr><td><a href="#/ficha/${b.r.id}">${h(b.r.name)}</a></td><td class="r">${U.eur(b.c.perDose.total)}</td><td class="r b">${U.eur(s.c.perDose.total)}</td><td class="r ${diffCls(d)}">${signPct(b.c.perDose.total ? (d / b.c.perDose.total) * 100 : NaN)}</td><td class="r">${U.eur(b.p.recommended.gross)}</td><td class="r b">${U.eur(s.p.recommended.gross)}</td><td class="r">${s.p.current ? U.eur(s.p.current.gross) : '—'}</td><td class="r">${b.p.current ? U.pct(b.p.current.foodCostPct) : '—'}</td><td class="r b ${s.p.current ? pctClass(s.p.current.foodCostPct, s.p.target) : ''}">${s.p.current ? U.pct(s.p.current.foodCostPct) : '—'}</td><td class="r">${b.p.current ? U.eur(b.p.current.profit) : '—'}</td><td class="r b ${s.p.current && s.p.current.profit < 0 ? 'red' : ''}">${s.p.current ? U.eur(s.p.current.profit) : '—'}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="help">A simulação não altera os dados gravados. O "PV praticado" inclui a variação de preço de venda indicada.</div>` : '<div class="empty">Sem produtos de venda para simular.</div>';
  };
  $('#sScope', el).onchange = (e) => { Sim.scope = e.target.value; Sim.qty = []; Views.simulador(el); };
  $$('[data-s]', el).forEach((i) => i.addEventListener('input', () => { const v = i.value.trim() === '' ? (i.dataset.s === 'targetFC' ? '' : 0) : U.parseNum(i.value); i.classList.toggle('bad', v !== '' && !U.ok(v)); if (v !== '' && !U.ok(v)) return; Sim[i.dataset.s] = v; draw(); }));
  $$('[data-adj]', el).forEach((row) => { const i = +row.dataset.adj; $$('[data-af]', row).forEach((inp) => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { const f = inp.dataset.af; if (f === 'pct') { const v = U.parseNum(inp.value); if (!U.ok(v)) return; Sim.adj[i].pct = v; draw(); } else { Sim.adj[i][f] = inp.value; if (f === 'kind') { Sim.adj[i].ref = inp.value === 'cat' ? cats[0] : inp.value === 'ing' ? (ings[0] || {}).id : null; Views.simulador(el); } else draw(); } })); $('[data-adel]', row).onclick = () => { Sim.adj.splice(i, 1); Views.simulador(el); }; });
  $('#adjAdd', el).onclick = () => { Sim.adj.push({ kind: 'all', ref: null, pct: 10 }); Views.simulador(el); };
  $$('[data-ql]', el).forEach((i) => i.addEventListener('input', () => { const v = U.parseNum(i.value); const id = i.dataset.ql; Sim.qty = Sim.qty.filter((q) => q.lineId !== id); if (U.ok(v) && v > -100) Sim.qty.push({ lineId: id, pct: v }); draw(); }));
  $('#simReset', el).onclick = () => { Object.assign(Sim, { scope: '', adj: [], elec: 0, gas: 0, labor: 0, priceDelta: 0, targetFC: '', qty: [] }); Views.simulador(el); };
  draw();
};

/* ------------------------------ 11. CONFIGURAÇÕES ------------------------------ */
Views.configuracoes = (el) => {
  const st = getSettings();
  el.innerHTML = `<div class="card"><div class="card-h"><h3>Língua e país</h3></div><div class="fields">
      <div class="field"><label>Língua da aplicação (neste dispositivo)</label><select id="cfgLang" data-notr>${options(Object.entries(I18N.LANGS), I18N.lang)}</select></div>
      <div class="field"><label>País do estabelecimento</label><select id="cfgCountry" data-notr>${options(Object.entries(COUNTRIES).map(([k, c]) => [k, c.name]), st.country)}</select><span class="hint">Define moeda, formato dos números, taxas de imposto predefinidas e a lei de alergénios citada.</span></div>
      <div class="field"><label>Moeda</label><input disabled value="${h(countryInfo().currency)}"></div></div></div>
    <div class="grid g2" style="align-items:start"><div class="card" id="acct"></div><div class="card" id="plan"></div></div><div class="grid g2">
    <div class="card"><div class="card-h"><h3>Negócio e preços</h3></div><form id="cfg"><div class="fields">
      <div class="field" style="grid-column:1/-1"><label>Nome do estabelecimento (aparece nos relatórios)</label><input name="businessName" value="${h(st.businessName)}"></div>
      <div class="field"><label>Food Cost pretendido padrão (%)</label>${numInput('targetFC', st.targetFC)}</div>
      <div class="field"><label>Diferença entre sugestões (pontos %)</label>${numInput('tierDelta', st.tierDelta)}<span class="hint">Económico = alvo + x; Premium = alvo − x</span></div>
      <div class="field" style="grid-column:1/-1"><label>Base de cálculo do preço sugerido</label><select name="fcBase">${options([['materias', 'Custo das matérias-primas ÷ Food Cost (definição clássica)'], ['total', 'Custo total de produção ÷ percentagem pretendida']], st.fcBase)}</select>
        <span class="hint">Com "custo total", a mão de obra e os indiretos entram no numerador e a percentagem deixa de ser um Food Cost em sentido estrito (fica mais próxima do "prime cost"). Os preços sugeridos sobem bastante.</span></div>
      <div class="field"><label>IVA de venda padrão (%)</label>${numInput('defaultSaleVat', st.defaultSaleVat)}</div>
      <div class="field"><label>Preço desatualizado após (dias)</label>${numInput('staleDays', st.staleDays)}</div>
      <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="vatDeductible" ${st.vatDeductible ? 'checked' : ''}> IVA das compras é dedutível</label><span class="hint">Se sim, o custo usa o preço sem IVA</span></div>
      <div class="field"><label>&nbsp;</label><label class="check"><input type="checkbox" name="roundingEnabled" ${st.roundingEnabled ? 'checked' : ''}> Arredondamento comercial</label></div>
      <div class="field" style="grid-column:span 2"><label>Terminações de preço (separadas por ;)</label><input name="roundingEndings" value="${h(st.roundingEndings)}"><span class="hint">ex.: 0,50; 0,90 → 9,90 · 10,50 · 12,90 · 14,90</span></div>
    </div><button type="button" class="btn primary" id="cfgSave" style="margin-top:12px">Guardar configurações</button></form></div>
    <div class="card"><div class="card-h"><h3>Categorias de venda e taxas de IVA</h3><button class="btn sm" id="vcAdd">+ Categoria</button></div>
      <div class="table-wrap"><table><thead><tr><th>Categoria</th><th class="r">IVA (%)</th><th></th></tr></thead><tbody>${st.saleCategories.map((c, i) => `<tr data-vc="${i}"><td><input data-vf="name" value="${h(c.name)}" style="width:100%"></td><td class="r"><input class="num" data-vf="vat" value="${h(U.inNum(c.vat))}" style="width:70px"></td><td><button class="btn sm danger" data-vdel>✕</button></td></tr>`).join('')}</tbody></table></div>
      <div class="help">Valores de exemplo. Confirme as taxas aplicáveis a cada produto com o seu contabilista (por exemplo, bebidas alcoólicas e refrigerantes têm normalmente taxa normal na restauração).</div>
      <div class="field" style="margin-top:10px"><label>Categorias de ingredientes (uma por linha)</label><textarea id="icats">${h(st.ingredientCategories.join('\n'))}</textarea></div>
      <button class="btn primary" id="catSave" style="margin-top:8px">Guardar categorias</button></div></div>
    <div class="grid g2">
    <div class="card"><div class="card-h"><h3>Cópias de segurança</h3></div>
      <p>${Sync.mode() === 'cloud' ? 'Os dados estão na nuvem. Uma cópia exportada continua a ser útil como arquivo independente.' : `Os dados ficam guardados neste navegador (${h(Repo.kind)}). Limpar os dados do navegador apaga-os: exporte cópias regularmente.`}${st.lastBackup ? ` Última exportação: ${U.fmtDateTime(st.lastBackup)}.` : ''}</p>
      <div class="toolbar"><button class="btn primary" id="bkExp">⤓ Exportar cópia (.json)</button><label class="btn">⤒ Importar cópia<input type="file" id="bkImp" accept=".json,application/json" hidden></label>
      <select id="bkMode"><option value="replace">Substituir todos os dados</option><option value="merge">Juntar aos dados atuais</option></select></div></div>
    <div class="card"><div class="card-h"><h3>Dados de demonstração</h3></div>
      <p>${Demo.has() ? 'Existem dados de demonstração carregados (assinalados com DEMO).' : 'Não há dados de demonstração.'}</p>
      <div class="toolbar"><button class="btn green" id="demoLoad">Carregar demonstração</button><button class="btn danger" id="demoDel" ${Demo.has() ? '' : 'disabled'}>Eliminar dados de demonstração</button></div>
      <div class="sep"></div><h4>Zona de perigo</h4><button class="btn danger" id="wipe">Apagar todos os dados</button></div></div>`;
  renderAccountCard($('#acct', el));
  $('#cfgLang', el).onchange = (e) => { I18N.setLang(e.target.value); location.reload(); };
  $('#cfgCountry', el).onchange = async (e) => {
    const to = e.target.value, from = st.country;
    const c = COUNTRIES[to];
    if (!(await confirmDlg(`<span data-notr>${h(tr('Mudar o país para'))} <b>${h(tr(c.name))}</b>${h(tr('? As categorias de venda e as taxas de imposto passam a ser as predefinidas desse país (moeda: EUR). As fichas mantêm a categoria correspondente. Confirme as taxas com o seu contabilista.').replace('EUR', c.currency))}</span>`, { ok: 'Mudar país' }))) { e.target.value = from; return; }
    const oldCats = st.saleCategories, newCats = c.cats.map(([name, vat]) => ({ name, vat }));
    for (const r of Repo.all('recipes')) {
      const i = oldCats.findIndex((x) => x.name === r.category);
      if (i >= 0 && newCats[i] && newCats[i].name !== r.category) await Repo.save('recipes', { ...r, category: newCats[i].name });
    }
    await saveSettings({ country: to, saleCategories: newCats, defaultSaleVat: c.defaultSaleVat, roundingEndings: c.rounding });
    applyCountry(); toast('País alterado', 'ok'); route(true);
  };
  renderPlanCard($('#plan', el));
  $('#cfgSave', el).onclick = async () => {
    const v = readForm($('#cfg', el)); const bad = [];
    if (!(v.targetFC > 0 && v.targetFC < 100)) bad.push('targetFC');
    if (!(v.tierDelta >= 0 && v.tierDelta < 50)) bad.push('tierDelta');
    if (!(v.defaultSaleVat >= 0 && v.defaultSaleVat <= 100)) bad.push('defaultSaleVat');
    if (!(v.staleDays > 0)) bad.push('staleDays');
    if (v.roundingEnabled && !Calc.parseEndings(v.roundingEndings).length) bad.push('roundingEndings');
    markInvalid($('#cfg', el), bad); if (bad.length) return toast('Corrija os campos assinalados', 'err');
    await saveSettings(v); toast('Configurações guardadas — preços recalculados', 'ok');
  };
  $('#vcAdd', el).onclick = async () => { await saveSettings({ saleCategories: [...st.saleCategories, { name: 'Nova categoria', vat: st.defaultSaleVat }] }); Views.configuracoes(el); };
  $$('tr[data-vc]', el).forEach((tr) => {
    const i = +tr.dataset.vc;
    $$('[data-vf]', tr).forEach((inp) => (inp.onchange = async () => {
      const cs = U.clone(st.saleCategories); const old = cs[i].name;
      if (inp.dataset.vf === 'vat') { const v = U.parseNum(inp.value); if (!(v >= 0 && v <= 100)) { inp.classList.add('bad'); return; } cs[i].vat = v; }
      else { const nv = inp.value.trim(); if (!nv) return; cs[i].name = nv; const affected = Repo.all('recipes').filter((r) => r.category === old); for (const r of affected) await Repo.save('recipes', { ...r, category: nv }); }
      await saveSettings({ saleCategories: cs }); toast('Guardado', 'ok'); Views.configuracoes(el);
    }));
    $('[data-vdel]', tr).onclick = async () => { const n = st.saleCategories[i].name; const used = Repo.all('recipes').filter((r) => r.category === n).length; if (used && !(await confirmDlg(`${used} ficha(s) usam "${h(n)}". Passarão a usar o IVA padrão. Continuar?`))) return; const cs = st.saleCategories.filter((_, j) => j !== i); await saveSettings({ saleCategories: cs }); Views.configuracoes(el); };
  });
  $('#catSave', el).onclick = async () => { const list = [...new Set($('#icats', el).value.split('\n').map((x) => x.trim()).filter(Boolean))]; await saveSettings({ ingredientCategories: list }); toast('Categorias guardadas', 'ok'); };
  $('#bkExp', el).onclick = () => { backupDownload(); Views.configuracoes(el); };
  $('#bkImp', el).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const obj = JSON.parse(await f.text()); Repo.validateBackup(obj);
      const n = Object.values(obj.data).reduce((a, x) => a + x.length, 0);
      const mode = $('#bkMode', el).value;
      if (!(await confirmDlg(`Importar ${n} registos de ${U.fmtDateTime(obj.exportedAt)}? ${mode === 'replace' ? '<b>Todos os dados atuais serão substituídos.</b>' : 'Registos com o mesmo identificador serão substituídos.'}`, { ok: 'Importar', danger: mode === 'replace' }))) return;
      await Repo.importAll(obj, mode); toast('Cópia importada', 'ok'); route();
    } catch (err) { toast('Erro: ' + err.message, 'err'); }
  };
  $('#demoLoad', el).onclick = async () => { await Demo.load(); toast('Dados de demonstração carregados', 'ok'); Views.configuracoes(el); };
  $('#demoDel', el).onclick = async () => {
    if (!(await confirmDlg('Eliminar todos os dados de demonstração? Os seus dados reais não são afetados.', { ok: 'Eliminar', danger: true }))) return;
    const r = await Demo.remove();
    toast(r.kept ? `Demonstração eliminada. ${r.kept} registo(s) mantidos por estarem a ser usados em fichas reais: ${r.keptNames.join(', ')}` : 'Dados de demonstração eliminados', 'ok');
    Views.configuracoes(el);
  };
  $('#wipe', el).onclick = async () => {
    if (!(await confirmDlg('Apagar <b>todos</b> os dados (ingredientes, fichas, histórico, configurações)? Esta ação não pode ser desfeita. Exporte primeiro uma cópia de segurança.', { ok: 'Apagar tudo', danger: true }))) return;
    if (!(await confirmDlg('Tem a certeza absoluta?', { ok: 'Sim, apagar tudo', danger: true }))) return;
    await Repo.clearAll(); toast('Todos os dados foram apagados'); route();
  };
};
