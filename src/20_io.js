/* =====================================================================
   MÓDULO 2 — FICHEIROS: XLSX (leitura/escrita nativa, sem bibliotecas
   externas), CSV e colagem de folha de cálculo.
   ===================================================================== */
const IO = (() => {
  /* ---------- CRC32 / ZIP ---------- */
  const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

  function zipStore(files) {
    const enc = new TextEncoder();
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const chunks = [], central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc.encode(f.name);
      const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      chunks.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    const cdSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  async function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') throw new Error('Este navegador não suporta descompressão de ficheiros Excel. Atualize o navegador ou use CSV.');
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(buf);
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('O ficheiro não é um Excel (.xlsx) válido. Ficheiros .xls antigos não são suportados: guarde como .xlsx ou CSV.');
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    const files = new Map();
    const dec = new TextDecoder();
    for (let i = 0; i < count; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Estrutura ZIP inválida');
      const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loff = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      const start = loff + 30 + dv.getUint16(loff + 26, true) + dv.getUint16(loff + 28, true);
      files.set(name, { method, data: u8.subarray(start, start + csize) });
    }
    return {
      has: (n) => files.has(n),
      async text(n) {
        const f = files.get(n); if (!f) return null;
        let d;
        if (f.method === 0) d = f.data; else if (f.method === 8) d = await inflateRaw(f.data); else throw new Error('Compressão não suportada');
        return dec.decode(d);
      },
    };
  }

  /* ---------- Leitura XLSX ---------- */
  const xmlDoc = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const byTag = (node, tag) => [...node.getElementsByTagNameNS('*', tag)];
  function colIndex(ref) { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; }

  async function readXlsx(buf) {
    const z = unzip(buf);
    const wbXml = await z.text('xl/workbook.xml');
    if (!wbXml) throw new Error('Livro Excel sem workbook.xml');
    const wb = xmlDoc(wbXml);
    const relsXml = await z.text('xl/_rels/workbook.xml.rels');
    const rels = {};
    if (relsXml) byTag(xmlDoc(relsXml), 'Relationship').forEach((r) => (rels[r.getAttribute('Id')] = r.getAttribute('Target')));
    const ssXml = await z.text('xl/sharedStrings.xml');
    const shared = [];
    if (ssXml) byTag(xmlDoc(ssXml), 'si').forEach((si) => {
      let txt = '';
      [...si.childNodes].forEach((c) => {
        if (c.localName === 't') txt += c.textContent;
        else if (c.localName === 'r') byTag(c, 't').forEach((t) => (txt += t.textContent));
      });
      shared.push(txt);
    });
    const sheets = [];
    for (const sh of byTag(wb, 'sheet')) {
      const name = sh.getAttribute('name');
      const rid = sh.getAttribute('r:id') || sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      let target = rels[rid] || '';
      if (!target) continue;
      target = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
      const sx = await z.text(target);
      if (!sx) continue;
      const doc = xmlDoc(sx);
      const rows = [];
      byTag(doc, 'row').forEach((row, ri) => {
        const rIdx = (Number(row.getAttribute('r')) || ri + 1) - 1;
        const arr = [];
        let seq = 0;
        byTag(row, 'c').forEach((c) => {
          let ci = colIndex(c.getAttribute('r'));
          if (ci < 0) ci = seq;
          seq = ci + 1;
          const t = c.getAttribute('t');
          const vEl = byTag(c, 'v')[0];
          let v = vEl ? vEl.textContent : null;
          if (t === 's') v = shared[Number(v)] ?? '';
          else if (t === 'inlineStr') v = byTag(c, 't').map((x) => x.textContent).join('');
          else if (t === 'b') v = v === '1';
          else if (t === 'str' || t === 'e') v = v ?? '';
          else if (v !== null && v !== '') v = Number(v);
          arr[ci] = v;
        });
        rows[rIdx] = arr;
      });
      const width = Math.max(0, ...rows.filter(Boolean).map((r) => r.length));
      const clean = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i] || [];
        const full = Array.from({ length: width }, (_, j) => (r[j] === undefined || r[j] === null ? '' : r[j]));
        clean.push(full);
      }
      while (clean.length && clean[clean.length - 1].every((x) => x === '')) clean.pop();
      sheets.push({ name, rows: clean });
    }
    return sheets;
  }

  /* ---------- Escrita XLSX ---------- */
  const xe = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  // estilos: 0 normal | 1 cabeçalho | 2 euro | 3 percentagem | 4 número | 5 título | 6 euro negrito
  const STY = { head: 1, eur: 2, pct: 3, num: 4, title: 5, eurb: 6 };
  function sheetXml(rows, widths) {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
    if (widths && widths.length) x += '<cols>' + widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('') + '</cols>';
    x += '<sheetData>';
    rows.forEach((row, ri) => {
      x += `<row r="${ri + 1}">`;
      (row || []).forEach((cell, ci) => {
        if (cell === null || cell === undefined || cell === '') return;
        const ref = colName(ci) + (ri + 1);
        let v = cell, s = 0;
        if (typeof cell === 'object' && !(cell instanceof Date)) { v = cell.v; s = STY[cell.t] || 0; if (cell.t === 'pct' && typeof v === 'number') v = v / 100; }
        if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) { if (s) x += `<c r="${ref}" s="${s}"/>`; return; }
        const sa = s ? ` s="${s}"` : '';
        if (typeof v === 'number') x += `<c r="${ref}"${sa}><v>${v}</v></c>`;
        else if (typeof v === 'boolean') x += `<c r="${ref}"${sa} t="b"><v>${v ? 1 : 0}</v></c>`;
        else x += `<c r="${ref}"${sa} t="inlineStr"><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
      });
      x += '</row>';
    });
    return x + '</sheetData></worksheet>';
  }
  const STYLES = () => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="3"><numFmt numFmtId="164" formatCode="' + (U.currency === 'GBP' ? '&quot;£&quot;#,##0.00' : '#,##0.00\\ &quot;€&quot;') + '"/><numFmt numFmtId="165" formatCode="0.0%"/><numFmt numFmtId="166" formatCode="#,##0.000"/></numFmts>'
    + '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF0F2742"/><name val="Calibri"/></font></fonts>'
    + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF0F2742"/><bgColor indexed="64"/></patternFill></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="164" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/></cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  /** sheets: [{ name, rows: [[valor | {v, t:'eur'|'pct'|'num'|'head'|'title'}]], widths }] */
  function writeXlsx(sheets) {
    const used = new Set();
    const safe = sheets.map((s, i) => {
      let n = String(s.name || 'Folha' + (i + 1)).replace(/[\[\]:*?/\\]/g, ' ').slice(0, 31).trim() || 'Folha' + (i + 1);
      let k = n, j = 2; while (used.has(k.toLowerCase())) k = n.slice(0, 28) + ' ' + j++;
      used.add(k.toLowerCase()); return { ...s, name: k };
    });
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + safe.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
      { name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + safe.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>' },
      { name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + safe.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${safe.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
      { name: 'xl/styles.xml', data: STYLES() },
      ...safe.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s.rows, s.widths) })),
    ];
    const blob = zipStore(files);
    return new Blob([blob], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- CSV ---------- */
  function detectDelimiter(text) {
    const first = text.split(/\r?\n/).slice(0, 5).join('\n');
    const cands = ['\t', ';', ','];
    let best = ',', bestN = -1;
    for (const c of cands) { const n = first.split(c).length; if (n > bestN) { bestN = n; best = c; } }
    return best;
  }
  function parseCSV(text, delim) {
    text = text.replace(/^﻿/, '');
    const d = delim || detectDelimiter(text);
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += ch;
      } else if (ch === '"' && field === '') q = true;
      else if (ch === d) { row.push(field); field = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
      else field += ch;
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    const width = Math.max(0, ...rows.map((r) => r.length));
    const out = rows.map((r) => Array.from({ length: width }, (_, j) => (r[j] ?? '').trim())).filter((r) => r.some((x) => x !== ''));
    return out;
  }
  function toCSV(rows) {
    const cell = (c) => {
      let v = c && typeof c === 'object' ? c.v : c;
      if (v === null || v === undefined || (typeof v === 'number' && !isFinite(v))) return '';
      if (typeof v === 'number') v = String(Math.round(v * 10000) / 10000).replace('.', ',');
      v = String(v);
      return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return '﻿' + rows.map((r) => (r || []).map(cell).join(';')).join('\r\n');
  }

  function download(blob, filename) {
    if (typeof Native !== 'undefined' && Native.ok) {
      Native.saveFile(blob, filename).then((r) => r && toast('Ficheiro guardado', 'ok')).catch((e) => { if (!/cancel/i.test(e.message)) toast(e.message, 'err'); });
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const readAsArrayBuffer = (file) => file.arrayBuffer();
  async function readAsText(file) {
    const buf = await file.arrayBuffer();
    let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('�')) t = new TextDecoder('windows-1252').decode(buf); // ficheiros CSV antigos do Excel
    return t;
  }

  return { readXlsx, writeXlsx, parseCSV, toCSV, download, readAsArrayBuffer, readAsText, crc32, zipStore, unzip };
})();
