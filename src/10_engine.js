/* =====================================================================
   MÓDULO 1 — UTILITÁRIOS E MOTOR DE CÁLCULO
   Lógica pura, sem dependência da interface (DOM). Pode ser reutilizada
   num servidor ou testada isoladamente.
   ===================================================================== */
'use strict';

const U = (() => {
  let LOCALE = 'pt-PT', CUR = 'EUR', DEC = ',';
  let nfCache = {};
  const fmt = (key, opts) => nfCache[key] || (nfCache[key] = new Intl.NumberFormat(LOCALE, opts));
  const nfEur = { format: (n) => fmt('e2', { style: 'currency', currency: CUR, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) };
  const nfEur4 = { format: (n) => fmt('e4', { style: 'currency', currency: CUR, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(n) };
  const nf = (d) => fmt('n' + d, { minimumFractionDigits: d, maximumFractionDigits: d });
  const nfMax = (d) => fmt('m' + d, { minimumFractionDigits: 0, maximumFractionDigits: d });
  /** Formatação de números e moeda segundo o país do estabelecimento. */
  function setLocale(locale, currency) { LOCALE = locale || 'pt-PT'; CUR = currency || 'EUR'; nfCache = {}; DEC = (1.5).toLocaleString(LOCALE).includes(',') ? ',' : '.'; }
  const ok = (n) => typeof n === 'number' && isFinite(n);
  const eur = (n) => ok(n) ? nfEur.format(n) : '—';
  const eur4 = (n) => ok(n) ? nfEur4.format(n) : '—';
  const num = (n, d = 2) => ok(n) ? nf(d).format(n) : '—';
  const numMax = (n, d = 3) => ok(n) ? nfMax(d).format(n) : '';
  const pct = (n, d = 1) => ok(n) ? nf(d).format(n) + ' %' : '—';

  /** Converte texto em número aceitando formato português (1.234,56) e internacional (1234.56). */
  function parseNum(v) {
    if (v === null || v === undefined) return NaN;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    if (!s) return NaN;
    s = s.replace(/[€£%\s\u00a0\u202f]/g, '').replace(/(eur|gbp)$/i, '');
    if (!s) return NaN;
    const hasC = s.includes(','), hasD = s.includes('.');
    if (hasC && hasD) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
      else s = s.replace(/,/g, '');
    } else if (hasC) {
      // em países com ponto decimal (Reino Unido), "1,234" é separador de milhares
      if ((s.match(/,/g) || []).length > 1 || (DEC === '.' && /^\d{1,3}(,\d{3})+$/.test(s))) s = s.replace(/,/g, '');
      else s = s.replace(',', '.');
    } else if (hasD && (s.match(/\./g) || []).length > 1) {
      s = s.replace(/\./g, '');
    }
    if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return NaN;
    return parseFloat(s);
  }
  /** Número para campo de formulário (vírgula decimal, sem separador de milhares). */
  const inNum = (n, d = 4) => (ok(n) ? fmt('i' + d, { minimumFractionDigits: 0, maximumFractionDigits: d, useGrouping: false }).format(n) : '');

  const round = (n, d = 2) => ok(n) ? Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d : n;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const nowISO = () => new Date().toISOString();

  /** Aceita dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd, número de série Excel e objetos Date. Devolve 'aaaa-mm-dd' ou null. */
  function parseDate(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
    if (typeof v === 'number' || /^\d{5}(\.\d+)?$/.test(String(v).trim())) {
      const n = Number(v);
      if (n > 20000 && n < 80000) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000); return d.toISOString().slice(0, 10); }
      return null;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) return valid(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; return valid(y, +m[2], +m[1]); }
    return null;
    function valid(y, mo, d) {
      if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
      const dt = new Date(Date.UTC(y, mo - 1, d));
      if (dt.getUTCMonth() !== mo - 1) return null;
      return dt.toISOString().slice(0, 10);
    }
  }
  const fmtDate = (iso) => { if (!iso) return '—'; const s = String(iso).slice(0, 10).split('-'); return s.length === 3 ? `${s[2]}/${s[1]}/${s[0]}` : iso; };
  const fmtDateTime = (iso) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleString(LOCALE, { dateStyle: 'short', timeStyle: 'short' }); };
  const daysSince = (iso) => { if (!iso) return Infinity; const d = new Date(String(iso).slice(0, 10) + 'T00:00:00'); return Math.floor((Date.now() - d.getTime()) / 86400000); };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const sum = (arr, f = (x) => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
  const avg = (arr) => (arr.length ? sum(arr) / arr.length : NaN);

  return { setLocale, get locale() { return LOCALE; }, get currency() { return CUR; }, ok, eur, eur4, num, numMax, pct, parseNum, inNum, round, uid, normalize, todayISO, nowISO, parseDate, fmtDate, fmtDateTime, daysSince, esc, clone, sum, avg };
})();

