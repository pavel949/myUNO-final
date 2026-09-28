import {describe,it,expect} from 'vitest';
import {deriveStayWorkItems} from './work-projection';
const base={id:'b1',projectId:'p1',unitId:'u1',unitName:'G6',guestName:'Guest',
  status:'confirmed',startDate:'2026-10-10',endDate:'2026-10-12',
  totalSatang:300000,paidSatang:0,refundAccruedSatang:0};
describe('role-specific tasks derive from canonical booking',()=>{
  it('creates prearrival, housekeeping and balance queues for a confirmed stay',()=>{
    const items=deriveStayWorkItems(base,'2026-10-09');
    expect(items.map(i=>i.department)).toEqual(['front_desk','housekeeping','finance']);
    expect(items.every(i=>i.bookingId==='b1')).toBe(true);
  });
  it('keeps requested inquiries non-operational until accepted',()=>{
    expect(deriveStayWorkItems({...base,status:'requested'},'2026-10-09').map(i=>i.phase))
      .toEqual(['request']);
  });
  it('holds post-cancellation money for finance review',()=>{
    expect(deriveStayWorkItems({...base,status:'cancelled',paidSatang:300000},'2026-10-13'))
      .toMatchObject([{phase:'close',department:'finance',severity:'attention'}]);
  });
  it('has no duplicate work on completed stays',()=>{
    expect(deriveStayWorkItems({...base,status:'completed'},'2026-10-13')).toEqual([]);
  });
});
