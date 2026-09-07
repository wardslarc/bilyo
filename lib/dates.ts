/**
 * Locale & Date formatting rules (§5.7)
 * Timezone: Asia/Manila. Dates displayed as "September 30, 2026".
 * Store all dates as UTC Date; convert at the boundary only.
 */

const MANILA_TZ = 'Asia/Manila';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TZ,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: MANILA_TZ,
  month: 'long',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/**
 * Formats a date into Asia/Manila display string: "September 30, 2026"
 */
export function formatDate(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  return dateFormatter.format(d);
}

/**
 * Formats a date with time into Asia/Manila display string: "September 30, 2026, 2:30 PM"
 */
export function formatDateTime(date: Date | string | number): string {
  const d = typeof date === 'object' ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  return dateTimeFormatter.format(d);
}

/**
 * Gets a Date representing start of current day (00:00:00.000) in Asia/Manila.
 */
export function getManilaStartOfDay(refDate: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(refDate);

  const year = Number.parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
  const month = Number.parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10) - 1;
  const day = Number.parseInt(parts.find((p) => p.type === 'day')?.value || '1', 10);

  // UTC representation of midnight in Asia/Manila (UTC+8) -> minus 8 hours UTC
  return new Date(Date.UTC(year, month, day, -8, 0, 0, 0));
}

/**
 * Derives whether an invoice is OVERDUE (§5.4):
 * status === 'SENT' && dueDate < today (in Asia/Manila)
 */
export function isInvoiceOverdue(
  dueDate: Date | string | number,
  status: string,
  now: Date = new Date()
): boolean {
  if (status !== 'SENT') {
    return false;
  }

  const d = typeof dueDate === 'object' ? dueDate : new Date(dueDate);
  const todayManila = getManilaStartOfDay(now);

  return d.getTime() < todayManila.getTime();
}

/**
 * Gets the start and end Date of the calendar month in Asia/Manila (UTC+8).
 * Returned Dates are in UTC, spanning midnight of the 1st to 23:59:59.999 of the last day.
 */
export function getManilaMonthRange(refDate: Date = new Date()): {
  startOfMonth: Date;
  endOfMonth: Date;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MANILA_TZ,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(refDate);

  const year = Number.parseInt(parts.find((p) => p.type === 'year')?.value || '1970', 10);
  const month = Number.parseInt(parts.find((p) => p.type === 'month')?.value || '1', 10) - 1;

  const startOfMonth = new Date(Date.UTC(year, month, 1, -8, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 1, -8, 0, 0, -1));

  return { startOfMonth, endOfMonth };
}
