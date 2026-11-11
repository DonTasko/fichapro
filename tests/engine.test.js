const assert = require('assert');
const E = require('../src/10_engine.js');
const { U, Calc, convertUnits, parseUnit, parseAllergens } = E;
let n = 0; const t = (name, fn) => { fn(); n++; console.log('ok -', name); };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

t('parseNum pt/en', () => {
  near(U.parseNum('1.234,56'), 1234.56); near(U.parseNum('1234.56'), 1234.56); near(U.parseNum('12,5'), 12.5);
  near(U.parseNum('16,90 €'), 16.9); near(U.parseNum('1,234.5'), 1234.5); near(U.parseNum('1.234.567'), 1234567);
  near(U.parseNum('23%'), 23); assert.ok(isNaN(U.parseNum('abc'))); assert.ok(isNaN(U.parseNum('')));
});
t('inNum round trip', () => { near(U.parseNum(U.inNum(1234.5)), 1234.5); near(U.parseNum(U.inNum(0.0125)), 0.0125); });
t('parseDate', () => {
  assert.equal(U.parseDate('05/03/2026'), '2026-03-05'); assert.equal(U.parseDate('2026-03-05'), '2026-03-05');
  assert.equal(U.parseDate(46000), '2025-12-09'); assert.equal(U.parseDate('31/02/2026'), null);
});
t('conversões kg/g/L/ml', () => {
  near(convertUnits(1500, 'g', 'kg'), 1.5); near(convertUnits(0.25, 'l', 'ml'), 250); near(convertUnits(2, 'dz', 'un'), 24);
  near(convertUnits(500, 'ml', 'kg', { density: 1.03 }), 0.515); assert.ok(isNaN(convertUnits(1, 'l', 'kg')));
  near(convertUnits(3, 'un', 'g', { unitWeight: 0.06 }), 180);
});
t('parseUnit/allergens', () => {
  assert.equal(parseUnit('Kgs'), 'kg'); assert.equal(parseUnit('Litro'), 'l'); assert.equal(parseUnit('Cx'), 'emb'); assert.equal(parseUnit('xyz'), null);
  assert.deepEqual(parseAllergens('Glúten, leite; ovos'), [1, 3, 7]); assert.deepEqual(parseAllergens('4;14'), [4, 14]);
});
t('arredondamento comercial', () => {
  const e = Calc.parseEndings('0,50; 0,90');
  near(Calc.roundCommercial(9.42, e), 9.5); near(Calc.roundCommercial(9.51, e), 9.9); near(Calc.roundCommercial(9.95, e), 10.5);
  near(Calc.roundCommercial(14.9, e), 14.9); near(Calc.roundCommercial(15.06, e), 15.5);
});

const settings = { vatDeductible: true, targetFC: 30, tierDelta: 5, fcBase: 'total', roundingEnabled: false, roundingEndings: '0,50;0,90', defaultSaleVat: 13, saleCategories: [{ name: 'Bebidas', vat: 23 }], teamAvgMode: 'manual', teamAvgManual: 9, electricityPrice: 0.2, gasPrice: 0.1, indirect: { method: 'none' } };
const mk = (o) => ({ ingredients: new Map(), recipes: new Map(), staff: new Map(), equipment: new Map(), opcosts: [], settings: { ...settings }, ...o });

t('custo unitário com IVA e embalagem', () => {
  const a = { id: 'a', purchaseUnit: 'kg', purchaseQty: 5, price: 50, vat: 6, priceIncludesVat: false };
  near(Calc.ingredientUnitCost(a, settings).cost, 10);
  const b = { id: 'b', purchaseUnit: 'kg', purchaseQty: 1, price: 10.6, vat: 6, priceIncludesVat: true };
  near(Calc.ingredientUnitCost(b, settings).cost, 10);
  near(Calc.ingredientUnitCost(b, { ...settings, vatDeductible: false }).cost, 10.6);
  const c = { id: 'c', purchaseUnit: 'emb', purchaseQty: 2, packQty: 200, packUnit: 'ml', price: 1.6, vat: 0 };
  near(Calc.ingredientUnitCost(c, settings).cost, 4); // 1,60 / 0,4 L
});