/* ---------------------------- Unidades ---------------------------- */
const UNITS = {
  kg: { dim: 'mass', f: 1, label: 'kg' },
  g: { dim: 'mass', f: 0.001, label: 'g' },
  l: { dim: 'vol', f: 1, label: 'L' },
  cl: { dim: 'vol', f: 0.01, label: 'cl' },
  ml: { dim: 'vol', f: 0.001, label: 'ml' },
  un: { dim: 'count', f: 1, label: 'un' },
  dz: { dim: 'count', f: 12, label: 'dúzia' },
};
const BASE_UNIT = { mass: 'kg', vol: 'l', count: 'un' };
const BASE_LABEL = { mass: 'kg', vol: 'L', count: 'un' };
const PURCHASE_UNITS = [['kg', 'kg'], ['g', 'g'], ['l', 'litro'], ['ml', 'ml'], ['un', 'unidade'], ['emb', 'embalagem']];

const UNIT_SYNONYMS = {
  kg: ['kg', 'kgs', 'kilo', 'kilos', 'quilo', 'quilos', 'quilograma', 'quilogramas', 'kilograma', 'kilogramo', 'kilogramos', 'kilogramme', 'kilogrammes', 'kilogram', 'kilograms'],
  g: ['g', 'gr', 'grs', 'grama', 'gramas', 'gramo', 'gramos', 'gramme', 'grammes', 'gram', 'grams'],
  l: ['l', 'lt', 'lts', 'litro', 'litros', 'ltr', 'litre', 'litres', 'liter', 'liters'],
  ml: ['ml', 'mililitro', 'mililitros', 'millilitre', 'millilitres', 'milliliter', 'milliliters'],
  cl: ['cl', 'centilitro', 'centilitros'],
  un: ['un', 'und', 'unid', 'unidade', 'unidades', 'uni', 'u', 'pc', 'pcs', 'peca', 'pecas', 'pç', 'ud', 'uds', 'unidad', 'unite', 'unites', 'unit', 'units', 'each', 'ea', 'piece', 'pieces', 'pieza', 'piezas'],
  dz: ['dz', 'duzia', 'duzias', 'docena', 'docenas', 'douzaine', 'douzaines', 'dozen', 'doz'],
  emb: ['emb', 'embalagem', 'embalagens', 'cx', 'caixa', 'caixas', 'pack', 'pacote', 'pacotes', 'saco', 'sacos', 'lata', 'latas', 'garrafa', 'garrafas', 'frasco', 'frascos', 'fardo', 'envase', 'caja', 'cajas', 'paquete', 'paquetes', 'bolsa', 'botella', 'botellas', 'bote', 'tarro', 'boite', 'boites', 'paquet', 'paquets', 'sachet', 'bouteille', 'bouteilles', 'pot', 'carton', 'cartons', 'box', 'boxes', 'packet', 'packets', 'bag', 'bags', 'bottle', 'bottles', 'tin', 'tins', 'can', 'cans', 'jar', 'jars', 'case', 'cases'],
};
function parseUnit(v) {
  const s = U.normalize(v).replace(/\s/g, '');
  if (!s) return null;
  for (const [u, list] of Object.entries(UNIT_SYNONYMS)) if (list.includes(s)) return u;
  return null;
}

/** Converte qty na unidade `unit` para a unidade base da dimensão `targetDim`.
 *  conv = { density: kg por litro, unitWeight: kg por unidade } (opcionais). Devolve NaN se impossível. */
function convertToDim(qty, unit, targetDim, conv = {}) {
  const uu = UNITS[unit];
  if (!uu || !U.ok(qty)) return NaN;
  const v = qty * uu.f;
  if (uu.dim === targetDim) return v;
  const density = Number(conv.density) > 0 ? Number(conv.density) : 0;
  const uw = Number(conv.unitWeight) > 0 ? Number(conv.unitWeight) : 0;
  let kg;
  if (uu.dim === 'mass') kg = v;
  else if (uu.dim === 'vol') { if (!density) return NaN; kg = v * density; }
  else { if (!uw) return NaN; kg = v * uw; }
  if (targetDim === 'mass') return kg;
  if (targetDim === 'vol') return density ? kg / density : NaN;
  if (targetDim === 'count') return uw ? kg / uw : NaN;
  return NaN;
}
function convertUnits(qty, from, to, conv = {}) {
  const t = UNITS[to];
  if (!t) return NaN;
  const base = convertToDim(qty, from, t.dim, conv);
  return base / t.f;
}

