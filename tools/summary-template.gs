/**
 * ชีตสรุป Dashboard PPIM Solar 2569 (กฟน.1) — สำหรับนำไปทำกราฟใน Canva
 * -----------------------------------------------------------------------
 * ⚠ ไฟล์นี้สร้างอัตโนมัติด้วย `node tools/build-summary-gs.js` (build __BUILD_DATE__)
 *   ห้ามแก้ไฟล์ apps-script-summary.gs ตรง ๆ — แก้ที่ tools/summary-template.gs แล้ว build ใหม่
 *   ตรรกะจัดขั้น/จุดรวมงาน/SLA/มิเตอร์ คัดลอกจาก index.html ทุกครั้งที่ build → ตัวเลขตรงกับ Dashboard
 *
 * ติดตั้ง (ครั้งเดียว):
 *   1) เปิด Google Sheet สรุป → ส่วนขยาย (Extensions) → Apps Script
 *   2) ลบโค้ดเดิม วางไฟล์นี้ทั้งไฟล์ → บันทึก
 *   3) เลือกฟังก์ชัน `setup` → Run → อนุญาตสิทธิ์ (อ่านชีต PPIM + เขียนชีตนี้ + ตั้งเวลา)
 *   → ระบบสร้าง tab สรุปทั้งหมด + ตั้งเวลาอัปเดตทุกวัน 07:00 น. (เวลาไทย)
 *   อัปเดตเองได้ทุกเมื่อ: เมนู "📊 สรุป PPIM" → อัปเดตตอนนี้
 *
 * ชีตนี้อ่านอย่างเดียวจากชีตหลัก (ไม่แก้ข้อมูล PPIM) และเก็บเฉพาะตัวเลขสรุป — ไม่มีข้อมูลส่วนบุคคล
 */

var SRC_SHEET_ID     = '15MinRHg79n2zToLiOsacmm2Br7N9FUIEaHOxl2eqelo';   // ชีตหลัก "PPIM Solar"
var SRC_MAIN_TAB     = 'PPIM Solar Update';
var SRC_SLA_SHEET_ID = '1SFqBINbiTy7OsQ_OrDLzv_8slFymddakAkpgAcnWKXE';   // ชีต SLA/Grid (เติมวันที่ข้ามชีต เหมือน Dashboard)
var TZ               = 'Asia/Bangkok';
var UPDATE_HOUR      = 7;                                              // อัปเดตทุกวันเวลา 07:00 น.

var TAB = {
  info:    'อัปเดต',
  pipe:    'Pipeline',
  hubStep: 'จุดรวมงาน×ขั้น',
  slaCeo:  'SLA แยก CEO',
  slaHub:  'SLA แยกจุดรวมงาน',
  meter:   'สถานะมิเตอร์',
  meterHub:'มิเตอร์แยกจุดรวมงาน',
  hist:    'ประวัติรายวัน'
};

/* ================= ตรรกะจาก Dashboard (index.html) ================= */
// ตัวแปรกลางที่ฟังก์ชันจาก index.html อ้างถึง
var headers = [], rows = [], slaRows = null;
function hubMapping(){ return DEFAULT_HUB_MAP; }   // Dashboard รวมค่าที่ตั้งเองใน localStorage ด้วย — ชีตสรุปใช้ค่าตั้งต้น

/*__DASHBOARD_LOGIC__*/

/* ================= เมนู / ติดตั้ง ================= */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('📊 สรุป PPIM')
    .addItem('อัปเดตตอนนี้', 'updateSummary')
    .addItem('ตั้งเวลาอัปเดตทุกวันใหม่', 'installTrigger')
    .addToUi();
}
function setup() {
  installTrigger();
  updateSummary();
}
function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === 'updateSummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('updateSummary').timeBased().everyDays(1).atHour(UPDATE_HOUR).inTimezone(TZ).create();
}

