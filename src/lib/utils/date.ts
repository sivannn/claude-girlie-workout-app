/**
 * Parses a date-only string ("YYYY-MM-DD", e.g. from `<input type="date">`)
 * as local midnight. `new Date("YYYY-MM-DD")` parses as UTC midnight per the
 * ES spec, which silently shifts to the previous day in any negative-UTC
 * timezone — this is the fix for that class of bug.
 */
export function parseLocalDateInput(dateString: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}