/* ---------------------------- Alergénios (Reg. UE 1169/2011, Anexo II) ---------------------------- */
const ALLERGENS = [
  { id: 1, short: 'Glúten', name: 'Cereais que contêm glúten', color: '#c8902e', syn: ['gluten', 'trigo', 'cereais', 'cevada', 'centeio', 'aveia', 'espelta', 'cereales', 'cebada', 'centeno', 'avena', 'ble', 'cereales contenant du gluten', 'orge', 'seigle', 'wheat', 'cereals', 'barley', 'rye', 'oats'] },
  { id: 2, short: 'Crustáceos', name: 'Crustáceos', color: '#e0603a', syn: ['crustaceos', 'crustaceo', 'camarao', 'marisco crustaceo', 'lagosta', 'caranguejo', 'crustaceans', 'crustaces', 'gamba', 'prawn', 'shrimp', 'crevette'] },
  { id: 3, short: 'Ovos', name: 'Ovos', color: '#e8b923', syn: ['ovos', 'ovo', 'huevo', 'huevos', 'oeuf', 'oeufs', 'egg', 'eggs'] },
  { id: 4, short: 'Peixes', name: 'Peixes', color: '#3a7bd5', syn: ['peixe', 'peixes', 'pescado', 'pescados', 'pez', 'poisson', 'poissons', 'fish'] },
  { id: 5, short: 'Amendoins', name: 'Amendoins', color: '#a0522d', syn: ['amendoim', 'amendoins', 'cacahuete', 'cacahuetes', 'mani', 'arachide', 'arachides', 'cacahuete', 'peanut', 'peanuts'] },
  { id: 6, short: 'Soja', name: 'Soja', color: '#7a9a3a', syn: ['soja', 'soy', 'soya', 'soybean', 'soybeans'] },
  { id: 7, short: 'Leite', name: 'Leite', color: '#5b8fb9', syn: ['leite', 'lactose', 'laticinios', 'lacteos', 'leche', 'lactosa', 'lait', 'milk', 'dairy'] },
  { id: 8, short: 'Frutos casca rija', name: 'Frutos de casca rija', color: '#8b5a2b', syn: ['frutos de casca rija', 'frutos casca rija', 'frutos secos', 'nozes', 'amendoas', 'avela', 'avelas', 'caju', 'pistacio', 'frutos de cascara', 'frutos de cascara de arbol', 'fruits a coque', 'noix', 'amandes', 'nuts', 'tree nuts', 'almonds', 'hazelnuts', 'walnuts'] },
  { id: 9, short: 'Aipo', name: 'Aipo', color: '#4caf50', syn: ['aipo', 'apio', 'celeri', 'celery'] },
  { id: 10, short: 'Mostarda', name: 'Mostarda', color: '#c9a400', syn: ['mostarda', 'mostaza', 'moutarde', 'mustard'] },
  { id: 11, short: 'Sésamo', name: 'Sementes de sésamo', color: '#b39b74', syn: ['sesamo', 'sementes de sesamo', 'gergelim', 'granos de sesamo', 'graines de sesame', 'sesame', 'sesame seeds'] },
  { id: 12, short: 'Sulfitos', name: 'Dióxido de enxofre e sulfitos', color: '#8e3b8e', syn: ['sulfitos', 'sulfito', 'dioxido de enxofre', 'so2', 'dioxido de azufre', 'anhydride sulfureux', 'sulfites', 'sulphites', 'sulphur dioxide'] },
  { id: 13, short: 'Tremoço', name: 'Tremoço', color: '#d4a017', syn: ['tremoco', 'tremocos', 'lupino', 'lupina', 'altramuz', 'altramuces', 'lupin', 'lupine'] },
  { id: 14, short: 'Moluscos', name: 'Moluscos', color: '#2a9d8f', syn: ['moluscos', 'molusco', 'ameijoa', 'mexilhao', 'polvo', 'lula', 'choco', 'mollusques', 'molluscs', 'mollusks'] },
];
const ALLERGEN_BY_ID = Object.fromEntries(ALLERGENS.map((a) => [a.id, a]));
/** Converte texto livre ("glúten, leite" ou "1;7") em lista de IDs de alergénios. */
function parseAllergens(v) {
  if (v === null || v === undefined || v === '') return [];
  const out = new Set();
  String(v).split(/[,;|/+\n]/).forEach((part) => {
    const p = U.normalize(part);
    if (!p) return;
    if (/^\d{1,2}$/.test(p) && ALLERGEN_BY_ID[+p]) { out.add(+p); return; }
    for (const a of ALLERGENS) {
      if (a.syn.some((s) => p === s || p.includes(s)) || U.normalize(a.name) === p || U.normalize(a.short) === p) { out.add(a.id); break; }
    }
  });
  return [...out].sort((a, b) => a - b);
}

