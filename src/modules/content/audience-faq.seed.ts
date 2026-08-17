/**
 * Q35: Seed audience FAQ content for five key audiences (doc 05 §1)
 * Each FAQ is a needs_review draft awaiting founder tone review (CLAUDE.md).
 *
 * Audiences:
 * 1. Guests (travelers booking stays)
 * 2. Owners (property investors/residents)
 * 3. Developers (third-party integrators, API consumers)
 * 4. Buyers (prospective property purchasers via Ignatev model)
 * 5. Management Companies (professional property managers)
 *
 * The FAQ mechanism is built in T-035 (SEO layer, schema.org FAQPage);
 * this file seeds the copy. Founder to review and lock tone per brand layers
 * (doc CLAUDE.md: Ignatev / ClearView / myUNO / Asset tones).
 */

import { PrismaClient } from '@prisma/client';
import { ensureContentKey, setTranslation } from './content.service';

interface FAQDef {
  key: string;
  namespace: string;
  description: string;
  ru: string;
  en: string;
  th?: string;
  status?: 'ok' | 'needs_review';
}

const AUDIENCE_FAQ_KEYS: FAQDef[] = [
  // ============================================================================
  // 1. GUESTS (travelers, bookers)
  // ============================================================================
  {
    key: 'faq.guests.safety_trust',
    namespace: 'faq',
    description: 'FAQ: How safe and trustworthy is myUNO for guests?',
    ru: 'Как я могу быть уверен, что myUNO — надежная платформа для бронирования?',
    en: 'How safe and trustworthy is myUNO for guests?',
    th: 'myUNO นั้นปลอดภัยและน่าเชื่อถือสำหรับผู้เข้าพัก?',
    status: 'needs_review',
  },
  {
    key: 'faq.guests.safety_trust_answer',
    namespace: 'faq',
    description: 'FAQ answer: Trust and safety',
    ru: 'Каждый гость проходит верификацию, а каждое имущество — полный аудит.' +
         ' Все транзакции защищены, и мы гарантируем возврат средств в соответствии с политикой отмены.' +
         ' Хозяева недвижимости оценены предыдущими гостями, и у нас есть 24/7 поддержка.',
    en: 'Every guest is verified, and every property undergoes a full audit. All transactions are secure,' +
        ' and we guarantee refunds according to our cancellation policy. Hosts are rated by past guests,' +
        ' and we offer 24/7 support.',
    th: 'ผู้เข้าพักทุกคนจะต้องผ่านการยืนยันตัวตน และทรัพย์สินทุกแห่งจะได้รับการตรวจสอบอย่างละเอียด' +
         ' ธุรกรรมทั้งหมดมีการป้องกัน และเรารับประกันการคืนเงินตามนโยบายการยกเลิก' +
         ' เจ้าของบ้านได้รับการประเมินโดยผู้เข้าพักในอดีต และเรามีการสนับสนุน 24/7',
    status: 'needs_review',
  },
  {
    key: 'faq.guests.cancellation_policy',
    namespace: 'faq',
    description: 'FAQ: What if I need to cancel my booking?',
    ru: 'Что будет, если мне нужно отменить бронирование?',
    en: 'What if I need to cancel my booking?',
    th: 'จะเกิดอะไรขึ้นถ้าฉันต้องยกเลิกการจองของฉัน?',
    status: 'needs_review',
  },
  {
    key: 'faq.guests.cancellation_policy_answer',
    namespace: 'faq',
    description: 'FAQ answer: Cancellation',
    ru: 'Размер возврата зависит от политики отмены объекта и того, за сколько времени до заезда вы отменяете.' +
         ' Гибкая политика позволяет полный возврат за семь дней до заезда.' +
         ' Умеренная политика требует три дня. Строгая политика возвращает только 50%.' +
         ' Проверьте условия при бронировании.',
    en: 'Refund amount depends on the property\'s cancellation policy and how far in advance you cancel.' +
        ' Flexible policies allow full refunds up to 7 days before check-in.' +
        ' Moderate policies require 3 days notice. Strict policies refund 50%.' +
        ' Check terms at booking.',
    th: 'จำนวนการคืนเงินขึ้นอยู่กับนโยบายการยกเลิกของทรัพย์สินและระยะเวลาที่คุณยกเลิกล่วงหน้า' +
         ' นโยบายที่ยืดหยุ่นอนุญาตให้คืนเงินเต็มจนถึง 7 วันก่อนการเข้าพัก' +
         ' นโยบายปานกลางต้องการการแจ้งล่วงหน้า 3 วัน นโยบายที่เข้มงวดคืนเงิน 50%' +
         ' ตรวจสอบเงื่อนไขขณะจอง',
    status: 'needs_review',
  },
  {
    key: 'faq.guests.payment_methods',
    namespace: 'faq',
    description: 'FAQ: What payment methods do you accept?',
    ru: 'Какие способы оплаты вы принимаете?',
    en: 'What payment methods do you accept?',
    th: 'คุณยอมรับวิธีการชำระเงินใด?',
    status: 'needs_review',
  },
  {
    key: 'faq.guests.payment_methods_answer',
    namespace: 'faq',
    description: 'FAQ answer: Payment methods',
    ru: 'Мы принимаем основные кредитные карты (Visa, Mastercard), банковские переводы и наличные платежи.' +
         ' Все платежи обрабатываются безопасно. В некоторых регионах доступны локальные методы.',
    en: 'We accept major credit cards (Visa, Mastercard), bank transfers, and cash payments.' +
        ' All transactions are processed securely. Local payment methods available in some regions.',
    th: 'เรายอมรับบัตรเครดิตหลัก (Visa, Mastercard), การโอนธนาคาร และการชำระเงินสด' +
         ' ธุรกรรมทั้งหมดจะถูกประมวลผลอย่างปลอดภัย' +
         ' วิธีการชำระเงินในท้องถิ่นมีอยู่ในบางภูมิภาค',
    status: 'needs_review',
  },

  // ============================================================================
  // 2. OWNERS (property investors, resident owners)
  // ============================================================================
  {
    key: 'faq.owners.management_model',
    namespace: 'faq',
    description: 'FAQ: How does the management model work?',
    ru: 'Как работает модель управления недвижимостью?',
    en: 'How does the management model work?',
    th: 'แบบจำลองการจัดการทำงานอย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.owners.management_model_answer',
    namespace: 'faq',
    description: 'FAQ answer: Management model',
    ru: 'myUNO предлагает три варианта: полное управление (myUNO может принимать гостей и управлять всем),' +
         ' управление через компанию (MC обрабатывает бронирования и операции),' +
         ' или независимое (вы управляете все сами).' +
         ' Каждая модель имеет соответствующую комиссию за управление и условия.',
    en: 'myUNO offers three options: full management (myUNO books guests and handles operations),' +
        ' management company model (MC processes bookings and operations),' +
        ' or owner-direct (you manage everything).' +
        ' Each model has corresponding management fees and terms.',
    th: 'myUNO มีตัวเลือกสามตัวเลือก: การจัดการเต็มรูปแบบ (myUNO จองผู้เข้าพักและจัดการการดำเนินงาน),' +
         ' บริษัทจัดการ (MC ประมวลผลการจองและการดำเนินงาน),' +
         ' หรือเจ้าของโดยตรง (คุณจัดการทุกอย่าง)' +
         ' แต่ละแบบจำลองมีค่าธรรมเนียมการจัดการและเงื่อนไขที่เกี่ยวข้อง',
    status: 'needs_review',
  },
  {
    key: 'faq.owners.revenue_sharing',
    namespace: 'faq',
    description: 'FAQ: How are revenues shared with owners?',
    ru: 'Как распределяется доход между владельцами?',
    en: 'How are revenues shared with owners?',
    th: 'รายได้แบ่งปันกับเจ้าของอย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.owners.revenue_sharing_answer',
    namespace: 'faq',
    description: 'FAQ answer: Revenue sharing',
    ru: 'Ежемесячная выписка показывает валовой доход от бронирований, вычитаемые комиссии и расходы,' +
         ' а также распределяемую сумму для вас. Все суммы рассчитаны на сервере и прозрачны.' +
         ' Разные контракты предусматривают разные базы расчетов (GOP, NOI и т.д.).' +
         ' Подробности указаны в вашем контракте управления.',
    en: 'Monthly statements show gross booking revenue, deducted fees and expenses,' +
        ' and your distributable amount. All amounts are server-calculated and transparent.' +
        ' Different contracts specify different calculation bases (GOP, NOI, etc.).' +
        ' Details are in your management contract.',
    th: 'งบบัญชีรายเดือนแสดงรายได้จากการจองแบบรวม ค่าธรรมเนียมและค่าใช้จ่ายที่หักลบ' +
         ' และจำนวนที่จำหน่ายให้กับคุณ จำนวนทั้งหมดจะคำนวณบนเซิร์ฟเวอร์และมีความโปร่งใส' +
         ' สัญญาต่างๆ ระบุฐานการคำนวณที่แตกต่างกัน (GOP, NOI ฯลฯ)' +
         ' รายละเอียดอยู่ในสัญญาการจัดการของคุณ',
    status: 'needs_review',
  },
  {
    key: 'faq.owners.support_sla',
    namespace: 'faq',
    description: 'FAQ: What level of support will I receive?',
    ru: 'Какой уровень поддержки я получу?',
    en: 'What level of support will I receive?',
    th: 'ฉันจะได้รับการสนับสนุนในระดับใด?',
    status: 'needs_review',
  },
  {
    key: 'faq.owners.support_sla_answer',
    namespace: 'faq',
    description: 'FAQ answer: Support SLA',
    ru: 'myUNO предоставляет поддержку 24/7 через мобильный чат, электронную почту и звонки.' +
         ' Критические вопросы (например, гость не может попасть) решаются в течение часа.' +
         ' Обычные запросы рассматриваются в течение 4 часов рабочих дней,' +
         ' и административные вопросы в течение одного рабочего дня.' +
         ' Вы также получите доступ к панели управления в реальном времени.',
    en: 'myUNO provides 24/7 support via mobile chat, email, and calls.' +
        ' Critical issues (e.g. guest locked out) are resolved within one hour.' +
        ' Routine requests are answered within 4 business hours,' +
        ' and administrative queries within one business day.' +
        ' You also get access to a real-time management dashboard.',
    th: 'myUNO ให้การสนับสนุน 24/7 ผ่านแชทมือถือ อีเมล และการโทร' +
         ' ปัญหาที่มีความสำคัญ (เช่น ผู้เข้าพักล็อกอยู่นอก) จะได้รับการแก้ไขภายในหนึ่งชั่วโมง' +
         ' คำขอตามปกติจะได้รับคำตอบภายใน 4 ชั่วโมงในวันทำการ' +
         ' และคำค้นหาด้านการบริหารภายในหนึ่งวันทำการ' +
         ' คุณยังได้รับการเข้าถึงแดชบอร์ดการจัดการแบบเรียลไทม์',
    status: 'needs_review',
  },

  // ============================================================================
  // 3. DEVELOPERS (API consumers, integrators)
  // ============================================================================
  {
    key: 'faq.developers.api_access',
    namespace: 'faq',
    description: 'FAQ: How do I access the myUNO API?',
    ru: 'Как я получу доступ к API myUNO?',
    en: 'How do I access the myUNO API?',
    th: 'ฉันจะเข้าถึง API ของ myUNO ได้อย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.developers.api_access_answer',
    namespace: 'faq',
    description: 'FAQ answer: API access',
    ru: 'Документация API доступна на developers.myuno.com (Q1: URL TBD).' +
         ' Вы можете запросить ключ API в консоли администратора.' +
         ' Мы предоставляем REST API для бронирований, управления недвижимостью и отчетов.' +
         ' Все запросы должны включать токен Bearer и используют HTTPS.',
    en: 'API documentation is available at developers.myuno.com (Q1: URL TBD).' +
        ' You can request an API key from the admin console.' +
        ' We provide REST endpoints for bookings, property management, and reporting.' +
        ' All requests require Bearer token authentication and use HTTPS.',
    th: 'เอกสาร API พร้อมใช้งานที่ developers.myuno.com (Q1: URL TBD)' +
         ' คุณสามารถขอคีย์ API จากคอนโซลผู้ดูแลระบบ' +
         ' เรามีจุดท้ายสุด REST สำหรับการจองบ้าน การจัดการทรัพย์สิน และการรายงาน' +
         ' คำขอทั้งหมดต้องมีการพิสูจน์ยืนยันโทเค็น Bearer และใช้ HTTPS',
    status: 'needs_review',
  },
  {
    key: 'faq.developers.rate_limits',
    namespace: 'faq',
    description: 'FAQ: What are the API rate limits?',
    ru: 'Каковы ограничения частоты вызовов API?',
    en: 'What are the API rate limits?',
    th: 'ขีดจำกัดอัตราของ API คืออะไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.developers.rate_limits_answer',
    namespace: 'faq',
    description: 'FAQ answer: Rate limits',
    ru: 'Бесплатные учетные записи разработчика ограничены 1000 запросов в день.' +
         ' Платные планы (начиная с $50/месяц) дают 10 000 запросов в день.' +
         ' Enterprise планы предлагают пользовательские лимиты.' +
         ' Поддержка в режиме реального времени включена для платных планов.',
    en: 'Free developer accounts are limited to 1,000 requests per day.' +
        ' Paid plans (starting $50/month) provide 10,000 requests per day.' +
        ' Enterprise plans offer custom limits.' +
        ' Real-time support is included for paid plans.',
    th: 'บัญชีผู้พัฒนาแบบฟรีจำกัดไว้ที่ 1,000 คำขอต่อวัน' +
         ' แผนที่จ่ายเงิน (เริ่มต้น $50/เดือน) ให้ 10,000 คำขอต่อวัน' +
         ' แผน Enterprise มีขีดจำกัดแบบกำหนดเอง' +
         ' การสนับสนุนแบบเรียลไทม์รวมอยู่ในแผนที่จ่ายเงิน',
    status: 'needs_review',
  },
  {
    key: 'faq.developers.webhooks',
    namespace: 'faq',
    description: 'FAQ: Do you support webhooks?',
    ru: 'Вы поддерживаете webhooks?',
    en: 'Do you support webhooks?',
    th: 'คุณสนับสนุน webhooks หรือไม่?',
    status: 'needs_review',
  },
  {
    key: 'faq.developers.webhooks_answer',
    namespace: 'faq',
    description: 'FAQ answer: Webhooks',
    ru: 'Да. Вы можете подписаться на события бронирования, платежей, сообщений и управления имуществом.' +
         ' Webhooks отправляются в режиме реального времени на вашу конечную точку с подписью HMAC.' +
         ' Мы повторяем попытки доставки в течение 24 часов.',
    en: 'Yes. You can subscribe to booking, payment, messaging, and property management events.' +
        ' Webhooks are delivered in real-time to your endpoint with HMAC signature verification.' +
        ' We retry delivery for 24 hours.',
    th: 'ใช่. คุณสามารถสมัครรับข้อมูลการจองและกิจกรรมการจัดการทรัพย์สิน' +
         ' Webhooks ส่งมอบแบบเรียลไทม์ไปยังจุดสิ้นสุดของคุณพร้อมการตรวจสอบลายเซ็น HMAC' +
         ' เราลองส่งมอบใหม่เป็นเวลา 24 ชั่วโมง',
    status: 'needs_review',
  },

  // ============================================================================
  // 4. BUYERS (prospective property purchasers, Ignatev model)
  // ============================================================================
  {
    key: 'faq.buyers.investment_model',
    namespace: 'faq',
    description: 'FAQ: What is the Ignatev investment model?',
    ru: 'Что такое модель инвестиций Игнатьев?',
    en: 'What is the Ignatev investment model?',
    th: 'แบบจำลองการลงทุน Ignatev คืออะไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.buyers.investment_model_answer',
    namespace: 'faq',
    description: 'FAQ answer: Investment model',
    ru: 'Модель Игнатьева предлагает собственникам возможность приобретать недвижимость в Пхукете' +
         ' с целью долгосрочного накопления капитала.' +
         ' После покупки ваша недвижимость может быть внесена в операционную платформу myUNO' +
         ' для управления арендой или вы можете управлять ею независимо.' +
         ' Компания Ignatev Estate предоставляет поддержку в приобретении и квалификации активов.',
    en: 'The Ignatev model enables owners to purchase properties in Phuket' +
        ' with the goal of long-term capital appreciation.' +
        ' After purchase, your property can be enrolled in the myUNO operating platform' +
        ' for rental management or you can manage it independently.' +
        ' Ignatev Estate provides acquisition and asset qualification support.',
    th: 'แบบจำลอง Ignatev ช่วยให้เจ้าของสามารถซื้อทรัพย์สินในภูเก็ตได้' +
         ' โดยมีเป้าหมายเพื่อเพิ่มมูลค่าเงินทุนในระยะยาว' +
         ' หลังจากการซื้อ ทรัพย์สินของคุณสามารถลงทะเบียนในแพลตฟอร์มการทำงาน myUNO ได้' +
         ' สำหรับการจัดการการเช่า หรือคุณสามารถจัดการได้อย่างอิสระ' +
         ' Ignatev Estate ให้การสนับสนุนในการซื้อและการรับรองสินทรัพย์',
    status: 'needs_review',
  },
  {
    key: 'faq.buyers.acquisition_process',
    namespace: 'faq',
    description: 'FAQ: How does the acquisition process work?',
    ru: 'Как работает процесс приобретения?',
    en: 'How does the acquisition process work?',
    th: 'กระบวนการซื้อทำงานอย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.buyers.acquisition_process_answer',
    namespace: 'faq',
    description: 'FAQ answer: Acquisition process',
    ru: 'Процесс состоит из четырех этапов: (1) Квалификация активов (ClearView проверяет пригодность),' +
         ' (2) Переговоры и проверка (юридическая проверка, условия), (3) Финансирование и закрытие,' +
         ' (4) Мобилизация (управление недвижимостью начинается). Весь процесс обычно занимает 8–12 недель.' +
         ' Мы предоставляем поддержку на каждом этапе.',
    en: 'The process comprises four stages: (1) Asset Qualification (ClearView vets suitability),' +
        ' (2) Negotiation and Due Diligence (legal audit, terms),' +
        ' (3) Financing and Closing, (4) Mobilization (property management begins).' +
        ' The full process typically takes 8–12 weeks. We support you at every stage.',
    th: 'กระบวนการประกอบด้วยสี่ขั้นตอน (1) การรับรองสินทรัพย์ (ClearView ตรวจสอบความเหมาะสม)' +
         ' (2) การเจรจาและการตรวจสอบอย่างละเอียด (การตรวจสอบทางกฎหมาย เงื่อนไข)' +
         ' (3) การจัดหาเงินและการปิด (4) การเปิดตัว (การจัดการทรัพย์สินเริ่มต้น)' +
         ' กระบวนการที่สมบูรณ์โดยทั่วไปใช้เวลา 8–12 สัปดาห์' +
         ' เราให้การสนับสนุนคุณในแต่ละขั้นตอน',
    status: 'needs_review',
  },
  {
    key: 'faq.buyers.legal_compliance',
    namespace: 'faq',
    description: 'FAQ: What are the legal requirements for foreign buyers?',
    ru: 'Каковы юридические требования для иностранных покупателей?',
    en: 'What are the legal requirements for foreign buyers?',
    th: 'ข้อกำหนดทางกฎหมายสำหรับผู้ซื้อต่างชาติคืออะไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.buyers.legal_compliance_answer',
    namespace: 'faq',
    description: 'FAQ answer: Legal requirements',
    ru: 'อพยพในประเทศไทยต้องเป็นไปตามกฎหมายการซื้อที่ดินของประเทศไทย ซึ่งมีข้อจำกัดเฉพาะ।' +
         ' โครงสร้างทั่วไปคือ บริษัท จดทะเบียนในประเทศไทย ที่ถือครองและจัดการทรัพย์สิน' +
         ' (ซึ่ง Ignatev Estate ช่วยอำนวย)। ต้องสรุปสัญญา การตรวจสอบกรรมสิทธิ์' +
         ' และลงทะเบียนกับสำนักงานที่ดิน। ClearView และทีมกฎหมายของเราจะแนะนำคุณตลอดกระบวนการ',
    en: 'Foreign ownership in Thailand is subject to Thai land purchase laws, which have specific restrictions.' +
        ' The typical structure is a Thailand-registered company owning and managing the property' +
        ' (which Ignatev Estate facilitates). A purchase agreement, title audit,' +
        ' and Land Office registration are required. ClearView and our legal team guide you through the process.',
    th: 'การเป็นเจ้าของทรัพย์สินของต่างชาติในประเทศไทยอยู่ภายใต้กฎหมายการซื้อที่ดินของประเทศไทย' +
         ' ซึ่งมีข้อ จำกัดเฉพาะ โครงสร้างทั่วไปคือ บริษัท จดทะเบียนในประเทศไทยที่ครอบครองและจัดการทรัพย์สิน' +
         ' (ซึ่ง Ignatev Estate อำนวยความสะดวก) สัญญาซื้อขาย การตรวจสอบกรรมสิทธิ์' +
         ' และการลงทะเบียนสำนักงานที่ดินเป็นสิ่งจำเป็น ClearView และทีมกฎหมายของเราแนะนำคุณตลอดกระบวนการ',
    status: 'needs_review',
  },

  // ============================================================================
  // 5. MANAGEMENT COMPANIES (professional property managers)
  // ============================================================================
  {
    key: 'faq.mc.partner_program',
    namespace: 'faq',
    description: 'FAQ: How do I become a myUNO management partner?',
    ru: 'Как мне стать партнером управления myUNO?',
    en: 'How do I become a myUNO management partner?',
    th: 'ฉันจะเป็นพarter์นเนอร์การจัดการของ myUNO ได้อย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.mc.partner_program_answer',
    namespace: 'faq',
    description: 'FAQ answer: Partner program',
    ru: 'Если вы управляете портфелем недвижимости на Пхукете, вы можете подать заявку на партнерство' +
         ' как компания управления (MC). MC получают доступ к платформе myUNO для управления бронированиями,' +
         ' связи с гостями, отчетности и платежей.' +
         ' В обмен на управление вы получаете комиссию, согласованную в контракте MC.' +
         ' Свяжитесь с нашей командой партнеров для обсуждения требований.',
    en: 'If you manage a portfolio of properties in Phuket, you can apply to partner as a Management Company (MC).' +
        ' MCs get platform access for booking management, guest communication, reporting, and payments.' +
        ' In exchange for managing, you earn a commission agreed in your MC contract.' +
        ' Contact our partnerships team to discuss requirements.',
    th: 'หากคุณจัดการพอร์ตโฟลิโอทรัพย์สินในภูเก็ต คุณสามารถสมัครเป็นพpartner์นเนอร์เป็นบริษัทจัดการ (MC)' +
         ' MC ได้รับการเข้าถึงแพลตฟอร์มสำหรับการจัดการการจอง การสื่อสารกับผู้เข้าพัก การรายงาน และการชำระเงิน' +
         ' เพื่อแลกกับการจัดการ คุณจะได้รับค่าคอมมิชชั่นตามที่ตกลงในสัญญา MC ของคุณ' +
         ' ติดต่อทีมพautner์นเนอร์ของเราเพื่อหารือเกี่ยวกับข้อกำหนด',
    status: 'needs_review',
  },
  {
    key: 'faq.mc.commission_structure',
    namespace: 'faq',
    description: 'FAQ: How is the MC commission structure calculated?',
    ru: 'Как рассчитывается структура комиссии MC?',
    en: 'How is the MC commission structure calculated?',
    th: 'โครงสร้างค่าคอมมิชชั่น MC คำนวณอย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.mc.commission_structure_answer',
    namespace: 'faq',
    description: 'FAQ answer: Commission structure',
    ru: 'Комиссия MC основана на валовом доходе от бронирований (RUB, USD или THB в зависимости от контракта)' +
         ' и может включать фиксированную часть и переменную часть на основе производительности.' +
         ' Особенности вашего контракта описаны в вашем соглашении MC.' +
         ' Ежемесячные выписки детализируют ваш заработок и выплаты. Платежи обычно проводятся ежемесячно.',
    en: 'MC commission is based on gross booking revenue (in RUB, USD, or THB depending on your contract)' +
        ' and may include a fixed portion plus performance-based variable portion.' +
        ' Your specific contract terms are detailed in your MC agreement.' +
        ' Monthly statements detail your earnings and payouts. Payments are typically processed monthly.',
    th: 'ค่าคอมมิชชั่น MC ขึ้นอยู่กับรายได้จากการจองแบบรวม (ใน RUB, USD หรือ THB ตามสัญญา)' +
         ' และอาจรวมถึงส่วนคงที่บวกส่วนตัวแปรตามประสิทธิภาพ' +
         ' เงื่อนไขสัญญาเฉพาะของคุณมีรายละเอียดในสัญญา MC ของคุณ' +
         ' งบบัญชีรายเดือนอธิบายรายได้และการจ่ายเงินของคุณ การชำระเงินโดยปกติจะดำเนินการรายเดือน',
    status: 'needs_review',
  },
  {
    key: 'faq.mc.onboarding',
    namespace: 'faq',
    description: 'FAQ: What is the MC onboarding process?',
    ru: 'Как выглядит процесс адаптации MC?',
    en: 'What is the MC onboarding process?',
    th: 'กระบวนการออนบอร์ดดิ้ง MC เป็นอย่างไร?',
    status: 'needs_review',
  },
  {
    key: 'faq.mc.onboarding_answer',
    namespace: 'faq',
    description: 'FAQ answer: MC onboarding',
    ru: 'Процесс адаптации состоит из пяти этапов:' +
         ' (1) Подать заявку (проверяем квалификацию, портфолио и опыт управления),' +
         ' (2) Одобрение (MC одобрен нашей командой),' +
         ' (3) Настройка контракта (согласование условий комиссии),' +
         ' (4) Обучение (ваша команда получает доступ и обучение в системе myUNO),' +
         ' (5) Активизация (начинаем управлять первыми свойствами). Весь процесс занимает 2–4 недели.',
    en: 'The onboarding process has five stages:' +
        ' (1) Application (we vet qualifications, portfolio, and management experience),' +
        ' (2) Approval (MC is approved by our team),' +
        ' (3) Contract Setup (commission terms are negotiated),' +
        ' (4) Training (your team gets platform access and training),' +
        ' (5) Activation (we start managing your first properties). The full process takes 2–4 weeks.',
    th: 'กระบวนการออนบอร์ดมีห้าขั้นตอน:' +
         ' (1) สมัครใจ (เราตรวจสอบคุณสมบัติ พอร์ตโฟลิโอ และประสบการณ์การจัดการ),' +
         ' (2) การอนุมัติ (MC ได้รับการอนุมัติจากทีมของเรา),' +
         ' (3) การตั้งค่าสัญญา (เงื่อนไขค่าคอมมิชชั่นได้รับการเจรจา),' +
         ' (4) การฝึกอบรม (ทีมของคุณได้รับการเข้าถึงแพลตฟอร์มและการฝึกอบรม),' +
         ' (5) การเปิดใช้งาน (เราเริ่มจัดการทรัพย์สินแรกของคุณ) กระบวนการที่สมบูรณ์ใช้เวลา 2–4 สัปดาห์',
    status: 'needs_review',
  },
];

export async function seedAudienceFAQs(db: PrismaClient, systemIdentityId?: string): Promise<void> {
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

  for (const keyDef of AUDIENCE_FAQ_KEYS) {
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
