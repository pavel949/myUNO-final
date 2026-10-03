import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('PMS operations expansion', () => {
  const schema = readFileSync('prisma/schema.prisma', 'utf8');
  const enumMigration = readFileSync(
    'prisma/migrations/20261003075000_pms_operational_task_enums/migration.sql',
    'utf8',
  );
  const structuralMigration = readFileSync(
    'prisma/migrations/20261003080000_pms_operational_task_expansion/migration.sql',
    'utf8',
  );

  it('keeps one canonical OperationalTask and adds operational capabilities', () => {
    expect((schema.match(/model OperationalTask \{/g) ?? []).length).toBe(1);
    expect(schema).toContain('model PreventiveMaintenancePlan {');
    expect(schema).toContain('model OperationalTaskMedia {');
    expect(schema).toContain('assignedTeamId');
    expect(schema).toContain('blocksInventory');
    expect(schema).toContain('estimatedCostSatang');
    expect(schema).toContain('actualCostSatang');
  });

  it('commits PostgreSQL enum extensions before using them in later DDL', () => {
    expect(enumMigration).toContain("ADD VALUE IF NOT EXISTS 'preventive_maintenance'");
    expect(enumMigration).toContain("ADD VALUE IF NOT EXISTS 'blocked'");
    expect(structuralMigration).not.toContain('ALTER TYPE "OperationalTaskType" ADD VALUE');
    expect(structuralMigration).not.toContain('ALTER TYPE "OperationalTaskStatus" ADD VALUE');
    expect(structuralMigration).toContain("DEFAULT 'preventive_maintenance'");
  });

  it('does not introduce another occupancy or reservation authority', () => {
    expect(schema).toContain('model Booking {');
    expect(schema).toContain('model BlockedDate {');
    expect(schema).not.toContain('model HousekeepingBooking {');
    expect(schema).not.toContain('model MaintenanceCalendar {');
  });
});
