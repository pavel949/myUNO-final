import fs from 'node:fs';

const th = {
  'legal.entity.title': 'ใครดำเนินการ myUNO',
  'legal.entity.controller_title': 'ผู้ควบคุมข้อมูล',
  'legal.entity.controller_body':
    'นิติบุคคลนี้เป็นผู้ควบคุมข้อมูลส่วนบุคคลที่เก็บผ่าน myUNO ภายใต้พระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคลของไทย (PDPA) ใช้ข้อมูลติดต่อด้านล่างสำหรับคำขอเข้าถึง แก้ไข หรือลบข้อมูล',
  'legal.entity.label.name': 'นิติบุคคลที่ดำเนินการ',
  'legal.entity.label.dbd_registration': 'ทะเบียน DBD',
  'legal.entity.label.address': 'ที่อยู่จดทะเบียน',
  'legal.entity.label.director': 'กรรมการผู้จัดการ',
  'legal.entity.label.email': 'อีเมล',
  'legal.entity.label.phone': 'โทรศัพท์',
  'legal.terms.pending':
    'ข้อกำหนดการให้บริการฉบับเต็มกำลังจัดทำร่วมกับที่ปรึกษากฎหมาย จนกว่าจะเผยแพร่ที่นี่ นิติบุคคลด้านล่างคือคู่สัญญาของคุณ และข้อมูลติดต่อคือช่องทางติดต่อเราเกี่ยวกับข้อกำหนดใดๆ',
  'legal.privacy.pending':
    'นโยบายความเป็นส่วนตัวฉบับเต็มกำลังจัดทำร่วมกับที่ปรึกษากฎหมาย จนกว่าจะเผยแพร่ที่นี่ ผู้ควบคุมที่ระบุด้านล่างรับผิดชอบข้อมูลส่วนบุคคลของคุณ และสิทธิที่สรุปในหน้านี้ยังคงมีผล',
  'legal.privacy.rights_title': 'สิทธิของคุณภายใต้ PDPA',
  'legal.privacy.rights_access': 'ขอทราบข้อมูลส่วนบุคคลที่เราเก็บเกี่ยวกับคุณ และขอสำเนา',
  'legal.privacy.rights_correct': 'ขอแก้ไขข้อมูลส่วนบุคคลที่ไม่ถูกต้อง',
  'legal.privacy.rights_delete':
    'ขอลบข้อมูลส่วนบุคคลของคุณ บันทึกที่ต้องเก็บตามกฎการเงินหรือตรวจคนเข้าเมืองจะยังคงไว้ และตัวตนของคุณจะถูกทำให้ไม่ระบุตัวตนแทน',
  'legal.privacy.rights_withdraw': 'ถอนความยินยอมที่คุณให้ไว้ได้ตลอดเวลา',
  'legal.privacy.rights_how':
    'ส่งคำขอใดๆ ไปยังอีเมลของผู้ควบคุมด้านล่าง เราตอบภายในระยะเวลาที่ PDPA กำหนด',
  'trust.verified.title': 'ผู้เข้าพักทุกคนผ่านการตรวจสอบ',
  'trust.verified.body':
    'เก็บหนังสือเดินทางก่อนมาถึงและยื่นต่อตรวจคนเข้าเมืองภายใน 24 ชั่วโมงตามกฎหมายไทย เจ้าของรู้ว่าใครพักในยูนิต ผู้เข้าพักรู้ว่าเพื่อนบ้านได้รับการตรวจสอบเช่นกัน',
  'trust.recorded.title': 'ทุกการชำระเงินมีบันทึก',
  'trust.recorded.body':
    'เงินสดหรือบัตร ทุกบาทมีใบเสร็จผูกกับการจองและบันทึกในบัญชีที่ไม่ถูกเขียนทับ งบเจ้าของติดตามย้อนกลับทีละบรรทัดถึงการจองและค่าใช้จ่าย',
  'trust.tracked.title': 'ทุกข้อร้องเรียนถูกติดตาม',
  'trust.tracked.body':
    'แจ้งปัญหาแล้วคุณเห็นสถานะและประวัติเดียวกับพนักงาน พร้อมนับเวลาตาม SLA ที่ประกาศ ไม่มีเรื่องใดจบลงโดยถูกลืมเงียบๆ',
  'trust.ombudsman_link': 'เกี่ยวกับผู้ตรวจการแผ่นดินอิสระ',
  'trust.ombudsman.pending':
    'เอกสารรับรองผู้ตรวจการแผ่นดินอิสระยังไม่เผยแพร่ เมื่อพร้อม เงื่อนไขการอุทธรณ์ฉบับเต็มจะแสดงที่นี่',
  'trust.ombudsman.meanwhile':
    'ระหว่างนี้ ทุกข้อร้องเรียนบนแพลตฟอร์มมีสถานะและประวัติที่มองเห็นได้',
  'trust.ombudsman.back': 'ความน่าเชื่อถือที่ myUNO ทำงานอย่างไร',
};

const path = 'src/modules/content/seed.ts';
const lines = fs.readFileSync(path, 'utf8').split('\n');
let updated = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const keyMatch = line.match(/key: '(legal\.[^']+|trust\.[^']+)'/);
  if (!keyMatch) continue;
  if (/,\s*th:\s*'/.test(line)) continue;
  const key = keyMatch[1];
  const translation = th[key];
  if (!translation) continue;
  const escaped = translation.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  if (line.includes("status: 'needs_review'")) {
    lines[i] = line.replace(
      /, status: 'needs_review'/,
      `, th: '${escaped}', status: 'needs_review'`,
    );
  } else {
    lines[i] = line.replace(/, status: NR/, `, th: '${escaped}', status: NR`);
  }
  updated++;
}

fs.writeFileSync(path, lines.join('\n'));
console.log(`Updated ${updated} legal/trust keys`);
