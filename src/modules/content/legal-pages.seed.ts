/**
 * Q36: Seed legal page content — Terms of Service and Privacy Policy (doc 05 §1)
 * Both pages are needs_review drafts awaiting counsel review (CLAUDE.md, doc 12).
 *
 * Doc 12 §3 requires:
 * - PDPA compliance (Thailand Personal Data Protection Act)
 * - Clear data controller statement (myUNO = controller; Ignatev Estate = legal mandate)
 * - Cancellation policy transparency
 * - Guest funds handling (never held; provider pre-auth only)
 * - PII retention limits
 *
 * Founder to engage external counsel to finalize these templates.
 */

import { PrismaClient } from '@prisma/client';
import { ensureContentKey, setTranslation } from './content.service';

interface LegalPageDef {
  key: string;
  namespace: string;
  description: string;
  ru: string;
  en: string;
  th?: string;
  status?: 'ok' | 'needs_review';
}

const LEGAL_PAGE_KEYS: LegalPageDef[] = [
  // ============================================================================
  // TERMS OF SERVICE — Overview & Key Sections
  // ============================================================================
  {
    key: 'legal.terms.title',
    namespace: 'legal',
    description: 'Terms of Service page title',
    ru: 'Условия обслуживания',
    en: 'Terms of Service',
    th: 'ข้อกำหนดการให้บริการ',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.last_updated',
    namespace: 'legal',
    description: 'Terms last updated date (format: YYYY-MM-DD)',
    ru: 'Последнее обновление: [COUNSEL_TO_FILL]',
    en: 'Last updated: [COUNSEL_TO_FILL]',
    th: 'อัปเดตครั้งสุดท้าย: [COUNSEL_TO_FILL]',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.intro',
    namespace: 'legal',
    description: 'Terms of Service introduction',
    ru: 'Эти Условия обслуживания (далее "Условия") регулируют вашу использование платформы myUNO,' +
         ' включая веб-сайт, мобильное приложение и связанные сервисы' +
         ' (далее "Платформа"), предоставленные myUNO Platform Limited' +
         ' (далее "myUNO", "мы" или "нас") в соответствии с мандатом Ignatev Estate.' +
         ' Используя Платформу, вы согласны с этими Условиями.',
    en: 'These Terms of Service (the "Terms") govern your use of the myUNO platform,' +
        ' including the website, mobile app, and related services' +
        ' (the "Platform"), operated by myUNO Platform Limited' +
        ' (the "Company", "we", or "us") under Ignatev Estate\'s mandate.' +
        ' By using the Platform, you agree to these Terms.',
    th: 'ข้อกำหนดการให้บริการนี้ (ข้อกำหนด) ควบคุมการใช้แพลตฟอร์ม myUNO' +
         ' รวมถึงเว็บไซต์ แอปมือถือ และบริการที่เกี่ยวข้อง' +
         ' (แพลตฟอร์ม) ซึ่งดำเนินการโดย myUNO Platform Limited' +
         ' (บริษัท, "เรา" หรือ "ของเรา") ภายใต้อนุมัติของ Ignatev Estate' +
         ' การใช้แพลตฟอร์มถือว่าคุณยอมรับข้อกำหนดเหล่านี้',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.eligibility',
    namespace: 'legal',
    description: 'Terms: Eligibility section',
    ru: 'Вы должны быть в возрасте 18 лет и иметь право вступать в контракты по законодательству вашей юрисдикции.' +
         ' Если вы используете Платформу от имени организации, вы заявляете, что' +
         ' имеете право подписывать от ее имени.' +
         ' myUNO оставляет за собой право отклонить доступ любого лица или организации,' +
         ' которые не соответствуют этим требованиям.',
    en: 'You must be 18 years of age and legally able to enter contracts in your jurisdiction.' +
        ' If you use the Platform on behalf of an organization, you represent that you are authorized' +
        ' to bind it. myUNO reserves the right to deny access to anyone who does not meet these requirements.',
    th: 'คุณต้องมีอายุ 18 ปีขึ้นไปและมีสิทธิ์ทางกฎหมายในการเข้าทำสัญญาในเขตอำนาจของคุณ' +
         ' หากคุณใช้แพลตฟอร์มโดยนามขององค์กร คุณยืนยันว่าคุณมีอำนาจในการผูกมัด' +
         ' myUNO สงวนสิทธิ์ในการปฏิเสธการเข้าถึงใครก็ตามที่ไม่เป็นไปตามข้อกำหนดเหล่านี้',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.cancellation_policy',
    namespace: 'legal',
    description: 'Terms: Cancellation & Refunds section',
    ru: '[COUNSEL_TO_DRAFT: Политика отмены контролируется конфигурацией doc 04 §7,' +
         ' а не этим документом. Однако здесь необходимо описать механизм:' +
         ' гибкий/умеренный/строгий; как рассчитывается возврат;' +
         ' как гости могут оспаривать платежи.]',
    en: '[COUNSEL_TO_DRAFT: Cancellation policy is controlled by config (doc 04 §7),' +
        ' not this document. However, this section must describe the mechanics:' +
        ' flexible/moderate/strict; how refunds are calculated;' +
        ' how guests can dispute charges.]',
    th: '[COUNSEL_TO_DRAFT: นโยบายการยกเลิกควบคุมโดยการกำหนดค่า (doc 04 §7)' +
         ' ไม่ใช่เอกสารนี้ อย่างไรก็ตาม ส่วนนี้ต้องอธิบายกลไก:' +
         ' ยืดหยุ่น/ปานกลาง/เข้มงวด คำนวณเงินคืนอย่างไร' +
         ' ผู้เข้าพักสามารถโต้แย้งการเรียกเก็บเงินได้อย่างไร]',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.payment_terms',
    namespace: 'legal',
    description: 'Terms: Payments section',
    ru: '[COUNSEL_TO_DRAFT: ระบุการสนับสนุนวิธีการชำระเงิน' +
         ' ข้อมูลการปลอดภัยการจ่ายเงิน; ว่า myUNO ไม่เก็บเงินหรือบัตร' +
         ' (ทรัพยสินผู้ให้บริการเท่านั้น ดู doc 10 และ 12)]',
    en: '[COUNSEL_TO_DRAFT: Specify supported payment methods,' +
        ' payment security; that myUNO never holds funds or card details' +
        ' (provider-only assets; see doc 10 and 12)]',
    th: '[COUNSEL_TO_DRAFT: ระบุวิธีการชำระเงินที่รองรับ' +
         ' ความปลอดภัยในการชำระเงิน ว่า myUNO ไม่เก็บเงินหรือรายละเอียดบัตร' +
         ' (สินทรัพย์ผู้ให้บริการเท่านั้น ดู doc 10 และ 12)]',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.liability_limitation',
    namespace: 'legal',
    description: 'Terms: Limitation of Liability section',
    ru: '[COUNSEL_TO_DRAFT: ข้อจำกัดความรับผิด' +
         ' ยกเว้นอุตสาหกรรมบาท แรงคุณสมบูรณ์ และอื่น ๆ]',
    en: '[COUNSEL_TO_DRAFT: Limitation of liability,' +
        ' carve-outs for gross negligence, force majeure, etc.]',
    th: '[COUNSEL_TO_DRAFT: ข้อจำกัดความรับผิด' +
         ' ยกเว้นการประมาทเลินเล่อที่มากมาย แรงคุณสมบูรณ์ ฯลฯ]',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.dispute_resolution',
    namespace: 'legal',
    description: 'Terms: Dispute Resolution & Governing Law section',
    ru: '[COUNSEL_TO_DRAFT: การแก้ไขข้อพิพาท' +
         ' ที่ยุติธรรมในไทย; ข้อกำหนดการปกครอง (บอร์กห์รือพฤหัสบดี)]',
    en: '[COUNSEL_TO_DRAFT: Dispute resolution; Thai jurisdiction,' +
        ' governing law (Bangkok or Bangkok); arbitration or litigation clause.]',
    th: '[COUNSEL_TO_DRAFT: การแก้ไขข้อพิพาท; อำนาจศาลไทย' +
         ' กฎหมายควบคุม (เขตบางกอก); ข้อสัญญา สืบหรือสิ่งสาธารณูปโภค]',
    status: 'needs_review',
  },
  {
    key: 'legal.terms.termination',
    namespace: 'legal',
    description: 'Terms: Account Termination section',
    ru: '[COUNSEL_TO_DRAFT: myUNO' +
         ' สามารถระงับหรือสิ้นสุดบัญชีเพื่อเหตุผลใด ๆ (เนื้อหา ฟรี เป็นต้น)]',
    en: '[COUNSEL_TO_DRAFT: myUNO may suspend or terminate accounts' +
        ' for any reason (content policy, abuse, etc.)]',
    th: '[COUNSEL_TO_DRAFT: myUNO อาจระงับหรือสิ้นสุดบัญชี' +
         ' ด้วยเหตุผลใด ๆ (นโยบายเนื้อหา การใช้งานในทางที่ผิด ฯลฯ)]',
    status: 'needs_review',
  },

  // ============================================================================
  // PRIVACY POLICY — Data Protection & PDPA Compliance
  // ============================================================================
  {
    key: 'legal.privacy.title',
    namespace: 'legal',
    description: 'Privacy Policy page title',
    ru: 'Политика конфиденциальности',
    en: 'Privacy Policy',
    th: 'นโยบายความเป็นส่วนตัว',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.last_updated',
    namespace: 'legal',
    description: 'Privacy Policy last updated date (format: YYYY-MM-DD)',
    ru: 'Последнее обновление: [COUNSEL_TO_FILL]',
    en: 'Last updated: [COUNSEL_TO_FILL]',
    th: 'อัปเดตครั้งสุดท้าย: [COUNSEL_TO_FILL]',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.data_controller',
    namespace: 'legal',
    description: 'Privacy Policy: Data Controller statement',
    ru: 'myUNO Platform Limited (ที่อยู่: [COUNSEL_TO_FILL]) เป็นตัวควบคุมข้อมูลส่วนบุคคล' +
         ' ภายใต้กฎหมาย PDPA ของประเทศไทย และเพื่อสนับสนุนการดำเนินการของ Ignatev Estate' +
         ' (อยู่ที่: [COUNSEL_TO_FILL]).' +
         ' หากคุณมีคำถามเกี่ยวกับข้อมูลส่วนบุคคล ติดต่อ: privacy@myuno.app',
    en: 'myUNO Platform Limited (address: [COUNSEL_TO_FILL]) is the Data Controller' +
        ' under Thailand\'s PDPA and to support Ignatev Estate\'s operations' +
        ' (address: [COUNSEL_TO_FILL]).' +
        ' For questions about your personal data, contact: privacy@myuno.app',
    th: 'myUNO Platform Limited (ที่อยู่: [COUNSEL_TO_FILL]) เป็นตัวควบคุมข้อมูล' +
         ' ภายใต้ PDPA ของประเทศไทย และเพื่อสนับสนุนการดำเนินการของ Ignatev Estate' +
         ' (ที่อยู่: [COUNSEL_TO_FILL])' +
         ' สำหรับคำถามเกี่ยวกับข้อมูลส่วนบุคคล โปรดติดต่อ: privacy@myuno.app',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.data_collection',
    namespace: 'legal',
    description: 'Privacy Policy: Data Collection section',
    ru: 'เราเก็บรวบรวมข้อมูลดังต่อไปนี้:' +
         ' - ข้อมูลบัญชี (ชื่อ อีเมล โทรศัพท์ รหัสผ่าน)' +
         ' - ข้อมูลการชำระเงิน (วิธีการชำระเงิน ที่อยู่ออกบิล)' +
         ' - ข้อมูลการจอง (วันที่ ความต้องการ เพื่อให้สำเร็จได้)' +
         ' - ข้อมูลตัวตน (สำเนาหนังสือเดินทาง วันเกิด - สำหรับการยืนยัน)' +
         ' - ข้อมูลการติดต่อ (ประวัติข้อความ โทรศัพท์ การสื่อสาร)' +
         ' - ข้อมูลวิเคราะห์ (วิธีการใช้งานเว็บไซต์และแอป)',
    en: 'We collect the following data:' +
        ' - Account Information (name, email, phone, password)' +
        ' - Payment Data (payment method, billing address)' +
        ' - Booking Information (dates, requests, preferences)' +
        ' - Identity Information (passport copy, date of birth — for verification)' +
        ' - Communication Data (message history, phone, correspondence)' +
        ' - Analytics Data (how you use the website and app)',
    th: 'เราเก็บรวบรวมข้อมูลต่อไปนี้:' +
         ' - ข้อมูลบัญชี (ชื่อ อีเมล โทรศัพท์ รหัสผ่าน)' +
         ' - ข้อมูลการชำระเงิน (วิธีการชำระเงิน ที่อยู่ออกบิล)' +
         ' - ข้อมูลการจอง (วันที่ คำขอ ความชอบ)' +
         ' - ข้อมูลตัวตน (สำเนาหนังสือเดินทาง วันเกิด - สำหรับการยืนยัน)' +
         ' - ข้อมูลการสื่อสาร (ประวัติข้อความ โทรศัพท์ การติดต่อ)' +
         ' - ข้อมูลการวิเคราะห์ (วิธีที่คุณใช้เว็บไซต์และแอป)',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.data_retention',
    namespace: 'legal',
    description: 'Privacy Policy: Data Retention section',
    ru: 'Kami menyimpan data Anda sesuai dengan:' +
         ' - Akun & Profil: Disimpan selama akun aktif + 90 hari; dapat diminta dihapus kapan saja.' +
         ' - Data Pembayaran: Tidak pernah disimpan di sistem kami (diproses oleh penyedia pihak ketiga).' +
         ' - Paspor & Identitas: Dihapus 7 tahun setelah checkout (persyaratan kepatuhan Thailand).' +
         ' - Pesan: Disimpan selamanya; dapat diarsipkan/dihapus oleh peserta kapan saja.' +
         ' - Data Analitik: Disimpan 12 bulan untuk pelaporan; dianonimkan setelah itu.',
    en: 'We retain your data as follows:' +
        ' - Account & Profile: Kept while active + 90 days; can be deleted anytime on request.' +
        ' - Payment Data: Never stored in our system (processed by third-party provider).' +
        ' - Passports & Identity: Deleted 7 years after checkout (Thailand compliance requirement).' +
        ' - Messages: Kept indefinitely; can be archived/deleted by participants anytime.' +
        ' - Analytics Data: Kept 12 months for reporting; anonymized after that.',
    th: 'เราเก็บข้อมูลของคุณดังนี้:' +
         ' - บัญชี & โปรไฟล์: เก็บไว้ขณะที่ใช้งาน + 90 วัน สามารถลบได้ตลอดเวลาตามคำขอ' +
         ' - ข้อมูลการชำระเงิน: ไม่เก็บไว้ในระบบของเรา (ประมวลผลโดยผู้ให้บริการบริษัทอื่น)' +
         ' - หนังสือเดินทางและตัวตน: ลบหลังจาก 7 ปี หลังจากการเช็คเอาต์ (ข้อกำหนดการปฏิบัติตามของไทย)' +
         ' - ข้อความ: เก็บไว้ตลอดไป สามารถเก็บถาวร/ลบโดยผู้เข้าร่วมตลอดเวลา' +
         ' - ข้อมูลการวิเคราะห์: เก็บไว้ 12 เดือนสำหรับการรายงาน ไม่เปิดเผยตัวตนหลังจากนั้น',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.user_rights',
    namespace: 'legal',
    description: 'Privacy Policy: PDPA Rights section (Thailand Personal Data Protection Act)',
    ru: 'ภายใต้ PDPA ของประเทศไทย คุณมีสิทธิ์ต่อไปนี้:' +
         ' - เข้าถึง: ขอสำเนาข้อมูลส่วนบุคคลของคุณ' +
         ' - แก้ไข: ปรับปรุงข้อมูลที่ไม่ถูกต้องหรือไม่สมบูรณ์' +
         ' - ลบ (\"สิทธิการลืม\"): ขอให้ลบข้อมูลของคุณ เว้นแต่จำเป็นสำหรับการปฏิบัติตามกฎหมาย' +
         ' - ถอนความยินยอม: ยกเลิกการให้การประมวลผลข้อมูล' +
         ' - สิทธิอื่น ๆ: ตามที่อนุญาตโดย PDPA' +
         ' การปฏิเสธการลบข้อมูลทางบัญชีที่ยังคงต้อง (บัญชีที่ได้รับใบอนุญาต)',
    en: 'Under Thailand\'s PDPA, you have the following rights:' +
        ' - Access: Request a copy of your personal data.' +
        ' - Correction: Update inaccurate or incomplete information.' +
        ' - Deletion ("Right to be Forgotten"): Request deletion of your data, except where legally required.' +
        ' - Withdraw Consent: Opt out of data processing.' +
        ' - Other Rights: As permitted by PDPA.' +
        ' Exception: We retain compliance records indefinitely.',
    th: 'ภายใต้ PDPA ของประเทศไทย คุณมีสิทธิ์ต่อไปนี้:' +
         ' - เข้าถึง: ขอสำเนาข้อมูลส่วนบุคคลของคุณ' +
         ' - แก้ไข: ปรับปรุงข้อมูลที่ไม่ถูกต้องหรือไม่สมบูรณ์' +
         ' - ลบ (\"สิทธิ์ที่จะลืม\"): ขอให้ลบข้อมูลของคุณ เว้นแต่จำเป็นตามกฎหมาย' +
         ' - ถอนความยินยอม: ปฏิเสธการประมวลผลข้อมูล' +
         ' - สิทธิอื่น ๆ: ตามที่อนุญาตโดย PDPA' +
         ' ข้อยกเว้น: เราเก็บบันทึกการปฏิบัติตามกฎหมายเป็นอนันต์',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.security',
    namespace: 'legal',
    description: 'Privacy Policy: Security section',
    ru: 'Kami menggunakan enkripsi end-to-end (AES-256-GCM) untuk data identitas sensitif (paspor, tanggal lahir).' +
         ' Semua data dalam transit melalui HTTPS.' +
         ' Akses ke data sensitif dicatat dalam jejak audit PDPA.' +
         ' Server dihosting di fasilitas aman dengan akses terbatas.' +
         ' Kami melakukan pembaruan keamanan reguler dan pengujian penetrasi.' +
         ' Tidak ada sistem sempurna; beri tahu kami tentang ancaman keamanan segera.',
    en: 'We use end-to-end encryption (AES-256-GCM) for sensitive identity data (passports, DOB).' +
        ' All data in transit uses HTTPS.' +
        ' Access to sensitive data is logged in PDPA audit trails.' +
        ' Servers are hosted in secure facilities with restricted access.' +
        ' We perform regular security updates and penetration testing.' +
        ' No system is perfect; please report security threats immediately.',
    th: 'เราใช้การเข้ารหัสแบบปลายถึงปลาย (AES-256-GCM) สำหรับข้อมูลตัวตนที่ละเอียดอ่อน (หนังสือเดินทาง DOB)' +
         ' ข้อมูลทั้งหมดในการขนส่งใช้ HTTPS' +
         ' การเข้าถึงข้อมูลที่ละเอียดอ่อนจะถูกบันทึกในการตรวจสอบ PDPA' +
         ' เซิร์ฟเวอร์โฮสต์ในสิ่งอำนวยความสะดวกที่ปลอดภัยพร้อมการเข้าถึงที่ถูก จำกัด' +
         ' เราดำเนินการปรับปรุงความปลอดภัยอย่างสม่ำเสมอและการทดสอบการทะลวง' +
         ' ไม่มีระบบที่สมบูรณ์แบบ โปรดรายงานภัยคุกคามด้านความปลอดภัยโดยทันที',
    status: 'needs_review',
  },
  {
    key: 'legal.privacy.contact',
    namespace: 'legal',
    description: 'Privacy Policy: Contact section',
    ru: 'Для ซักถามเกี่ยวกับความเป็นส่วนตัวหรือการขอสิทธิ PDPA โปรดติดต่อ:' +
         ' อีเมล: privacy@myuno.app' +
         ' โทรศัพท์: [COUNSEL_TO_FILL]' +
         ' ข้อความ: myUNO In-app Chat Support',
    en: 'For privacy inquiries or PDPA rights requests, please contact:' +
        ' Email: privacy@myuno.app' +
        ' Phone: [COUNSEL_TO_FILL]' +
        ' Message: myUNO In-app Chat Support',
    th: 'สำหรับคำถามด้านความเป็นส่วนตัวหรือคำขอสิทธิ PDPA โปรดติดต่อ:' +
         ' อีเมล: privacy@myuno.app' +
         ' โทรศัพท์: [COUNSEL_TO_FILL]' +
         ' ข้อความ: myUNO In-app Chat Support',
    status: 'needs_review',
  },
];

export async function seedLegalPages(db: PrismaClient, systemIdentityId?: string): Promise<void> {
  // Ensure system identity exists to author seeded translations
  let identityId = systemIdentityId;
  if (!identityId) {
    const system = await db.identity.upsert({
      where: { email: 'system@myuno.internal' },
      update: {},
      create: {
        firstName: 'myUNO',
        lastName: 'System',
        email: 'system@myuno.internal',
        status: 'active',
        preferredLocale: 'en',
        isAdmin: true,
      },
      select: { id: true },
    });
    identityId = system.id;
  }

  for (const keyDef of LEGAL_PAGE_KEYS) {
    await ensureContentKey(db, keyDef.key, keyDef.namespace, keyDef.description);

    const translations: Record<string, string> = {
      ru: keyDef.ru,
      en: keyDef.en,
    };
    if (keyDef.th) translations.th = keyDef.th;

    for (const [locale, text] of Object.entries(translations)) {
      await setTranslation(db, keyDef.key, locale as any, text, keyDef.status || 'ok', identityId);
    }
  }
}
