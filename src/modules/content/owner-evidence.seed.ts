/** Reviewable UI copy only; this module never seeds a database. */
export const OWNER_EVIDENCE_KEYS = [
  {
    "key": "admin.owner_evidence.title",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Legal owner and contract evidence draft",
    "ru": "Черновик данных о собственнике и договоре",
    "th": "ร่างข้อมูลเจ้าของตามกฎหมายและสัญญา",
    "zh": "法定业主及合同证据草稿",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.hint",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Private, unverified source information only. Recording a company or its representative does not verify title, execute a contract, grant account access or approve publication. Do not enter tax IDs, banking details or credentials.",
    "ru": "Это закрытые, непроверенные сведения из источника. Запись компании или представителя не подтверждает право собственности, подписание договора, доступ к аккаунту или разрешение на публикацию. Не вводите налоговые номера, банковские реквизиты и пароли.",
    "th": "ข้อมูลจากแหล่งอ้างอิงนี้เป็นข้อมูลส่วนตัวที่ยังไม่ยืนยัน การบันทึกบริษัทหรือตัวแทนไม่ยืนยันกรรมสิทธิ์ การลงนามสัญญา สิทธิ์เข้าบัญชี หรือการอนุมัติเผยแพร่ ห้ามกรอกเลขประจำตัวผู้เสียภาษี ข้อมูลธนาคาร หรือรหัสผ่าน",
    "zh": "这些是未经核实的私密来源信息。记录公司或代表不代表确认产权、签署合同、授予账户权限或批准发布。请勿输入税号、银行信息或凭据。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.open",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Open evidence draft",
    "ru": "Открыть черновик",
    "th": "เปิดร่างข้อมูล",
    "zh": "打开证据草稿",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.reload",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Reload saved draft (replaces unsaved edits)",
    "ru": "Загрузить сохранённый черновик (заменит несохранённые правки)",
    "th": "โหลดร่างที่บันทึกใหม่ (แทนที่การแก้ไขที่ยังไม่บันทึก)",
    "zh": "重新加载已保存草稿（替换未保存的修改）",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.saved",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Draft saved. Ownership, account access and launch approval are unchanged.",
    "ru": "Черновик сохранён. Собственность, доступ к аккаунтам и разрешение на запуск не изменены.",
    "th": "บันทึกร่างแล้ว กรรมสิทธิ์ สิทธิ์เข้าบัญชี และการอนุมัติเปิดใช้งานไม่เปลี่ยนแปลง",
    "zh": "草稿已保存。产权、账户权限及上线批准均未改变。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.conflict",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Someone changed this draft. Your edits are still here. Reload to review the latest saved version before replacing it.",
    "ru": "Черновик изменён другим пользователем. Ваши правки сохранены в форме. Загрузите последнюю версию перед заменой.",
    "th": "มีผู้แก้ไขร่างนี้ การแก้ไขของคุณยังอยู่ในแบบฟอร์ม โปรดโหลดและตรวจสอบฉบับล่าสุดก่อนแทนที่",
    "zh": "草稿已被他人修改。您的编辑仍保留在表单中。请重新加载并查看最新版本后再替换。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.forbidden",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Only an active administrator can read or save this evidence.",
    "ru": "Просматривать и сохранять эти данные может только активный администратор.",
    "th": "เฉพาะผู้ดูแลระบบที่ใช้งานอยู่เท่านั้นที่อ่านหรือบันทึกข้อมูลนี้ได้",
    "zh": "只有有效的管理员账户可以查看或保存此证据。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.invalid",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Check the source document link, dates and required fields.",
    "ru": "Проверьте ссылку на документ, даты и обязательные поля.",
    "th": "ตรวจสอบลิงก์เอกสาร วันที่ และช่องที่จำเป็น",
    "zh": "请检查来源文档链接、日期及必填字段。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.auth",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Sign in again before saving.",
    "ru": "Войдите снова перед сохранением.",
    "th": "โปรดเข้าสู่ระบบอีกครั้งก่อนบันทึก",
    "zh": "请重新登录后保存。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.error",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "The draft could not be saved or loaded. Try again.",
    "ru": "Не удалось сохранить или загрузить черновик. Попробуйте снова.",
    "th": "ไม่สามารถบันทึกหรือโหลดร่างได้ โปรดลองอีกครั้ง",
    "zh": "无法保存或加载草稿。请重试。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.ownerName",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Owner company legal name",
    "ru": "Юридическое название компании-собственника",
    "th": "ชื่อบริษัทเจ้าของตามกฎหมาย",
    "zh": "业主公司法定名称",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.ownerAddress",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Owner business address",
    "ru": "Адрес компании-собственника",
    "th": "ที่อยู่บริษัทเจ้าของ",
    "zh": "业主公司地址",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.ownerRepresentative",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Owner representative name",
    "ru": "Имя представителя собственника",
    "th": "ชื่อตัวแทนเจ้าของ",
    "zh": "业主代表姓名",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.ownerTitle",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Owner representative title",
    "ru": "Должность представителя собственника",
    "th": "ตำแหน่งตัวแทนเจ้าของ",
    "zh": "业主代表职务",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.operatorName",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Operator company legal name",
    "ru": "Юридическое название управляющей компании",
    "th": "ชื่อบริษัทผู้ดำเนินการตามกฎหมาย",
    "zh": "运营公司法定名称",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.operatorAddress",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Operator business address",
    "ru": "Адрес управляющей компании",
    "th": "ที่อยู่บริษัทผู้ดำเนินการ",
    "zh": "运营公司地址",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.operatorRepresentative",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Operator representative name",
    "ru": "Имя представителя управляющей компании",
    "th": "ชื่อตัวแทนผู้ดำเนินการ",
    "zh": "运营方代表姓名",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.operatorTitle",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Operator representative title",
    "ru": "Должность представителя управляющей компании",
    "th": "ตำแหน่งตัวแทนผู้ดำเนินการ",
    "zh": "运营方代表职务",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.sourceUrl",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Google Drive document link",
    "ru": "Ссылка на документ в Google Диске",
    "th": "ลิงก์เอกสาร Google Drive",
    "zh": "Google Drive 文档链接",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.sourceTitle",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Source document title",
    "ru": "Название документа-источника",
    "th": "ชื่อเอกสารต้นทาง",
    "zh": "来源文档标题",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.modifiedDate",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Source modified date",
    "ru": "Дата изменения источника",
    "th": "วันที่แก้ไขเอกสารต้นทาง",
    "zh": "来源修改日期",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.commencement",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Proposed contract commencement",
    "ru": "Предполагаемая дата начала договора",
    "th": "วันที่เริ่มสัญญาที่ระบุในร่าง",
    "zh": "拟定合同开始日期",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.term",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Proposed term in years",
    "ru": "Предполагаемый срок в годах",
    "th": "ระยะเวลาที่ระบุในร่าง (ปี)",
    "zh": "拟定期限（年）",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.signatures",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Signatures in this source copy",
    "ru": "Подписи в этой копии",
    "th": "ลายเซ็นในสำเนานี้",
    "zh": "此来源副本中的签名",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.notChecked",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Not visually checked",
    "ru": "Визуально не проверено",
    "th": "ยังไม่ได้ตรวจดู",
    "zh": "尚未目视检查",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.blank",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Signature lines visually checked: blank",
    "ru": "Поля подписей проверены визуально: пустые",
    "th": "ตรวจดูแล้ว: ช่องลงนามว่าง",
    "zh": "已目视检查：签名栏为空",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.visible",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Signatures visible; execution still unverified",
    "ru": "Подписи видны; подписание договора не подтверждено",
    "th": "มองเห็นลายเซ็น แต่ยังไม่ยืนยันการลงนามสัญญา",
    "zh": "签名可见；合同签署仍未核实",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.status",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Execution, ownership and licence status: unverified.",
    "ru": "Подписание, собственность и лицензия: не подтверждены.",
    "th": "สถานะการลงนาม กรรมสิทธิ์ และใบอนุญาต: ยังไม่ยืนยัน",
    "zh": "签署、产权及许可状态：未经核实。",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.saving",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Saving…",
    "ru": "Сохранение…",
    "th": "กำลังบันทึก…",
    "zh": "正在保存…",
    "status": "needs_review"
  },
  {
    "key": "admin.owner_evidence.save",
    "namespace": "admin",
    "description": "Private owner evidence draft",
    "en": "Save unverified evidence draft",
    "ru": "Сохранить непроверенный черновик",
    "th": "บันทึกร่างข้อมูลที่ยังไม่ยืนยัน",
    "zh": "保存未经核实的证据草稿",
    "status": "needs_review"
  }
] as const;
export function ownerEvidenceLabelsForLocale(locale: string): Record<string,string> {
 const language = locale === "ru" || locale === "th" || locale === "zh" ? locale : "en";
 return Object.fromEntries(OWNER_EVIDENCE_KEYS.map(row => [row.key,row[language]]));
}
export const OWNER_EVIDENCE_LOCALE_DRAFTS = Object.fromEntries(OWNER_EVIDENCE_KEYS.map(row => [row.key, { en: row.en, ru: row.ru, th: row.th, zh: row.zh }]));
