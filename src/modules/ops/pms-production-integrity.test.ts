import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');

describe('Production PMS macro integrity',()=>{
  const schema=read('prisma/schema.prisma');
  const booking=read('src/modules/booking/booking.service.ts');
  const reservationDesk=read('src/app/api/ops/reservations/route.ts');
  const calendar=read('src/app/ops/calendar/board/page.tsx');
  const projectScope=read('src/app/libs/projectScope.ts');
  const taskService=read('src/modules/ops/operational-task.service.ts');
  const jobs=read('src/jobs/dispatch.ts');
  const finance=read('src/modules/finance/finance.service.ts');
  const threads=read('src/modules/comms/thread.service.ts');
  const stay=read('src/app/ops/stays/[bookingId]/page.tsx');

  it('keeps Project → InventoryCategory → Unit → Booking as the canonical physical/occupancy chain',()=>{
    expect(schema).toContain('model Project {');
    expect(schema).toContain('model InventoryCategory {');
    expect(schema).toContain('model Unit {');
    expect(schema).toContain('model Booking {');
    expect(schema).toContain('inventoryCategoryId');
    expect(schema).toContain('unitId');
    expect(calendar).toContain('prisma.booking.findMany');
    expect(calendar).toContain('prisma.blockedDate.findMany');
    expect(calendar).not.toContain('calendarBooking.create');
  });

  it('supports both category inventory and exact physical-unit reservations',()=>{
    expect(reservationDesk).toContain("targetType === 'category'");
    expect(reservationDesk).toContain('findAvailableUnitsForCategory');
    expect(reservationDesk).toContain('allocatedUnitId');
    expect(reservationDesk).toContain('createBooking(prisma');
    expect(reservationDesk).not.toContain('prisma.booking.create(');
  });

  it('models independently operated portfolios, exact unit assignments, teams and capabilities',()=>{
    expect(schema).toContain('model OperatingSpace {');
    expect(schema).toContain('model OperatingSpaceUnit {');
    expect(schema).toContain('model OperatingSpaceMember {');
    expect(schema).toContain('model OperatingSpaceMemberUnit {');
    expect(schema).toContain('model OperatingTeam {');
    expect(projectScope).toContain('getAuthorizedOperationalUnitIds');
    expect(projectScope).toContain('operatingSpaceMemberUnit.findMany');
  });

  it('routes checkout into canonical turnover tasks and operating teams',()=>{
    expect(booking).toContain("'turnover_cleaning'");
    expect(booking).toContain("'turnover_inspection'");
    expect(booking).toContain('operatingSpaceId: turnoverSpaceId');
    expect(booking).toContain('assignedTeamId');
  });

  it('supports recurring preventive work through the scheduler',()=>{
    expect(schema).toContain('model PreventiveMaintenancePlan {');
    expect(taskService).toContain('generateDuePreventiveMaintenanceTasks');
    expect(taskService).toContain('frequencyDays');
    expect(taskService).toContain('nextDueAt');
    expect(jobs).toContain('runPreventiveMaintenanceJob');
    expect(jobs).toContain('JOB_KEYS.preventiveMaintenance');
  });

  it('connects confirmed stays to CRM and the booking conversation',()=>{
    expect(finance).toContain('recordConfirmedStayInCrm');
    expect(finance).toContain("contextType: 'booking'");
    expect(finance).toContain('getBookingThreadParticipants');
    expect(threads).toContain("'manage_guest_communications'");
    expect(threads).toContain('unitAssignments');
    expect(stay).toContain('/conversation');
  });

  it('keeps money and owner reporting on canonical finance records',()=>{
    expect(schema).toContain('model Payment {');
    expect(schema).toContain('model LedgerEntry {');
    expect(schema).toContain('model OwnerStatement {');
    expect(finance).toContain('recordCashPayment');
  });
});
