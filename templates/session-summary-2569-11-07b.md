# สรุปงาน Dashboard PPIM Solar 2569 — 7 พ.ย. 2569 รอบบ่าย (ต่อจาก `session-summary-2569-11-07.md`)

> Repo: `pasasorn/ppim-solar-2569` · branch `main` · รายละเอียดระบบอยู่ใน `HANDOFF.md`

---

## ข้อตกลงการทำงาน (ใช้ต่อในหน้าต่างใหม่)
- ตอบเป็น **ภาษาไทย** · เรื่องกำกวม **ถามก่อนลงมือ** · เสนอตัวเลือกขั้นต่อไปท้ายทุกคำตอบ · ทำผิดให้บอก "don't accept it"
- แก้บน **`main` โดยตรง** → ตรวจ syntax → commit → `git push origin main`
- ตรวจ syntax `index.html` ตาม HANDOFF ข้อ 7 · `.gs`: `node -e "new Function(require('fs').readFileSync('apps-script-meter.gs','utf8'))"`
- ทดสอบ .gs ด้วย mock Node (จำลอง SpreadsheetApp/MailApp) · หน้าเว็บด้วย Playwright + stub `Chart` + route จำลอง `script.google.com`
- อ่านชีตได้ผ่าน Google Drive connector (`read_file_content` id `15MinRHg…`) — ได้เฉพาะแถวตัวอย่าง ค้นแถวเจาะจงไม่ได้
- แก้ตรรกะใน index.html ที่ชีตสรุปใช้ (`mergeRows` ฯลฯ) → `node tools/build-summary-gs.js` ทุกครั้ง
- ห้ามเปิดอ่านโฟลเดอร์ output / templates อัตโนมัติ

---

## งานที่เสร็จรอบนี้
| งาน | commit | redeploy .gs |
|---|---|---|
| หน้าจอโหลดตอนเปิดเว็บ: พระอาทิตย์**ยิ้มทะเล้น** (ขยิบตา แลบลิ้น) + % ประมาณการ · ล้มเหลวมีปุ่มลองใหม่ | `4b01504`,`9ae34e9` | ไม่ |
| **PDPA ตามจุดร่วมงาน** — API `data` ส่งชื่อเต็มเฉพาะแถวในจุดของ ผมต. · Admin/ผซฟ./กบล. เห็นทุกแถว | `59b0c74` | **ใช่** |
| Auto deploy: แจ้ง error แยก secret · กัน `AKfycb…` ผิดช่อง · actions v5/Node 22 | `bcc3744` | — |
| เมนูใหม่ **"อนุมัติผู้ลงทะเบียน (Admin)"** + ตัวเลขแดง + ป๊อปอัปเมื่อมีรายใหม่ (ตรวจทุก 2 นาที) | `2d41340` | ไม่ |
| **`empHub()`** — ทะเบียนจริงเก็บจุดในคอลัมน์ `กฟน.1` → ไล่ จุดร่วมงาน → กฟน.1 → สังกัด (ก่อนแก้: ผมต. ส่วนใหญ่ "ไม่มีจุดร่วมงาน") | `a672217` | **ใช่** |
| ชีต Grid "For P'Gift" **ใช้เฉพาะ Grid Capacity** (gridChk/tr/kva/trOwner) · เลิกเพิ่มคำขอที่มีเฉพาะชีต Grid (สาเหตุชื่อ "-" เช่น PPIM1A602230) · build ชีตสรุปใหม่ | `0ecdd77` | ไม่ (ชีตสรุปต้องวางใหม่) |
| **อีเมลแจ้ง Admin** เมื่อมีผู้ลงทะเบียน (MailApp · ผู้รับที่ tab ตั้งค่า) + ลิงก์ `#approve` → login แล้วไปหน้าอนุมัติ | `2cfded5` | **ใช่ + Run `testMail`** |
| คู่มือจัดแท็บพนักงานมิเตอร์ `templates/guide-emp-hub-column.md` | — | — |

## สิ่งที่ผู้ใช้ต้องทำ (เรียงตามลำดับ)
1. **Deploy Apps Script** (`apps-script-meter.gs` ล่าสุด) → New version บน deployment เดิม — ครอบคลุม `dllogs` + PDPA + `empHub` + อีเมล
2. ใน Apps Script เลือกฟังก์ชัน **`testMail`** → Run → อนุญาตสิทธิ์ "ส่งอีเมลในนามคุณ" → เช็กกล่องจดหมาย (tab `ตั้งค่า` จะมีแถว `อีเมลแจ้งเตือนผู้ลงทะเบียนใหม่` เพิ่ม — แก้/เพิ่มผู้รับได้)
3. ชีตสรุป Canva: วาง `apps-script-summary.gs` ใหม่ทับ
4. ~~ตั้ง secret `GAS_SCRIPT_ID`~~ ✅ ไม่ต้องแล้ว — Script ID (`1iPVVjNJ…` โปรเจกต์ผูกกับชีต) ใส่ใน workflow · **auto deploy สำเร็จ run #17 → deployment @28** (7 พ.ย. 2569 23:07)
5. (ไม่บังคับ) จัดแท็บพนักงานมิเตอร์ตามคู่มือ
6. ทดสอบ: ผมต. จุดหนึ่ง login → หัวฟอร์มขึ้นจุดร่วมงาน · แถวจุดอื่นชื่อปิดบัง · ดาวน์โหลดได้ · สมัครบัญชีทดสอบ → Admin ได้อีเมล+ป๊อปอัป → กดลิงก์ในอีเมลไปหน้าอนุมัติ

## งานค้าง / ไอเดีย
- ผลทดสอบจริง 5 ข้อจากรอบก่อน (ลบ `TEST01` หลังทดสอบ)
- หน้าเว็บแจ้ง ผมต. ว่า "เห็นข้อมูลส่วนบุคคลเฉพาะจุดร่วมงานของคุณ" (API คืน `scope`/`hub` แล้ว)
- ให้หน้าจอโหลดขึ้นตอนรีโหลด/login · Export ตัวชี้วัด 1_ภาพรวม/5_มิเตอร์ · งาน `present.html` (repo `ppim-dashboard`)

---

## ข้อความสำหรับเปิดหน้าต่างใหม่ (คัดลอกไปวาง)

```
ทำงานต่อ Dashboard ppim-solar-2569 (repo pasasorn/ppim-solar-2569)
อ่าน HANDOFF.md และ templates/session-summary-2569-11-07b.md ก่อน แล้วยึดข้อตกลง: ตอบภาษาไทย · แก้บน main โดยตรง ตรวจ syntax แล้ว push main เลย · เรื่องกำกวมให้ถามก่อน · เสนอตัวเลือกขั้นต่อไปทุกครั้ง
สถานะล่าสุด (7 พ.ย. 2569 บ่าย): หน้าจอโหลด · เมนูอนุมัติ+ป๊อปอัป · ชีต Grid ใช้เฉพาะ Grid เสร็จแล้ว · รอ deploy Apps Script (dllogs + PDPA ตามจุดร่วมงาน + empHub + อีเมลแจ้ง Admin → Run testMail) · auto deploy ใช้ได้แล้ว (push .gs → deploy เอง) · รอ Run testMail อนุญาตสิทธิ์ส่งอีเมล
งานถัดไปที่อยากทำ: <พิมพ์งานที่ต้องการ>
```
