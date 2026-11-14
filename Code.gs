/**
 * Claude AI Class — Attendance backend (Google Apps Script + Google Sheets)
 * ---------------------------------------------------------------------------
 * วิธีใช้ (ย่อ) — ดูรายละเอียดใน README.md
 *  1) สร้าง Google Sheet ใหม่ > ส่วนขยาย > Apps Script > วางไฟล์นี้
 *  2) แก้ ADMIN_KEY ด้านล่าง แล้วกด Run ฟังก์ชัน setup() หนึ่งครั้ง (อนุญาตสิทธิ์)
 *  3) Deploy > New deployment > Web app
 *       Execute as: Me   |   Who has access: Anyone
 *  4) คัดลอก Web app URL ไปใส่ใน config.js ของหน้าเว็บ
 */

// ===== ตั้งค่า =====
const ADMIN_KEY = 'CHANGE-ME-1234';          // รหัสผู้ดูแล (นำเข้า/ลบรายชื่อ, ตั้งค่า) — เปลี่ยนก่อนใช้งาน!
const SHEET_ID = '';                         // เว้นว่าง = ใช้ Google Sheet ที่ผูกกับสคริปต์นี้
const SIGNATURE_FOLDER = 'Claude AI Class - Signatures';
const TZ = 'Asia/Bangkok';

// ===== โครงสร้างชีต (ลำดับคอลัมน์ห้ามสลับ; แก้ชื่อหัวคอลัมน์ได้) =====
const SHEETS = {
  Roster: {
    keys:    ['id', 'no', 'name', 'dept', 'org', 'phone', 'email', 'note'],
    headers: ['ID', 'ลำดับ', 'ชื่อ-นามสกุล', 'ตำแหน่ง/แผนก', 'บริษัท', 'เบอร์โทร', 'อีเมล', 'หมายเหตุ'],
    widths:  [90, 60, 220, 180, 240, 120, 220, 220]
  },
  Checkins: {
    keys:    ['key', 'date', 'rosterId', 'no', 'name', 'org', 'dept', 'time', 'timeText', 'status', 'lateMin', 'signatureUrl', 'signatureId'],
    headers: ['Key', 'วันที่เรียน', 'ID', 'ลำดับ', 'ชื่อ-นามสกุล', 'บริษัท', 'ตำแหน่ง/แผนก', 'เวลา (ISO)', 'เวลาเช็คชื่อ', 'สถานะ', 'สาย (นาที)', 'ลายเซ็น', 'SignatureFileId'],
    widths:  [150, 100, 70, 60, 220, 240, 180, 190, 110, 90, 80, 260, 120]
  },
  Config: {
    keys:    ['key', 'value'],
    headers: ['ค่า', 'ข้อมูล'],
    widths:  [160, 260]
  }
};
const DEFAULT_CONFIG = { className: 'Claude AI Class', startTime: '09:00', grace: '10' };

// ===== Setup (รันครั้งแรกครั้งเดียว) =====
function setup() {
  Object.keys(SHEETS).forEach(name => sheet_(name));
  const cfg = readConfig_();
  const sh = sheet_('Config');
  Object.keys(DEFAULT_CONFIG).forEach(k => { if (cfg[k] === undefined) sh.appendRow([k, String(DEFAULT_CONFIG[k])]); });
  const cs = sheet_('Checkins');
  cs.hideColumns(1); cs.hideColumns(8); cs.hideColumns(13);        // ซ่อนคอลัมน์ระบบ
  sheet_('Roster').hideColumns(1);
  signatureFolder_();
  const def = ss_().getSheetByName('Sheet1') || ss_().getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss_().getSheets().length > 1) ss_().deleteSheet(def);
  Logger.log('✅ Setup เสร็จแล้ว: ' + ss_().getUrl());
}

