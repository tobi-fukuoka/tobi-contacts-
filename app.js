// ============================================================
// 東美 連絡帳 - app.js
// ============================================================

'use strict';

// ---------- Constants ----------
const DB_NAME = 'tobi-contacts-v1';
const STORE = 'contacts';
const GYO_LABELS = ['あ', 'か', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', '他'];
const GYO_CHARS = [
  'あいうえおぁぃぅぇぉ',
  'かきくけこがぎぐげご',
  'さしすせそざじずぜぞ',
  'たちつてとだぢづでどっ',
  'なにぬねの',
  'はひふへほばびぶべぼぱぴぷぺぽ',
  'まみむめも',
  'やゆよゃゅょ',
  'らりるれろ',
  'わゐゑをん',
];
const TEL_TYPES = ['携帯', '自宅', '勤務先', 'FAX', 'その他'];
const TEL_TYPE_TO_VCARD = { '携帯': 'CELL', '自宅': 'HOME', '勤務先': 'WORK', 'FAX': 'FAX', 'その他': 'OTHER' };
const VCARD_TO_TEL_TYPE = { 'CELL': '携帯', 'MOBILE': '携帯', 'HOME': '自宅', 'WORK': '勤務先', 'FAX': 'FAX', 'OTHER': 'その他' };
const EMAIL_TYPES = ['個人', '勤務先', 'その他'];
const EMAIL_TYPE_TO_VCARD = { '個人': 'HOME', '勤務先': 'WORK', 'その他': 'OTHER' };
const VCARD_TO_EMAIL_TYPE = { 'HOME': '個人', 'WORK': '勤務先', 'INTERNET': '個人', 'OTHER': 'その他' };
const ADDR_TYPES = ['自宅', '勤務先', 'その他'];
const ADDR_TYPE_TO_VCARD = { '自宅': 'HOME', '勤務先': 'WORK', 'その他': 'OTHER' };
const VCARD_TO_ADDR_TYPE = { 'HOME': '自宅', 'WORK': '勤務先', 'OTHER': 'その他' };

// ---------- State ----------
const state = {
  contacts: [],
  filteredGroups: [],   // [{ label, items: [contact] }]
  selectedId: null,
  searchQuery: '',
};

// ---------- IndexedDB ----------
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(contact) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(contact);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbPutMany(contacts) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    contacts.forEach(c => store.put(c));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Utilities ----------
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toHiragana(str) {
  if (!str) return '';
  // Katakana → Hiragana
  return str.replace(/[\u30A1-\u30F6]/g, (m) => String.fromCharCode(m.charCodeAt(0) - 0x60));
}

function normalizeForSearch(str) {
  if (!str) return '';
  return toHiragana(String(str))
    .toLowerCase()
    // 全角英数 → 半角
    .replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A]/g, (m) =>
      String.fromCharCode(m.charCodeAt(0) - 0xFEE0))
    // 半角カタカナ → 全角カタカナ → (above to hiragana via second pass)
    .replace(/[\uFF65-\uFF9F]/g, (m) => convertHalfKana(m));
}

function convertHalfKana(c) {
  const map = {
    'ｦ':'を','ｧ':'ぁ','ｨ':'ぃ','ｩ':'ぅ','ｪ':'ぇ','ｫ':'ぉ','ｬ':'ゃ','ｭ':'ゅ','ｮ':'ょ','ｯ':'っ','ｰ':'ー',
    'ｱ':'あ','ｲ':'い','ｳ':'う','ｴ':'え','ｵ':'お',
    'ｶ':'か','ｷ':'き','ｸ':'く','ｹ':'け','ｺ':'こ',
    'ｻ':'さ','ｼ':'し','ｽ':'す','ｾ':'せ','ｿ':'そ',
    'ﾀ':'た','ﾁ':'ち','ﾂ':'つ','ﾃ':'て','ﾄ':'と',
    'ﾅ':'な','ﾆ':'に','ﾇ':'ぬ','ﾈ':'ね','ﾉ':'の',
    'ﾊ':'は','ﾋ':'ひ','ﾌ':'ふ','ﾍ':'へ','ﾎ':'ほ',
    'ﾏ':'ま','ﾐ':'み','ﾑ':'む','ﾒ':'め','ﾓ':'も',
    'ﾔ':'や','ﾕ':'ゆ','ﾖ':'よ',
    'ﾗ':'ら','ﾘ':'り','ﾙ':'る','ﾚ':'れ','ﾛ':'ろ',
    'ﾜ':'わ','ﾝ':'ん','ﾞ':'゛','ﾟ':'゜',
  };
  return map[c] || c;
}