t('desperdício: custo efetivo = custo / (1 − d)', () => {
  const d = mk();
  d.ingredients.set('i', { id: 'i', name: 'Batata', purchaseUnit: 'kg', purchaseQty: 1, price: 1, vat: 0, wastePct: 20 });
  const r = { id: 'r', name: 'R', portions: 2, lines: [{ id: 'l1', kind: 'ing', refId: 'i', qty: 800, unit: 'g' }] };
  d.recipes.set('r', r);
  const c = Calc.evaluator(d).cost(r);
  near(c.lines[0].cost, 0.8); near(c.lines[0].effCost, 1); near(c.lines[0].grossQty, 1000); near(c.perDose.materials, 0.5);
});

t('mão de obra: exemplo do caderno (2 × 9 € × 30 min = 9 €)', () => {
  const d = mk(); d.staff.set('s', { id: 's', name: 'A', hourlyCost: 9 });
  const r = { id: 'r', portions: 1, prepMin: 30, lines: [], labor: { mode: 'simultaneo', lines: [{ staffId: 's', count: 2 }] } };
  near(Calc.evaluator(d).cost(r).labor, 9);
  const r2 = { ...r, id: 'r2', labor: { mode: 'individual', lines: [{ staffId: 's', count: 2 }] } };
  near(Calc.evaluator(d).cost(r2).labor, 4.5); // 30 min-homem no total
  const r3 = { ...r, id: 'r3', cookMin: 60, laborIncludeCook: false };
  near(Calc.evaluator(d).cost(r3).labor, 9);
});
t('custo horário a partir do salário (14 meses + encargos)', () => {
  near(Calc.staffHourly({ mode: 'salario', monthlySalary: 1000, chargesPct: 23.75, hoursMonth: 173.33, salariesYear: 14 }), (1000 * 14 / 12) * 1.2375 / 173.33);
});

t('preço de venda: 4,00 € / 30 % = 13,33 € (base custo total)', () => {
  const d = mk(); d.ingredients.set('i', { id: 'i', name: 'X', purchaseUnit: 'kg', purchaseQty: 1, price: 4, vat: 0 });
  const r = { id: 'r', portions: 1, category: 'Pratos', lines: [{ id: 'l', kind: 'ing', refId: 'i', qty: 1, unit: 'kg' }] };
  const c = Calc.evaluator(d).cost(r); const p = Calc.pricing(r, c, d.settings);
  near(U.round(p.recommended.net, 2), 13.33); near(p.recommended.gross, 13.3333333 * 1.13, 1e-4); assert.equal(p.vat, 13);
  near(p.tiers[0].targetPct, 35); near(p.tiers[2].targetPct, 25);
  const pb = Calc.pricing({ ...r, category: 'Bebidas' }, c, d.settings); assert.equal(pb.vat, 23);
  const pr = Calc.pricing(r, c, { ...d.settings, roundingEnabled: true }); near(pr.recommended.gross, 15.5); near(pr.recommended.net, 15.5 / 1.13);
});

t('sub-receita incorpora custos por componente, sem duplicar indiretos', () => {
  const d = mk(); d.settings.indirect = { method: 'percent', percent: 10 };
  d.staff.set('s', { id: 's', hourlyCost: 12 });
  d.ingredients.set('cog', { id: 'cog', name: 'Cogumelos', purchaseUnit: 'kg', purchaseQty: 1, price: 6, vat: 0, allergens: [] });
  d.ingredients.set('nat', { id: 'nat', name: 'Natas', purchaseUnit: 'l', purchaseQty: 1, price: 4, vat: 0, allergens: [7] });
  const molho = { id: 'm', name: 'Molho', portions: 10, finalQty: 1, finalUnit: 'l', prepMin: 30, labor: { mode: 'simultaneo', lines: [{ staffId: 's', count: 1 }] },
    lines: [{ id: 'a', kind: 'ing', refId: 'cog', qty: 0.5, unit: 'kg' }, { id: 'b', kind: 'ing', refId: 'nat', qty: 0.5, unit: 'l' }] };
  d.recipes.set('m', molho);
  const prato = { id: 'p', name: 'Prato', portions: 1, lines: [{ id: 'x', kind: 'rec', refId: 'm', qty: 100, unit: 'ml' }] };
  d.recipes.set('p', prato);
  const ev = Calc.evaluator(d);
  const cm = ev.cost(molho); near(cm.materials, 5); near(cm.labor, 6); near(cm.indirect, 1.1); near(cm.perBaseUnit, 12.1);
  const cp = ev.cost(prato); near(cp.materials, 0.5); near(cp.labor, 0.6); near(cp.indirect, 0.11); near(cp.total, 1.21);
  assert.deepEqual(cp.allergens.present, [7]); assert.deepEqual(cp.allergens.sources[7], ['Molho']);
  const cd = Calc.evaluator(d).cost({ ...prato, id: 'p2', lines: [{ id: 'x', kind: 'rec', refId: 'm', qty: 1, unit: 'dose' }] }); near(cd.materials, 0.5);
  assert.ok(Calc.wouldCycle(d, 'm', 'p')); assert.ok(!Calc.wouldCycle(d, 'p', 'm'));
  assert.deepEqual(Calc.usages(d, 'ing', 'nat').all.sort(), ['m', 'p']);
});