/* ================= อ่านข้อมูล (แบบเดียวกับ action 'data' ใน apps-script-meter.gs) ================= */
function readValues_(id, tab) {
  var ss = SpreadsheetApp.openById(id);
  var sh = tab ? ss.getSheetByName(tab) : ss.getSheets()[0];
  if (!sh) throw new Error('ไม่พบ tab "' + tab + '" ในชีตต้นทาง');
  var vals = sh.getDataRange().getValues();
  if (!vals.length) return { headers: [], data: [] };
  var hd = vals[0].map(function(x){ return String(x).trim(); });
  var data = [];
  for (var r = 1; r < vals.length; r++) {
    var o = {};
    hd.forEach(function(h, i){
      var c = vals[r][i];
      o[h] = (c instanceof Date) ? Utilities.formatDate(c, TZ, 'yyyy-MM-dd HH:mm:ss') : (c == null ? '' : String(c));
    });
    data.push(o);
  }
  return { headers: hd, data: data };
}
function loadRows_() {
  var m = readValues_(SRC_SHEET_ID, SRC_MAIN_TAB);
  headers = m.headers;
  rows = buildRowsFrom(m.data, computeMapping(headers));
  slaRows = null;
  try {
    var s = readValues_(SRC_SLA_SHEET_ID, null);
    if (s.headers.length) slaRows = buildRowsFrom(s.data, computeMapping(s.headers));
  } catch (e) { console.warn('อ่านชีต SLA ไม่ได้: ' + e.message); }
  mergeRows();
  return rows;
}

/* ================= คำนวณสรุป ================= */
var r1_ = function(v){ return Math.round(v * 10) / 10; };
var pct_ = function(a, b){ return b ? r1_(a / b * 100) : 0; };
var avg_ = function(a){ return a.length ? Math.round(a.reduce(function(s, v){ return s + v; }, 0) / a.length) : ''; };
var kwSum_ = function(L){ return r1_(L.reduce(function(s, r){ return s + (r.kw || 0); }, 0)); };
var hubOf_ = function(r){ return reqHub(r) || 'ไม่ระบุจุดรวมงาน'; };
var STEP_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
var stepLabel_ = function(s){ return s + '. ' + STEP_DISP[s]; };

function pipelineTable_(R) {
  var out = [['ขั้น', 'สถานะ', 'จำนวนคำขอ', 'kW', '% ของคำขอทั้งหมด']];
  STEP_IDS.forEach(function(s){
    var L = R.filter(function(r){ return r.step === s; });
    out.push([s, STEP_DISP[s], L.length, kwSum_(L), pct_(L.length, R.length)]);
  });
  var c = R.filter(function(r){ return r.step === 0; });
  out.push([0, 'ไม่ผ่าน/ยกเลิก', c.length, kwSum_(c), pct_(c.length, R.length)]);
  var u = R.filter(function(r){ return r.step == null; });
  if (u.length) out.push(['', 'ไม่ทราบสถานะ', u.length, kwSum_(u), pct_(u.length, R.length)]);
  out.push(['', 'รวม', R.length, kwSum_(R), 100]);
  return out;
}

function hubStepTable_(R) {
  var hubs = HUB_LIST.slice();
  R.forEach(function(r){ var h = hubOf_(r); if (hubs.indexOf(h) < 0) hubs.push(h); });
  var out = [['จุดรวมงาน'].concat(STEP_IDS.map(stepLabel_), ['ไม่ผ่าน/ยกเลิก', 'รวมคำขอ', 'kW รวม', 'COD แล้ว (%)'])];
  hubs.forEach(function(h){
    var L = R.filter(function(r){ return hubOf_(r) === h; });
    if (!L.length && h === 'ไม่ระบุจุดรวมงาน') return;
    var cnt = STEP_IDS.map(function(s){ return L.filter(function(r){ return r.step === s; }).length; });
    var cod = cnt[9];
    out.push([h].concat(cnt, [L.filter(function(r){ return r.step === 0; }).length, L.length, kwSum_(L), pct_(cod, L.length)]));
  });
  var tot = ['รวมทั้งเขต'].concat(STEP_IDS.map(function(s){ return R.filter(function(r){ return r.step === s; }).length; }));
  tot.push(R.filter(function(r){ return r.step === 0; }).length, R.length, kwSum_(R), pct_(tot[10], R.length));
  out.push(tot);
  return out;
}

