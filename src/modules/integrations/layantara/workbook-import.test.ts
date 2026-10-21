import { describe, it, expect, vi } from 'vitest';
import { buildReservationsWorkbook } from '@/test/xlsx-fixture';
import { zipSync, strToU8 } from 'fflate';
vi.mock('@/modules/booking', () => ({ createReservationGroup: vi.fn() }));
vi.mock('./channel-service', () => ({ applyChannelEvent: vi.fn() }));
import { parseReservationsWorkbook } from './workbook-import';

const headers = ['Booking ID','Channel','Guest name','Check-in','Check-out','Rooms','Revenue','Booking status','Payment status','Amount paid','Adults','Children','Avg./night','Balance'];
function workbook(extra: Record<string, string>, sold = '500') {
  const row = (n: number, cells: Record<string, string>) => `<row r="${n}">${Object.entries(cells).map(([col, value]) => `<c r="${col}${n}" t="inlineStr"><is><t>${value}</t></is></c>`).join('')}</row>`;
  return zipSync({
    'xl/workbook.xml': strToU8('<workbook><sheets><sheet name="Reservations" r:id="rId1"/></sheets></workbook>'),
    'xl/_rels/workbook.xml.rels': strToU8('<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'),
    'xl/worksheets/sheet1.xml': strToU8('<worksheet><sheetData>' +
      row(1, Object.fromEntries(headers.map((h,i) => [String.fromCharCode(65+i),h]))) +
      row(2, { A:'SYNTH-1',B:'Direct',C:'Synthetic Guest',D:'2026-10-01',E:'2026-10-03',F:'TEST',G:sold,H:'Confirmed',I:'Paid',J:'500' }) +
      row(3, extra) + '</sheetData></worksheet>'),
  });
}
describe('operator workbook evidence parsing', () => {
  it('ignores only otherwise empty template formula-zero rows', () => {
    const parsed = parseReservationsWorkbook(workbook({ M:'0',N:'0' }));
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.sourcePayments).toHaveLength(1);
    expect(parsed.problems).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ adults:null,children:null });
  });
  it('retains payment evidence on a row with missing reservation identity', () => {
    const parsed = parseReservationsWorkbook(workbook({ M:'0',N:'0',I:'Paid',J:'100' }));
    expect(parsed.sourcePayments).toHaveLength(2);
    expect(parsed.problems).toContainEqual({ rowNumber:3,ref:null,message:'booking_ref' });
  });
  it('does not turn an unknown sold total into a zero-priced stay', () => {
    expect(parseReservationsWorkbook(workbook({}, '')).problems).toContainEqual({ rowNumber:2,ref:'SYNTH-1',message:'revenue' });
  });
  const sourceRow = { ref:'Res-9001',channel:'Direct',guest:'Synthetic Guest',checkIn:'2026-12-18',checkOut:'2026-12-21',rooms:'B22',revenue:100,status:'Confirmed',payment:'Unpaid',paid:'' };
  it('canonicalizes only RES numeric IDs and keeps raw alias and blank payment evidence', () => {
    const parsed=parseReservationsWorkbook(buildReservationsWorkbook([sourceRow]));
    expect(parsed.rows[0]).toMatchObject({ref:'RES-9001',operationalDetails:{sourceReferenceRaw:'Res-9001'}});
    expect(parsed.sourcePayments[0]).toMatchObject({ref:'RES-9001',amountPaidRaw:'',amountPaidSatang:null});
    const other=parseReservationsWorkbook(buildReservationsWorkbook([{...sourceRow,ref:'Partner-Abc'}]));
    expect(other.rows[0].ref).toBe('Partner-Abc');
  });
  it('holds duplicate aliases instead of creating two case-variant source identities', () => {
    const parsed=parseReservationsWorkbook(buildReservationsWorkbook([sourceRow,{...sourceRow,ref:'RES-9001'}]));
    expect(parsed.rows).toHaveLength(0);
    expect(parsed.problems).toContainEqual(expect.objectContaining({ref:'RES-9001',message:'duplicate_ref'}));
  });

});
