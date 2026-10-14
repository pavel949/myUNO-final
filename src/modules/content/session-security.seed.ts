/** Account → Sessions copy (log out everywhere). Drafts (needs_review). */
const NR = 'needs_review' as const;
export const SESSION_SECURITY_KEYS = [
  { key: 'account.sessions.title', namespace: 'account', description: 'Account: sessions section title', en: 'Sessions', ru: 'Сессии', th: 'เซสชัน', status: NR },
  { key: 'account.sessions.body', namespace: 'account', description: 'Account: log out everywhere explanation', en: 'Signed in somewhere you no longer trust? This ends every session on every device, including this one.', ru: 'Входили где-то, чему больше не доверяете? Это завершит все сессии на всех устройствах, включая эту.', th: 'เข้าสู่ระบบในที่ที่คุณไม่ไว้ใจอีกต่อไป? การดำเนินการนี้จะสิ้นสุดทุกเซสชันในทุกอุปกรณ์ รวมถึงอุปกรณ์นี้', status: NR },
  { key: 'account.sessions.revoke', namespace: 'account', description: 'Account: log out everywhere button', en: 'Log out everywhere', ru: 'Выйти везде', th: 'ออกจากระบบทุกที่', status: NR },
];
