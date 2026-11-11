/* =====================================================================
   MÓDULO 0 — LÍNGUAS E PAÍSES
   A interface é escrita em português (língua de origem). Nas outras línguas
   o texto é traduzido por dicionário, quer ao ser mostrado no ecrã
   (observador do DOM), quer em ficheiros exportados (função tr()).
   Os números (preços, percentagens, quantidades) são generalizados como {#},
   por isso "28 de 50 ingredientes" usa a chave "{#} de {#} ingredientes".
   ===================================================================== */
const I18N = (() => {
  const LANGS = { pt: 'Português', es: 'Español', fr: 'Français', en: 'English' };
  const DICT = { es: Object.create(null), fr: Object.create(null), en: Object.create(null) };
  const store = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };
  const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  function detect() {
    const saved = read('fp_lang');
    if (saved && LANGS[saved]) return saved;
    const n = (typeof navigator !== 'undefined' && (navigator.language || '')).slice(0, 2).toLowerCase();
    return LANGS[n] ? n : n ? 'en' : 'pt';
  }
  let lang = detect();
  let currencySymbol = '€';
  const NUM = /(?:£\s?)?[-+−]?\d+(?:[.,   ]\d+)*(?:\s?[€%])?/g;
  const norm = (s) => String(s).replace(/[\s  ]+/g, ' ').trim();
  const missing = new Set();
  let collect = false;

  function lookup(n) {
    const d = DICT[lang];
    if (!d) return null;
    let v = d[n];
    if (v !== undefined) return v;
    const nums = [];
    const k = n.replace(NUM, (m) => { nums.push(m); return '{#}'; });
    if (k !== n) {
      v = d[k];
      if (v !== undefined) { let i = 0; return v.replace(/\{#\}/g, () => (nums[i++] ?? '')); }
    }
    if (collect) missing.add(k);
    return null;
  }
  /** Traduz um texto da interface (mantém os espaços nas extremidades). */
  function tr(s) {
    if (s === null || s === undefined) return s;
    s = String(s);
    let out = s;
    if (lang !== 'pt') {
      const n = norm(s);
      if (n && /[A-Za-zÀ-ÿ]/.test(n)) {
        const v = lookup(n);
        if (v !== null) { const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0]; out = lead + v + trail; }
      }
    }
    if (currencySymbol !== '€' && out.includes('€')) out = out.replace(/€/g, currencySymbol);
    return out;
  }
  const active = () => lang !== 'pt' || currencySymbol !== '€';

  /* ---------------- Tradução do DOM ---------------- */
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
  function trNode(root) {
    if (!active() || !root) return;
    if (root.nodeType === 3) { const v = tr(root.nodeValue); if (v !== root.nodeValue) root.nodeValue = v; return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && (SKIP.has(root.tagName) || root.hasAttribute('data-notr'))) return;
    const w = document.createTreeWalker(root, 5 /* ELEMENT | TEXT */, {
      acceptNode: (n) => (n.nodeType === 1 && (SKIP.has(n.tagName) || n.hasAttribute('data-notr')) ? 2 /* REJECT */ : 1),
    });
    const texts = [];
    let n = root;
    do {
      if (n.nodeType === 3) texts.push(n);
      else if (n.nodeType === 1) for (const a of ATTRS) { const v = n.getAttribute(a); if (v) { const t = tr(v); if (t !== v) n.setAttribute(a, t); } }
    } while ((n = w.nextNode()));
    for (const t of texts) { const v = tr(t.nodeValue); if (v !== t.nodeValue) t.nodeValue = v; }
  }
  let observer = null;
  function start() {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = { pt: 'pt-PT', es: 'es', fr: 'fr', en: 'en-GB' }[lang];
    if (observer) observer.disconnect();
    if (!active()) return;
    trNode(document.body);
    document.title = tr(document.title);
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList') m.addedNodes.forEach(trNode);
        else if (m.type === 'characterData') trNode(m.target);
        else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName); if (v) { const t = tr(v); if (t !== v) m.target.setAttribute(m.attributeName, t); } }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  /** Traduz um bloco de HTML (documentos de impressão). */
  function trHTML(html) {
    if (!active()) return html;
    const t = document.createElement('template');
    t.innerHTML = html;
    trNode(t.content);
    return t.innerHTML;
  }
  return {
    LANGS,
    get lang() { return lang; },
    setLang(l) { if (!LANGS[l]) return; lang = l; store('fp_lang', l); },
    setCurrencySymbol(s) { currencySymbol = s || '€'; },
    add(l, obj) { const d = DICT[l]; for (const [k, v] of Object.entries(obj)) d[norm(k)] = v; },
    tr, trNode, trHTML, start,
    debug: { get missing() { return missing; }, set collect(v) { collect = v; }, DICT },
  };
})();
const tr = I18N.tr;

