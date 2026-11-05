/**
 * ชีตสรุป Dashboard PPIM Solar 2569 (กฟน.1) — สำหรับนำไปทำกราฟใน Canva
 * -----------------------------------------------------------------------
 * ⚠ ไฟล์นี้สร้างอัตโนมัติด้วย `node tools/build-summary-gs.js` (build 2026-11-05)
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

// ---- STEPS (จาก index.html)
const STEPS = [
  {id:1, name:'ตรวจสอบคำขอ', kw:['รอตรวจสอบคำขอ','ตรวจสอบคำขอ','รอตรวจ','ยื่นคำขอ','รับคำขอ']},
  {id:2, name:'อนุมัติผลการพิจารณา', kw:['รออนุมัติผลพิจารณา','อนุมัติผลการพิจารณา','อนุมัติผลพิจารณา','อนุมัติผล','ตรวจสอบเอกสาร','ตรวจสอบทางเทคนิค','รอพิจารณา','รอ หผ','รอ ผจก']},
  {id:3, name:'ทำสัญญา/ชำระเงิน', kw:['รอทำสัญญา','ทำสัญญา','ชำระเงิน','ประกาศผล','ผ่านการพิจารณา','รอชำระ','รอลงนาม','ลงนามสัญญา']},
  {id:4, name:'ยื่นคำขอเชื่อมต่อ', kw:['รอยื่นคำขอเชื่อมต่อ','ยื่นคำขอเชื่อมต่อ','ยื่นขอเชื่อมต่อ','ยื่นเชื่อมต่อ']},
  {id:5, name:'แก้ไขคำขอเชื่อมต่อ', kw:['แก้ไขคำขอเชื่อมต่อ','ส่งเอกสารแก้ไข','แก้ไขเอกสาร','รอแก้ไข','แก้ไข']},
  {id:6, name:'ตรวจคำขอเชื่อมต่อ', kw:['ตรวจคำขอเชื่อมต่อ','ตรวจสอบคำขอเชื่อมต่อ','ตรวจเอกสารเชื่อมต่อ','ตรวจสอบระบบผลิต','รับพิจารณาเชื่อมต่อ','ใบรับรองตนเอง']},
  {id:7, name:'อนุมัติเชื่อมต่อ', kw:['รออนุมัติเชื่อมต่อ','อนุมัติเชื่อมต่อ','อนุมัติการเชื่อมต่อ','รอดำเนินการหลังอนุมัติ','หลังอนุมัติเชื่อมต่อ']},
  {id:8, name:'ทดสอบเชื่อมต่อ/COD', kw:['ทดสอบเชื่อมต่อ','ทดสอบ','first sync','เปลี่ยนมิเตอร์','มิเตอร์','นัดหมาย','แจ้งวันเริ่มเชื่อมต่อ','วันเริ่มเชื่อมต่อ']},
  {id:9, name:'แจ้งผล COD', kw:['แจ้งผล cod','แจ้ง cod','รอ cod']},
  {id:10, name:'เริ่ม COD', kw:['เริ่ม cod','cod','จ่ายไฟเชิงพาณิชย์','เริ่มต้นซื้อขาย','เชื่อมต่อเรียบร้อย','เชื่อมต่อเข้าระบบ']},
  {id:0, name:'ไม่ผ่าน/ยกเลิก', kw:['ไม่ผ่าน','ยกเลิก','ปฏิเสธ','สิ้นผล','คืนคำขอ']}
];

// ---- FIELDS (จาก index.html)
const FIELDS = [
  {key:'reqNo',   label:'เลขที่คำขอ *',        kw:['เลขที่คำขอ','เลขคำขอ','request']},
  {key:'area',    label:'พื้นที่ / กฟฟ.',       kw:['กฟฟ.พื้นที่','พื้นที่ กฟฟ','พื้นที่','การไฟฟ้า','สังกัด']},
  {key:'areaCheck',label:'กฟฟ.ที่ตรวจสอบ',      kw:['กฟฟ.ที่ตรวจสอบ','กฟฟ.ตรวจสอบ']},
  {key:'hub',     label:'จุดรวมงาน (ถ้ามีในไฟล์)', kw:['กฟฟ.จุดรวมงาน','จุดรวมงาน','จุดร่วมงาน']},
  {key:'gridChk', label:'ผลตรวจ Grid Capacity',   kw:['ผลการตรวจสอบ grid','grid capacity','grid']},
  {key:'tr',      label:'TR PEA No. (หม้อแปลง)',  kw:['tr pea','tr no','tr']},
  {key:'kva',     label:'พิกัดหม้อแปลง (kVA)',     kw:['kva']},
  {key:'trOwner', label:'เจ้าของหม้อแปลง (P/C)',   kw:['เจ้าของหม้อแปลง']},
  {key:'meterV',  label:'ระดับแรงดันมิเตอร์',    kw:['ระดับแรงดันมิเตอร์','แรงดันมิเตอร์']},
  {key:'phaseNo', label:'จำนวนเฟส',            kw:['จำนวนเฟส']},
  {key:'meterSize', label:'ขนาด/ชนิดมิเตอร์เดิม', kw:['ขนาด/ชนิด','ขนาดชนิด','ขนาด/ ชนิด']},
  {key:'meterModel', label:'ประเภทมิเตอร์ (รุ่น/ขนาด)', kw:['ประเภทมิเตอร์']},
  {key:'allocDate', label:'วันที่จัดสรรมิเตอร์', kw:['วันที่จัดสรรมิเตอร์','วันที่จัดสรร','จัดสรรมิเตอร์']},
  {key:'pullDate', label:'วันที่ดึงข้อมูลจัดสรร', kw:['วันที่ดึงข้อมูลจัดสรร','วันที่ดึงจัดสรร','ดึงข้อมูลจัดสรร']},
  {key:'ca',      label:'หมายเลขผู้ใช้ไฟฟ้า (CA)', kw:['หมายเลขผู้ใช้ไฟฟ้า','ผู้ใช้ไฟฟ้า (ca','ca']},
  {key:'peaNo',   label:'PEA No.',             kw:['pea no.','pea no','peano']},
  {key:'lat',     label:'ละติจูด',              kw:['ละติจูด','latitude']},
  {key:'lng',     label:'ลองจิจูด',             kw:['ลองจิจูด','longitude']},
  {key:'status',  label:'สถานะคำขอ *',         kw:['สถานะคำขอ','สถานะ','status']},
  {key:'kw',      label:'กำลังไฟฟ้า (kW)',      kw:['กำลังการผลิตที่ขอ','ปริมาณเสนอขาย','เสนอขาย','กำลังไฟฟ้า','กิโลวัตต์']},
  {key:'dSubmit', label:'วันที่ยื่นคำขอ',       kw:['วันที่ยื่นคำขอ','วันที่ยื่น','วันยื่น']},
  {key:'dAnnounce',label:'วันที่ประกาศผล',      kw:['วันที่ประกาศผล','ประกาศ','วันที่อนุมัติผล']},
  {key:'dSign',   label:'วันที่ลงนามสัญญา',     kw:['วันที่ลงนาม','ลงนาม','วันที่ทำสัญญา']},
  {key:'dPay',    label:'วันที่ชำระเงิน',       kw:['วันที่ชำระเงิน','ชำระเงิน']},
  {key:'dConnReq',label:'วันที่ยื่นขอเชื่อมต่อ', kw:['วันที่ยื่นขอเชื่อมต่อ','ยื่นขอเชื่อมต่อ','ยื่นเชื่อมต่อ']},
  {key:'dConnApprove',label:'วันที่อนุมัติเชื่อมต่อ',kw:['วันที่อนุมัติเชื่อมต่อ','อนุมัติเชื่อมต่อ']},
  {key:'dCod',    label:'วันที่ COD/เชื่อมต่อเข้าระบบ', kw:['วันที่เชื่อมต่อเข้าระบบ','วันที่ cod','cod','เริ่มต้นซื้อขาย']},
  {key:'dSwapReport', label:'วันที่รายงานสับเปลี่ยน', kw:['วันที่รายงานสับเปลี่ยน','รายงานสับเปลี่ยน']},
  {key:'swapStatus', label:'สถานะการสับเปลี่ยน (ระบบ)', kw:['สถานะการสับเปลี่ยน','สถานะสับเปลี่ยน','ผลการสับเปลี่ยน']},
  {key:'ca82No',  label:'หมายเลข CA 82 (ชีต)', kw:['หมายเลข ca 82','หมายเลขca82','เลขที่ ca 82']},
  {key:'ca82Sys', label:'สถานะสร้างบัญชี CA 82 (ระบบ)', kw:['สถานะสร้างบัญชี ca 82','สถานะสร้างบัญชีca82']},
  {key:'ca82NoSys', label:'เลขที่ CA 82 (ระบบ)', kw:['เลขที่ ca 82 (ระบบ)','เลขที่ca82(ระบบ)']},
  {key:'ca82Note', label:'หมายเหตุ CA 82 (ระบบ)', kw:['หมายเหตุ ca 82','หมายเหตุca82']},
  {key:'custName', label:'ชื่อผู้ใช้ไฟฟ้า', kw:['ชื่อผู้ใช้ไฟฟ้า']},
  {key:'projLoc', label:'ที่ตั้งโครงการ', kw:['ที่ตั้งโครงการ']},
  {key:'prodKw', label:'กำลังการผลิต (kW)', kw:['กำลังการผลิต']},
  {key:'receiver', label:'ผู้รับงาน (PEA/Vendor)', kw:['ผู้รับงาน','รับงานโดย','หน่วยรับงาน']},
  {key:'installer', label:'ผู้ติดตั้ง', kw:['ผู้ติดตั้ง','ติดตั้งโดย','บริษัทติดตั้ง','ผู้รับเหมา']},
  {key:'custPhone', label:'เบอร์โทรศัพท์', kw:['เบอร์โทรศัพท์ ผู้ใช้ไฟฟ้า','เบอร์โทรศัพท์ผู้ใช้ไฟฟ้า','เบอร์โทรศัพท์','หมายเลขโทรศัพท์','เบอร์โทร','โทรศัพท์','เบอร์ติดต่อ']},
  {key:'caStatus', label:'สถานะการสร้างบัญชี CA', kw:['สถานะการสร้างบัญชี','สถานะสร้างบัญชีแสดงสัญญา','สร้างบัญชีแสดงสัญญา','บัญชีแสดงสัญญา','สถานะบัญชี']},
  // ผูกตามชื่อหัว (strict: ตรงทั้งคำ/ขึ้นต้น + kwInc เท่านั้น · kwExact = ตรงทั้งคำเท่านั้น) · ถ้าหาไม่เจอ ถอยไปอ่านตามตำแหน่งเดิม col (A=0)
  {key:'panelRaw',   label:'ข้อมูลแผงโซลาร์ (เดิมคอลัมน์ R)', strict:true, col:17, kw:['แผงพลังงานแสงอาทิตย์','ข้อมูลแผงโซลาร์','แผงโซลาร์','แผงเซลล์แสงอาทิตย์','แผงเซลล์','ข้อมูลแผง','solar panel'], kwInc:['แผงโซลาร์','แผงเซลล์']},
  {key:'contractNo', label:'เลขที่สัญญา (เดิมคอลัมน์ AB)',   strict:true, col:27, kw:['เลขที่สัญญา','เลขสัญญา','contract no'], kwInc:['เลขที่สัญญา','เลขสัญญา']},
  {key:'kwp',        label:'kWp (เดิมคอลัมน์ AX)',          strict:true, col:49, kw:['kwp','kw p','ขนาดติดตั้ง (kwp)','กำลังผลิตติดตั้ง'], kwInc:['kwp']},
  {key:'respOffice', label:'กฟส./กฟย. ที่รับผิดชอบ (เดิมคอลัมน์ AZ)', strict:true, col:51, kw:['กฟส./กฟย.ที่รับผิดชอบ','กฟส./กฟย. ที่รับผิดชอบ','กฟฟ.ที่รับผิดชอบ','การไฟฟ้าที่รับผิดชอบ','หน่วยงานที่รับผิดชอบ','กฟส./กฟย.','กฟอ./กฟย.'], kwExact:['กฟฟ.']}
];

// ---- SLA (จาก index.html)
const SLA = {reviewDays:30, signDays:30};

// ---- STEP_DISP (จาก index.html)
const STEP_DISP={1:'รอตรวจสอบคำขอ',2:'รออนุมัติผลการพิจารณา',3:'รอทำสัญญา/ชำระเงิน',4:'รอยื่นคำขอเชื่อมต่อ',5:'รอแก้ไขคำขอเชื่อมต่อ',6:'รอตรวจคำขอเชื่อมต่อ',7:'รออนุมัติเชื่อมต่อ',8:'รอสับเปลี่ยนมิเตอร์/COD',9:'รอแจ้งผล COD',10:'เริ่ม COD'};

// ---- parseDate (จาก index.html)
function parseDate(v){
  if(v==null||v==='') return null;
  if(v instanceof Date) return isNaN(v)?null:v;
  if(typeof v==='number'){
    const d = new Date(Math.round((v-25569)*86400*1000));
    return isNaN(d)?null:d;
  }
  const s = String(v).trim();
  if(s==='-'||s==='') return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m){ let yy=+m[1]; if(yy>2400)yy-=543; const d=new Date(yy,+m[2]-1,+m[3]); return isNaN(d)?null:d; }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if(m){
    let dd=+m[1], mm=+m[2], yy=+m[3];
    if(yy<100) yy+=2500;
    if(yy>2400) yy-=543;
    const d = new Date(yy,mm-1,dd);
    return isNaN(d)?null:d;
  }
  return null;
}

// ---- classifyStatus (จาก index.html)
function classifyStatus(txt){
  const t = String(txt||'').toLowerCase().trim();
  if(!t) return null;
  // ===== กรณีพิเศษ เรียงตามลำดับความจำเพาะ (เช็คก่อน loop เพราะข้อความมีคำซ้อนทับกัน) =====
  if(t.includes('ทดสอบ') && t.includes('เชื่อมต่อเรียบร้อย') && !t.includes('cod เรียบร้อย')) return 9; // "ทดสอบเชื่อมต่อเรียบร้อย" = ทดสอบผ่าน ยังรอ ผบส.กด COD (ไม่ใช่ COD เสร็จ)
  if(t.includes('เชื่อมต่อเรียบร้อย')||t.includes('เชื่อมต่อเข้าระบบ')) return 10; // COD เสร็จสิ้น
  if(t.includes('cod') && t.includes('เรียบร้อย')) return 10;                    // แจ้งผล COD เรียบร้อย (ผบส. ยืนยันแล้ว)
  if(t.includes('ยกเลิก')||t.includes('ไม่ผ่าน')||t.includes('ปฏิเสธ')||t.includes('สิ้นผล')||t.includes('คืนคำขอ')) return 0;
  if((t.includes('ผบส') && t.includes('cod'))||t.includes('กรอกข้อมูล cod')||t.includes('กรอก cod')) return 9; // รอ ผบส.กรอก COD (สับเปลี่ยนแล้ว) — ต้องมี "ผบส"+"cod" คู่กัน ไม่ใช่แค่ "ผบส" ลอยๆ
  if(t.includes('ผมต')) return 8;                                                   // รอ ผมต. สับเปลี่ยนมิเตอร์
  if(t.includes('แก้ไข')) return 5;                                                 // แก้ไขคำขอเชื่อมต่อ
  if(t.includes('ยื่นคำขอเชื่อมต่อ')||t.includes('ยื่นขอเชื่อมต่อ')||t.includes('ยื่นเชื่อมต่อ')) return 4;
  if(t.includes('ทดสอบเชื่อมต่อ')||t.includes('แจ้งวันเริ่มเชื่อมต่อ')||t.includes('วันเริ่มเชื่อมต่อ')||t.includes('first sync')) return 8;
  if(t.includes('ตรวจสอบระบบผลิต')||t.includes('ตรวจคำขอเชื่อมต่อ')||t.includes('ตรวจสอบคำขอเชื่อมต่อ')||t.includes('ตรวจเอกสารเชื่อมต่อ')||t.includes('รับพิจารณาเชื่อมต่อ')) return 6;
  if(t.includes('รออนุมัติเชื่อมต่อ')||t.includes('หลังอนุมัติเชื่อมต่อ')||t.includes('รอดำเนินการหลังอนุมัติ')||t.includes('อนุมัติเชื่อมต่อ')||t.includes('อนุมัติการเชื่อมต่อ')) return 7;
  if(t.includes('แจ้งผล cod')||t.includes('แจ้ง cod')||t.includes('รอ cod')) return 9;
  // ===== ที่เหลือใช้ keyword ตาม STEPS (ขั้นสูงก่อน) =====
  for(const st of [...STEPS].filter(s=>s.id!==0).sort((a,b)=>b.id-a.id)){
    if(st.kw.some(k=>t.includes(k.toLowerCase()))) return st.id;
  }
  return null;
}

// ---- computeSla (จาก index.html)
function computeSla(o){
  const today = new Date(); today.setHours(0,0,0,0);
  o.sla = {phase:null, band:null, elapsed:null, due:null, label:''};
  if(o.step===1||o.step===2){
    if(o.dSubmit){
      o.sla.phase='review'; o.sla.label='ตรวจสอบเอกสาร/เทคนิค';
      o.sla.due = addD(o.dSubmit,SLA.reviewDays);
      o.sla.elapsed = Math.max(0,daysBetween(o.dSubmit,today));
    }
  } else if(o.step===3){
    const base = o.dAnnounce || o.dConnApprove;
    if(base){
      o.sla.phase='contract'; o.sla.label='ทำสัญญา/ชำระเงิน';
      o.sla.due = addD(base,SLA.signDays);
      o.sla.elapsed = Math.max(0,daysBetween(base,today));
    }
  }
  if(o.sla.elapsed!=null){
    const e = o.sla.elapsed;
    o.sla.band = e<=10?'green' : e<=20?'yellow' : e<=30?'red' : 'over';
  }
  return o;
}

// ---- daysBetween (จาก index.html)
function daysBetween(a,b){ return Math.floor((b-a)/86400000); }

// ---- addD (จาก index.html)
function addD(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); x.setHours(0,0,0,0); return x; }

// ---- computeMapping (จาก index.html)
function computeMapping(hdrs){
  const map = {};
  const norm = s=>String(s).toLowerCase().replace(/\s+/g,'');
  const used = new Set();
  for(const f of FIELDS){
    let hit = null;
    for(const k of f.kw.concat(f.kwExact||[])){ hit = hdrs.find(h=>!used.has(h)&&norm(h)===norm(k)); if(hit)break; }
    if(!hit) for(const k of f.kw){ hit = hdrs.find(h=>!used.has(h)&&norm(h).startsWith(norm(k))); if(hit)break; }
    if(!hit) for(const k of (f.strict?(f.kwInc||[]):f.kw)){ hit = hdrs.find(h=>!used.has(h)&&norm(h).includes(norm(k))); if(hit)break; }
    if(hit){ map[f.key] = hit; used.add(hit);
      if(f.col!=null && hdrs.indexOf(hit)!==f.col) console.warn('[mapping] '+f.key+': ผูกตามชื่อหัว "'+hit+'" (คอลัมน์ที่ '+(hdrs.indexOf(hit)+1)+') ไม่ตรงตำแหน่งเดิม (คอลัมน์ที่ '+(f.col+1)+' = "'+(hdrs[f.col]||'')+'")'); }
  }
  return map;
}

// ---- buildRowsFrom (จาก index.html)
function buildRowsFrom(rawArr, map){
  const today = new Date(); today.setHours(0,0,0,0);
  return rawArr.map((r,i)=>{
    const get = k => map[k]!=null ? r[map[k]] : '';
    const getCol = (k,idx) => map[k]!=null ? r[map[k]] : ((typeof headers!=='undefined' && headers[idx]) ? r[headers[idx]] : '');   // ชื่อหัวก่อน → ถ้าไม่เจอใช้ตำแหน่งเดิม
    const clean = v => { v=String(v||'').trim().replace(/กฟอ\./g,'กฟส.'); return v==='-'?'':v; };   // แสดงผล กฟอ. เป็น กฟส. ทั้งระบบ (กฟจ. คงเดิม)
    const hubV = clean(get('hub'));
    const o = {
      i, reqNo:clean(get('reqNo')), area:clean(get('area'))||clean(get('areaCheck'))||'ไม่ระบุ',
      areaCheck: clean(get('areaCheck')),
      respOffice: clean(getCol('respOffice',51)),   // กฟส./กฟย. ที่รับผิดชอบ (ชื่อหัว → สำรองคอลัมน์ AZ)
      panelRaw:   clean(getCol('panelRaw',17)),     // ข้อมูลแผงโซลาร์ ข้อความอิสระ (ชื่อหัว → สำรองคอลัมน์ R)
      receiver: clean(get('receiver')), installer: clean(get('installer')),                         // การตลาด: ผู้รับงาน (PEA/Vendor) · ผู้ติดตั้ง
      contractNo: clean(getCol('contractNo',27)),   // เลขที่สัญญา (ชื่อหัว → สำรองคอลัมน์ AB)
      kwp:        clean(getCol('kwp',49)),          // kWp (ชื่อหัว → สำรองคอลัมน์ AX)
      hub: (hubV==='#N/A'||hubV.toLowerCase()==='x') ? '' : hubV,
      gridChk: clean(get('gridChk')),   // ผลตรวจ Grid Capacity — ผูกตามชื่อหัวคอลัมน์ (คอลัมน์ M เป็นระดับแรงดัน ไม่ใช่ผลตรวจ Grid)
      tr: clean(get('tr')), kva: clean(get('kva')), trOwner: clean(get('trOwner')),
      meterV: clean(get('meterV')), phaseNo: clean(get('phaseNo')),
      ca: clean(get('ca')), peaNo: clean(get('peaNo')), lat: clean(get('lat')), lng: clean(get('lng')),
      statusTxt:clean(get('status')),
      kw: parseFloat(String(get('kw')).replace(/[^\d.]/g,''))||0,
      dSubmit:parseDate(get('dSubmit')), dAnnounce:parseDate(get('dAnnounce')),
      dSign:parseDate(get('dSign')), dPay:parseDate(get('dPay')),
      dConnReq:parseDate(get('dConnReq')), dConnApprove:parseDate(get('dConnApprove')),
      dCod:parseDate(get('dCod')), dSwapReport:parseDate(get('dSwapReport')),
      swapStatus: clean(get('swapStatus')),
      ca82No: clean(get('ca82No')), ca82Sys: clean(get('ca82Sys')), ca82NoSys: clean(get('ca82NoSys')), ca82Note: clean(get('ca82Note')), custName: clean(get('custName')), projLoc: clean(get('projLoc')), prodKw: clean(get('prodKw')), custPhone: clean(get('custPhone')),
      caStatus: clean(get('caStatus'))
    };
    // สร้างบัญชี CA 82 แล้ว ถ้า: ผซฟ.บันทึกผ่านระบบ (ca82Sys) · หรือมีหมายเลข CA 82 จริงในชีต · หรือ caStatus บอกว่าสร้างแล้ว
    o.caCreated = (!!o.ca82Sys && /สร้าง|แล้ว|เสร็จ/.test(o.ca82Sys))
               || (!!o.ca82No && o.ca82No!=='-' && /\d/.test(o.ca82No))
               || (!!o.caStatus && !/ยัง|รอ|ไม่|กำลัง/.test(o.caStatus));
    o.gridPass = o.gridChk.includes('ผ่าน') && !o.gridChk.includes('ไม่ผ่าน');
    o.step = classifyStatus(o.statusTxt);
    // ระบบรายงานสับเปลี่ยน (คอลัมน์แยก "สถานะการสับเปลี่ยน (ระบบ)") — ไม่ยุ่งกับ "สถานะคำขอ" ของ PPIM
    // ถ้ามีการรายงานสับเปลี่ยนแล้ว (swapStatus มีค่า) และสถานะระบบยังไม่ถึงขั้น 9 → เลื่อนเป็นขั้น 9 (รอ ผบส.กด COD)
    if(o.swapStatus && (o.step==null || o.step<9)) o.step = 9;
    // ถ้าไม่มี ใช้ระดับแรงดันแทน: 220V=1 เฟส, 380V=3 เฟส, แรงสูง(kV)=มิเตอร์ CT
    const pv = (o.phaseNo||'').toString();
    const mv = (o.meterV||'').replace(/\s/g,'');
    o.meterPhase = /3/.test(pv) ? '3P' : /1/.test(pv) ? '1P'
                 : mv.startsWith('220') ? '1P' : mv.startsWith('380') ? '3P'
                 : (/kv/i.test(o.meterV)) ? 'MV' : '';
    // ===== ประเภทมิเตอร์เดิม (คอลัมน์ "ขนาด/ชนิด") → คาดการณ์การเปลี่ยนเป็น TOU =====
    o.meterSize = clean(get('meterSize'));
    o.meterModel = clean(get('meterModel'));                               // ประเภทมิเตอร์ (มีขนาด เช่น 5(100)A, 15(45)amp, 30(100))
    const is5100 = s => /(^|[^0-9])5\s*\(\s*100/.test(s);                  // ขนาด 5(100) เท่านั้น (ไม่ชนกับ 15,25,30(100))
    o.isTOU = /TOU/i.test(o.meterSize) || /TOU/i.test(o.meterModel);       // เป็น TOU (ดูทั้ง 2 คอลัมน์)
    o.isTOU5100 = o.isTOU && (is5100(o.meterModel) || is5100(o.meterSize)); // TOU ขนาด 5(100) → ไม่ต้องเปลี่ยน
    // ประเภทมิเตอร์เดิม: TOU 5(100) เป็นตัวตัดสินก่อน (ถ้าเป็น TOU 5(100) แล้วไม่ต้องเปลี่ยน แม้ "ขนาด/ชนิด" จะยังเขียนชนิดเดิม)
    o.meterType = o.isTOU5100 ? 'TOU 5(100)'
                : /จานหมุน/.test(o.meterSize) ? 'จานหมุน'
                : /e[\s-]?meter|อิเล็ก/i.test(o.meterSize) ? 'E-meter'
                : o.isTOU ? 'TOU ขนาดอื่น' : 'ไม่ระบุ';
    // ต้องจัดสรรมิเตอร์ใหม่ทุกราย ไม่ว่าประเภท/ขนาดใด (รวม TOU 5(100) ด้วย) — ประเภทเก็บไว้เพื่อแสดงผลเท่านั้น
    o.needSwap = true;
    o.swapPhase = /3\s*เฟส|3p/i.test(o.meterSize) ? '3P'
                : /1\s*เฟส|1p/i.test(o.meterSize) ? '1P'
                : (o.meterPhase==='1P'||o.meterPhase==='3P') ? o.meterPhase : '';
    o.allocDate = parseDate(get('allocDate'));
    o.pullDate = parseDate(get('pullDate'));
    o.allocated = !!o.allocDate;                                           // มีวันที่จัดสรร = จัดสรรมิเตอร์แล้ว
    o.pulled = !o.allocated && !!o.pullDate;                               // ดึงไปแล้ว ยังไม่จัดสรร = รอจัดสรรมิเตอร์
    o.allocStatus = o.allocated ? 'จัดสรรแล้ว' : o.pulled ? 'รอจัดสรรมิเตอร์' : 'ยังไม่จัดสรร';
    computeSla(o);   // SLA — 2 จุดควบคุม (แยกเป็นฟังก์ชันเพื่อคำนวณซ้ำได้หลังเติมวันที่ข้ามชีต)
    // กรอบเวลา COD: ต้อง COD ภายในสิ้นปี 2570 (31 ธ.ค. 2027) เตือนล่วงหน้า 3 เดือน
    // ครอบคลุมรายที่ทำสัญญาแล้วแต่ยังไม่ COD (ขั้น 4-8) และไม่ยกเลิก
    o.codBand = null; o.codDaysLeft = null;
    if(o.step>=4 && o.step<=9){
      const dl = new Date(2027,11,31);
      const d = daysBetween(today, dl);
      o.codDaysLeft = d;
      o.codBand = d<0 ? 'over' : d<=90 ? 'near' : 'ok';   // near = ภายใน 3 เดือน
    }
    o.pendDays = o.dSubmit? daysBetween(o.dSubmit,today) : null;
    // ระยะเวลาดำเนินงานมิเตอร์
    const swapBase = o.dConnApprove||o.dSign||o.dPay||o.dAnnounce;   // วันที่อนุมัติเชื่อมต่อ (fallback วันทำสัญญา)
    o.swapWaitDays = (o.step===8 && swapBase) ? Math.max(0,daysBetween(swapBase,today)) : null; // รอเปลี่ยนมิเตอร์ นับจากวันอนุมัติเชื่อมต่อ
    o.swapFromAlloc = (o.step===8 && o.allocDate) ? Math.max(0,daysBetween(o.allocDate,today)) : null; // รอสับเปลี่ยน นับจากวันจัดสรรมิเตอร์ (ยังไม่จัดสรร = null)
    o.codWaitDays  = (o.step===9 && o.dSwapReport) ? Math.max(0,daysBetween(o.dSwapReport,today)) : null; // รอ ผบส.กรอก COD นับจากวันรายงานสับเปลี่ยน
    return o;
  }).filter(o=>o.reqNo);
}

// ---- mergeRows (จาก index.html)
function mergeRows(){
  if(!slaRows || !slaRows.length) return;
  if(!rows) rows = [];
  const fillStr  = ['gridChk','hub','ca','peaNo','lat','lng','kva','tr','trOwner','meterV','phaseNo','areaCheck','caStatus'];
  const fillDate = ['dAnnounce','dSign','dPay','dConnReq','dConnApprove','dCod','dSwapReport'];
  const idxMain = {}; rows.forEach(r=>{ if(r.reqNo) idxMain[r.reqNo] = r; });
  slaRows.forEach(s=>{
    const r = idxMain[s.reqNo];
    if(r){   // reqNo ตรงกัน → เติมช่องว่างในชุดหลักด้วยข้อมูลจากชีต SLA/Grid
      fillStr.forEach(k=>{ if((r[k]===''||r[k]==null) && s[k]) r[k]=s[k]; });
      fillDate.forEach(k=>{ if(!r[k] && s[k]) r[k]=s[k]; });
    } else {  // union: คำขอที่มีเฉพาะในชีต SLA → เพิ่มเข้าชุดหลักด้วย (ไม่ให้ตกหล่น)
      rows.push(s); idxMain[s.reqNo]=s;
    }
  });
  rows.forEach(r=>{ r.gridPass = (r.gridChk||'').includes('ผ่าน') && !(r.gridChk||'').includes('ไม่ผ่าน'); });
  // ↔ เติมย้อนกลับ: ชีต SLA แถวไหนไม่มีวันที่อ้างอิง → ดึงจากชีตหลักมาเติม แล้วคำนวณ SLA ใหม่
  // (การ์ด SLA อ่านจาก slaData()=slaRows เป็นหลัก จึงต้องเติมวันที่ให้ครบก่อน)
  const fillDate2 = ['dSubmit','dAnnounce','dConnApprove','dSign','dPay','dConnReq','dCod','dSwapReport'];
  slaRows.forEach(s=>{
    const m = idxMain[s.reqNo];
    if(m){
      let changed=false;
      fillDate2.forEach(k=>{ if(!s[k] && m[k]){ s[k]=m[k]; changed=true; } });
      if(changed) computeSla(s);   // มีวันที่เพิ่ม → คำนวณ SLA ใหม่
    }
  });
}

// ---- DEFAULT_HUB_MAP (จาก index.html)
const DEFAULT_HUB_MAP = {
  'กฟจ.พะเยา':'กฟจ.พะเยา','กฟย.แม่กา':'กฟจ.พะเยา','กฟส.จุน':'กฟจ.พะเยา','กฟส.เชียงคำ':'กฟจ.พะเยา',
  'กฟส.เชียงม่วน':'กฟจ.พะเยา','กฟส.ดอกคำใต้':'กฟจ.พะเยา','กฟส.ปง':'กฟจ.พะเยา','กฟส.ภูกามยาว':'กฟจ.พะเยา',
  'กฟส.ภูซาง':'กฟจ.พะเยา','กฟส.แม่ใจ':'กฟจ.พะเยา',
  'กฟจ.แม่ฮ่องสอน':'กฟจ.แม่ฮ่องสอน','กฟส.กัลยาณิวัฒนา':'กฟจ.แม่ฮ่องสอน','กฟส.ขุนยวม':'กฟจ.แม่ฮ่องสอน',
  'กฟส.ปางมะผ้า':'กฟจ.แม่ฮ่องสอน','กฟส.ปาย':'กฟจ.แม่ฮ่องสอน','กฟส.แม่ลาน้อย':'กฟจ.แม่ฮ่องสอน',
  'กฟส.แม่สะเรียง':'กฟจ.แม่ฮ่องสอน','กฟส.สบเมย':'กฟจ.แม่ฮ่องสอน',
  'กฟน.1':'กฟน.1',
  'กฟส.เกาะคา':'กฟส.เกาะคา','กฟส.เถิน':'กฟส.เกาะคา','กฟส.แม่ทะ':'กฟส.เกาะคา','กฟส.แม่พริก':'กฟส.เกาะคา',
  'กฟส.สบปราบ':'กฟส.เกาะคา','กฟส.เสริมงาม':'กฟส.เกาะคา','กฟส.ห้างฉัตร':'กฟส.เกาะคา',
  'กฟส.จอมทอง':'กฟส.จอมทอง','กฟส.ดอยเต่า':'กฟส.จอมทอง','กฟส.ดอยหล่อ':'กฟส.จอมทอง','กฟส.แม่แจ่ม':'กฟส.จอมทอง',
  'กฟส.อมก๋อย':'กฟส.จอมทอง','กฟส.ฮอด':'กฟส.จอมทอง','กฟต.บ่อหลวง':'กฟส.จอมทอง',
  'กฟจ.เชียงราย':'กฟจ.เชียงราย','กฟต.ห้วยสัก':'กฟจ.เชียงราย','กฟส.นางแล':'กฟจ.เชียงราย',
  'กฟส.เวียงชัย':'กฟจ.เชียงราย','กฟส.เวียงเชียงรุ้ง':'กฟจ.เชียงราย',
  'กฟส.ขุนตาล':'กฟส.เทิง','กฟส.เชียงของ':'กฟส.เทิง','กฟส.เทิง':'กฟส.เทิง','กฟส.พญาเม็งราย':'กฟส.เทิง','กฟส.เวียงแก่น':'กฟส.เทิง',
  'กฟส.ไชยปราการ':'กฟส.ฝาง','กฟส.ฝาง':'กฟส.ฝาง','กฟส.แม่อาย':'กฟส.ฝาง',
  'กฟส.ป่าแดด':'กฟส.พาน','กฟส.พาน':'กฟส.พาน','กฟส.แม่ลาว':'กฟส.พาน','กฟส.แม่สรวย':'กฟส.พาน','กฟส.เวียงป่าเป้า':'กฟส.พาน',
  'กฟจ.เชียงใหม่':'กฟจ.เชียงใหม่','กฟส.สารภี':'กฟจ.เชียงใหม่',
  'กฟจ.เชียงใหม่ 2':'กฟส.เมืองเชียงใหม่ 2','กฟส.เมืองเชียงใหม่ 2':'กฟส.เมืองเชียงใหม่ 2','กฟส.ดอยสะเก็ด':'กฟส.เมืองเชียงใหม่ 2',
  'กฟต.ป่าแป๋':'กฟส.แม่ริม','กฟส.เชียงดาว':'กฟส.แม่ริม','กฟส.แม่แตง':'กฟส.แม่ริม','กฟส.แม่ริม':'กฟส.แม่ริม',
  'กฟส.เวียงแหง':'กฟส.แม่ริม',
  'กฟต.แม่สลองนอก':'กฟส.แม่สาย','กฟบ.เทอดไทย':'กฟส.แม่สาย','กฟฟ.ดอยตุง':'กฟส.แม่สาย','กฟส.ดอยหลวง':'กฟส.แม่สาย',
  'กฟส.แม่ฟ้าหลวง':'กฟส.แม่สาย','กฟส.เชียงแสน':'กฟส.แม่สาย','กฟส.แม่จัน':'กฟส.แม่สาย','กฟส.แม่สาย':'กฟส.แม่สาย',
  'กฟจ.ลำปาง':'กฟจ.ลำปาง','กฟต.พบชส.':'กฟจ.ลำปาง','กฟส.งาว':'กฟจ.ลำปาง','กฟส.แจ้ห่ม':'กฟจ.ลำปาง',
  'กฟส.เมืองปาน':'กฟจ.ลำปาง','กฟส.แม่เมาะ':'กฟจ.ลำปาง','กฟส.วังเหนือ':'กฟจ.ลำปาง',
  'กฟจ.ลำพูน':'กฟจ.ลำพูน','กฟต.นครเจดีย์':'กฟจ.ลำพูน','กฟส.ป่าซาง':'กฟจ.ลำพูน','กฟส.ทุ่งหัวช้าง':'กฟจ.ลำพูน',
  'กฟส.บ้านธิ':'กฟจ.ลำพูน','กฟส.บ้านโฮ่ง':'กฟจ.ลำพูน','กฟส.แม่ทา':'กฟจ.ลำพูน','กฟส.ลี้':'กฟจ.ลำพูน',
  'กฟส.เวียงหนองล่อง':'กฟจ.ลำพูน','กฟส.แม่ตืน':'กฟจ.ลำพูน',
  'กฟส.แม่ออน':'กฟส.สันกำแพง','กฟส.สันกำแพง':'กฟส.สันกำแพง',
  'กฟส.พร้าว':'กฟส.สันทราย','กฟส.สันทราย':'กฟส.สันทราย','กฟส.สันทราย':'กฟส.สันทราย',
  'กฟส.แม่วาง':'กฟส.สันป่าตอง','กฟส.สันป่าตอง':'กฟส.สันป่าตอง',
  'กฟส.หางดง':'กฟส.หางดง','กฟส.สะเมิง':'กฟส.หางดง'
};

// ---- METER_AGE_WARN (จาก index.html)
const METER_AGE_WARN = 7;   // ค้างเกินกี่วันให้เตือน

// ---- daysSince (จาก index.html)
const daysSince = d => d ? Math.max(0, daysBetween(d, (()=>{const t=new Date();t.setHours(0,0,0,0);return t;})())) : null;

// ---- METER_FLOW (จาก index.html)
const METER_FLOW = [
  {k:'doc',  ic:'📄', l:'รอออกเอกสารขอจัดสรร', who:'ผมต.กบล.', f:r=>r.step===8&&!r.allocated&&!r.pulled, age:r=>r.swapWaitDays, since:'อนุมัติเชื่อมต่อ'},
  {k:'alloc',ic:'⏳', l:'รอจัดสรรมิเตอร์',     who:'ผมต.กบล.', f:r=>r.step===8&&r.pulled,                 age:r=>daysSince(r.pullDate), since:'ออกเอกสาร'},
  {k:'swap', ic:'🔧', l:'รอสับเปลี่ยน',          who:'ผมม./ผมต.', f:r=>r.step===8&&r.allocated,             age:r=>daysSince(r.allocDate), since:'จัดสรร'},
  {k:'pbs',  ic:'📨', l:'สับเปลี่ยนแล้ว รอ ผบส. กด COD', who:'ผบส.', f:r=>r.step===9,                       age:r=>r.codWaitDays, since:'รายงานสับเปลี่ยน'},
  {k:'cod',  ic:'🏁', l:'COD เรียบร้อย',          who:'',          f:r=>r.step===10,                         age:()=>null},
  {k:'ca82', ic:'🧾', l:'รอสร้าง CA 82',          who:'ผซฟ.กบฟ.', f:r=>r.step>=8&&!r.caCreated,             age:r=>r.step===8?r.swapWaitDays:null, since:'อนุมัติเชื่อมต่อ', parallel:true}
];

// ---- HUB_LIST (จาก index.html)
const HUB_LIST = ['กบล.กฟน.1','กฟจ.เชียงราย','กฟจ.เชียงใหม่','กฟส.เมืองเชียงใหม่ 2','กฟจ.พะเยา','กฟจ.ลำปาง','กฟจ.ลำพูน','กฟจ.แม่ฮ่องสอน','กฟส.เกาะคา','กฟส.จอมทอง','กฟส.เทิง','กฟส.ฝาง','กฟส.พาน','กฟส.แม่ริม','กฟส.แม่สาย','กฟส.สันกำแพง','กฟส.สันทราย','กฟส.สันป่าตอง','กฟส.หางดง'];

// ---- CEO_LIST (จาก index.html)
const CEO_LIST = ['เชียงใหม่','ลำพูน','ลำปาง','เชียงราย','แม่ฮ่องสอน','พะเยา'];

// ---- CEO_DISTRICTS (จาก index.html)
const CEO_DISTRICTS = {
  'เชียงใหม่':  ['เชียงใหม่','สันทราย','หางดง','แม่ริม','สันป่าตอง','สันกำแพง','จอมทอง','ฝาง','ดอยสะเก็ด','แม่แตง','พร้าว','เชียงดาว','ไชยปราการ','แม่อาย','ฮอด','แม่แจ่ม','อมก๋อย','สะเมิง','สารภี','เวียงแหง','กัลยาณิวัฒนา','แม่วาง','ดอยหล่อ','แม่ออน','ดอยเต่า'],
  'ลำพูน':      ['ลำพูน','ป่าซาง','บ้านธิ','แม่ทา','ลี้','บ้านโฮ่ง','ทุ่งหัวช้าง','เวียงหนองล่อง','แม่ตืน'],
  'ลำปาง':      ['ลำปาง','เกาะคา','แม่เมาะ','งาว','แจ้ห่ม','เถิน','แม่ทะ','สบปราบ','ห้างฉัตร','เสริมงาม','เมืองปาน','วังเหนือ','แม่พริก'],
  'เชียงราย':   ['เชียงราย','พาน','แม่สาย','เทิง','เชียงของ','เวียงป่าเป้า','แม่จัน','เชียงแสน','แม่สรวย','เวียงชัย','พญาเม็งราย','ขุนตาล','ป่าแดด','แม่ฟ้าหลวง','เวียงแก่น','ดอยหลวง','เวียงเชียงรุ้ง','แม่ลาว'],
  'แม่ฮ่องสอน': ['แม่ฮ่องสอน','แม่สะเรียง','ปาย','ขุนยวม','แม่ลาน้อย','สบเมย','ปางมะผ้า'],
  'พะเยา':      ['พะเยา','เชียงคำ','ดอกคำใต้','จุน','ปง','แม่ใจ','เชียงม่วน','ภูซาง','ภูกามยาว']
};

// ---- hubCEO (จาก index.html)
function hubCEO(name){
  const k=String(name||'').replace(/^กฟ[จอสฟยน]\.?\s*/,'').replace(/\s+/g,'').replace(/^เมือง(?=เชียงใหม่|เชียงราย|ลำพูน|ลำปาง|พะเยา|แม่ฮ่องสอน)/,'').replace(/2$/,'');
  if(!k || /กบล/.test(String(name))) return '';
  for(const c of CEO_LIST){ if(k.indexOf(c)===0) return c; }
  for(const c of CEO_LIST){ if(CEO_DISTRICTS[c].some(d=>k.indexOf(d)===0)) return c; }
  return '';
}

