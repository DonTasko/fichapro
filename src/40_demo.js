/* =====================================================================
   MÓDULO 4 — DADOS DE DEMONSTRAÇÃO (preços fictícios)
   Todos os registos têm demo:true e id começado por "demo-".
   ===================================================================== */
const Demo = (() => {
  const I = (code, name, category, supplier, purchaseUnit, purchaseQty, price, vat, wastePct, allergens = [], extra = {}) => ({
    id: 'demo-i-' + code, code: 'D' + code, name: tr(name), category: tr(category), supplier: tr(supplier), purchaseUnit, purchaseQty, price, vat, priceIncludesVat: false, wastePct, allergens, traces: [], demo: true, priceUpdatedAt: U.todayISO(), ...extra,
  });
  const ingredients = () => [
    I('001', 'Picanha de novilho', 'Carnes', 'Talho Demo', 'kg', 1, 16.9, 6, 8),
    I('002', 'Bacalhau graúdo demolhado', 'Peixes e mariscos', 'Peixaria Demo', 'kg', 1, 13.5, 6, 12, [4]),
    I('003', 'Frango inteiro', 'Carnes', 'Talho Demo', 'kg', 1, 3.2, 6, 30),
    I('004', 'Lombinho de porco', 'Carnes', 'Talho Demo', 'kg', 1, 7.8, 6, 5),
    I('005', 'Arroz carolino', 'Mercearia', 'Distribuidor Demo', 'kg', 1, 1.45, 6, 0),
    I('006', 'Feijão encarnado cozido (frasco 800 g)', 'Mercearia', 'Distribuidor Demo', 'emb', 1, 1.29, 6, 0, [], { packQty: 0.8, packUnit: 'kg' }),
    I('007', 'Batata', 'Legumes e hortícolas', 'Hortofrutícola Demo', 'kg', 25, 21.25, 6, 15),
    I('008', 'Grelos', 'Legumes e hortícolas', 'Hortofrutícola Demo', 'kg', 1, 2.9, 6, 35),
    I('009', 'Cogumelos frescos', 'Legumes e hortícolas', 'Hortofrutícola Demo', 'kg', 1, 4.5, 6, 10),
    I('010', 'Natas culinárias (200 ml)', 'Laticínios e ovos', 'Distribuidor Demo', 'emb', 1, 0.89, 6, 0, [7], { packQty: 200, packUnit: 'ml', density: 1.01 }),
    I('011', 'Manteiga sem sal', 'Laticínios e ovos', 'Distribuidor Demo', 'kg', 1, 8.9, 6, 0, [7]),
    I('012', 'Azeite virgem extra', 'Gorduras e óleos', 'Distribuidor Demo', 'l', 5, 37.5, 6, 0, [], { density: 0.91 }),
    I('013', 'Alho', 'Legumes e hortícolas', 'Hortofrutícola Demo', 'kg', 1, 4.2, 6, 15),
    I('014', 'Cebola', 'Legumes e hortícolas', 'Hortofrutícola Demo', 'kg', 1, 1.1, 6, 10),
    I('015', 'Limão', 'Frutas', 'Hortofrutícola Demo', 'kg', 1, 1.8, 6, 0, [], { unitWeightG: 120 }),
    I('016', 'Mel', 'Mercearia', 'Distribuidor Demo', 'kg', 1, 9.5, 6, 0),
    I('017', 'Mostarda Dijon', 'Mercearia', 'Distribuidor Demo', 'kg', 1, 6.4, 23, 0, [10, 12]),
    I('018', 'Sal grosso', 'Especiarias e ervas', 'Distribuidor Demo', 'kg', 1, 0.6, 23, 0),
    I('019', 'Pimenta preta moída', 'Especiarias e ervas', 'Distribuidor Demo', 'kg', 1, 18, 23, 0),
    I('020', 'Louro (folhas)', 'Especiarias e ervas', 'Distribuidor Demo', 'kg', 1, 12, 23, 0),
    I('021', 'Ovos classe M (dúzia)', 'Laticínios e ovos', 'Distribuidor Demo', 'emb', 1, 2.6, 6, 0, [3], { packQty: 12, packUnit: 'un', unitWeightG: 55 }),
    I('022', 'Chocolate culinário 70 %', 'Pastelaria', 'Distribuidor Demo', 'kg', 1, 11.5, 23, 0, [6], { traces: [7, 8] }),
    I('023', 'Açúcar branco', 'Mercearia', 'Distribuidor Demo', 'kg', 1, 1.05, 23, 0),
    I('024', 'Farinha de trigo T65', 'Mercearia', 'Distribuidor Demo', 'kg', 1, 0.75, 6, 0, [1]),
    I('025', 'Vinho branco de cozinha', 'Bebidas', 'Distribuidor Demo', 'l', 1, 2.2, 23, 0, [12], { density: 0.99 }),
    I('026', 'Salsa fresca', 'Especiarias e ervas', 'Hortofrutícola Demo', 'kg', 1, 6, 6, 30),
    I('027', 'Alecrim fresco', 'Especiarias e ervas', 'Hortofrutícola Demo', 'kg', 1, 15, 6, 20),
    I('028', 'Paprika fumada', 'Especiarias e ervas', 'Distribuidor Demo', 'kg', 1, 14, 23, 0),
  ];

  let ln = 0, rc = 0;
  const L = (code, qty, unit, wastePct = null) => ({ id: 'demo-l' + ++ln, kind: 'ing', refId: 'demo-i-' + code, qty, unit, wastePct });
  const S = (rid, qty, unit) => ({ id: 'demo-l' + ++ln, kind: 'rec', refId: 'demo-r-' + rid, qty, unit, wastePct: null });
  const avg = (n = 1) => ({ mode: 'simultaneo', lines: [{ staffId: 'avg', count: n }] });
  const st = (id, n = 1) => ({ staffId: 'demo-s-' + id, count: n });
  /** Categoria de venda equivalente no país do estabelecimento (mesma posição na lista). */
  const demoCat = (pt) => { const i = COUNTRIES.PT.cats.findIndex((c) => c[0] === pt); const c = countryInfo().cats[i]; return c ? c[0] : pt; };
  const R = (id, o0) => { const o = { ...o0, name: tr(o0.name), category: demoCat(o0.category), notes: tr(o0.notes || ''), temperature: tr(o0.temperature || ''), extras: (o0.extras || []).map((x) => ({ ...x, name: tr(x.name) })) }; return ({
    id: 'demo-r-' + id, demo: true, code: 'FT-D' + String(++rc).padStart(2, '0'), targetFC: null, vatRate: null, salePrice: null, sellable: true, intermediate: false,
    prepMin: 0, cookMin: 0, platingMin: 0, cleanMin: 0, laborIncludeCook: true, extras: [], equipment: [], allergenOverrides: { add: [], remove: [], traces: [], confirmed: false }, version: 0, ...o,
  }); };
  const recipes = () => { ln = 0; rc = 0; return [
    R('molho', { name: 'Molho de cogumelos', category: 'Molhos e bases', type: 'molho', sellable: false, intermediate: true, portions: 10, finalQty: 1, finalUnit: 'l', prepMin: 15, cookMin: 20, labor: { mode: 'simultaneo', lines: [st('coz')] }, laborIncludeCook: false, equipment: [{ equipId: 'demo-e-fogao', minutes: 20 }],
      lines: [L('009', 0.5, 'kg'), L('014', 100, 'g'), L('013', 20, 'g'), L('011', 40, 'g'), L('010', 400, 'ml'), L('025', 100, 'ml'), L('018', 8, 'g'), L('019', 2, 'g')], notes: 'Saltear a cebola e o alho na manteiga, juntar os cogumelos laminados, refrescar com vinho branco, reduzir e ligar com as natas. Retificar temperos.', temperature: '' }),
    R('arroz', { name: 'Arroz de feijão', category: 'Acompanhamentos', type: 'acompanhamento', sellable: false, intermediate: true, portions: 10, finalQty: 2.2, finalUnit: 'kg', prepMin: 10, cookMin: 20, labor: avg(1), laborIncludeCook: false, equipment: [{ equipId: 'demo-e-fogao', minutes: 25 }],
      lines: [L('005', 600, 'g'), L('006', 1, 'emb'), L('014', 150, 'g'), L('013', 20, 'g'), L('012', 60, 'ml'), L('020', 2, 'g'), L('018', 12, 'g')], notes: 'Refogar cebola e alho em azeite com louro, juntar o feijão com o caldo, levar a ferver e adicionar o arroz. Cozinhar 15–18 minutos.' }),
    R('batata', { name: 'Batata rústica', category: 'Acompanhamentos', type: 'acompanhamento', sellable: false, intermediate: true, portions: 10, finalQty: 2, finalUnit: 'kg', prepMin: 15, cookMin: 40, labor: avg(1), laborIncludeCook: false, equipment: [{ equipId: 'demo-e-forno', minutes: 40 }],
      lines: [L('007', 2.5, 'kg'), L('012', 80, 'ml'), L('013', 30, 'g'), L('027', 10, 'g'), L('028', 8, 'g'), L('018', 15, 'g')], notes: 'Cortar a batata em gomos com casca, temperar e assar a 200 °C.', temperature: '200 °C' }),
    R('esparregado', { name: 'Esparregado de grelos', category: 'Acompanhamentos', type: 'acompanhamento', sellable: false, intermediate: true, portions: 10, finalQty: 1.5, finalUnit: 'kg', prepMin: 20, cookMin: 15, labor: avg(1), equipment: [{ equipId: 'demo-e-fogao', minutes: 15 }],
      lines: [L('008', 2, 'kg'), L('013', 30, 'g'), L('012', 80, 'ml'), L('024', 40, 'g'), L('018', 10, 'g')], notes: 'Branquear os grelos, picar finamente, refogar em azeite e alho e ligar com farinha.' }),
    R('picanha', { name: 'Picanha grelhada', category: 'Pratos principais', type: 'prato', portions: 4, salePrice: 16.9, prepMin: 5, cookMin: 12, platingMin: 3, cleanMin: 5, labor: { mode: 'simultaneo', lines: [st('coz')] }, equipment: [{ equipId: 'demo-e-grelhador', minutes: 15 }],
      lines: [L('001', 1, 'kg'), L('018', 20, 'g'), S('arroz', 4, 'dose'), S('batata', 0.8, 'kg')], notes: 'Fatiar a picanha com gordura (250 g crus por dose), temperar com sal grosso e grelhar ao ponto pedido. Servir com arroz de feijão e batata rústica.' }),
    R('bacalhau', { name: 'Bacalhau assado', category: 'Pratos principais', type: 'prato', portions: 4, salePrice: 15.5, prepMin: 15, cookMin: 30, platingMin: 4, labor: { mode: 'simultaneo', lines: [st('coz')] }, laborIncludeCook: false, equipment: [{ equipId: 'demo-e-forno', minutes: 30 }],
      lines: [L('002', 1.2, 'kg'), L('007', 1, 'kg'), L('012', 200, 'ml'), L('013', 40, 'g'), L('014', 200, 'g'), L('026', 10, 'g'), S('esparregado', 4, 'dose')], notes: 'Assar o bacalhau com cebola e alho em azeite. Servir com batata a murro e esparregado.', temperature: '180 °C' }),
    R('frango', { name: 'Frango ao limão', category: 'Pratos principais', type: 'prato', portions: 4, salePrice: 10.9, prepMin: 15, cookMin: 50, platingMin: 3, labor: avg(1), laborIncludeCook: false, equipment: [{ equipId: 'demo-e-forno', minutes: 50 }],
      lines: [L('003', 1.6, 'kg'), L('015', 3, 'un', 50), L('013', 30, 'g'), L('012', 60, 'ml'), L('025', 100, 'ml'), L('018', 15, 'g'), L('019', 2, 'g'), S('batata', 0.8, 'kg')], notes: 'Marinar o frango com sumo de limão, alho e vinho branco durante 2 horas. Assar a 190 °C.', temperature: '190 °C' }),
    R('lombinho', { name: 'Lombinho de porco com mel e mostarda', category: 'Pratos principais', type: 'prato', portions: 4, salePrice: 12.5, prepMin: 10, cookMin: 25, platingMin: 4, labor: { mode: 'simultaneo', lines: [st('coz')] }, laborIncludeCook: false, equipment: [{ equipId: 'demo-e-fogao', minutes: 8 }, { equipId: 'demo-e-forno', minutes: 18 }],
      lines: [L('004', 800, 'g'), L('016', 60, 'g'), L('017', 50, 'g'), L('012', 30, 'ml'), L('013', 10, 'g'), L('018', 8, 'g'), L('019', 1, 'g'), S('batata', 0.8, 'kg'), S('molho', 200, 'ml')], notes: 'Selar o lombinho, pincelar com mel e mostarda e terminar no forno. Servir com batata rústica e molho de cogumelos.', temperature: 'Núcleo 63 °C' }),
    R('mousse', { name: 'Mousse de chocolate', category: 'Sobremesas', type: 'sobremesa', portions: 10, salePrice: 3.5, finalQty: 1, finalUnit: 'kg', prepMin: 25, cookMin: 5, labor: { mode: 'simultaneo', lines: [st('past')] }, equipment: [{ equipId: 'demo-e-fogao', minutes: 5 }],
      extras: [{ name: 'Taça descartável', type: 'embalagem', per: 'dose', value: 0.12 }],
      lines: [L('022', 250, 'g'), L('021', 6, 'un'), L('023', 80, 'g'), L('011', 50, 'g'), L('010', 200, 'ml')], notes: 'Derreter o chocolate com a manteiga em banho-maria, juntar gemas e açúcar, envolver claras em castelo e natas batidas. Refrigerar 4 h.', temperature: 'Conservar a 0–5 °C' }),
  ]; };
  const staff = () => [
    { id: 'demo-s-coz', name: tr('Cozinheiro de 1.ª (demo)'), role: tr('Cozinheiro'), mode: 'salario', monthlySalary: 1150, chargesPct: 23.75, hoursMonth: 173.33, salariesYear: 14, hourlyCost: 0, active: true, demo: true },
    { id: 'demo-s-aj', name: tr('Ajudante de cozinha (demo)'), role: tr('Ajudante'), mode: 'manual', hourlyCost: 9, active: true, demo: true },
    { id: 'demo-s-past', name: tr('Pasteleiro (demo)'), role: tr('Pasteleiro'), mode: 'manual', hourlyCost: 10.5, active: true, demo: true },
  ];
  const equipment = () => [
    { id: 'demo-e-forno', name: tr('Forno convector (demo)'), energyType: 'eletricidade', mode: 'potencia', powerKw: 7, usageFactor: 60, demo: true },
    { id: 'demo-e-fogao', name: tr('Fogão 4 bicos (demo)'), energyType: 'gas', mode: 'potencia', powerKw: 10, usageFactor: 50, demo: true },
    { id: 'demo-e-grelhador', name: tr('Grelhador a gás (demo)'), energyType: 'gas', mode: 'potencia', powerKw: 8, usageFactor: 60, demo: true },
    { id: 'demo-e-frit', name: tr('Fritadeira (demo)'), energyType: 'eletricidade', mode: 'potencia', powerKw: 6, usageFactor: 70, demo: true },
  ];
  const opcosts = () => [
    { id: 'demo-o-agua', type: 'agua', name: tr('Água (demo)'), monthly: 120, include: true, demo: true },
    { id: 'demo-o-limp', type: 'limpeza', name: tr('Produtos de limpeza (demo)'), monthly: 180, include: true, demo: true },
    { id: 'demo-o-cons', type: 'consumiveis', name: tr('Consumíveis — guardanapos, película, papel (demo)'), monthly: 150, include: true, demo: true },
    { id: 'demo-o-elet', type: 'eletricidade', name: tr('Eletricidade não associada a equipamentos — frio, iluminação (demo)'), monthly: 450, include: true, demo: true },
  ];

  async function load() {
    await Repo.saveMany('ingredients', ingredients());
    await Repo.saveMany('staff', staff());
    await Repo.saveMany('equipment', equipment());
    await Repo.saveMany('opcosts', opcosts());
    for (const r of recipes()) if (!Repo.get('recipes', r.id)) await Services.saveRecipe(r, 'Dados de demonstração');
    await saveSettings({ demoLoaded: true });
  }
  /** Elimina dados demo. Mantém (e devolve) os que estão a ser usados por registos reais. */
  async function remove() {
    const data = dataView();
    const real = [...data.recipes.values()].filter((r) => !r.demo);
    const usedIng = new Set(), usedRec = new Set(), usedStaff = new Set(), usedEq = new Set();
    const markRec = (id) => { if (usedRec.has(id)) return; const r = data.recipes.get(id); if (!r || !r.demo) return; usedRec.add(id); scan(r); };
    const scan = (r) => {
      (r.lines || []).forEach((l) => { if (l.kind === 'ing' && String(l.refId).startsWith('demo-')) usedIng.add(l.refId); if (l.kind === 'rec') markRec(l.refId); });
      ((r.labor && r.labor.lines) || []).forEach((l) => String(l.staffId).startsWith('demo-') && usedStaff.add(l.staffId));
      (r.equipment || []).forEach((e) => String(e.equipId).startsWith('demo-') && usedEq.add(e.equipId));
    };
    real.forEach(scan);
    const del = (store, keep) => Repo.all(store).filter((o) => o.demo && !keep.has(o.id)).map((o) => o.id);
    const recDel = del('recipes', usedRec);
    for (const id of recDel) await Services.deleteRecipe(id);
    await Repo.removeMany('ingredients', del('ingredients', usedIng));
    await Repo.removeMany('staff', del('staff', usedStaff));
    await Repo.removeMany('equipment', del('equipment', usedEq));
    await Repo.removeMany('opcosts', del('opcosts', new Set()));
    await Repo.removeMany('priceHistory', Repo.all('priceHistory').filter((h) => h.demo && !usedIng.has(h.ingredientId)).map((h) => h.id));
    await saveSettings({ demoLoaded: false });
    return { kept: usedIng.size + usedRec.size + usedStaff.size + usedEq.size, keptNames: [...usedIng].map((id) => data.ingredients.get(id)?.name).concat([...usedRec].map((id) => data.recipes.get(id)?.name)).filter(Boolean) };
  }
  const has = () => ['ingredients', 'recipes', 'staff', 'equipment', 'opcosts'].some((s) => Repo.all(s).some((o) => o.demo));
  return { load, remove, has };
})();