t('alergénios: correções manuais e contaminação cruzada', () => {
  const d = mk();
  d.ingredients.set('f', { id: 'f', name: 'Farinha', purchaseUnit: 'kg', purchaseQty: 1, price: 1, vat: 0, allergens: [1], traces: [6] });
  const r = { id: 'r', portions: 1, lines: [{ id: 'l', kind: 'ing', refId: 'f', qty: 1, unit: 'kg' }], allergenOverrides: { add: [3], remove: [1], traces: [8, 3] } };
  const a = Calc.evaluator(d).cost(r).allergens;
  assert.deepEqual(a.present, [3]); assert.deepEqual(a.traces, [6, 8]); assert.deepEqual(a.removedAuto, [1]);
});

t('energia, indiretos por dose e anti-duplicação', () => {
  const d = mk(); d.equipment.set('f', { id: 'f', name: 'Forno', energyType: 'eletricidade', mode: 'potencia', powerKw: 5, usageFactor: 50 });
  near(Calc.equipmentHourly(d.equipment.get('f'), d.settings), 0.5);
  const r = { id: 'r', portions: 4, lines: [], equipment: [{ equipId: 'f', minutes: 60 }], extras: [{ name: 'Caixa', type: 'embalagem', per: 'dose', value: 0.3 }] };
  let c = Calc.evaluator(d).cost(r); near(c.energy, 0.5); near(c.extras, 1.2);
  d.settings.indirect = { method: 'perDose', dosesPerMonth: 1000, includesEnergy: true, includesPackaging: true }; d.opcosts = [{ monthly: 500, include: true }, { monthly: 999, include: false }];
  c = Calc.evaluator(d).cost(r); near(c.energy, 0); near(c.extras, 0); near(c.indirect, 2); near(c.perDose.operational, 0.5);
});

t('simulação: +15 % no ingrediente e +1 € no preço', () => {
  const d = mk(); d.ingredients.set('i', { id: 'i', name: 'Carne', category: 'Carnes', purchaseUnit: 'kg', purchaseQty: 1, price: 10, vat: 0 });
  const r = { id: 'r', portions: 1, salePrice: 11.3, lines: [{ id: 'l', kind: 'ing', refId: 'i', qty: 0.3, unit: 'kg' }] };
  const ctx = { ingMult: (ing) => (ing.category === 'Carnes' ? 1.15 : 1), priceDelta: 1 };
  const c = Calc.evaluator(d, ctx).cost(r); near(c.materials, 3.45);
  const p = Calc.pricing(r, c, d.settings, ctx); near(p.current.gross, 12.3); near(p.current.net, 12.3 / 1.13);
  near(p.current.profit, 12.3 / 1.13 - 3.45);
});

t('erros: unidade incompatível e doses 0', () => {
  const d = mk(); d.ingredients.set('i', { id: 'i', name: 'Leite', purchaseUnit: 'l', purchaseQty: 1, price: 1, vat: 0 });
  const c = Calc.evaluator(d).cost({ id: 'r', portions: 0, lines: [{ id: 'l', kind: 'ing', refId: 'i', qty: 1, unit: 'kg' }] });
  assert.ok(c.errors.length >= 2);
});
console.log(`\n${n} testes do motor passaram.`);