// SLA: นับเฉพาะงานที่อยู่ในช่วง SLA (ขั้น 1–3, ไม่รวมยกเลิก) — เหมือน slaPick()/slaStat() ใน Dashboard
function slaRow_(name, L) {
  var b = function(k){ return L.filter(function(r){ return r.sla.band === k; }).length; };
  var s = slaStat(L);
  var rev = L.filter(function(r){ return r.sla.phase === 'review'; }), con = L.filter(function(r){ return r.sla.phase === 'contract'; });
  var ok = function(X){ return X.length ? pct_(X.filter(function(r){ return r.sla.band !== 'over'; }).length, X.length) : ''; };
  return [name, b('green'), b('yellow'), b('red'), b('over'), s.t, r1_(s.pct), s.avgUse, rev.length, ok(rev), con.length, ok(con)];
}
var SLA_HEAD = ['ชื่อ', '≤10 วัน', '11–20 วัน', '21–30 วัน', 'เกิน 30 วัน', 'งานใน SLA', 'ในเกณฑ์ SLA (%)', 'ใช้เวลาเฉลี่ย (% ของ 30 วัน)',
                'ตรวจสอบ/พิจารณา (งาน)', 'ตรวจสอบ/พิจารณา ในเกณฑ์ (%)', 'ทำสัญญา/ชำระเงิน (งาน)', 'ทำสัญญา/ชำระเงิน ในเกณฑ์ (%)'];
function slaInScope_(R) { return R.filter(function(r){ return r.step !== 0 && r.sla && r.sla.band; }); }
function slaCeoTable_(R) {
  var S = slaInScope_(R), out = [['CEO'].concat(SLA_HEAD.slice(1))];
  CEO_LIST.forEach(function(c){ out.push(slaRow_('CEO ' + c, S.filter(function(r){ return rowCEO(r) === c; }))); });
  var none = S.filter(function(r){ return !rowCEO(r); });
  if (none.length) out.push(slaRow_('ไม่ระบุ CEO', none));
  out.push(slaRow_('รวมทั้งเขต', S));
  return out;
}
function slaHubTable_(R) {
  var S = slaInScope_(R), out = [['จุดรวมงาน'].concat(SLA_HEAD.slice(1))];
  var hubs = HUB_LIST.slice(); S.forEach(function(r){ var h = hubOf_(r); if (hubs.indexOf(h) < 0) hubs.push(h); });
  hubs.forEach(function(h){ var L = S.filter(function(r){ return hubOf_(r) === h; }); if (L.length) out.push(slaRow_(h, L)); });
  out.push(slaRow_('รวมทั้งเขต', S));
  return out;
}

// สถานะงานมิเตอร์ — METER_FLOW เดียวกับการ์ดหน้าสับเปลี่ยนมิเตอร์
function meterTable_(R) {
  var out = [['สถานะ', 'ผู้รับผิดชอบ', 'จำนวน (ราย)', '% ของงานขั้น 8+', 'รอเฉลี่ย (วัน)', 'รอนานสุด (วัน)', 'ค้างเกิน ' + METER_AGE_WARN + ' วัน', 'นับวันรอจาก', 'หมายเหตุ']];
  var st = METER_FLOW.map(function(x){ var L = R.filter(x.f); return { x: x, L: L, ages: L.map(x.age).filter(function(v){ return v != null; }) }; });
  var tot = st.filter(function(s){ return !s.x.parallel; }).reduce(function(a, s){ return a + s.L.length; }, 0);
  st.forEach(function(s){
    var x = s.x;
    out.push([x.ic + ' ' + x.l, x.who || '', s.L.length, x.parallel ? '' : pct_(s.L.length, tot), avg_(s.ages),
              s.ages.length ? Math.max.apply(null, s.ages) : '', s.ages.filter(function(v){ return v > METER_AGE_WARN; }).length,
              x.since || '', x.parallel ? 'งานคู่ขนาน (ไม่นับรวมยอด)' : '']);
    if (x.k === 'swap') {
      var rd = s.L.filter(function(r){ return r.caCreated; }).length;
      out.push(['   ↳ ✅ พร้อมเปลี่ยน (มี CA 82 + จัดสรรแล้ว)', '', rd, pct_(rd, s.L.length), '', '', '', '', '% ของรอสับเปลี่ยน']);
      out.push(['   ↳ ⛔ ยังไม่พร้อม (ขาด CA 82)', '', s.L.length - rd, pct_(s.L.length - rd, s.L.length), '', '', '', '', '% ของรอสับเปลี่ยน']);
    }
  });
  out.push(['รวมงานขั้น 8 ขึ้นไป', '', tot, 100, '', '', '', '', '']);
  return out;
}
function meterHubTable_(R) {
  var main = METER_FLOW.filter(function(x){ return !x.parallel; }), par = METER_FLOW.filter(function(x){ return x.parallel; });
  var out = [['จุดรวมงาน'].concat(main.map(function(x){ return x.l; }), ['รวมขั้น 8+'], par.map(function(x){ return x.l + ' (คู่ขนาน)'; }))];
  var R8 = R.filter(function(r){ return r.step >= 8; });
  var hubs = HUB_LIST.slice(); R8.forEach(function(r){ var h = hubOf_(r); if (hubs.indexOf(h) < 0) hubs.push(h); });
  var line = function(name, L){
    var m = main.map(function(x){ return L.filter(x.f).length; });
    return [name].concat(m, [m.reduce(function(a, b){ return a + b; }, 0)], par.map(function(x){ return L.filter(x.f).length; }));
  };
  hubs.forEach(function(h){ var L = R8.filter(function(r){ return hubOf_(r) === h; }); if (L.length || HUB_LIST.indexOf(h) >= 0) out.push(line(h, L)); });
  out.push(line('รวมทั้งเขต', R8));
  return out;
}

