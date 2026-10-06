import { zipSync, strToU8 } from 'fflate';

/** A minimal .xlsx with one "Reservations" sheet (inline strings, numeric dates). */
export function buildReservationsWorkbook(rows: Array<Record<string, string | number | null>>): Uint8Array {
  const headers = ['Booking ID', 'Channel / ช่องทาง', 'Guest name / ชื่อลูกค้า', 'Check-in', 'Check-out', 'Nights',
    'Rooms / ห้อง', 'Unit count', 'Revenue / รายได้', 'Avg./night', 'Booking status', 'Payment status',
    'Amount paid', 'Balance', 'Contact', 'Booking link', 'Add to calendar', 'Notes', 'Calendar Event ID',
    'Calendar Action', 'Last Synced', 'Adults / ผู้ใหญ่', 'Children / เด็ก'];
  const letters = headers.map((_, i) => String.fromCharCode(65 + i));
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cell = (ref: string, v: string | number | null | undefined) =>
    v === null || v === undefined ? '' : typeof v === 'number'
      ? `<c r="${ref}"><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t>${esc(v)}</t></is></c>`;
  const serial = (iso: string) => Math.round((Date.parse(iso + 'T00:00:00Z') - Date.UTC(1899, 11, 30)) / 86_400_000);
  const lines = [
    `<row r="1">${cell('A1', 'RESERVATIONS / ตารางการจอง')}</row>`,
    `<row r="2">${headers.map((h, i) => cell(letters[i] + '2', h)).join('')}</row>`,
    ...rows.map((r, n) => {
      const values: Record<string, string | number | null> = {
        'Booking ID': r.ref, 'Channel / ช่องทาง': r.channel, 'Guest name / ชื่อลูกค้า': r.guest,
        'Check-in': serial(String(r.checkIn)), 'Check-out': serial(String(r.checkOut)), 'Rooms / ห้อง': r.rooms,
        'Revenue / รายได้': r.revenue, 'Booking status': r.status, 'Payment status': r.payment ?? 'Unpaid',
        'Amount paid': r.paid ?? 0, 'Adults / ผู้ใหญ่': r.adults ?? null, 'Children / เด็ก': r.children ?? null,
      };
      return `<row r="${n + 3}">${headers.map((h, i) => cell(letters[i] + (n + 3), values[h] ?? null)).join('')}</row>`;
    }),
  ];
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${lines.join('')}</sheetData></worksheet>`;
  const dashboard = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData/></worksheet>`;
  return zipSync({
    'xl/workbook.xml': strToU8(`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dashboard" sheetId="1" r:id="rId1"/><sheet name="Reservations" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="worksheet" Target="/xl/worksheets/sheet2.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': strToU8(dashboard),
    'xl/worksheets/sheet2.xml': strToU8(sheet),
  });
}
