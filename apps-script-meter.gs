/**
 * PPIM Solar — Backend ระบบรายงานผลสับเปลี่ยนมิเตอร์ (สำหรับพนักงานมิเตอร์ ผมต.)
 * Google Apps Script Web App — รับ login + บันทึกผลสับเปลี่ยน แล้วเขียนสถานะกลับ Google Sheet
 *
 * วิธี deploy:
 *  1) เปิด Google Sheet "PPIM Solar" (15Min…) → เมนู Extensions → Apps Script
 *  2) ลบโค้ดเดิม วางไฟล์นี้ทั้งหมด → Save
 *  3) Deploy → New deployment → เลือก type: Web app
 *       - Execute as: Me
 *       - Who has access: Anyone
 *     → Deploy → คัดลอก "Web app URL"
 *  4) เอา URL ไปตั้งใน Dashboard (Console F12):
 *       localStorage.setItem("meter_api_url","<URL>")  แล้วรีเฟรช
 *     (หรือส่ง URL ให้ Claude ฝังใน index.html ให้ถาวร)
 *
 * ต้องมี 3 แท็บในชีต:
 *  - "PPIM Solar Update"  = ข้อมูลคำขอ (มีคอลัมน์ "เลขที่คำขอ" และ "สถานะคำขอ")
 *  - "พนักงานมิเตอร์"      = ทะเบียนพนักงาน (สร้างใหม่) หัวคอลัมน์แถวแรก:
 *        รหัสพนักงาน | ชื่อ-สกุล | สังกัด | password
 *  - "ผลสับเปลี่ยนมิเตอร์" = log ผลการสับเปลี่ยน (สคริปต์สร้างให้อัตโนมัติถ้ายังไม่มี)
 */

var SHEET_ID  = '15MinRHg79n2zToLiOsacmm2Br7N9FUIEaHOxl2eqelo';   // ชีตมิเตอร์ (ข้อมูล+สถานะ+ทะเบียนพนักงาน+log)
var MAIN_TAB  = 'PPIM Solar Update';
var EMP_TAB   = 'พนักงานมิเตอร์';
var LOG_TAB   = 'ผลสับเปลี่ยนมิเตอร์';
var LOG_USER_TAB = 'บันทึกการเข้าใช้งาน';   // log ผู้ใช้ (login/register/รายงาน) ใคร-เมื่อไหร่-ทำอะไร
var TICKER_TAB   = 'ประกาศวิ่ง';            // ข้อความแถบวิ่งด้านล่าง (Admin แก้ไขได้) เก็บใน A1
var PHOTO_FOLDER_ID = '1iL62z_4VPx9DBFH4S482jhbJ3phnHyvK';        // โฟลเดอร์ Drive เก็บรูปสับเปลี่ยนมิเตอร์
var STATUS_AFTER_SWAP = 'รอ ผบส.กรอกข้อมูล COD ในระบบ PPIM';   // ผมต. รายงานเสร็จ (ขั้น 9)
var STATUS_AFTER_COD  = 'แจ้งผล COD เรียบร้อย';                 // ผบส. ยืนยันเสร็จ (ขั้น 10)
var COL_SWAP_DATE = 'วันที่รายงานสับเปลี่ยน';   // คอลัมน์เก็บวันที่ ผมต. รายงานผล (ใช้จับเวลา)
var COL_COD_DATE  = 'วันที่เชื่อมต่อเข้าระบบ';   // คอลัมน์วัน COD (ถ้ามี จะเขียนตอน ผบส. ยืนยัน)
var ADMIN_SECRET  = 'PEA-N1-ADMIN-2569';   // 🔑 รหัสอนุมัติ Admin — ต้องกรอกให้ตรงตอนสมัครตำแหน่ง Admin (เปลี่ยนเป็นรหัสลับของคุณเอง)

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'login')    return json(doLogin(body));
    if (body.action === 'register') return json(doRegister(body));
    if (body.action === 'report')   return json(doReport(body));
    if (body.action === 'cod')      return json(doCod(body));
    if (body.action === 'log')      return json(doGetLog(body));
    if (body.action === 'ticker')   return json(doGetTicker());
    if (body.action === 'setticker')return json(doSetTicker(body));
    return json({ ok:false, error:'unknown action' });
  } catch (err) {
    return json({ ok:false, error:String(err) });
  }
}

