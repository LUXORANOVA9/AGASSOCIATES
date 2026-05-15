import { describe, it, expect } from 'vitest';
import { calculateBillableFee } from './billing.ts';

describe('calculateBillableFee', () => {
  it('calculates the exact fee for standard hours', () => {
    // 2 hours at ₹2500/hr should be ₹5000
    const fee = calculateBillableFee(120, 2500);
    expect(fee).toBe(5000);
  });

  it('calculates partial hour fees correctly', () => {
    // 30 minutes at ₹2500/hr should be ₹1250
    const fee = calculateBillableFee(30, 2500);
    expect(fee).toBe(1250);
  });

  it('enforces a minimum billable duration of 1 minute', () => {
    // 0 seconds passed should still bill for 1 minute (₹41.67)
    // 2500 / 60 = 41.666...
    const fee = calculateBillableFee(0, 2500);
    expect(fee).toBeCloseTo(41.67, 2);
  });
});
