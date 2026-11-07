// สร้างไฟล์ apps-script-summary.gs จากตรรกะใน index.html (ให้ตัวเลขในชีตสรุปตรงกับ Dashboard เสมอ)
// วิธีใช้: node tools/build-summary-gs.js   → แล้ววางไฟล์ apps-script-summary.gs ทับใน Apps Script ของชีตสรุป
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tpl = fs.readFileSync(path.join(__dirname, 'summary-template.gs'), 'utf8');

// ชื่อ const/function ที่ต้องคัดลอกจาก index.html (ตามลำดับ)
const NAMES = ['STEPS', 'FIELDS', 'SLA', 'STEP_DISP', 'parseDate', 'classifyStatus', 'computeSla', 'daysBetween', 'addD',
  'computeMapping', 'buildRowsFrom', 'GRID_FIELDS', 'mergeRows', 'DEFAULT_HUB_MAP', 'METER_AGE_WARN', 'daysSince', 'METER_FLOW',
  'HUB_LIST', 'CEO_LIST', 'CEO_DISTRICTS', 'hubCEO', 'rowCEO', 'SLA_PHASES', 'slaStat', 'hubKey', 'canonHub', 'reqHub'];

const lines = html.split('\n');
function extract(name) {
  const re = new RegExp('^(const|let|function)\\s+' + name + '\\b');
  const start = lines.findIndex(l => re.test(l));
  if (start < 0) throw new Error('ไม่พบ ' + name + ' ใน index.html');
  let depth = 0, out = [], q = null;
  for (let i = start; i < lines.length; i++) {
    const l = lines[i]; out.push(l);
    for (let j = 0; j < l.length; j++) {
      const c = l[j];
      if (c === '\\') { j++; continue; }
      if (q) { if (c === q) q = null; continue; }
      if (c === "'" || c === '"' || c === '`') { q = c; continue; }
      if (c === '/' && l[j + 1] === '/') break;   // คอมเมนต์ท้ายบรรทัด
      if ('({['.includes(c)) depth++;
      else if (')}]'.includes(c)) depth--;
    }
    q = null;
    if (depth <= 0 && /[;}]\s*(\/\/.*)?$/.test(l.trim())) break;
  }
  return out.join('\n');
}
const blocks = NAMES.map(n => '// ---- ' + n + ' (จาก index.html)\n' + extract(n));
const out = tpl.replace('/*__DASHBOARD_LOGIC__*/', blocks.join('\n\n'))
  .replace('__BUILD_DATE__', new Date().toISOString().slice(0, 10));
fs.writeFileSync(path.join(root, 'apps-script-summary.gs'), out);
console.log('เขียน apps-script-summary.gs แล้ว (' + out.split('\n').length + ' บรรทัด)');