function getGyoIndex(text) {
  if (!text) return 10;
  const first = toHiragana(String(text)).charAt(0);
  for (let i = 0; i < GYO_CHARS.length; i++) {
    if (GYO_CHARS[i].includes(first)) return i;
  }
  return 10;
}

function displayName(c) {
  if (c.fn && c.fn.trim()) return c.fn.trim();
  const n = [c.family, c.given].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (c.org) return c.org;
  if (c.tels && c.tels[0]) return c.tels[0].value;
  if (c.emails && c.emails[0]) return c.emails[0].value;
  return '(名称未設定)';
}

function fullFurigana(c) {
  return [c.familyPhonetic, c.givenPhonetic].filter(Boolean).join(' ').trim();
}

function buildSearchIndex(c) {
  const parts = [
    displayName(c),
    c.family, c.given,
    c.familyPhonetic, c.givenPhonetic,
    c.org, c.orgPhonetic,
    c.title,
    c.note,
    ...(c.tels || []).map(t => t.value),
    ...(c.tels || []).map(t => (t.value || '').replace(/[^0-9]/g, '')),
    ...(c.emails || []).map(e => e.value),
    ...(c.addresses || []).map(a => a.value),
    ...(c.urls || []),
  ].filter(Boolean).join(' ');
  return normalizeForSearch(parts);
}

function getSortKey(c) {
  return fullFurigana(c) || displayName(c);
}

// ---------- vCard parsing ----------
function unfoldLines(text) {
  // RFC 6350: lines starting with space or tab are continuations of previous
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.substring(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeValue(s) {
  if (!s) return '';
  return s
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function decodeQuotedPrintable(s) {
  // Decode =XX hex sequences as UTF-8 bytes
  try {
    const bytes = [];
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '=' && i + 2 < s.length) {
        const hex = s.substring(i + 1, i + 3);
        if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
          bytes.push(parseInt(hex, 16));
          i += 2;
          continue;
        }
      }
      bytes.push(s.charCodeAt(i));
    }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch (e) {
    return s;
  }
}

function parseVCardLine(line) {
  // Split into property name+params and value
  const colonIdx = line.indexOf(':');
  if (colonIdx < 0) return null;

  const left = line.substring(0, colonIdx);
  let value = line.substring(colonIdx + 1);

  // Property+params; split by ;
  const segments = left.split(';');
  const name = segments[0].toUpperCase();
  const params = {};
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    const eqIdx = seg.indexOf('=');
    if (eqIdx > 0) {
      const k = seg.substring(0, eqIdx).toUpperCase();
      const v = seg.substring(eqIdx + 1);
      if (params[k]) params[k] += ',' + v;
      else params[k] = v;
    } else {
      // No value: treat as type bareword (vCard 2.1 style: TEL;CELL:...)
      params['TYPE'] = (params['TYPE'] ? params['TYPE'] + ',' : '') + seg.toUpperCase();
    }
  }

  // Handle ENCODING=QUOTED-PRINTABLE
  if ((params['ENCODING'] || '').toUpperCase().includes('QUOTED-PRINTABLE')) {
    value = decodeQuotedPrintable(value);
  }

  return { name, params, value };
}

function getTypes(params) {
  const t = params['TYPE'];
  if (!t) return [];
  return t.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
}

function mapTelType(types) {
  for (const t of types) {
    if (VCARD_TO_TEL_TYPE[t]) return VCARD_TO_TEL_TYPE[t];
  }
  return 'その他';
}

function mapEmailType(types) {
  for (const t of types) {
    if (VCARD_TO_EMAIL_TYPE[t]) return VCARD_TO_EMAIL_TYPE[t];
  }
  return '個人';
}

function mapAddrType(types) {
  for (const t of types) {
    if (VCARD_TO_ADDR_TYPE[t]) return VCARD_TO_ADDR_TYPE[t];
  }
  return 'その他';
}

