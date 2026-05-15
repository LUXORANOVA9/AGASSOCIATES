export function calculateBillableFee(durationMinutes: number, hourlyRate: number): number {
  // Enforce minimum 1 minute
  const safeDuration = Math.max(1, durationMinutes);
  
  // Calculate raw fee
  const rawFee = (safeDuration / 60) * hourlyRate;
  
  // Return rounded to 2 decimal places to prevent float math errors
  return Math.round(rawFee * 100) / 100;
}
