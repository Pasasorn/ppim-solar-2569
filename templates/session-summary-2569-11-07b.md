# สรุปงาน Dashboard PPIM Solar 2569 — 7 พ.ย. 2569 รอบบ่าย (ต่อจาก `session-summary-2569-11-07.md`)

> Repo: `pasasorn/ppim-solar-2569` · branch `main` · รายละเอียดระบบอยู่ใน `HANDOFF.md`

---

## ข้อตกลงการทำงาน (ใช้ต่อในหน้าต่างใหม่)
- ตอบเป็น **ภาษาไทย** · เรื่องกำกวม **ถามก่อนลงมือ** · เสนอตัวเลือกขั้นต่อไปท้ายทุกคำตอบ · ทำผิดให้บอก "don't accept it"
- แก้บน **`main` โดยตรง** → ตรวจ syntax → commit → `git push origin main`
- ตรวจ syntax `index.html` ตาม HANDOFF ข้อ 7 · `.gs`: `node -e "new Function(require('fs').readFileSync('apps-script-meter.gs','utf8'))"`
- ทดสอบ .gs ด้วย mock Node (จำลอง SpreadsheetApp) · หน้าเว็บด้วย Playwright + stub `Chart` (CDN ถูกบล็อกในเครื่อง cloud) + route จำลอง `script.google.com`
- ห้ามเปิดอ่านโฟลเดอร์ output / templates อัตโนมัติ

---

## งานที่เสร็จรอบนี้
| งาน | commit | redeploy .gs |
|---|---|---|
| **หน้าจอโหลดตอนเปิดเว็บ** — พระอาทิตย์ SVG + % ประมาณการ (≤95% → 100% แล้วจางหาย) · โหลดไม่สำเร็จมีปุ่ม 🔄 ลองใหม่ / เข้าหน้าเว็บ | `4b01504` | ไม่ |
| เปลี่ยนหน้าเป็น **ยิ้มทะเล้น** (ขยิบตา แลบลิ้นส่าย) · ข้อความล้มเหลว "อุ๊ย! 😜" | `9ae34e9` | ไม่ |
| **PDPA ตามจุดร่วมงาน** — API `data` ส่งข้อมูลส่วนบุคคลเต็มเฉพาะแถวในจุดร่วมงานของ ผมต. · Admin/ผซฟ./กบล.กฟน.1 เห็นทุกแถว · ไม่ login/รออนุมัติ/ไม่มีจุด = ปิดบังทั้งหมด (ปิดช่องโหว่ F12) | `59b0c74` | **ใช่** |
| Auto deploy: แจ้ง error แยกตาม secret · กัน `AKfycb…` ผิดช่อง/รูปแบบผิด · actions v5 + Node 22 | `bcc3744` | — |

### กลไกใหม่ (.gs)
- `getAuthUser()` → `dataScope()` คืน `'all'` / ชื่อจุดร่วมงาน / `'none'` · `maskPii(tbl, keepHub)` ข้ามแถวที่ `rowHub()` ตรงจุดของผู้ใช้
- `rowHub()` = ตรรกะเดียวกับ `reqHub()` ในหน้าเว็บ (กฟฟ.ที่ตรวจสอบ → กฟฟ.พื้นที่ → จุดรวมงาน → `DEFAULT_HUB_MAP`) · คัดลอก `HUB_LIST`/`DEFAULT_HUB_MAP` มาจาก index.html — **แก้ที่หนึ่งต้องแก้อีกที่**
- ข้อจำกัด: การตั้งค่าจับคู่ กฟฟ. เพิ่มเองในหน้าเว็บ (`#hubCfg`) ไม่มีผลฝั่ง API → แถวที่จับคู่ด้วยวิธีนั้นจะยังปิดบังสำหรับ ผมต. จุดนั้น
- ลบ `isRegistered()` (ไม่ใช้แล้ว)

## สิ่งที่ผู้ใช้ต้องทำ
1. **Deploy Apps Script** (New version บน deployment เดิม) — รวม `dllogs` (`842d608`) + PDPA ตามจุดร่วมงาน (`59b0c74`)
2. **ตั้ง secret `GAS_SCRIPT_ID` ใหม่** (ตอนนี้ว่าง — run #11 ล้มด้วยเหตุนี้): GitHub repo → Settings → Secrets and variables → Actions → `GAS_SCRIPT_ID` = Script ID จาก Apps Script → ⚙️ Project Settings → IDs (ไม่ใช่ `AKfycb…`) → แท็บ Actions → Deploy Apps Script → Run workflow
3. ทดสอบหลัง deploy: login ผมต. จุดหนึ่ง → แถวจุดอื่นต้องเป็น "นายส*** ใ***" · Admin/ผซฟ./กบล. เห็นเต็ม · ดาวน์โหลดงานสับเปลี่ยนของ ผมต. ยังได้ชื่อเต็มของจุดตัวเอง

## งานค้าง / ไอเดีย
- ผลทดสอบจริง 5 ข้อจากรอบก่อน (ลงทะเบียน+รูป / อนุมัติ / เปลี่ยนรหัส / ดาวน์โหลด+log / บัญชีเดิม — ลบ `TEST01`)
- หน้าเว็บ: แจ้งผู้ใช้ ผมต. ว่า "เห็นข้อมูลส่วนบุคคลเฉพาะจุดร่วมงานของคุณ" (ใช้ `scope`/`hub` ที่ API คืนแล้ว)
- ให้หน้าจอโหลดขึ้นตอนรีโหลด/login ด้วย
- แจ้งเตือน Admin ทางอีเมลเมื่อมีผู้ลงทะเบียนใหม่ · Export ตัวชี้วัด 1_ภาพรวม/5_มิเตอร์ · งาน `present.html` (repo `ppim-dashboard`)

---

## ข้อความสำหรับเปิดหน้าต่างใหม่ (คัดลอกไปวาง)

```
ทำงานต่อ Dashboard ppim-solar-2569 (repo pasasorn/ppim-solar-2569)
อ่าน HANDOFF.md และ templates/session-summary-2569-11-07b.md ก่อน แล้วยึดข้อตกลง: ตอบภาษาไทย · แก้บน main โดยตรง ตรวจ syntax แล้ว push main เลย · เรื่องกำกวมให้ถามก่อน · เสนอตัวเลือกขั้นต่อไปทุกครั้ง
สถานะล่าสุด (7 พ.ย. 2569 บ่าย): หน้าจอโหลดพระอาทิตย์ยิ้มทะเล้น + % เสร็จแล้ว · PDPA ตามจุดร่วมงาน (API data) push แล้ว ต้อง deploy Apps Script (รวม dllogs) · auto deploy รอตั้ง secret GAS_SCRIPT_ID (ตอนนี้ว่าง)
งานถัดไปที่อยากทำ: <พิมพ์งานที่ต้องการ>
```