/* ===================================================================
   MOTOR DE CÁLCULO
   - data: { ingredients: Map, recipes: Map, staff: Map, equipment: Map, opcosts: [], settings }
   - ctx (opcional, simulação): { ingMult(ing), energyMult(type), laborMult, lineQtyMult(recId, lineId), targetFC, priceDelta }
   =================================================================== */
const Calc = (() => {
  const NO_CTX = {};

  function ingredientBase(ing) {
    const qty = Number(ing.purchaseQty);
    if (!(qty > 0)) return null;
    if (ing.purchaseUnit === 'emb') {
      const cu = UNITS[ing.packUnit];
      const pq = Number(ing.packQty);
      if (!cu || !(pq > 0)) return null;
      return { dim: cu.dim, qty: qty * pq * cu.f };
    }
    const uu = UNITS[ing.purchaseUnit];
    if (!uu) return null;
    return { dim: uu.dim, qty: qty * uu.f };
  }

  /** Custo por unidade base (kg, L ou un). Usa preço sem IVA quando o IVA é dedutível. */
  function ingredientUnitCost(ing, settings, ctx = NO_CTX) {
    const b = ingredientBase(ing);
    const price = Number(ing.price);
    const vat = Number(ing.vat) || 0;
    if (!b) return { dim: null, cost: NaN, net: NaN, gross: NaN, error: 'Quantidade/unidade de compra inválida' };
    if (!(price >= 0)) return { dim: b.dim, cost: NaN, net: NaN, gross: NaN, error: 'Preço inválido' };
    const net = ing.priceIncludesVat ? price / (1 + vat / 100) : price;
    const gross = ing.priceIncludesVat ? price : price * (1 + vat / 100);
    const mult = ctx.ingMult ? ctx.ingMult(ing) : 1;
    const used = (settings.vatDeductible !== false ? net : gross) * mult;
    return { dim: b.dim, cost: used / b.qty, net: (net * mult) / b.qty, gross: (gross * mult) / b.qty, baseQty: b.qty };
  }
  const convOf = (ing) => ({ density: Number(ing.density) || 0, unitWeight: (Number(ing.unitWeightG) || 0) / 1000 });

  function teamAverageRate(data) {
    const s = data.settings;
    if (s.teamAvgMode === 'manual') return Number(s.teamAvgManual) || 0;
    const active = [...data.staff.values()].filter((x) => x.active !== false).map((x) => staffHourly(x));
    const vals = active.filter((v) => v > 0);
    return vals.length ? U.avg(vals) : Number(s.teamAvgManual) || 0;
  }
  /** Custo horário de um funcionário. Modo salário: (salário × 14 / 12) × (1 + encargos) / horas por mês. */
  function staffHourly(st) {
    if (st.mode === 'salario') {
      const sal = Number(st.monthlySalary) || 0, enc = Number(st.chargesPct) || 0, h = Number(st.hoursMonth) || 0, months = Number(st.salariesYear) || 14;
      if (!(h > 0)) return 0;
      return (sal * months / 12) * (1 + enc / 100) / h;
    }
    return Number(st.hourlyCost) || 0;
  }
  function equipmentHourly(eq, settings) {
    if (eq.mode === 'manual') return Number(eq.costPerHour) || 0;
    const price = eq.energyType === 'gas' ? Number(settings.gasPrice) : eq.energyType === 'eletricidade' ? Number(settings.electricityPrice) : Number(eq.energyPrice);
    return (Number(eq.powerKw) || 0) * (price || 0) * ((Number(eq.usageFactor) || 100) / 100);
  }
  function indirectPerDose(data) {
    const s = data.settings.indirect || {};
    const total = U.sum((data.opcosts || []).filter((o) => o.include !== false), (o) => o.monthly);
    const doses = Number(s.dosesPerMonth) || 0;
    return { monthly: total, perDose: doses > 0 ? total / doses : 0, doses };
  }
  function laborMinutes(rec) {
    const prep = Number(rec.prepMin) || 0, cook = Number(rec.cookMin) || 0, plat = Number(rec.platingMin) || 0, clean = Number(rec.cleanMin) || 0;
    const counted = prep + (rec.laborIncludeCook === false ? 0 : cook) + plat + clean;
    return { prep, cook, plat, clean, total: prep + cook + plat + clean, counted };
  }

  function finalBase(rec) {
    const u = UNITS[rec.finalUnit];
    const q = Number(rec.finalQty);
    if (!u || !(q > 0)) return null;
    return { dim: u.dim, qty: q * u.f };
  }

  /** Cria um avaliador com cache (por conjunto de dados + contexto). */
  function evaluator(data, ctx = NO_CTX) {
    const cache = new Map();

    function evalRecipe(rec, stack = []) {
      if (cache.has(rec.id)) return cache.get(rec.id);
      if (stack.includes(rec.id)) return { error: 'Referência circular entre fichas', materials: 0, labor: 0, energy: 0, extras: 0, direct: 0, lines: [], errors: ['Referência circular'], allergens: { present: [], traces: [], auto: [], sources: {}, traceSources: {}, removedAuto: [], confirmed: false } };
      const nextStack = stack.concat(rec.id);
      const settings = data.settings;
      const errors = [], warnings = [];
      let materials = 0, subLabor = 0, subEnergy = 0, subExtras = 0;
      const autoAll = new Map(), autoTraces = new Map();
      const addSrc = (map, id, src) => { if (!map.has(id)) map.set(id, new Set()); map.get(id).add(src); };
      let netMass = 0, netMassOk = true;

      const lines = (rec.lines || []).map((line) => {
        const out = { id: line.id, kind: line.kind, refId: line.refId, unit: line.unit, qty: Number(line.qty) || 0, name: '?', unitPrice: NaN, cost: NaN, wastePct: 0, effCost: NaN, grossQty: NaN, error: null, allergens: [], traces: [] };
        const qMult = ctx.lineQtyMult ? ctx.lineQtyMult(rec.id, line.id) : 1;
        const qty = (Number(line.qty) || 0) * qMult;
        out.qty = qty;
        const wOverride = line.wastePct !== null && line.wastePct !== undefined && line.wastePct !== '' && U.ok(Number(line.wastePct));
        if (line.kind === 'rec') {
          const sub = data.recipes.get(line.refId);
          if (!sub) { out.error = 'Ficha técnica em falta'; errors.push(out.error); return out; }
          out.name = sub.name;
          const r = evalRecipe(sub, nextStack);
          if (r.errors && r.errors.length) { out.error = 'Erro na sub-ficha: ' + r.errors[0]; errors.push(out.error); }
          let fraction = NaN;
          if (line.unit === 'dose') fraction = qty / (Number(sub.portions) || NaN);
          else {
            const fb = finalBase(sub);
            const lu = UNITS[line.unit];
            if (fb && lu && lu.dim === fb.dim) fraction = (qty * lu.f) / fb.qty;
          }
          if (!U.ok(fraction)) { out.error = 'Unidade incompatível com a sub-ficha'; errors.push(out.error + ' (' + sub.name + ')'); return out; }
          const w = wOverride ? Number(line.wastePct) : 0;
          if (w >= 100 || w < 0) { out.error = 'Desperdício inválido'; errors.push(out.error); return out; }
          const factor = fraction / (1 - w / 100);
          out.wastePct = w;
          out.cost = r.direct * fraction;
          out.effCost = r.direct * factor;
          out.unitPrice = qty > 0 ? out.cost / qty : NaN;
          out.grossQty = qty / (1 - w / 100);
          out.parts = { materials: r.materials * factor, labor: r.labor * factor, energy: r.energy * factor, extras: r.extras * factor };
          materials += out.parts.materials; subLabor += out.parts.labor; subEnergy += out.parts.energy; subExtras += out.parts.extras;
          const fa = r.allergens;
          fa.present.forEach((id) => addSrc(autoAll, id, sub.name));
          fa.traces.forEach((id) => addSrc(autoTraces, id, sub.name));
          out.allergens = [...fa.present]; out.traces = [...fa.traces];
          const lu = UNITS[line.unit];
          if (lu && lu.dim === 'mass') netMass += qty * lu.f; else netMassOk = false;
          return out;
        }
        const ing = data.ingredients.get(line.refId);
        if (!ing) { out.error = 'Ingrediente em falta'; errors.push(out.error); return out; }
        out.name = ing.name;
        const uc = ingredientUnitCost(ing, settings, ctx);
        if (!U.ok(uc.cost)) { out.error = uc.error || 'Preço inválido'; errors.push(ing.name + ': ' + out.error); return out; }
        const baseQty = line.unit === 'emb' ? (ing.purchaseUnit === 'emb' && UNITS[ing.packUnit] && UNITS[ing.packUnit].dim === uc.dim ? qty * (Number(ing.packQty) || 0) * UNITS[ing.packUnit].f : NaN) : convertToDim(qty, line.unit, uc.dim, convOf(ing));
        if (!U.ok(baseQty)) { out.error = 'Unidade incompatível (defina densidade ou peso unitário)'; errors.push(ing.name + ': unidade incompatível'); return out; }
        const w = wOverride ? Number(line.wastePct) : Number(ing.wastePct) || 0;
        if (w >= 100 || w < 0) { out.error = 'Desperdício inválido'; errors.push(ing.name + ': desperdício inválido'); return out; }
        out.wastePct = w;
        out.unitPrice = qty > 0 ? (uc.cost * baseQty) / qty : uc.cost * (UNITS[line.unit] ? UNITS[line.unit].f : 1);
        out.cost = uc.cost * baseQty;
        out.effCost = out.cost / (1 - w / 100);
        out.grossQty = qty / (1 - w / 100);
        materials += out.effCost;
        (ing.allergens || []).forEach((id) => addSrc(autoAll, id, ing.name));
        (ing.traces || []).forEach((id) => addSrc(autoTraces, id, ing.name));
        out.allergens = [...(ing.allergens || [])]; out.traces = [...(ing.traces || [])];
        const m = line.unit === 'emb' ? convertToDim(baseQty, BASE_UNIT[uc.dim], 'mass', convOf(ing)) : convertToDim(qty, line.unit, 'mass', convOf(ing));
        if (U.ok(m)) netMass += m; else netMassOk = false;
        return out;
      });

      // Mão de obra
      const mins = laborMinutes(rec);
      const lab = rec.labor || {};
      const avgRate = teamAverageRate(data);
      const labLines = (lab.lines || []).map((l) => {
        const st = l.staffId && l.staffId !== 'avg' ? data.staff.get(l.staffId) : null;
        const rate = st ? staffHourly(st) : avgRate;
        if (l.staffId && l.staffId !== 'avg' && !st) warnings.push('Funcionário removido na mão de obra');
        return { staffId: l.staffId || 'avg', name: st ? st.name : tr('Média da equipa'), count: Math.max(0, Number(l.count) || 0), rate };
      });
      const totCount = U.sum(labLines, (l) => l.count);
      const rateSum = U.sum(labLines, (l) => l.count * l.rate);
      const hours = mins.counted / 60;
      let ownLabor = 0;
      if (lab.mode === 'individual') ownLabor = totCount > 0 ? hours * (rateSum / totCount) : 0;
      else ownLabor = hours * rateSum;
      ownLabor *= ctx.laborMult || 1;
      if (mins.counted > 0 && !labLines.length) warnings.push('Tempos definidos sem funcionários associados: mão de obra = 0 €');

      // Energia (equipamentos)
      const indirectCfg = settings.indirect || {};
      const eqLines = (rec.equipment || []).map((e) => {
        const eq = data.equipment.get(e.equipId);
        if (!eq) return { name: 'Equipamento em falta', minutes: Number(e.minutes) || 0, cost: 0, error: true };
        const h = equipmentHourly(eq, settings) * (ctx.energyMult ? ctx.energyMult(eq.energyType) : 1);
        return { name: eq.name, energyType: eq.energyType, minutes: Number(e.minutes) || 0, perHour: h, cost: h * (Number(e.minutes) || 0) / 60 };
      });
      let ownEnergy = U.sum(eqLines, (e) => e.cost);
      const energyExcluded = !!indirectCfg.includesEnergy && indirectCfg.method !== 'none';
      if (energyExcluded) ownEnergy = 0;

      // Outros custos diretos (embalagens, consumíveis…)
      const portions = Number(rec.portions) || 0;
      const exLines = (rec.extras || []).map((x) => {
        const v = Number(x.value) || 0;
        const batch = x.per === 'dose' ? v * portions : v;
        const excluded = !!indirectCfg.includesPackaging && indirectCfg.method !== 'none' && (x.type === 'embalagem' || x.type === 'consumivel');
        return { name: x.name, type: x.type, per: x.per, value: v, batch: excluded ? 0 : batch, excluded };
      });
      const ownExtras = U.sum(exLines, (x) => x.batch);

      const labor = ownLabor + subLabor, energy = ownEnergy + subEnergy, extras = ownExtras + subExtras;
      const direct = materials + labor + energy + extras;

      // Alergénios finais (auto + correções manuais)
      const ov = rec.allergenOverrides || {};
      const present = new Set(autoAll.keys());
      (ov.add || []).forEach((id) => present.add(id));
      (ov.remove || []).forEach((id) => present.delete(id));
      const traces = new Set(autoTraces.keys());
      (ov.traces || []).forEach((id) => traces.add(id));
      present.forEach((id) => traces.delete(id));
      const allergens = {
        present: [...present].sort((a, b) => a - b), traces: [...traces].sort((a, b) => a - b),
        auto: [...autoAll.keys()].sort((a, b) => a - b),
        sources: Object.fromEntries([...autoAll].map(([k, v]) => [k, [...v]])),
        traceSources: Object.fromEntries([...autoTraces].map(([k, v]) => [k, [...v]])),
        removedAuto: (ov.remove || []).filter((id) => autoAll.has(id)),
        confirmed: !!ov.confirmed,
      };

      if (!(portions > 0)) errors.push('Número de doses tem de ser superior a 0');
      if (!lines.length) warnings.push('Ficha sem ingredientes');

      const res = {
        id: rec.id, lines, errors, warnings, materials, labor, energy, extras, direct,
        ownLabor, ownEnergy, ownExtras, subLabor, subEnergy, subExtras,
        laborDetail: { minutes: mins, lines: labLines, mode: lab.mode === 'individual' ? 'individual' : 'simultaneo', avgRate, hours },
        energyDetail: { lines: eqLines, excluded: energyExcluded }, extrasDetail: exLines,
        netMass: netMassOk ? netMass : NaN, allergens,
      };
      cache.set(rec.id, res);
      return res;
    }

    /** Custo completo de uma ficha (inclui custos indiretos — aplicados só ao nível da ficha final). */
    function cost(rec) {
      const r = evalRecipe(rec);
      const s = data.settings;
      const ind = s.indirect || {};
      const portions = Number(rec.portions) || 0;
      let indirect = 0;
      if (ind.method === 'percent') indirect = r.direct * (Number(ind.percent) || 0) / 100;
      else if (ind.method === 'perDose') indirect = indirectPerDose(data).perDose * portions;
      const opMult = ctx.opMult || 1;
      indirect *= opMult;
      const operational = r.extras + indirect;
      const total = r.direct + indirect;
      const fb = finalBase(rec);
      const per = (v) => (portions > 0 ? v / portions : NaN);
      return {
        ...r, indirect, operational, total,
        perDose: { materials: per(r.materials), labor: per(r.labor), energy: per(r.energy), operational: per(operational), extras: per(r.extras), indirect: per(indirect), total: per(total), direct: per(r.direct) },
        perBaseUnit: fb ? total / fb.qty : NaN, perBaseLabel: fb ? BASE_LABEL[fb.dim] : null,
        materialsPerBase: fb ? r.materials / fb.qty : NaN,
        yieldPct: fb && fb.dim === 'mass' && r.netMass > 0 ? (fb.qty / r.netMass) * 100 : NaN,
        finalBase: fb,
      };
    }
    return { evalRecipe, cost };
  }

  /* ---------------------------- Preços ---------------------------- */
  function parseEndings(str) {
    return String(str || '').split(/[;\s]+/).map((x) => U.parseNum(x)).filter((x) => U.ok(x) && x >= 0 && x < 1).sort((a, b) => a - b);
  }
  /** Arredonda para cima para o terminal comercial mais próximo (ex.: 0,50 e 0,90 → 9,90; 10,50; 10,90…). */
  function roundCommercial(x, endings) {
    if (!U.ok(x) || x <= 0) return x;
    const ends = endings && endings.length ? endings : [0.5, 0.9];
    const base = Math.floor(x);
    for (let n = base - 1; n <= base + 1; n++) {
      for (const e of ends) { const c = Math.round((n + e) * 100) / 100; if (c >= x - 1e-9 && c > 0) return c; }
    }
    return Math.ceil(x);
  }
  function vatFor(rec, settings) {
    if (rec.vatRate !== null && rec.vatRate !== undefined && rec.vatRate !== '' && U.ok(Number(rec.vatRate))) return Number(rec.vatRate);
    const c = (settings.saleCategories || []).find((x) => x.name === rec.category);
    return c ? Number(c.vat) : Number(settings.defaultSaleVat) || 0;
  }
  function targetFor(rec, settings, ctx = NO_CTX) {
    if (ctx.targetFC) return Number(ctx.targetFC);
    const t = Number(rec.targetFC);
    return t > 0 ? t : Number(settings.targetFC) || 30;
  }
  /** Indicadores para um preço de venda sem IVA. */
  function metrics(net, c, vat) {
    const variable = c.perDose.materials + c.perDose.energy + c.perDose.extras;
    return {
      net, gross: net * (1 + vat / 100), vatValue: net * vat / 100,
      totalCost: c.perDose.total,
      foodCostPct: net > 0 ? (c.perDose.materials / net) * 100 : NaN,
      totalCostPct: net > 0 ? (c.perDose.total / net) * 100 : NaN,
      grossMargin: net - c.perDose.materials,
      grossMarginPct: net > 0 ? ((net - c.perDose.materials) / net) * 100 : NaN,
      contribution: net - variable,
      contributionPct: net > 0 ? ((net - variable) / net) * 100 : NaN,
      profit: net - c.perDose.total,
      profitPct: net > 0 ? ((net - c.perDose.total) / net) * 100 : NaN,
    };
  }
  function pricing(rec, c, settings, ctx = NO_CTX) {
    const vat = vatFor(rec, settings);
    const target = targetFor(rec, settings, ctx);
    const delta = Number(settings.tierDelta) || 5;
    const baseCost = settings.fcBase === 'total' ? c.perDose.total : c.perDose.materials;
    const ends = parseEndings(settings.roundingEndings);
    const mk = (key, label, fc) => {
      const f = Math.min(95, Math.max(1, fc));
      let net = baseCost / (f / 100);
      let gross = net * (1 + vat / 100);
      const rawGross = gross;
      if (settings.roundingEnabled) { gross = roundCommercial(gross, ends); net = gross / (1 + vat / 100); }
      return { key, label, targetPct: f, rawGross, ...metrics(net, c, vat) };
    };
    const tiers = [mk('econ', 'Económico', target + delta), mk('rec', 'Recomendado', target), mk('premium', 'Premium', target - delta)];
    let current = null;
    const sp = Number(rec.salePrice);
    if (sp > 0) {
      const g = sp + (Number(ctx.priceDelta) || 0);
      current = metrics(g / (1 + vat / 100), c, vat);
    }
    return { vat, target, baseCost, tiers, recommended: tiers[1], current };
  }
  function status(rec, c, p, settings) {
    if (c.errors && c.errors.length) return { key: 'erro', label: 'Erro nos dados', cls: 'red' };
    if (!p.current) return { key: 'sempreco', label: 'Sem preço', cls: 'gray' };
    if (p.current.profit < 0) return { key: 'prejuizo', label: 'Prejuízo', cls: 'red' };
    if (p.current.foodCostPct > p.target + 0.05) return { key: 'acima', label: 'Food Cost acima do objetivo', cls: 'amber' };
    return { key: 'ok', label: 'Dentro do objetivo', cls: 'green' };
  }

  /** Fichas que usam (direta ou indiretamente) o ingrediente/ficha indicada. */
  function usages(data, kind, id) {
    const direct = new Set();
    for (const r of data.recipes.values()) if ((r.lines || []).some((l) => l.kind === kind && l.refId === id)) direct.add(r.id);
    const all = new Set(direct);
    let changed = true;
    while (changed) {
      changed = false;
      for (const r of data.recipes.values()) {
        if (all.has(r.id)) continue;
        if ((r.lines || []).some((l) => l.kind === 'rec' && all.has(l.refId))) { all.add(r.id); changed = true; }
      }
    }
    return { direct: [...direct], all: [...all] };
  }
  /** true se incluir `subId` em `recId` criaria um ciclo. */
  function wouldCycle(data, recId, subId) {
    if (recId === subId) return true;
    const seen = new Set();
    const walk = (id) => {
      if (id === recId) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      const r = data.recipes.get(id);
      return !!r && (r.lines || []).some((l) => l.kind === 'rec' && walk(l.refId));
    };
    return walk(subId);
  }

  return { ingredientBase, ingredientUnitCost, convOf, teamAverageRate, staffHourly, equipmentHourly, indirectPerDose, laborMinutes, finalBase, evaluator, parseEndings, roundCommercial, vatFor, targetFor, metrics, pricing, status, usages, wouldCycle };
})();

if (typeof module !== 'undefined') module.exports = { U, UNITS, BASE_UNIT, BASE_LABEL, PURCHASE_UNITS, parseUnit, convertToDim, convertUnits, ALLERGENS, ALLERGEN_BY_ID, parseAllergens, Calc };
