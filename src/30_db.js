/* =====================================================================
   MÓDULO 3 — PERSISTÊNCIA
   Camada de repositório com adaptadores intercambiáveis. Hoje: IndexedDB
   (com recurso a localStorage). Para uma base de dados online basta criar
   um adaptador com os mesmos métodos (getAll, put, bulkPut, delete, clear).
   ===================================================================== */
const SCHEMA_VERSION = 1;
const LOCAL_DB_NAME = 'fichas-tecnicas-hotelaria';
const STORES = ['ingredients', 'recipes', 'staff', 'equipment', 'opcosts', 'priceHistory', 'recipeVersions', 'meta'];

class IDBAdapter {
  constructor(name, stores = STORES) { this.name = name; this.stores = stores; this.kind = 'Local (IndexedDB)'; }
  open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível'));
      const req = indexedDB.open(this.name, 1);
      req.onupgradeneeded = () => { const db = req.result; this.stores.forEach((s) => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); }); };
      req.onsuccess = () => { this.db = req.result; resolve(this); };
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Base de dados bloqueada por outro separador'));
    });
  }
  tx(store, mode, fn) {
    return new Promise((resolve, reject) => {
      const t = this.db.transaction(store, mode);
      const s = t.objectStore(store);
      let out;
      Promise.resolve(fn(s)).then((v) => (out = v));
      t.oncomplete = () => resolve(out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transação abortada'));
    });
  }
  getAll(store) { return new Promise((res, rej) => { const r = this.db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  put(store, obj) { return this.tx(store, 'readwrite', (s) => { s.put(obj); }); }
  bulkPut(store, arr) { return this.tx(store, 'readwrite', (s) => { arr.forEach((o) => s.put(o)); }); }
  delete(store, id) { return this.tx(store, 'readwrite', (s) => { s.delete(id); }); }
  bulkDelete(store, ids) { return this.tx(store, 'readwrite', (s) => { ids.forEach((id) => s.delete(id)); }); }
  clear(store) { return this.tx(store, 'readwrite', (s) => { s.clear(); }); }
}
class LocalStorageAdapter {
  constructor(name) { this.name = name; this.kind = 'Local (localStorage)'; }
  async open() { return this; }
  key(s) { return this.name + ':' + s; }
  read(s) { try { return JSON.parse(localStorage.getItem(this.key(s)) || '{}'); } catch { return {}; } }
  write(s, o) { localStorage.setItem(this.key(s), JSON.stringify(o)); }
  async getAll(s) { return Object.values(this.read(s)); }
  async put(s, obj) { const o = this.read(s); o[obj.id] = obj; this.write(s, o); }
  async bulkPut(s, arr) { const o = this.read(s); arr.forEach((x) => (o[x.id] = x)); this.write(s, o); }
  async delete(s, id) { const o = this.read(s); delete o[id]; this.write(s, o); }
  async bulkDelete(s, ids) { const o = this.read(s); ids.forEach((id) => delete o[id]); this.write(s, o); }
  async clear(s) { this.write(s, {}); }
}

const Repo = (() => {
  let adapter = null;
  const cache = Object.fromEntries(STORES.map((s) => [s, new Map()]));
  const listeners = new Set();
  let persisted = null;

  /** custom: adaptador alternativo (ex.: nuvem). Sem ele usa o armazenamento local do navegador. */
  async function init(custom) {
    if (custom) adapter = await custom.open();
    else {
      try { adapter = await new IDBAdapter(LOCAL_DB_NAME).open(); }
      catch (e) { console.warn('IndexedDB falhou, a usar localStorage', e); adapter = await new LocalStorageAdapter(LOCAL_DB_NAME).open(); }
    }
    for (const s of STORES) { const all = await adapter.getAll(s); cache[s] = new Map(all.map((o) => [o.id, o])); }
    try { if (navigator.storage && navigator.storage.persist) persisted = await navigator.storage.persist(); } catch { persisted = null; }
    return adapter.kind;
  }
  const notify = (store) => listeners.forEach((fn) => fn(store));
  const all = (s) => [...cache[s].values()];
  const get = (s, id) => cache[s].get(id);
  const map = (s) => cache[s];
  // grava primeiro no adaptador: se for recusado (ex.: conta só de leitura) a cache não fica inconsistente
  async function save(s, obj) { if (!obj.id) obj.id = U.uid(); await adapter.put(s, obj); cache[s].set(obj.id, obj); notify(s); return obj; }
  async function saveMany(s, arr) { arr.forEach((o) => { if (!o.id) o.id = U.uid(); }); if (arr.length) await adapter.bulkPut(s, arr); arr.forEach((o) => cache[s].set(o.id, o)); notify(s); }
  async function remove(s, id) { await adapter.delete(s, id); cache[s].delete(id); notify(s); }
  async function removeMany(s, ids) { if (ids.length) await adapter.bulkDelete(s, ids); ids.forEach((id) => cache[s].delete(id)); notify(s); }
  async function clearAll() { for (const s of STORES) { await adapter.clear(s); cache[s].clear(); } notify('*'); }

  function exportAll() {
    const out = { app: 'fichas-tecnicas-hotelaria', schema: SCHEMA_VERSION, exportedAt: U.nowISO(), data: {} };
    STORES.forEach((s) => (out.data[s] = all(s)));
    return out;
  }
  function validateBackup(obj) {
    if (!obj || obj.app !== 'fichas-tecnicas-hotelaria' || !obj.data) throw new Error('Ficheiro de cópia de segurança inválido');
    if (obj.schema > SCHEMA_VERSION) throw new Error('Cópia criada por uma versão mais recente da aplicação');
    for (const s of Object.keys(obj.data)) {
      if (!STORES.includes(s)) continue;
      if (!Array.isArray(obj.data[s])) throw new Error('Secção inválida: ' + s);
      if (obj.data[s].some((o) => !o || typeof o.id !== 'string')) throw new Error('Registos sem identificador em ' + s);
    }
  }
  async function importAll(obj, mode = 'replace') {
    validateBackup(obj);
    if (mode === 'replace') for (const s of STORES) { await adapter.clear(s); cache[s].clear(); }
    for (const s of STORES) { const arr = obj.data[s] || []; if (arr.length) { await adapter.bulkPut(s, arr); arr.forEach((o) => cache[s].set(o.id, o)); } }
    notify('*');
  }
  /** Alterações vindas de outro dispositivo (sincronização): atualiza a cache sem voltar a gravar. */
  function applyRemote(changes) {
    const touched = new Set();
    for (const c of changes) {
      if (!cache[c.store]) continue;
      if (c.deleted) cache[c.store].delete(c.id); else cache[c.store].set(c.id, c.data);
      touched.add(c.store);
    }
    if (touched.size) listeners.forEach((fn) => fn('remote', [...touched]));
  }
  return { init, applyRemote, get adapter() { return adapter; }, all, get, map, save, saveMany, remove, removeMany, clearAll, exportAll, importAll, validateBackup, on: (fn) => listeners.add(fn), get kind() { return adapter ? adapter.kind : '—'; }, get persisted() { return persisted; } };
})();

/* ---------- Configurações ---------- */
const INGREDIENT_CATEGORIES = ['Carnes', 'Peixes e mariscos', 'Legumes e hortícolas', 'Frutas', 'Laticínios e ovos', 'Mercearia', 'Gorduras e óleos', 'Especiarias e ervas', 'Bebidas', 'Pastelaria', 'Congelados', 'Outros'];
/** Configurações predefinidas para um país (categorias e taxas de imposto do país, nomes na língua atual). */
function defaultSettings(country) {
  const c = COUNTRIES[country] || COUNTRIES.PT;
  return {
    id: 'settings', country: COUNTRIES[country] ? country : 'PT',
    businessName: tr('O meu restaurante'),
    vatDeductible: true,
    targetFC: 30, tierDelta: 5, fcBase: 'materias',
    roundingEnabled: true, roundingEndings: c.rounding,
    defaultSaleVat: c.defaultSaleVat,
    saleCategories: c.cats.map(([name, vat]) => ({ name, vat })),
    ingredientCategories: INGREDIENT_CATEGORIES.map((x) => tr(x)),
    staleDays: 90,
    electricityPrice: country === 'GB' ? 0.25 : 0.16, gasPrice: country === 'GB' ? 0.07 : 0.09,
    teamAvgMode: 'auto', teamAvgManual: country === 'GB' ? 12.5 : 9,
    indirect: { method: 'none', percent: 5, dosesPerMonth: 2000, includesEnergy: false, includesPackaging: false },
  };
}
function getSettings() {
  const s = Repo.get('meta', 'settings');
  // estabelecimentos antigos (sem país) são de Portugal; novos usam o país da língua do dispositivo
  const country = (s && s.country) || (s ? 'PT' : COUNTRY_BY_LANG[I18N.lang] || 'PT');
  const d = defaultSettings(country);
  const merged = { ...d, ...(s || {}), country };
  merged.indirect = { ...d.indirect, ...((s && s.indirect) || {}) };
  return merged;
}
const countryInfo = () => COUNTRIES[getSettings().country] || COUNTRIES.PT;
/** Aplica moeda e formatação do país do estabelecimento. */
function applyCountry() {
  const c = countryInfo();
  U.setLocale(c.locale, c.currency);
  I18N.setCurrencySymbol(c.currency === 'GBP' ? '£' : '€');
}
async function saveSettings(patch) {
  const s = { ...getSettings(), ...patch, id: 'settings' };
  await Repo.save('meta', s);
  return s;
}
/** Vista dos dados para o motor de cálculo. `overrides` permite substituir uma ficha (rascunho em edição). */
function dataView(overrides) {
  const recipes = new Map(Repo.map('recipes'));
  if (overrides && overrides.recipe) recipes.set(overrides.recipe.id, overrides.recipe);
  return { ingredients: Repo.map('ingredients'), recipes, staff: Repo.map('staff'), equipment: Repo.map('equipment'), opcosts: Repo.all('opcosts'), settings: getSettings() };
}

/* ---------- Serviços de domínio com histórico ---------- */
const Services = (() => {
  /** Grava um ingrediente. Se o custo unitário mudar, regista histórico com impacto nas fichas. */
  async function saveIngredient(ing, { source = 'manual' } = {}) {
    if (!ing.demo) Plan.check('ingredients', ing.id);
    const prev = ing.id ? Repo.get('ingredients', ing.id) : null;
    const settings = getSettings();
    ing.id = ing.id || U.uid();
    let entry = null;
    if (prev) {
      const oldC = Calc.ingredientUnitCost(prev, settings).cost;
      const newC = Calc.ingredientUnitCost(ing, settings).cost;
      if (U.ok(oldC) && U.ok(newC) && Math.abs(oldC - newC) > 1e-9) {
        const before = recipeCostsUsing(ing.id);
        entry = { id: U.uid(), ingredientId: ing.id, ingredientName: ing.name, date: U.nowISO(), oldUnitCost: oldC, newUnitCost: newC, diffPct: oldC > 0 ? ((newC - oldC) / oldC) * 100 : NaN, oldPrice: prev.price, newPrice: ing.price, unit: prev.purchaseUnit, source, demo: !!ing.demo, impacts: [] };
        await Repo.save('ingredients', ing);
        const after = recipeCostsUsing(ing.id);
        entry.impacts = Object.keys(after).map((rid) => ({ recipeId: rid, recipeName: after[rid].name, oldDose: before[rid] ? before[rid].dose : NaN, newDose: after[rid].dose }));
        if (!ing.priceUpdatedAt || ing.priceUpdatedAt === prev.priceUpdatedAt) ing.priceUpdatedAt = U.todayISO();
        await Repo.save('ingredients', ing);
        await Repo.save('priceHistory', entry);
        return { ing, entry };
      }
    } else if (!ing.priceUpdatedAt) ing.priceUpdatedAt = U.todayISO();
    if (!ing.createdAt) ing.createdAt = U.nowISO();
    await Repo.save('ingredients', ing);
    return { ing, entry };
  }
  function recipeCostsUsing(ingId) {
    const data = dataView();
    const ev = Calc.evaluator(data);
    const out = {};
    Calc.usages(data, 'ing', ingId).all.forEach((rid) => { const r = data.recipes.get(rid); const c = ev.cost(r); out[rid] = { name: r.name, dose: c.perDose.total }; });
    return out;
  }
  /** Grava ficha e guarda uma versão (snapshot) com o custo nesse momento. */
  async function saveRecipe(rec, note = '') {
    if (!rec.demo) Plan.check('recipes', rec.id);
    rec.updatedAt = U.nowISO();
    if (!rec.createdAt) rec.createdAt = rec.updatedAt;
    rec.version = (Number(rec.version) || 0) + 1;
    await Repo.save('recipes', rec);
    const data = dataView();
    const c = Calc.evaluator(data).cost(rec);
    const p = Calc.pricing(rec, c, data.settings);
    await Repo.save('recipeVersions', { id: U.uid(), recipeId: rec.id, version: rec.version, date: rec.updatedAt, note, snapshot: U.clone({ ...rec, photo: undefined }), costDose: c.perDose.total, materialsDose: c.perDose.materials, salePrice: rec.salePrice || null, recommended: p.recommended.gross, demo: !!rec.demo });
    return rec;
  }
  async function deleteRecipe(id) {
    const vers = Repo.all('recipeVersions').filter((v) => v.recipeId === id).map((v) => v.id);
    await Repo.removeMany('recipeVersions', vers);
    await Repo.remove('recipes', id);
  }
  return { saveIngredient, saveRecipe, deleteRecipe, recipeCostsUsing };
})();