// เผื่อทดสอบด้วยการเปิด URL ตรง ๆ
function doGet() { return json({ ok:true, service:'PPIM meter report', ts:new Date() }); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet(tab) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(tab);
}

// บันทึก log การใช้งาน (สร้างแท็บให้อัตโนมัติ)
function logUser(emp, name, role, hub, action) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var lg = ss.getSheetByName(LOG_USER_TAB);
    if (!lg) { lg = ss.insertSheet(LOG_USER_TAB); lg.appendRow(['เวลา','รหัสพนักงาน','ชื่อ-สกุล','ตำแหน่ง','จุดร่วมงาน','การกระทำ']); }
    lg.appendRow([ new Date(), String(emp||''), String(name||''), String(role||''), String(hub||''), String(action||'') ]);
  } catch (e) {}
}

// หา index คอลัมน์จากชื่อหัว (แถวแรก) — ยืดหยุ่นต่อการสลับคอลัมน์
function colIndex(headerRow, name) {
  for (var i=0;i<headerRow.length;i++){
    if (String(headerRow[i]).trim() === name) return i;
  }
  return -1;
}

function doLogin(b) {
  var emp = String(b.emp||'').trim();
  var pw  = String(b.pw||'');
  if (!emp || !pw) return { ok:false, error:'missing credentials' };
  var sh = sheet(EMP_TAB);
  if (!sh) return { ok:false, error:'ไม่พบแท็บ '+EMP_TAB };
  var data = sh.getDataRange().getValues();
  var h = data[0];
  var iE = colIndex(h,'รหัสพนักงาน'), iN = colIndex(h,'ชื่อ-สกุล'), iR = colIndex(h,'ตำแหน่ง'),
      iD = colIndex(h,'สังกัด'), iH = colIndex(h,'จุดร่วมงาน'), iP = colIndex(h,'password');
  for (var r=1;r<data.length;r++){
    if (String(data[r][iE]).trim() === emp && String(data[r][iP]) === pw) {
      var nm=String(data[r][iN]||''), rl=iR>=0?String(data[r][iR]||''):'', hb=iH>=0?String(data[r][iH]||''):'';
      logUser(emp, nm, rl, hb, 'เข้าสู่ระบบ');
      return { ok:true, name:nm, dept:String(data[r][iD]||''), hub:hb, role:rl };
    }
  }
  return { ok:false, error:'invalid' };
}

function doRegister(b) {
  var emp  = String(b.emp||'').trim();
  var name = String(b.name||'').trim();
  var role = String(b.role||'').trim();
  var dept = String(b.dept||'').trim();
  var hub  = String(b.hub||'').trim();
  var pw   = String(b.pw||'');
  if (!emp || !name || !pw) return { ok:false, error:'missing fields' };
  // สมัครตำแหน่ง Admin ต้องกรอกรหัสอนุมัติ Admin ให้ตรง (กันไม่ให้ใครตั้งตัวเองเป็น Admin)
  if (role.toLowerCase().indexOf('admin') >= 0 && String(b.adminCode||'') !== ADMIN_SECRET) {
    return { ok:false, error:'bad_admin_code' };
  }
  var sh = sheet(EMP_TAB);
  if (!sh) {  // สร้างแท็บพนักงานให้อัตโนมัติถ้ายังไม่มี
    sh = SpreadsheetApp.openById(SHEET_ID).insertSheet(EMP_TAB);
    sh.appendRow(['รหัสพนักงาน','ชื่อ-สกุล','ตำแหน่ง','สังกัด','จุดร่วมงาน','password']);
  }
  var data = sh.getDataRange().getValues();
  var h = data[0];
  function ensureCol(nm){ var i=colIndex(h,nm); if(i<0){ i=h.length; sh.getRange(1,i+1).setValue(nm); h.push(nm);} return i; }
  var iR = ensureCol('ตำแหน่ง');
  var iH = ensureCol('จุดร่วมงาน');
  var iE = colIndex(h,'รหัสพนักงาน'), iN = colIndex(h,'ชื่อ-สกุล'),
      iD = colIndex(h,'สังกัด'), iP = colIndex(h,'password');
  for (var r=1;r<data.length;r++){
    if (String(data[r][iE]).trim() === emp) return { ok:false, error:'exists' };
  }
  var row = []; for (var c=0;c<h.length;c++) row.push('');
  row[iE]=emp; row[iN]=name; row[iR]=role; row[iD]=dept; row[iH]=hub;
  if (iP>=0) row[iP]=pw; else row.push(pw);
  sh.appendRow(row);
  logUser(emp, name, role, hub, 'ลงทะเบียน');
  return { ok:true, name:name, dept:dept, hub:hub, role:role };
}

