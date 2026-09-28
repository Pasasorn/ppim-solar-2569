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
var PHOTO_FOLDER_ID = '1iL62z_4VPx9DBFH4S482jhbJ3phnHyvK';        // โฟลเดอร์ Drive เก็บรูปสับเปลี่ยนมิเตอร์
var STATUS_AFTER_SWAP = 'รอ ผบส.กรอกข้อมูล COD ในระบบ PPIM';
var COL_SWAP_DATE = 'วันที่รายงานสับเปลี่ยน';   // คอลัมน์เก็บวันที่ ผมต. รายงานผล (ใช้จับเวลา)

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'login')    return json(doLogin(body));
    if (body.action === 'register') return json(doRegister(body));
    if (body.action === 'report')   return json(doReport(body));
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
  var iE = colIndex(h,'รหัสพนักงาน'), iN = colIndex(h,'ชื่อ-สกุล'),
      iD = colIndex(h,'สังกัด'), iP = colIndex(h,'password');
  for (var r=1;r<data.length;r++){
    if (String(data[r][iE]).trim() === emp && String(data[r][iP]) === pw) {
      return { ok:true, name:String(data[r][iN]||''), dept:String(data[r][iD]||'') };
    }
  }
  return { ok:false, error:'invalid' };
}

function doRegister(b) {
  var emp  = String(b.emp||'').trim();
  var name = String(b.name||'').trim();
  var dept = String(b.dept||'').trim();
  var pw   = String(b.pw||'');
  if (!emp || !name || !pw) return { ok:false, error:'missing fields' };
  var sh = sheet(EMP_TAB);
  if (!sh) {  // สร้างแท็บพนักงานให้อัตโนมัติถ้ายังไม่มี
    sh = SpreadsheetApp.openById(SHEET_ID).insertSheet(EMP_TAB);
    sh.appendRow(['รหัสพนักงาน','ชื่อ-สกุล','สังกัด','password']);
  }
  var data = sh.getDataRange().getValues();
  var h = data[0];
  var iE = colIndex(h,'รหัสพนักงาน');
  for (var r=1;r<data.length;r++){
    if (String(data[r][iE]).trim() === emp) return { ok:false, error:'exists' };
  }
  sh.appendRow([ emp, name, dept, pw ]);
  return { ok:true, name:name, dept:dept };
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
