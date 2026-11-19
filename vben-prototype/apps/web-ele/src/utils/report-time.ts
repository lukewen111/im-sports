const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export type ReportGranularity = 'day' | 'hour' | 'month' | 'week';
export type ReportRangeMode = '30d' | '7d' | 'custom' | 'today';

export interface ReportRange {
  end: number;
  granularity: ReportGranularity;
  start: number;
}

export interface TimeBucket {
  end: number;
  key: number;
  label: string;
  start: number;
  tooltip: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

/** 解析成员保存的时区偏移（如 UTC+08:00），无法识别时回退到浏览器时区 */
export function timezoneOffsetMinutes(timezone?: string): number {
  const matched = /^UTC([+-])(\d{2}):(\d{2})$/.exec(timezone ?? '');
  if (!matched) return -new Date().getTimezoneOffset();
  const sign = matched[1] === '-' ? -1 : 1;
  return sign * (Number(matched[2]) * 60 + Number(matched[3]));
}

const zonedDate = (value: number, offset: number) => new Date(value + offset * MINUTE_MS);

export function startOfZonedHour(value: number, offset: number): number {
  const date = zonedDate(value, offset);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours()) - offset * MINUTE_MS;
}

export function startOfZonedDay(value: number, offset: number): number {
  const date = zonedDate(value, offset);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - offset * MINUTE_MS;
}

/** 自然周，周一为起点 */
export function startOfZonedWeek(value: number, offset: number): number {
  const dayStart = startOfZonedDay(value, offset);
  const weekday = zonedDate(dayStart, offset).getUTCDay();
  return dayStart - ((weekday + 6) % 7) * DAY_MS;
}

export function startOfZonedMonth(value: number, offset: number): number {
  const date = zonedDate(value, offset);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) - offset * MINUTE_MS;
}

export function addZonedMonths(value: number, months: number, offset: number): number {
  const date = zonedDate(value, offset);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1) - offset * MINUTE_MS;
}

export const addDays = (value: number, days: number): number => value + days * DAY_MS;

export function formatZonedDate(value: number, offset: number): string {
  const date = zonedDate(value, offset);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatZonedTime(value: number, offset: number): string {
  const date = zonedDate(value, offset);
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** 把 YYYY-MM-DD 还原为成员时区下的当日 00:00 */
export function parseZonedDate(value: string, offset: number): number | undefined {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!matched) return undefined;
  return Date.UTC(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3])) - offset * MINUTE_MS;
}

export function zonedDayCount(start: number, end: number): number {
  return Math.round((end - start) / DAY_MS) + 1;
}

function customRange(mode: string, offset: number, now: number, customStart?: string, customEnd?: string): ReportRange | undefined {
  if (mode !== 'custom') return undefined;
  if (!customStart || !customEnd) return undefined;
  const start = parseZonedDate(customStart, offset);
  const endDay = parseZonedDate(customEnd, offset);
  if (start === undefined || endDay === undefined) return undefined;
  const today = startOfZonedDay(now, offset);
  if (endDay < start || endDay > today) return undefined;
  const days = zonedDayCount(start, endDay);
  if (days > 365) return undefined;
  const end = endDay === today ? now : endDay + DAY_MS - 1;
  const granularity: ReportGranularity = days === 1 ? 'hour' : days <= 31 ? 'day' : days <= 180 ? 'week' : 'month';
  return { end, granularity, start };
}

/** 计算本次查询的统计区间与分桶粒度，自定义范围不合法时返回 undefined */
export function resolveReportRange(mode: ReportRangeMode, offset: number, now: number, customStart?: string, customEnd?: string): ReportRange | undefined {
  const todayStart = startOfZonedDay(now, offset);
  if (mode === 'today') return { end: now, granularity: 'hour', start: todayStart };
  if (mode === '7d') return { end: now, granularity: 'day', start: addDays(todayStart, -6) };
  if (mode === '30d') return { end: now, granularity: 'day', start: addDays(todayStart, -29) };
  return customRange(mode, offset, now, customStart, customEnd);
}

function dayLabel(value: number, offset: number): string {
  const date = zonedDate(value, offset);
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`;
}

function buildHourBuckets(range: ReportRange, offset: number): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  for (let cursor = startOfZonedHour(range.start, offset); cursor < range.end && buckets.length < 48; cursor += HOUR_MS) {
    const end = Math.min(cursor + HOUR_MS - 1, range.end);
    const hour = zonedDate(cursor, offset).getUTCHours();
    buckets.push({
      end,
      key: cursor,
      label: `${pad(hour)}:00`,
      start: cursor,
      tooltip: `${formatZonedDate(cursor, offset)} ${pad(hour)}:00-${pad((hour + 1) % 24)}:00`,
    });
  }
  return buckets;
}

function buildDayBuckets(range: ReportRange, offset: number): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  for (let cursor = startOfZonedDay(range.start, offset); cursor < range.end && buckets.length < 62; cursor = addDays(cursor, 1)) {
    buckets.push({
      end: Math.min(cursor + DAY_MS - 1, range.end),
      key: cursor,
      label: dayLabel(cursor, offset),
      start: cursor,
      tooltip: formatZonedDate(cursor, offset),
    });
  }
  return buckets;
}

function buildWeekBuckets(range: ReportRange, offset: number): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  for (let cursor = startOfZonedWeek(range.start, offset); cursor < range.end && buckets.length < 60; cursor = addDays(cursor, 7)) {
    const start = Math.max(cursor, range.start);
    const end = Math.min(cursor + 7 * DAY_MS - 1, range.end);
    buckets.push({
      end,
      key: cursor,
      label: dayLabel(start, offset),
      start,
      tooltip: `${formatZonedDate(start, offset)} ~ ${formatZonedDate(end, offset)}`,
    });
  }
  return buckets;
}

function buildMonthBuckets(range: ReportRange, offset: number): TimeBucket[] {
  const buckets: TimeBucket[] = [];
  for (let cursor = startOfZonedMonth(range.start, offset); cursor < range.end && buckets.length < 14; cursor = addZonedMonths(cursor, 1, offset)) {
    const start = Math.max(cursor, range.start);
    const nextMonth = addZonedMonths(cursor, 1, offset);
    const end = Math.min(nextMonth - 1, range.end);
    const date = zonedDate(start, offset);
    buckets.push({
      end,
      key: cursor,
      label: `${date.getUTCMonth() + 1}月`,
      start,
      tooltip: `${date.getUTCFullYear()}年${date.getUTCMonth() + 1}月`,
    });
  }
  return buckets;
}

/** 按粒度生成连续时间桶，包含当前尚未结束的小时／日／周／月 */
export function buildTimeBuckets(range: ReportRange, offset: number): TimeBucket[] {
  if (range.granularity === 'hour') return buildHourBuckets(range, offset);
  if (range.granularity === 'week') return buildWeekBuckets(range, offset);
  if (range.granularity === 'month') return buildMonthBuckets(range, offset);
  return buildDayBuckets(range, offset);
}

/** 会话创建时间落在哪个时间桶 */
export function bucketKey(value: number, granularity: ReportGranularity, offset: number): number {
  if (granularity === 'hour') return startOfZonedHour(value, offset);
  if (granularity === 'week') return startOfZonedWeek(value, offset);
  if (granularity === 'month') return startOfZonedMonth(value, offset);
  return startOfZonedDay(value, offset);
}

/** 距今天数，用于禁用超出 365 天的历史日期 */
export function daysBeforeToday(value: number, now: number, offset: number): number {
  return Math.round((startOfZonedDay(now, offset) - startOfZonedDay(value, offset)) / DAY_MS);
}