// ข้อความแถบวิ่ง — อ่าน (สาธารณะ)
function doGetTicker() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var t = ss.getSheetByName(TICKER_TAB);
  if (!t) { t = ss.insertSheet(TICKER_TAB); t.getRange('A1').setValue('ยินดีต้อนรับสู่ระบบ PPIM Solar ภาคประชาชน ปี 2569 · การไฟฟ้าส่วนภูมิภาค เขต 1 (ภาคเหนือ)'); }
  return { ok:true, text: String(t.getRange('A1').getValue()||'') };
}
// ข้อความแถบวิ่ง — แก้ไข (เฉพาะ Admin)
function doSetTicker(b) {
  if (!isAdmin(b.emp, b.pw)) return { ok:false, error:'forbidden' };
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var t = ss.getSheetByName(TICKER_TAB) || ss.insertSheet(TICKER_TAB);
  t.getRange('A1').setValue(String(b.text||''));
  logUser(b.emp, b.name, 'Admin', '', 'แก้ไขข้อความแถบวิ่ง');
  return { ok:true };
}
// ตรวจสิทธิ์ Admin (ไม่บันทึก log)
function isAdmin(emp, pw) {
  var sh = sheet(EMP_TAB); if (!sh) return false;
  var data = sh.getDataRange().getValues(), h = data[0];
  var iE = colIndex(h,'รหัสพนักงาน'), iP = colIndex(h,'password'), iR = colIndex(h,'ตำแหน่ง');
  for (var r=1;r<data.length;r++){
    if (String(data[r][iE]).trim() === String(emp||'').trim() && String(data[r][iP]) === String(pw||'')) {
      return String(data[r][iR]||'').toLowerCase().indexOf('admin') >= 0;
    }
  }
  return false;
}

// Admin ดึง log การใช้งาน (ตรวจสิทธิ์ Admin ก่อน — ไม่บันทึก log ซ้ำ)
function doGetLog(b) {
  var sh = sheet(EMP_TAB);
  if (!sh) return { ok:false, error:'no employees' };
  var data = sh.getDataRange().getValues(), h = data[0];
  var iE = colIndex(h,'รหัสพนักงาน'), iP = colIndex(h,'password'), iR = colIndex(h,'ตำแหน่ง');
  var isAdmin = false;
  for (var r=1;r<data.length;r++){
    if (String(data[r][iE]).trim() === String(b.emp||'').trim() && String(data[r][iP]) === String(b.pw||'')) {
      isAdmin = String(data[r][iR]||'').toLowerCase().indexOf('admin') >= 0; break;
    }
  }
  if (!isAdmin) return { ok:false, error:'forbidden' };
  var lg = sheet(LOG_USER_TAB);
  if (!lg) return { ok:true, rows:[] };
  var d = lg.getDataRange().getValues();
  var out = d.slice(1).slice(-500).map(function(x){
    return { time:String(x[0]), emp:String(x[1]), name:String(x[2]), role:String(x[3]), hub:String(x[4]), action:String(x[5]) };
  });
  return { ok:true, rows: out.reverse() };   // ล่าสุดก่อน
}

// ผบส. ยืนยันแจ้งผล COD (ขั้น 9 → 10)
function doCod(b) {
  var reqNo = String(b.reqNo||'').trim();
  if (!reqNo) return { ok:false, error:'missing reqNo' };
  var sh = sheet(MAIN_TAB);
  if (!sh) return { ok:false, error:'ไม่พบแท็บ '+MAIN_TAB };
  var data = sh.getDataRange().getValues(), h = data[0];
  var iReq = colIndex(h,'เลขที่คำขอ'), iStatus = colIndex(h,'สถานะคำขอ');
  if (iReq < 0 || iStatus < 0) return { ok:false, error:'ไม่พบคอลัมน์ เลขที่คำขอ/สถานะคำขอ' };
  var foundRow = -1;
  for (var r=1;r<data.length;r++){ if (String(data[r][iReq]).trim() === reqNo) { foundRow = r; break; } }
  if (foundRow < 0) return { ok:false, error:'ไม่พบคำขอ '+reqNo };
  sh.getRange(foundRow+1, iStatus+1).setValue(STATUS_AFTER_COD);
  var iCod = colIndex(h, COL_COD_DATE);
  if (iCod >= 0 && b.codDate) sh.getRange(foundRow+1, iCod+1).setValue(b.codDate);
  var log = sheet(LOG_TAB);
  if (log) log.appendRow([ new Date(), reqNo, '', '', 'COD ยืนยันโดย ผบส.', '', '', String(b.codDate||''), String(b.emp||''), String(b.name||''), '' ]);
  return { ok:true };
}