// ---- rowCEO (จาก index.html)
function rowCEO(r){ return hubCEO(reqHub(r)) || hubCEO(r.areaCheck) || hubCEO(r.area) || hubCEO(r.respOffice) || ''; }

// ---- SLA_PHASES (จาก index.html)
const SLA_PHASES=[{k:'review',n:'ตรวจสอบ/พิจารณา'},{k:'contract',n:'ทำสัญญา/ชำระเงิน'}];

// ---- slaStat (จาก index.html)
function slaStat(list){
  const t=list.length; let g=0,y=0,o=0,el=0;
  list.forEach(r=>{ const b=r.sla.band; if(b==='over')o++; else if(b==='red')y++; else g++; el+=(r.sla.elapsed||0); });
  const inOk=t-o, pct=t?inOk/t*100:0, gp=t?g/t*100:0;
  return {t,g,y,o,inOk,pct,gp,score:t?Math.round(60*inOk/t+40*g/t):0,avgUse:t?Math.round(el/t/30*100):0};
}

// ---- hubKey (จาก index.html)
function hubKey(s){ return String(s||'').replace(/^กฟ[จอสฟน]\.?\s*/,'').replace(/\s+/g,'').replace(/^เมือง(?=เชียงใหม่|เชียงราย|ลำพูน|ลำปาง|พะเยา|แม่ฮ่องสอน)/,'').trim(); }   // "กฟจ.เชียงใหม่ 2" (ชื่อเดิม) = "กฟส.เมืองเชียงใหม่ 2"

// ---- canonHub (จาก index.html)
function canonHub(s){ const k=hubKey(s); return k ? (HUB_LIST.find(h=>hubKey(h)===k)||'') : ''; }

// ---- reqHub (จาก index.html)
function reqHub(r){
  return canonHub(r.areaCheck) || canonHub(r.area) || canonHub(r.hub)
      || canonHub(hubMapping()[r.area]) || canonHub(hubMapping()[r.areaCheck]) || '';
}

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
