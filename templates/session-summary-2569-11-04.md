# สรุปงาน Dashboard PPIM Solar 2569 — 2–4 พ.ย. 2569 (ต่อจาก 2 พ.ย.)

> Repo: `pasasorn/ppim-solar-2569` · branch `main` · commit ล่าสุดก่อนสรุปนี้ `25a99fb`
> รายละเอียดระบบทั้งหมดอยู่ใน `HANDOFF.md` · สรุปรอบก่อน: `templates/session-summary-2569-11-02.md`

---

## ข้อตกลงการทำงาน (ใช้ต่อในหน้าต่างใหม่)
- ตอบเป็น **ภาษาไทย** ตลอด
- แก้บน **`main` โดยตรง** → ตรวจ syntax → commit → `git push origin main`
- ตรวจ syntax `index.html` ตามหัวข้อ 7 ของ HANDOFF · `.gs`: `node -e "new Function(require('fs').readFileSync('apps-script-meter.gs','utf8'))"`
- เรื่องกำกวม **ถามก่อนลงมือ** · เสนอตัวเลือกขั้นต่อไปท้ายทุกคำตอบ · ทำผิดให้บอก "don't accept it"
- เครื่อง cloud เข้า `script.google.com`/CDN ไม่ได้ → ทดสอบด้วย mock (Node + Playwright, stub `Chart`)
- ดู log GitHub Actions ได้เองผ่าน GitHub MCP (`actions_list` / `get_job_logs`) — ไม่ต้องให้ผู้ใช้ส่งภาพ
- ห้ามเปิดอ่านโฟลเดอร์ output / templates อัตโนมัติ

---

## งานที่เสร็จรอบนี้ (ทั้งหมดแก้ `index.html` เท่านั้น ยกเว้น workflow — ไม่ต้อง redeploy .gs)
| งาน | commit |
|---|---|
| การ์ด "รอสับเปลี่ยนมิเตอร์" (หน้าแรก): กดตัวเลข 🧾 มี CA 82 / 📦 จัดสรรแล้ว / ✅ พร้อม → กราฟ + **ตารางรายการคำขอ** + ปุ่มกลุ่มย่อย (รวม "ยังไม่มี CA 82", "ยังไม่จัดสรร") · `kpiSub`, `kpiPickSub`, `kpiListHtml` | `b964bc3` |
| หมายเหตุ CA 82 แสดงในตารางงานค้างหน้าสับเปลี่ยนมิเตอร์ (`ca82NoteCell`) | `b964bc3` |
| การ์ด 🔧 รอสับเปลี่ยน: ✅ พร้อมเปลี่ยน (มี CA 82+จัดสรรแล้ว) / ⛔ ไม่พร้อม (ขาด CA 82) เป็นเครื่อง + % + แถบสัดส่วน · กดกรองได้ (`meterFlowSub`, `SWAP_SUB`) | `4270ffe` |
| **วันรอสับเปลี่ยนนับจากวันจัดสรร** (`swapFromAlloc`) — ตารางรายการคำขอ / แถบระยะเวลาดำเนินงาน / หน้ารายงาน ผมต. · การ์ดรอออกเอกสาร + รอสร้าง CA 82 ยังนับจากวันอนุมัติเชื่อมต่อ (`swapWaitDays`) | `5d7d56f` |
| การ์ด 🧾 รอสร้าง CA 82: ตาราง "ที่ระบุสาเหตุ" (เลขคำขอ PPIM · กฟฟ. · สาเหตุ · รอ) | `5d7d56f` |
| สถานะงานมิเตอร์: กดการ์ด (เอกสาร/จัดสรร/รอสับเปลี่ยน/CA 82) → **🏢 ตารางแยก กฟฟ.** (เครื่อง/1P/3P/รอเฉลี่ย/นานสุด/เกิน 30 วัน — **นับจากวันอนุมัติเชื่อมต่อ**) · กดแถว = รายการคำขอ (`meterFlowAreaHtml`, `meterFlowArea`) | `93e6ed3` |
| การ์ดรอสับเปลี่ยน: เอาตาราง "ค้างเกิน 7 วัน (นับจากวันจัดสรร)" ออก (ป้ายบนการ์ดยังอยู่) | `0eee69a` |
| ตาราง กฟฟ. ของการ์ดรอสับเปลี่ยน: แสดงรายที่ **✅ สับเปลี่ยนแล้ว** (ขั้น 9–10, 1P/3P) เป็นคอลัมน์ + แถวสีเขียว + วันที่รายงาน — ไม่นับรวมงานรอ/ไม่นับวันรอ | `25a99fb` |
| **Auto deploy Apps Script** — `.github/workflows/deploy-apps-script.yml` (clasp 3.4.1 · pull → ตรวจว่ามี Deployment ID ของ Dashboard → วางทับ → push → `update-deployment`) · ทริกเกอร์: push `apps-script-meter.gs` หรือ Run workflow | `fe29594`→`d8372be` |