function doReport(b) {
  var reqNo = String(b.reqNo||'').trim();
  if (!reqNo) return { ok:false, error:'missing reqNo' };
  var sh = sheet(MAIN_TAB);
  if (!sh) return { ok:false, error:'ไม่พบแท็บ '+MAIN_TAB };
  var rng = sh.getDataRange(), data = rng.getValues(), h = data[0];
  var iReq = colIndex(h,'เลขที่คำขอ'), iStatus = colIndex(h,'สถานะคำขอ');
  if (iReq < 0 || iStatus < 0) return { ok:false, error:'ไม่พบคอลัมน์ เลขที่คำขอ/สถานะคำขอ' };
  var foundRow = -1;
  for (var r=1;r<data.length;r++){
    if (String(data[r][iReq]).trim() === reqNo) { foundRow = r; break; }
  }
  if (foundRow < 0) return { ok:false, error:'ไม่พบคำขอ '+reqNo };

  // เขียนสถานะกลับ (แถว foundRow, คอลัมน์ iStatus) — getRange ใช้ 1-based
  sh.getRange(foundRow+1, iStatus+1).setValue(STATUS_AFTER_SWAP);

  // เขียน "วันที่รายงานสับเปลี่ยน" ลงคอลัมน์ท้ายสุด (สร้างหัวถ้ายังไม่มี) — ใช้จับเวลาขั้น รอ ผบส.
  var iSwapDate = colIndex(h, COL_SWAP_DATE);
  if (iSwapDate < 0) { iSwapDate = h.length; sh.getRange(1, iSwapDate+1).setValue(COL_SWAP_DATE); }
  sh.getRange(foundRow+1, iSwapDate+1).setValue(new Date());

  // อัปโหลดรูป (ถ้ามี) เข้า Google Drive แล้วเก็บลิงก์
  var photoLinks = savePhotos(b.photos, reqNo);

  // บันทึก log
  var log = sheet(LOG_TAB);
  if (!log) {
    log = SpreadsheetApp.openById(SHEET_ID).insertSheet(LOG_TAB);
    log.appendRow(['เวลาบันทึก','เลขที่คำขอ','CA ลูกค้า','PEA No.','ชนิดมิเตอร์','หมายเลขมิเตอร์','เลขอ่านหน่วย','วันที่ COD','รหัสพนักงาน','ชื่อพนักงาน','รูปภาพ']);
  }
  log.appendRow([ new Date(), reqNo, String(b.ca||''), String(b.peaNo||''), String(b.phase||''),
                  String(b.meterNo||''), String(b.reading||''), String(b.codDate||''),
                  String(b.emp||''), String(b.name||''), photoLinks.join('\n') ]);
  logUser(b.emp, b.name, 'ผมต.', '', 'รายงานสับเปลี่ยนมิเตอร์ ' + reqNo);

  return { ok:true, photos:photoLinks.length };
}

// อัปโหลด base64 dataURL เข้าโฟลเดอร์ Drive "PPIM_Meter_Photos" (สร้างให้อัตโนมัติ) คืน array ลิงก์
function savePhotos(photos, reqNo) {
  var links = [];
  if (!photos || !photos.length) return links;
  var folder = DriveApp.getFolderById(PHOTO_FOLDER_ID);   // โฟลเดอร์ที่กำหนด
  for (var i=0; i<photos.length && i<5; i++) {
    var m = String(photos[i]).match(/^data:(image\/\w+);base64,(.+)$/);
    if (!m) continue;
    // ตั้งชื่อไฟล์ตามเลขคำขอ: PPIMxxxxx_1, _2, ... ตามจำนวนรูป
    var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], reqNo+'_'+(i+1)+'.jpg');
    var file = folder.createFile(blob);
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
    links.push(file.getUrl());
  }
  return links;
}