/* ================= เขียนลงชีต ================= */
function thaiDate_(d) {
  var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var p = Utilities.formatDate(d, TZ, 'd|M|yyyy|HH:mm').split('|');
  return p[0] + ' ' + M[+p[1] - 1] + ' ' + (+p[2] + 543) + ' เวลา ' + p[3] + ' น.';
}
function writeTab_(ss, name, table, note) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  var w = table.reduce(function(m, r){ return Math.max(m, r.length); }, 0);
  var t = table.map(function(r){ while (r.length < w) r.push(''); return r; });
  sh.getRange(1, 1, t.length, w).setValues(t);
  sh.getRange(1, 1, 1, w).setFontWeight('bold').setBackground('#74045F').setFontColor('#ffffff').setWrap(true);
  sh.setFrozenRows(1);
  var last = t[t.length - 1][0];
  if (/^รวม/.test(String(last))) sh.getRange(t.length, 1, 1, w).setFontWeight('bold').setBackground('#F3E8F7');
  if (note) sh.getRange(t.length + 2, 1).setValue(note).setFontColor('#666666').setFontStyle('italic');
  sh.autoResizeColumns(1, w);
  return sh;
}

function updateSummary() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date(), upd = thaiDate_(now);
  var R = loadRows_();
  var stamp = 'ข้อมูล ณ ' + upd + ' · ที่มา: ชีต PPIM Solar (ตรรกะเดียวกับ Dashboard)';

  var pipe = pipelineTable_(R);
  writeTab_(ss, TAB.pipe, pipe, stamp);
  writeTab_(ss, TAB.hubStep, hubStepTable_(R), stamp);
  var slaC = slaCeoTable_(R);
  writeTab_(ss, TAB.slaCeo, slaC, stamp + ' · SLA 30 วัน นับเฉพาะงานขั้น 1–3 (ไม่รวมยกเลิก) · ในเกณฑ์ = ไม่เกิน 30 วัน');
  writeTab_(ss, TAB.slaHub, slaHubTable_(R), stamp + ' · SLA 30 วัน นับเฉพาะงานขั้น 1–3 (ไม่รวมยกเลิก)');
  var meter = meterTable_(R);
  writeTab_(ss, TAB.meter, meter, stamp + ' · 1 คำขอ = 1 สถานะ (ขั้น 8 ขึ้นไป)');
  writeTab_(ss, TAB.meterHub, meterHubTable_(R), stamp);

  // ---- ตัวเลขหลัก + วันที่อัปเดต (ใช้ใส่ข้อความใน Canva) ----
  var cnt = function(f){ return R.filter(f).length; };
  var slaAll = slaC[slaC.length - 1];
  var info = [
    ['หัวข้อ', 'ค่า', 'หน่วย'],
    ['วันที่อัปเดตข้อมูล', upd, ''],
    ['วันที่อัปเดต (สั้น)', Utilities.formatDate(now, TZ, 'd/M/') + (+Utilities.formatDate(now, TZ, 'yyyy') + 543), ''],
    ['คำขอทั้งหมด', R.length, 'ราย'],
    ['กำลังผลิตรวม', kwSum_(R), 'kW'],
    ['ผ่านการพิจารณา (ขั้น 3–10)', cnt(function(r){ return r.step >= 3; }), 'ราย'],
    ['ระหว่างตรวจสอบ (ขั้น 1–2)', cnt(function(r){ return r.step === 1 || r.step === 2; }), 'ราย'],
    ['ไม่ผ่าน/ยกเลิก', cnt(function(r){ return r.step === 0; }), 'ราย'],
    ['รอสับเปลี่ยนมิเตอร์/COD (ขั้น 8)', cnt(function(r){ return r.step === 8; }), 'ราย'],
    ['เริ่ม COD แล้ว (ขั้น 10)', cnt(function(r){ return r.step === 10; }), 'ราย'],
    ['kW ที่ COD แล้ว', kwSum_(R.filter(function(r){ return r.step === 10; })), 'kW'],
    ['งานใน SLA (ขั้น 1–3)', slaAll[5], 'ราย'],
    ['ในเกณฑ์ SLA ทั้งเขต', slaAll[6], '%'],
    ['เกิน SLA 30 วัน', slaAll[4], 'ราย'],
    ['สร้าง CA 82 แล้ว (ขั้น 8+)', cnt(function(r){ return r.step >= 8 && r.caCreated; }), 'ราย']
  ];
  var tz = Session.getScriptTimeZone();
  writeTab_(ss, TAB.info, info, tz === TZ ? 'อัปเดตอัตโนมัติทุกวัน ' + UPDATE_HOUR + ':00 น. · กดเมนู "📊 สรุป PPIM → อัปเดตตอนนี้" เพื่ออัปเดตทันที'
    : '⚠ Time zone ของสคริปต์เป็น ' + tz + ' — ตั้งเป็น (GMT+07:00) Bangkok ที่ Apps Script → ⚙️ Project Settings เพื่อให้นับวันตรงกับ Dashboard');

  // ---- ประวัติรายวัน (1 แถว/วัน — อัปเดตซ้ำวันเดิมจะเขียนทับแถวเดิม) ใช้ทำกราฟเส้นแนวโน้ม ----
  var hs = ss.getSheetByName(TAB.hist) || ss.insertSheet(TAB.hist);
  var hHead = ['วันที่'].concat(STEP_IDS.map(stepLabel_), ['ไม่ผ่าน/ยกเลิก', 'คำขอทั้งหมด', 'kW รวม', 'kW COD แล้ว', 'ในเกณฑ์ SLA (%)', 'เกิน SLA (ราย)']);
  if (hs.getLastRow() === 0) {
    hs.getRange(1, 1, 1, hHead.length).setValues([hHead]).setFontWeight('bold').setBackground('#74045F').setFontColor('#ffffff').setWrap(true);
    hs.setFrozenRows(1);
  }
  var day = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  var hRow = [day].concat(pipe.slice(1, 11).map(function(r){ return r[2]; }),
    [pipe[11][2], R.length, kwSum_(R), kwSum_(R.filter(function(r){ return r.step === 10; })), slaAll[6], slaAll[4]]);
  var n = hs.getLastRow(), at = n + 1;
  if (n >= 2) {
    var days = hs.getRange(2, 1, n - 1, 1).getDisplayValues().map(function(r){ return r[0]; });
    var ix = days.indexOf(day); if (ix >= 0) at = ix + 2;
  }
  hs.getRange(at, 1).setNumberFormat('@');
  hs.getRange(at, 1, 1, hRow.length).setValues([hRow]);

  // เรียง tab ให้อ่านง่าย
  [TAB.info, TAB.pipe, TAB.hubStep, TAB.slaCeo, TAB.slaHub, TAB.meter, TAB.meterHub, TAB.hist].forEach(function(name, i){
    var sh = ss.getSheetByName(name); if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(def);
  ss.setActiveSheet(ss.getSheetByName(TAB.info));
  return upd;
}