// ===== HTTP =====
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'state';
    if (action === 'state') return json_(Object.assign({ ok: true }, state_(p.date || today_())));
    if (action === 'sig')   return json_({ ok: true, dataUrl: signature_(p.date, p.id) });
    if (action === 'ping')  return json_({ ok: true, time: new Date().toISOString() });
    return json_({ ok: false, error: 'unknown_action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const isAdmin = !!b.key && b.key === ADMIN_KEY;

    // ---- ทุกคนเรียกได้ ----
    if (b.action === 'checkin')   return json_(checkin_(b.checkin || {}, isAdmin));
    if (b.action === 'verifyKey') return json_({ ok: isAdmin, sheetUrl: isAdmin ? ss_().getUrl() : '' });

    // ---- เฉพาะผู้ดูแล ----
    if (!isAdmin) return json_({ ok: false, error: 'unauthorized' });
    switch (b.action) {
      case 'putPerson':    upsertPeople_([b.person]); return json_({ ok: true });
      case 'importRoster': return json_(importRoster_(b.people || [], b.mode));
      case 'delPerson':    deleteWhere_('Roster', r => r.id === b.id); return json_({ ok: true });
      case 'clearRoster':  clearSheet_('Roster'); return json_({ ok: true });
      case 'delCheckin':   deleteWhere_('Checkins', r => r.key === b.date + '__' + b.id); return json_({ ok: true });
      case 'resetDay':     deleteWhere_('Checkins', r => r.date === b.date); return json_({ ok: true });
      case 'putConfig':    writeConfig_(b.config || {}); return json_({ ok: true });
      default:             return json_({ ok: false, error: 'unknown_action' });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// ===== Logic =====
function state_(date) {
  const roster = rows_('Roster').map(r => ({ id: r.id, no: Number(r.no) || null, name: r.name, dept: r.dept, org: r.org }));
  const checkins = rows_('Checkins').filter(r => r.date === date).map(r => ({
    date: r.date, rosterId: r.rosterId, name: r.name, time: r.time, hasSig: !!r.signatureId
  }));
  return { config: readConfig_(), roster: roster, checkins: checkins, date: date, serverTime: new Date().toISOString() };
}

function checkin_(c, isAdmin) {
  const date = String(c.date || today_());
  const person = rows_('Roster').find(r => r.id === c.rosterId);
  if (!person) return { ok: false, error: 'not_in_roster' };
  const key = date + '__' + person.id;
  const existing = rows_('Checkins').find(r => r.key === key);
  if (existing) return { ok: true, existing: true, checkin: { date: date, rosterId: person.id, time: existing.time } };

  const now = new Date();                                  // ใช้เวลาของเซิร์ฟเวอร์ (แก้เวลาเครื่องไม่ได้)
  const cfg = readConfig_();
  const lateMin = lateMinutes_(date, now, cfg.startTime);
  const late = lateMin > (Number(cfg.grace) || 0);

  let sigId = '', sigUrl = '';
  if (c.signature && /^data:image\/png;base64,/.test(c.signature)) {
    const bytes = Utilities.base64Decode(c.signature.split(',')[1]);
    const blob = Utilities.newBlob(bytes, 'image/png', date + '_' + (person.no || '') + '_' + person.name + '.png');
    const file = signatureFolder_().createFile(blob);
    sigId = file.getId(); sigUrl = file.getUrl();
  }
  appendObj_('Checkins', {
    key: key, date: date, rosterId: person.id, no: person.no, name: person.name, org: person.org, dept: person.dept,
    time: now.toISOString(), timeText: Utilities.formatDate(now, TZ, 'HH:mm:ss'),
    status: late ? 'มาสาย' : 'ตรงเวลา', lateMin: String(Math.max(0, lateMin)),
    signatureUrl: sigUrl, signatureId: sigId
  });
  return { ok: true, checkin: { date: date, rosterId: person.id, time: now.toISOString() } };
}

function signature_(date, id) {
  const r = rows_('Checkins').find(x => x.key === date + '__' + id);
  if (!r || !r.signatureId) return '';
  const blob = DriveApp.getFileById(r.signatureId).getBlob();
  return 'data:image/png;base64,' + Utilities.base64Encode(blob.getBytes());
}

function importRoster_(people, mode) {
  if (mode === 'replace') clearSheet_('Roster');
  const existing = rows_('Roster');
  const seen = new Set(existing.map(r => normName_(r.name)));
  let maxNo = existing.reduce((m, r) => Math.max(m, Number(r.no) || 0), 0);
  const add = [];
  people.forEach(p => {
    const n = normName_(p.name);
    if (!n || seen.has(n)) return;
    seen.add(n);
    add.push({ id: p.id || newId_(), no: p.no || ++maxNo, name: p.name, dept: p.dept || '', org: p.org || '',
               phone: p.phone || '', email: p.email || '', note: p.note || '' });
    if (p.no) maxNo = Math.max(maxNo, Number(p.no));
  });
  if (add.length) {
    const sh = sheet_('Roster');
    const values = add.map(o => SHEETS.Roster.keys.map(k => o[k] === undefined || o[k] === null ? '' : String(o[k])));
    sh.getRange(sh.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
  }
  return { ok: true, added: add.length, skipped: people.length - add.length };
}

function upsertPeople_(list) {
  const sh = sheet_('Roster');
  const all = rows_('Roster');
  list.forEach(p => {
    if (!p || !p.name) return;
    const row = all.find(r => r.id === p.id);
    const o = { id: p.id || newId_(), no: p.no || '', name: p.name, dept: p.dept || '', org: p.org || '',
                phone: p.phone || (row ? row.phone : ''), email: p.email || (row ? row.email : ''), note: p.note || (row ? row.note : '') };
    const values = [SHEETS.Roster.keys.map(k => String(o[k] === undefined ? '' : o[k]))];
    if (row) sh.getRange(row._row, 1, 1, values[0].length).setValues(values);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, values[0].length).setValues(values);
  });
}

// ===== Helpers =====
function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name) {
  const def = SHEETS[name];
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers])
      .setFontWeight('bold').setBackground('#059669').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), def.headers.length).setNumberFormat('@'); // เก็บเป็นข้อความ (กันเลข 0 หน้าเบอร์หาย/วันที่เพี้ยน)
    def.widths.forEach((w, i) => sh.setColumnWidth(i + 1, w));
  }
  return sh;
}