function parseVCards(text) {
  const lines = unfoldLines(text);
  const cards = [];
  let current = null;

  for (const rawLine of lines) {
    if (!rawLine) continue;
    const line = rawLine.trim();
    if (!line) continue;

    if (/^BEGIN:VCARD$/i.test(line)) {
      current = createBlank();
      continue;
    }
    if (/^END:VCARD$/i.test(line)) {
      if (current) {
        finalizeCard(current);
        cards.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const p = parseVCardLine(line);
    if (!p) continue;

    const value = unescapeValue(p.value);

    switch (p.name) {
      case 'VERSION':
        current._version = value;
        break;
      case 'FN':
        current.fn = value;
        break;
      case 'N': {
        // family;given;additional;prefix;suffix
        const parts = value.split(';');
        current.family = parts[0] || '';
        current.given = parts[1] || '';
        break;
      }
      case 'X-PHONETIC-LAST-NAME':
        current.familyPhonetic = value;
        break;
      case 'X-PHONETIC-FIRST-NAME':
        current.givenPhonetic = value;
        break;
      case 'X-PHONETIC-ORG':
        current.orgPhonetic = value;
        break;
      case 'SORT-STRING':
        current._sortString = value;
        break;
      case 'SOUND': {
        // SOUND;X-IRMC-N:familyフリ;givenフリ
        const types = getTypes(p.params);
        if (types.includes('X-IRMC-N') || types.includes('PHONETIC')) {
          const parts = value.split(';');
          if (!current.familyPhonetic) current.familyPhonetic = parts[0] || '';
          if (!current.givenPhonetic) current.givenPhonetic = parts[1] || '';
        }
        break;
      }
      case 'ORG':
        current.org = value.split(';')[0] || '';
        break;
      case 'TITLE':
        current.title = value;
        break;
      case 'TEL':
        if (value.trim()) {
          current.tels.push({ type: mapTelType(getTypes(p.params)), value: value.trim() });
        }
        break;
      case 'EMAIL':
        if (value.trim()) {
          current.emails.push({ type: mapEmailType(getTypes(p.params)), value: value.trim() });
        }
        break;
      case 'ADR': {
        // po;ext;street;city;region;postal;country
        const parts = value.split(';');
        const street = parts[2] || '';
        const city = parts[3] || '';
        const region = parts[4] || '';
        const postal = parts[5] || '';
        const country = parts[6] || '';
        const formatted = [postal ? '〒' + postal : '', country, region, city, street]
          .filter(Boolean).join(' ').trim();
        if (formatted) {
          current.addresses.push({ type: mapAddrType(getTypes(p.params)), value: formatted });
        }
        break;
      }
      case 'URL':
        if (value.trim()) current.urls.push(value.trim());
        break;
      case 'NOTE':
        current.note = (current.note ? current.note + '\n' : '') + value;
        break;
      case 'BDAY':
        // Normalize YYYY-MM-DD or YYYYMMDD
        if (/^\d{4}-?\d{2}-?\d{2}$/.test(value.substring(0, 10))) {
          const v = value.substring(0, 10).replace(/-/g, '');
          current.birthday = `${v.substring(0,4)}-${v.substring(4,6)}-${v.substring(6,8)}`;
        } else {
          current.birthday = value;
        }
        break;
      case 'PHOTO':
        // intentionally ignored to save space
        break;
      default:
        // Ignore other fields
        break;
    }
  }
  return cards;
}

function createBlank() {
  return {
    id: uuid(),
    fn: '',
    family: '',
    given: '',
    familyPhonetic: '',
    givenPhonetic: '',
    org: '',
    orgPhonetic: '',
    title: '',
    tels: [],
    emails: [],
    addresses: [],
    urls: [],
    note: '',
    birthday: '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function finalizeCard(c) {
  if (!c.fn) {
    c.fn = [c.family, c.given].filter(Boolean).join(' ').trim() || c.org || '';
  }
  // If furigana is in katakana, convert to hiragana for consistency
  c.familyPhonetic = toHiragana(c.familyPhonetic || '');
  c.givenPhonetic = toHiragana(c.givenPhonetic || '');
  c.orgPhonetic = toHiragana(c.orgPhonetic || '');
}

// ---------- vCard generation ----------
function escapeVCardValue(s) {
  if (s == null) return '';
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldLine(line) {
  // Fold at 75 octets per line per RFC 6350
  if (line.length <= 75) return line;
  const out = [];
  let i = 0;
  while (i < line.length) {
    const chunk = line.substring(i, i + 75);
    if (i === 0) out.push(chunk);
    else out.push(' ' + chunk);
    i += 75;
  }
  return out.join('\r\n');
}

function generateVCard(c) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];

  const fn = displayName(c);
  lines.push(`FN:${escapeVCardValue(fn)}`);
  lines.push(`N:${escapeVCardValue(c.family)};${escapeVCardValue(c.given)};;;`);

  if (c.familyPhonetic) lines.push(`X-PHONETIC-LAST-NAME:${escapeVCardValue(c.familyPhonetic)}`);
  if (c.givenPhonetic) lines.push(`X-PHONETIC-FIRST-NAME:${escapeVCardValue(c.givenPhonetic)}`);
  if (c.org) lines.push(`ORG:${escapeVCardValue(c.org)}`);
  if (c.orgPhonetic) lines.push(`X-PHONETIC-ORG:${escapeVCardValue(c.orgPhonetic)}`);
  if (c.title) lines.push(`TITLE:${escapeVCardValue(c.title)}`);

  (c.tels || []).forEach(t => {
    const vt = TEL_TYPE_TO_VCARD[t.type] || 'OTHER';
    lines.push(`TEL;TYPE=${vt}:${escapeVCardValue(t.value)}`);
  });
  (c.emails || []).forEach(e => {
    const vt = EMAIL_TYPE_TO_VCARD[e.type] || 'OTHER';
    lines.push(`EMAIL;TYPE=${vt}:${escapeVCardValue(e.value)}`);
  });
  (c.addresses || []).forEach(a => {
    const vt = ADDR_TYPE_TO_VCARD[a.type] || 'OTHER';
    // Use street field for the formatted address (Google Contacts compatible)
    lines.push(`ADR;TYPE=${vt}:;;${escapeVCardValue(a.value)};;;;`);
  });
  (c.urls || []).forEach(u => {
    lines.push(`URL:${escapeVCardValue(u)}`);
  });
  if (c.birthday) lines.push(`BDAY:${escapeVCardValue(c.birthday)}`);
  if (c.note) lines.push(`NOTE:${escapeVCardValue(c.note)}`);

  lines.push('END:VCARD');
  return lines.map(foldLine).join('\r\n');
}

// ---------- Search & grouping ----------
function applySearch() {
  const q = normalizeForSearch(state.searchQuery);
  let list = state.contacts;

  if (q) {
    list = list.filter(c => {
      const idx = c._searchIndex || buildSearchIndex(c);
      return idx.includes(q);
    });
  }

  // Sort by furigana, then by displayName
  list.sort((a, b) => {
    const ka = normalizeForSearch(getSortKey(a));
    const kb = normalizeForSearch(getSortKey(b));
    if (ka < kb) return -1;
    if (ka > kb) return 1;
    return 0;
  });

  // Group by 50音
  const groups = GYO_LABELS.map((label) => ({ label, items: [] }));
  for (const c of list) {
    const key = getSortKey(c);
    const gi = getGyoIndex(key);
    groups[gi].items.push(c);
  }
  state.filteredGroups = groups.filter(g => g.items.length > 0);
}

// ---------- Rendering ----------
function renderGyoRail() {
  const rail = document.getElementById('gyo-rail');
  const activeLabels = new Set(state.filteredGroups.map(g => g.label));
  rail.innerHTML = GYO_LABELS.map(label => {
    const active = activeLabels.has(label);
    return `<button class="${active ? '' : 'disabled'}" data-gyo="${label}">${label}</button>`;
  }).join('');
}

function highlightText(text, query) {
  if (!query || !text) return escapeHTML(text);
  const normQ = normalizeForSearch(query);
  const normT = normalizeForSearch(text);
  const idx = normT.indexOf(normQ);
  if (idx < 0) return escapeHTML(text);

  // We need to map normalized index back to original. Since normalization is
  // 1-char-in-1-char-out for our transformations, indices align.
  const before = text.substring(0, idx);
  const match = text.substring(idx, idx + normQ.length);
  const after = text.substring(idx + normQ.length);
  return escapeHTML(before) + '<span class="highlight">' + escapeHTML(match) + '</span>' + escapeHTML(after);
}

function buildContactSubline(c, query) {
  // Show the field that matched the search, or default to org/tel/email
  if (query) {
    const normQ = normalizeForSearch(query);
    const candidates = [
      c.org, c.title,
      ...(c.tels || []).map(t => t.value),
      ...(c.emails || []).map(e => e.value),
      c.note,
    ].filter(Boolean);
    for (const cand of candidates) {
      if (normalizeForSearch(cand).includes(normQ)) {
        return highlightText(cand, query);
      }
    }
  }
  if (c.org) return escapeHTML(c.org);
  if (c.tels && c.tels[0]) return escapeHTML(c.tels[0].value);
  if (c.emails && c.emails[0]) return escapeHTML(c.emails[0].value);
  return '';
}

function renderList() {
  const pane = document.getElementById('list-pane');
  const empty = document.getElementById('list-empty');

  if (state.contacts.length === 0) {
    pane.innerHTML = '';
    pane.appendChild(empty);
    return;
  }

  if (state.filteredGroups.length === 0) {
    pane.innerHTML = `<div class="list-empty"><p>該当する連絡先がありません</p></div>`;
    return;
  }

  const q = state.searchQuery;
  const html = state.filteredGroups.map(group => {
    const items = group.items.map(c => {
      const isSelected = c.id === state.selectedId;
      const name = displayName(c);
      const furigana = fullFurigana(c);
      const subline = buildContactSubline(c, q);
      return `
        <div class="contact-item ${isSelected ? 'selected' : ''}" data-id="${c.id}">
          <p class="contact-name">${highlightText(name, q)}</p>
          ${furigana ? `<p class="contact-furigana">${highlightText(furigana, q)}</p>` : ''}
          ${subline ? `<p class="contact-subline">${subline}</p>` : ''}
        </div>
      `;
    }).join('');
    return `
      <div class="gyo-group" data-gyo="${group.label}">
        <div class="gyo-header">${group.label}　（${group.items.length}件）</div>
        ${items}
      </div>
    `;
  }).join('');

  pane.innerHTML = html;
}

function renderDetail() {
  const pane = document.getElementById('detail-pane');
  const c = state.contacts.find(x => x.id === state.selectedId);
  if (!c) {
    pane.innerHTML = `
      <div class="detail-empty">
        <svg class="detail-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <p>左のリストから連絡先を選んでください</p>
      </div>
    `;
    return;
  }

  const rows = [];
  if (c.org || c.title) {
    rows.push(`
      <div class="detail-section">
        ${c.org ? `<div class="detail-row"><div class="detail-label">会社</div><div class="detail-value">${escapeHTML(c.org)}</div></div>` : ''}
        ${c.title ? `<div class="detail-row"><div class="detail-label">役職</div><div class="detail-value">${escapeHTML(c.title)}</div></div>` : ''}
      </div>
    `);
  }
  if (c.tels && c.tels.length) {
    rows.push(`
      <div class="detail-section">
        ${c.tels.map(t => `
          <div class="detail-row">
            <div class="detail-label">${escapeHTML(t.type)}</div>
            <div class="detail-value"><a href="tel:${escapeHTML(t.value)}">${escapeHTML(t.value)}</a></div>
          </div>
        `).join('')}
      </div>
    `);
  }
  if (c.emails && c.emails.length) {
    rows.push(`
      <div class="detail-section">
        ${c.emails.map(e => `
          <div class="detail-row">
            <div class="detail-label">${escapeHTML(e.type)}</div>
            <div class="detail-value"><a href="mailto:${escapeHTML(e.value)}">${escapeHTML(e.value)}</a></div>
          </div>
        `).join('')}
      </div>
    `);
  }
  if (c.addresses && c.addresses.length) {
    rows.push(`
      <div class="detail-section">
        ${c.addresses.map(a => `
          <div class="detail-row">
            <div class="detail-label">${escapeHTML(a.type)}</div>
            <div class="detail-value">${escapeHTML(a.value)}</div>
          </div>
        `).join('')}
      </div>
    `);
  }
  if (c.urls && c.urls.length) {
    rows.push(`
      <div class="detail-section">
        ${c.urls.map(u => `
          <div class="detail-row">
            <div class="detail-label">URL</div>
            <div class="detail-value"><a href="${escapeHTML(u)}" target="_blank" rel="noopener">${escapeHTML(u)}</a></div>
          </div>
        `).join('')}
      </div>
    `);
  }
  if (c.birthday) {
    rows.push(`
      <div class="detail-section">
        <div class="detail-row">
          <div class="detail-label">誕生日</div>
          <div class="detail-value">${escapeHTML(c.birthday)}</div>
        </div>
      </div>
    `);
  }
  if (c.note) {
    rows.push(`
      <div class="detail-section">
        <div class="detail-row">
          <div class="detail-label">メモ</div>
          <div class="detail-value">${escapeHTML(c.note)}</div>
        </div>
      </div>
    `);
  }

  pane.innerHTML = `
    <div class="detail-header">
      <button class="detail-back" id="detail-back" aria-label="戻る">‹</button>
      <div class="detail-name-block">
        <h1 class="detail-name">${escapeHTML(displayName(c))}</h1>
        ${fullFurigana(c) ? `<p class="detail-furigana">${escapeHTML(fullFurigana(c))}</p>` : ''}
      </div>
      <div class="detail-actions">
        <button class="btn" id="detail-edit">編集</button>
      </div>
    </div>
    <div class="detail-sections">
      ${rows.length ? rows.join('') : '<div class="detail-empty" style="height:auto;padding:24px;">登録情報がありません</div>'}
    </div>
  `;

  // Show detail pane on narrow
  document.getElementById('detail-pane').classList.add('show');
}

function render() {
  applySearch();
  renderGyoRail();
  renderList();
  renderDetail();
  document.getElementById('search-clear').classList.toggle('show', !!state.searchQuery);
}

// ---------- Edit form ----------
const editState = {
  editingId: null,  // null = new
  draft: null,
};

function multiRowHTML(kind, item, idx) {
  if (kind === 'tels') {
    return `
      <div class="multi-row" data-idx="${idx}">
        <select data-field="type">${TEL_TYPES.map(t => `<option ${t === item.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="tel" data-field="value" value="${escapeHTML(item.value || '')}" placeholder="090-1234-5678">
        <button class="multi-remove" data-remove>×</button>
      </div>
    `;
  }
  if (kind === 'emails') {
    return `
      <div class="multi-row" data-idx="${idx}">
        <select data-field="type">${EMAIL_TYPES.map(t => `<option ${t === item.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="email" data-field="value" value="${escapeHTML(item.value || '')}" placeholder="name@example.com">
        <button class="multi-remove" data-remove>×</button>
      </div>
    `;
  }
  if (kind === 'addresses') {
    return `
      <div class="multi-row" data-idx="${idx}">
        <select data-field="type">${ADDR_TYPES.map(t => `<option ${t === item.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
        <input type="text" data-field="value" value="${escapeHTML(item.value || '')}" placeholder="〒810-0000 福岡市…">
        <button class="multi-remove" data-remove>×</button>
      </div>
    `;
  }
  if (kind === 'urls') {
    return `
      <div class="multi-row" data-idx="${idx}" style="grid-template-columns: 1fr auto;">
        <input type="url" data-field="value" value="${escapeHTML(item || '')}" placeholder="https://...">
        <button class="multi-remove" data-remove>×</button>
      </div>
    `;
  }
  return '';
}

function renderMultiList(kind) {
  const el = document.getElementById('f-' + kind);
  const items = editState.draft[kind] || [];
  el.innerHTML = items.map((item, idx) => multiRowHTML(kind, item, idx)).join('');
}

function openEdit(contact) {
  if (contact) {
    editState.editingId = contact.id;
    editState.draft = JSON.parse(JSON.stringify(contact));
    document.getElementById('edit-title').textContent = '連絡先を編集';
    document.getElementById('edit-delete').style.display = '';
  } else {
    editState.editingId = null;
    editState.draft = createBlank();
    document.getElementById('edit-title').textContent = '新規連絡先';
    document.getElementById('edit-delete').style.display = 'none';
  }
  const d = editState.draft;
  document.getElementById('f-family').value = d.family || '';
  document.getElementById('f-given').value = d.given || '';
  document.getElementById('f-family-phonetic').value = d.familyPhonetic || '';
  document.getElementById('f-given-phonetic').value = d.givenPhonetic || '';
  document.getElementById('f-org').value = d.org || '';
  document.getElementById('f-org-phonetic').value = d.orgPhonetic || '';
  document.getElementById('f-title').value = d.title || '';
  document.getElementById('f-birthday').value = d.birthday || '';
  document.getElementById('f-note').value = d.note || '';

  renderMultiList('tels');
  renderMultiList('emails');
  renderMultiList('addresses');
  renderMultiList('urls');

  document.getElementById('edit-modal').classList.add('show');
}

function readEditForm() {
  const d = editState.draft;
  d.family = document.getElementById('f-family').value.trim();
  d.given = document.getElementById('f-given').value.trim();
  d.familyPhonetic = toHiragana(document.getElementById('f-family-phonetic').value.trim());
  d.givenPhonetic = toHiragana(document.getElementById('f-given-phonetic').value.trim());
  d.org = document.getElementById('f-org').value.trim();
  d.orgPhonetic = toHiragana(document.getElementById('f-org-phonetic').value.trim());
  d.title = document.getElementById('f-title').value.trim();
  d.birthday = document.getElementById('f-birthday').value.trim();
  d.note = document.getElementById('f-note').value.trim();

  ['tels', 'emails', 'addresses'].forEach(kind => {
    const rows = document.querySelectorAll('#f-' + kind + ' .multi-row');
    const items = [];
    rows.forEach(row => {
      const type = row.querySelector('[data-field="type"]').value;
      const value = row.querySelector('[data-field="value"]').value.trim();
      if (value) items.push({ type, value });
    });
    d[kind] = items;
  });

  const urlRows = document.querySelectorAll('#f-urls .multi-row');
  const urls = [];
  urlRows.forEach(row => {
    const value = row.querySelector('[data-field="value"]').value.trim();
    if (value) urls.push(value);
  });
  d.urls = urls;

  // Update derived fields
  d.fn = [d.family, d.given].filter(Boolean).join(' ').trim() || d.org || '';
  d.updatedAt = Date.now();
}

async function saveEdit() {
  readEditForm();
  const d = editState.draft;
  if (!d.family && !d.given && !d.org && !(d.tels && d.tels.length) && !(d.emails && d.emails.length)) {
    showToast('名前か会社、電話番号、メールのいずれかを入力してください');
    return;
  }
  d._searchIndex = buildSearchIndex(d);
  await dbPut(d);

  // Update local state
  const idx = state.contacts.findIndex(c => c.id === d.id);
  if (idx >= 0) state.contacts[idx] = d;
  else state.contacts.push(d);
  state.selectedId = d.id;

  closeEdit();
  render();
  showToast(editState.editingId ? '保存しました' : '追加しました');
}

function closeEdit() {
  document.getElementById('edit-modal').classList.remove('show');
}

async function deleteCurrent() {
  const id = editState.editingId;
  if (!id) return;
  const confirmed = await showConfirm('削除します', 'この連絡先を削除してもよろしいですか？');
  if (!confirmed) return;
  await dbDelete(id);
  state.contacts = state.contacts.filter(c => c.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  closeEdit();
  render();
  showToast('削除しました');
}

// ---------- Import ----------
async function readFileAs(file, encoding) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    if (encoding) reader.readAsText(file, encoding);
    else reader.readAsText(file);
  });
}

function isDuplicate(newCard, existing) {
  const newName = (displayName(newCard) || '').trim();
  const newTels = new Set((newCard.tels || []).map(t => (t.value || '').replace(/[^0-9]/g, '')).filter(Boolean));
  if (!newName || newTels.size === 0) return null;

  for (const ex of existing) {
    const exName = (displayName(ex) || '').trim();
    if (exName !== newName) continue;
    const exTels = new Set((ex.tels || []).map(t => (t.value || '').replace(/[^0-9]/g, '')).filter(Boolean));
    for (const t of newTels) {
      if (exTels.has(t)) return ex;
    }
  }
  return null;
}

async function importFiles(files) {
  const resultEl = document.getElementById('import-result');
  const summaryEl = document.getElementById('import-summary');
  const logEl = document.getElementById('import-log');
  const doneBtn = document.getElementById('import-done');
  resultEl.style.display = 'block';
  summaryEl.innerHTML = '取込中...';
  logEl.textContent = '';
  doneBtn.style.display = 'none';

  let added = 0;
  let skipped = 0;
  let parseError = 0;
  const logs = [];

  for (const file of files) {
    let text;
    try {
      text = await readFileAs(file);
      // If contains many � replacement chars, retry as Shift_JIS
      if ((text.match(/\uFFFD/g) || []).length > 5) {
        try { text = await readFileAs(file, 'shift_jis'); } catch (e) {}
      }
    } catch (e) {
      parseError++;
      logs.push(`✗ ${file.name}: 読み取りエラー`);
      continue;
    }

    let cards;
    try {
      cards = parseVCards(text);
    } catch (e) {
      parseError++;
      logs.push(`✗ ${file.name}: 解析エラー (${e.message})`);
      continue;
    }

    logs.push(`― ${file.name}: ${cards.length}件 検出`);

    const toAdd = [];
    for (const card of cards) {
      const dup = isDuplicate(card, state.contacts.concat(toAdd));
      if (dup) {
        skipped++;
        logs.push(`  ⊘ 重複でスキップ: ${displayName(card)}`);
        continue;
      }
      card._searchIndex = buildSearchIndex(card);
      toAdd.push(card);
    }

    if (toAdd.length) {
      try {
        await dbPutMany(toAdd);
        state.contacts.push(...toAdd);
        added += toAdd.length;
      } catch (e) {
        parseError++;
        logs.push(`✗ 保存エラー: ${e.message}`);
      }
    }
  }

  const lines = [];
  lines.push(`<strong>追加: ${added}件</strong>`);
  if (skipped > 0) lines.push(`スキップ: ${skipped}件`);
  if (parseError > 0) lines.push(`エラー: ${parseError}件`);
  summaryEl.innerHTML = lines.join('　');
  logEl.textContent = logs.join('\n');
  doneBtn.style.display = '';

  render();
}

// ---------- Export ----------
function exportAllAsVCard() {
  if (state.contacts.length === 0) {
    showToast('連絡先がありません');
    return;
  }
  const vcfData = state.contacts.map(c => generateVCard(c)).join('\r\n');
  // Prepend BOM for compatibility with apps that don't auto-detect UTF-8
  const blob = new Blob(['\uFEFF' + vcfData], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  a.href = url;
  a.download = `tobi-contacts-${ts}.vcf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`${state.contacts.length}件を書き出しました`);
}

// ---------- Toast & Confirm ----------
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

function showConfirm(title, message) {
  return new Promise((resolve) => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const modal = document.getElementById('confirm-modal');
    modal.classList.add('show');
    const onCancel = () => { cleanup(); resolve(false); };
    const onOk = () => { cleanup(); resolve(true); };
    function cleanup() {
      modal.classList.remove('show');
      document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
      document.getElementById('confirm-ok').removeEventListener('click', onOk);
    }
    document.getElementById('confirm-cancel').addEventListener('click', onCancel);
    document.getElementById('confirm-ok').addEventListener('click', onOk);
  });
}

// ---------- Event wiring ----------
function setupEvents() {
  // Search
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    render();
  });
  document.getElementById('search-clear').addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    render();
    searchInput.focus();
  });

  // Gyo rail
  document.getElementById('gyo-rail').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-gyo]');
    if (!btn || btn.classList.contains('disabled')) return;
    const label = btn.dataset.gyo;
    const target = document.querySelector(`.gyo-group[data-gyo="${label}"]`);
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // List
  document.getElementById('list-pane').addEventListener('click', (e) => {
    const item = e.target.closest('.contact-item');
    if (!item) {
      // Could be inside empty-state button
      if (e.target.id === 'empty-import') {
        openImport();
      }
      return;
    }
    state.selectedId = item.dataset.id;
    render();
  });

  // Header buttons
  document.getElementById('btn-new').addEventListener('click', () => openEdit(null));
  document.getElementById('btn-import').addEventListener('click', () => openImport());
  document.getElementById('btn-export').addEventListener('click', () => exportAllAsVCard());

  // Detail pane
  document.getElementById('detail-pane').addEventListener('click', (e) => {
    if (e.target.id === 'detail-edit') {
      const c = state.contacts.find(x => x.id === state.selectedId);
      if (c) openEdit(c);
    }
    if (e.target.id === 'detail-back') {
      document.getElementById('detail-pane').classList.remove('show');
    }
  });

  // Edit modal
  document.getElementById('edit-cancel').addEventListener('click', closeEdit);
  document.getElementById('edit-save').addEventListener('click', saveEdit);
  document.getElementById('edit-delete').addEventListener('click', deleteCurrent);

  // Multi-add buttons
  document.querySelectorAll('.multi-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.add;
      if (!editState.draft[kind]) editState.draft[kind] = [];
      if (kind === 'urls') {
        editState.draft.urls.push('');
      } else if (kind === 'tels') {
        editState.draft.tels.push({ type: '携帯', value: '' });
      } else if (kind === 'emails') {
        editState.draft.emails.push({ type: '個人', value: '' });
      } else if (kind === 'addresses') {
        editState.draft.addresses.push({ type: '自宅', value: '' });
      }
      readEditForm();
      renderMultiList(kind);
    });
  });

  // Multi-remove (delegated)
  ['tels', 'emails', 'addresses', 'urls'].forEach(kind => {
    document.getElementById('f-' + kind).addEventListener('click', (e) => {
      if (e.target.matches('[data-remove]')) {
        readEditForm();
        const row = e.target.closest('.multi-row');
        const idx = parseInt(row.dataset.idx, 10);
        editState.draft[kind].splice(idx, 1);
        renderMultiList(kind);
      }
    });
  });

  // Import modal
  document.getElementById('import-close').addEventListener('click', closeImport);
  document.getElementById('import-done').addEventListener('click', closeImport);
  const fileInput = document.getElementById('import-file');
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) importFiles(Array.from(e.target.files));
  });
  const dropZone = document.getElementById('import-drop');
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => /\.vcf$/i.test(f.name) || /vcard/i.test(f.type));
    if (files.length) importFiles(files);
  });
}

function openImport() {
  document.getElementById('import-result').style.display = 'none';
  document.getElementById('import-done').style.display = 'none';
  document.getElementById('import-file').value = '';
  document.getElementById('import-modal').classList.add('show');
}
function closeImport() {
  document.getElementById('import-modal').classList.remove('show');
}

// ---------- Boot ----------
async function boot() {
  try {
    const contacts = await dbGetAll();
    // Backfill search index if missing
    contacts.forEach(c => {
      if (!c._searchIndex) c._searchIndex = buildSearchIndex(c);
    });
    state.contacts = contacts;
  } catch (e) {
    console.error('DB load failed', e);
    showToast('データの読み込みに失敗しました');
  }
  setupEvents();
  render();

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW register failed', err));
  }
}

document.addEventListener('DOMContentLoaded', boot);