/* ---------------------------- Países ---------------------------- */
/* Taxas predefinidas = exemplos para facilitar a configuração; cada estabelecimento deve confirmá-las
   com o seu contabilista. As categorias têm a mesma ordem em todos os países (para mudar de país sem
   perder a ligação das fichas às categorias). */
const COUNTRIES = {
  PT: { name: 'Portugal', currency: 'EUR', locale: 'pt-PT', vatLabel: 'IVA', defaultSaleVat: 13, purchaseVat: 6, rounding: '0,50; 0,90', law: 'Regulamento (UE) n.º 1169/2011',
    cats: [['Pratos principais', 13], ['Entradas', 13], ['Acompanhamentos', 13], ['Sobremesas', 13], ['Molhos e bases', 13], ['Pastelaria', 13], ['Cafetaria', 13], ['Bebidas alcoólicas', 23], ['Refrigerantes e sumos', 23]] },
  ES: { name: 'España', currency: 'EUR', locale: 'es-ES', vatLabel: 'IVA', defaultSaleVat: 10, purchaseVat: 10, rounding: '0,50; 0,90', law: 'Reglamento (UE) n.º 1169/2011',
    cats: [['Platos principales', 10], ['Entrantes', 10], ['Guarniciones', 10], ['Postres', 10], ['Salsas y bases', 10], ['Pastelería', 10], ['Cafetería', 10], ['Bebidas alcohólicas', 10], ['Refrescos y zumos', 10], ['Bebidas alcohólicas para llevar', 21]] },
  FR: { name: 'France', currency: 'EUR', locale: 'fr-FR', vatLabel: 'TVA', defaultSaleVat: 10, purchaseVat: 5.5, rounding: '0,50; 0,90', law: 'Règlement (UE) n° 1169/2011',
    cats: [['Plats principaux', 10], ['Entrées', 10], ['Accompagnements', 10], ['Desserts', 10], ['Sauces et fonds', 10], ['Pâtisserie', 10], ['Café', 10], ['Boissons alcoolisées', 20], ['Boissons sans alcool', 10], ['Vente à emporter (conservable)', 5.5]] },
  GB: { name: 'United Kingdom', currency: 'GBP', locale: 'en-GB', vatLabel: 'VAT', defaultSaleVat: 20, purchaseVat: 0, rounding: '0.50; 0.95', law: 'Food Information Regulations 2014',
    cats: [['Main courses', 20], ['Starters', 20], ['Sides', 20], ['Desserts', 20], ['Sauces and bases', 20], ['Pastry', 20], ['Hot drinks', 20], ['Alcoholic drinks', 20], ['Soft drinks', 20], ['Cold takeaway', 0]] },
};
const VAT_RATES = { PT: [0, 6, 13, 23], ES: [0, 4, 10, 21], FR: [0, 5.5, 10, 20], GB: [0, 5, 20] };
const COUNTRY_BY_LANG = { pt: 'PT', es: 'ES', fr: 'FR', en: 'GB' };