function rows_(name) {
  const def = SHEETS[name];
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, def.keys.length).getValues();
  const out = [];
  values.forEach((r, i) => {
    if (r.every(v => v === '' || v === null)) return;
    const o = { _row: i + 2 };
    def.keys.forEach((k, j) => {
      let v = r[j];
      if (v instanceof Date) v = (k === 'date') ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : v.toISOString();
      o[k] = (v === null || v === undefined) ? '' : String(v).trim();
    });
    out.push(o);
  });
  return out;
}

function appendObj_(name, obj) {
  const sh = sheet_(name);
  const values = [SHEETS[name].keys.map(k => obj[k] === undefined || obj[k] === null ? '' : String(obj[k]))];
  sh.getRange(sh.getLastRow() + 1, 1, 1, values[0].length).setValues(values);
}

function deleteWhere_(name, pred) {
  const sh = sheet_(name);
  rows_(name).filter(pred).map(r => r._row).sort((a, b) => b - a).forEach(row => sh.deleteRow(row));
}

function clearSheet_(name) {
  const sh = sheet_(name);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
}

function readConfig_() {
  const cfg = {};
  rows_('Config').forEach(r => { if (r.key) cfg[r.key] = r.value; });
  Object.keys(DEFAULT_CONFIG).forEach(k => { if (cfg[k] === undefined || cfg[k] === '') cfg[k] = DEFAULT_CONFIG[k]; });
  return cfg;
}

function writeConfig_(c) {
  const sh = sheet_('Config');
  const rows = rows_('Config');
  ['className', 'startTime', 'grace'].forEach(k => {
    if (c[k] === undefined) return;
    const r = rows.find(x => x.key === k);
    if (r) sh.getRange(r._row, 2).setValue(String(c[k]));
    else sh.appendRow([k, String(c[k])]);
  });
}

function lateMinutes_(date, now, startTime) {
  const hm = String(startTime || '09:00').split(':');
  const start = new Date(date + 'T' + ('0' + hm[0]).slice(-2) + ':' + ('0' + (hm[1] || '0')).slice(-2) + ':00+07:00');
  return Math.floor((now.getTime() - start.getTime()) / 60000);
}

function signatureFolder_() {
  const it = DriveApp.getFoldersByName(SIGNATURE_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.createFolder(SIGNATURE_FOLDER);
}

function today_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function newId_() { return 'p' + Utilities.getUuid().replace(/-/g, '').slice(0, 10); }
function normName_(s) {
  return String(s || '').replace(/\s+/g, ' ').trim().replace(/^(นางสาว|นาง|นาย|น\.ส\.|ดร\.|mr\.|ms\.|mrs\.)\s*/i, '').toLowerCase();
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
