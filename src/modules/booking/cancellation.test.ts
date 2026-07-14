import { describe, it, expect } from 'vitest';
import {
  computeRefundPercentage,
  computeRefundAmount,
  DEFAULT_POLICIES,
} from './cancellation';

describe('Cancellation policies', () => {
  describe('flexible policy', () => {
    const policy = DEFAULT_POLICIES.flexible.steps;
    const checkInDate = new Date('2026-08-15T15:00:00Z');

    it('refunds 100% if cancelled 2+ days before check-in', () => {
      const cancellationTime = new Date('2026-08-13T10:00:00Z'); // 2+ days before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(100);
    });

    it('refunds 0% if cancelled < 1 day before check-in', () => {
      const cancellationTime = new Date('2026-08-14T18:00:00Z'); // ~20 hours before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(0);
    });

    it('refunds 100% exactly at the 1-day threshold', () => {
      const cancellationTime = new Date('2026-08-14T15:00:00Z'); // exactly 1 day
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(100);
    });
  });

  describe('moderate policy', () => {
    const policy = DEFAULT_POLICIES.moderate.steps;
    const checkInDate = new Date('2026-08-15T15:00:00Z');

    it('refunds 100% if cancelled 5+ days before check-in', () => {
      const cancellationTime = new Date('2026-08-10T10:00:00Z'); // 5+ days before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(100);
    });

    it('refunds 50% if cancelled < 5 days before check-in', () => {
      const cancellationTime = new Date('2026-08-12T10:00:00Z'); // ~3 days before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(50);
    });

    it('refunds 50% if cancelled on day of check-in', () => {
      const cancellationTime = new Date('2026-08-15T10:00:00Z'); // same day, 5 hours before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(50);
    });
  });

  describe('strict policy', () => {
    const policy = DEFAULT_POLICIES.strict.steps;
    const checkInDate = new Date('2026-08-15T15:00:00Z');

    it('refunds 50% if cancelled 14+ days before check-in', () => {
      const cancellationTime = new Date('2026-08-01T10:00:00Z'); // 14+ days before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(50);
    });

    it('refunds 0% if cancelled < 14 days before check-in', () => {
      const cancellationTime = new Date('2026-08-10T10:00:00Z'); // ~5 days before
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(0);
    });

    it('refunds 0% if cancelled on day of check-in', () => {
      const cancellationTime = new Date('2026-08-15T10:00:00Z');
      const refundPct = computeRefundPercentage(policy, checkInDate, cancellationTime);
      expect(refundPct).toBe(0);
    });
  });

  describe('refund amount calculation', () => {
    it('calculates correct refund amount for flexible policy', () => {
      const policy = DEFAULT_POLICIES.flexible.steps;
      const checkInDate = new Date('2026-08-15T15:00:00Z');
      const cancellationTime = new Date('2026-08-13T10:00:00Z');
      const totalPaid = 8000;

      const refundAmount = computeRefundAmount(
        totalPaid,
        policy,
        checkInDate,
        cancellationTime
      );
      expect(refundAmount).toBe(8000); // 100% of 8000
    });

    it('calculates correct refund amount for moderate policy - full refund', () => {
      const policy = DEFAULT_POLICIES.moderate.steps;
      const checkInDate = new Date('2026-08-15T15:00:00Z');
      const cancellationTime = new Date('2026-08-10T10:00:00Z');
      const totalPaid = 10000;

      const refundAmount = computeRefundAmount(
        totalPaid,
        policy,
        checkInDate,
        cancellationTime
      );
      expect(refundAmount).toBe(10000); // 100% of 10000
    });

    it('calculates correct refund amount for moderate policy - partial refund', () => {
      const policy = DEFAULT_POLICIES.moderate.steps;
      const checkInDate = new Date('2026-08-15T15:00:00Z');
      const cancellationTime = new Date('2026-08-12T10:00:00Z');
      const totalPaid = 10000;

      const refundAmount = computeRefundAmount(
        totalPaid,
        policy,
        checkInDate,
        cancellationTime
      );
      expect(refundAmount).toBe(5000); // 50% of 10000
    });

    it('calculates correct refund amount for strict policy - no refund', () => {
      const policy = DEFAULT_POLICIES.strict.steps;
      const checkInDate = new Date('2026-08-15T15:00:00Z');
      const cancellationTime = new Date('2026-08-10T10:00:00Z');
      const totalPaid = 12000;

      const refundAmount = computeRefundAmount(
        totalPaid,
        policy,
        checkInDate,
        cancellationTime
      );
      expect(refundAmount).toBe(0); // 0% of 12000
    });

    it('rounds refund amount correctly', () => {
      const policy = DEFAULT_POLICIES.moderate.steps;
      const checkInDate = new Date('2026-08-15T15:00:00Z');
      const cancellationTime = new Date('2026-08-12T10:00:00Z');
      const totalPaid = 9999; // 50% = 4999.5, should round to 5000

      const refundAmount = computeRefundAmount(
        totalPaid,
        policy,
        checkInDate,
        cancellationTime
      );
      expect(refundAmount).toBe(5000);
    });
  });
});