## สถานะ Auto deploy (ยังไม่สำเร็จ — workflow ยังไม่เคยแก้ Apps Script เลย)
- ✅ Apps Script API เปิดแล้ว · ✅ `CLASPRC_JSON` ใหม่ (login 3 พ.ย. ด้วย `npx.cmd @google/clasp@3.4.1 login`) ใช้ได้
- ❌ **`GAS_SCRIPT_ID` ผิด** — run #7 log แสดงว่ามีการวาง Deployment ID (`AKfycb…`) ลงใน secret นี้ → Google ตอบ "Request contains an invalid argument"
  - ต้องใส่ **Script ID** จาก Apps Script → ⚙️ Project Settings → IDs (โปรเจกต์ที่มี deployment `AKfycbxtZZ…`)
  - ค่า Script ID รอบก่อนหน้า (run #6) ดึงได้ `Code.js` 34,185 bytes ซึ่งเล็กกว่าไฟล์ใน git (53,815) → อาจเป็นคนละโปรเจกต์ — workflow มีตัวกันแล้ว (หยุดถ้าไม่พบ Deployment ID)
- ปัญหาที่เจอระหว่างตั้งค่า: PowerShell บล็อก `npx` → ใช้ `npx.cmd` · เครื่องผู้ใช้มี clasp 2.x global → ระบุ `@3.4.1` เสมอ · ผู้ใช้เคยวาง `.clasprc.json` ในแชต → ยกเลิกสิทธิ์และ login ใหม่แล้ว

## สถานะที่ยังรอผู้ใช้ยืนยัน
1. **Dashboard ขึ้น "API ไม่ส่งข้อมูลกลับ (request ไปโดน doGet)"** (3 พ.ย.) — ไม่ได้เกิดจาก workflow (ทุก run หยุดก่อนขั้น Push) · ผู้ใช้ Run `testDrive` ผ่านแล้ว → **ยังรอยืนยันว่า Deploy → Manage deployments → Edit → New version (Execute as Me · Anyone) แล้ว Dashboard กลับมาใช้ได้หรือยัง**
2. deploy .gs ที่มีหมายเหตุ CA 82 (`30dc8ec`) แล้วลองบันทึก
3. login ด้วยรหัสเดิมหลัง hash · ลบ tab สำรอง `พนักงานมิเตอร์` · ผลตรวจขั้น 6/7 (คำสั่งอยู่ใน `session-summary-2569-11-02.md`)

## งานค้าง (HANDOFF ข้อ 8)
1. คอลัมน์ "ผู้รับงาน (PEA/Vendor)" + "ผู้ติดตั้ง" ในชีต (หน้าการตลาด)
2. SLA รายขั้น (5/5/5/3/3 วัน)
3. เก็บ PDF เอกสารขอจัดสรรที่พิมพ์จริงลง Drive (redeploy .gs)

## ไอเดียที่เสนอไว้ (ยังไม่ได้สั่ง)
- ป้าย "⚠ ค้างเกิน 7 วัน" บนการ์ดรอสับเปลี่ยน: เอาออก หรือเปลี่ยนเป็น "เกิน 30 วัน นับจากอนุมัติเชื่อมต่อ" ให้ตรงตาราง กฟฟ.
- การ์ดรอสร้าง CA 82: รายที่สับเปลี่ยนแล้วไม่นับวันรอ (แบบเดียวกับตาราง กฟฟ.)
- ปุ่ม export ตาราง กฟฟ./รายการคำขอ เป็น Excel (SheetJS มีอยู่แล้ว)
- เกณฑ์ค้างนานแยกตามสถานะ (เอกสาร 3 / จัดสรร 7 / สับเปลี่ยน 14 วัน) · ตัดคำนำหน้า กฟจ./กฟส. ในกราฟ

---

## ข้อความสำหรับเปิดหน้าต่างใหม่ (คัดลอกไปวาง)

```
ทำงานต่อ Dashboard ppim-solar-2569 (repo pasasorn/ppim-solar-2569)
อ่าน HANDOFF.md และ templates/session-summary-2569-11-04.md ก่อน แล้วยึดข้อตกลง: ตอบภาษาไทย · แก้บน main โดยตรง ตรวจ syntax แล้ว push main เลย · เรื่องกำกวมให้ถามก่อน · เสนอตัวเลือกขั้นต่อไปทุกครั้ง
สถานะล่าสุด (4 พ.ย. 2569): Auto deploy ติดที่ secret GAS_SCRIPT_ID (ต้องเป็น Script ID ไม่ใช่ Deployment ID) · รอยืนยัน Dashboard กลับมาโหลดได้หลัง Deploy New version · หมายเหตุ CA 82 รอ deploy .gs
งานถัดไปที่อยากทำ: <พิมพ์งานที่ต้องการ>
```
