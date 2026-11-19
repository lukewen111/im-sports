import type { ServiceMemberDay, ServiceSessionSeed } from './service-report-seed';
import { addDays, parseZonedDate, startOfZonedDay, zonedDayCount } from '#/utils/report-time';
import { serviceReportSeed } from './service-report-seed';

const DAY_MS = 86_400_000;

export type ServiceRangeMode = '30d' | '7d' | 'custom' | 'today' | 'yesterday';

export interface ServiceRange {
  days: number;
  end: number;
  start: number;
}

export interface ServiceRanges {
  current: ServiceRange;
  previous: ServiceRange;
}

export interface ServiceRosterMember {
  account?: string;
  avatar?: string;
  deleted?: boolean;
  id: string;
  kind: 'ai' | 'human';
  name: string;
  teamIds: string[];
}

export interface ServiceValues {
  acceptedSeconds: null | number;
  chatSeconds: number;
  efficiency: null | number;
  firstResponseSeconds: null | number;
  receivedSessions: number;
  repliedSessions: number;
}

export interface ServiceDeltas {
  acceptedSeconds: null | number;
  chatSeconds: null | number;
  efficiency: null | number;
  firstResponseSeconds: null | number;
  receivedSessions: null | number;
  repliedSessions: null | number;
}

export interface ServiceRow {
  current: ServiceValues;
  deltas: ServiceDeltas;
  member: ServiceRosterMember;
  previous: ServiceValues;
  unavailable: boolean;
}

export interface ServiceTotals {
  efficiency: null | number;
  firstResponseSeconds: null | number;
  sessions: null | number;
}

export interface ServiceReportResult {
  memberHistoryIncomplete: boolean;
  range: ServiceRanges;
  rows: ServiceRow[];
  teamHistoryIncomplete: boolean;
  totals: { current: ServiceTotals; previous: ServiceTotals };
}

interface InternalValues extends ServiceValues {
  firstResponseTotal: number;
  firstResponseCount: number;
  sessionIds: Set<string>;
}

function emptyInternal(): InternalValues {
  return {
    acceptedSeconds: 0,
    chatSeconds: 0,
    efficiency: null,
    firstResponseCount: 0,
    firstResponseSeconds: null,
    firstResponseTotal: 0,
    receivedSessions: 0,
    repliedSessions: 0,
    sessionIds: new Set(),
  };
}

function emptyValues(): ServiceValues {
  return {
    acceptedSeconds: null,
    chatSeconds: 0,
    efficiency: null,
    firstResponseSeconds: null,
    receivedSessions: 0,
    repliedSessions: 0,
  };
}

/** 计算本期与等长上期区间，自定义范围不合法时返回 undefined */
export function resolveServiceRanges(
  mode: ServiceRangeMode,
  offset: number,
  now: number,
  customStart?: string,
  customEnd?: string,
): ServiceRanges | undefined {
  const todayStart = startOfZonedDay(now, offset);

  if (mode === 'today') {
    return {
      current: { days: 1, end: now, start: todayStart },
      previous: { days: 1, end: now - DAY_MS, start: todayStart - DAY_MS },
    };
  }

  if (mode === 'yesterday') {
    return {
      current: { days: 1, end: todayStart - 1, start: todayStart - DAY_MS },
      previous: { days: 1, end: todayStart - DAY_MS - 1, start: todayStart - 2 * DAY_MS },
    };
  }

  if (mode === '7d' || mode === '30d') {
    const days = mode === '7d' ? 7 : 30;
    const start = addDays(todayStart, -(days - 1));
    return {
      current: { days, end: now, start },
      previous: { days, end: now - days * DAY_MS, start: start - days * DAY_MS },
    };
  }

  if (!customStart || !customEnd) return undefined;
  const start = parseZonedDate(customStart, offset);
  const endDay = parseZonedDate(customEnd, offset);
  if (start === undefined || endDay === undefined) return undefined;
  if (endDay < start || endDay > todayStart) return undefined;
  const days = zonedDayCount(start, endDay);
  if (days > 365) return undefined;
  const end = endDay === todayStart ? now : endDay + DAY_MS - 1;
  return {
    current: { days, end, start },
    previous: { days, end: end - days * DAY_MS, start: start - days * DAY_MS },
  };
}

function addSession(values: InternalValues, session: ServiceSessionSeed, range: ServiceRange) {
  const overlaps = session.at < range.end && session.endAt > range.start;
  if (!overlaps) return;
  values.receivedSessions += 1;
  values.sessionIds.add(session.id);

  if (!session.replied || session.replyAt === null || session.replyAt < range.start || session.replyAt >= range.end) return;
  values.repliedSessions += 1;
  if (session.firstResponseSeconds !== null) {
    values.firstResponseTotal += session.firstResponseSeconds;
    values.firstResponseCount += 1;
  }
  const chatStart = Math.max(session.replyAt, range.start);
  const chatEnd = Math.min(session.endAt, range.end);
  values.chatSeconds += Math.max(0, Math.round((chatEnd - chatStart) / 1_000));
}

function aggregateDay(values: InternalValues, day: ServiceMemberDay, range: ServiceRange) {
  const dayEnd = day.dayStart + DAY_MS;
  const overlap = Math.max(0, Math.min(dayEnd, range.end) - Math.max(day.dayStart, range.start));
  if (overlap <= 0) return;
  values.acceptedSeconds = (values.acceptedSeconds ?? 0) + (day.acceptedSeconds * overlap) / DAY_MS;
  day.sessions.forEach((session) => addSession(values, session, range));
}

function finalize(values: InternalValues): ServiceValues {
  const acceptedSeconds = Math.round(values.acceptedSeconds ?? 0);
  return {
    acceptedSeconds,
    chatSeconds: Math.round(values.chatSeconds),
    efficiency: acceptedSeconds > 0 ? values.repliedSessions / (acceptedSeconds / 3_600) : null,
    firstResponseSeconds: values.firstResponseCount > 0 ? Math.round(values.firstResponseTotal / values.firstResponseCount) : null,
    receivedSessions: values.receivedSessions,
    repliedSessions: values.repliedSessions,
  };
}

function diff(current: null | number, previous: null | number): null | number {
  if (current === null || previous === null) return null;
  return current - previous;
}

interface TotalsAccumulator {
  acceptedSeconds: number;
  firstResponseCount: number;
  firstResponseTotal: number;
  repliedSessions: number;
}

const emptyTotalsAccumulator = (): TotalsAccumulator => ({
  acceptedSeconds: 0,
  firstResponseCount: 0,
  firstResponseTotal: 0,
  repliedSessions: 0,
});

export interface BuildServiceReportInput {
  customEnd?: string;
  customStart?: string;
  members: ServiceRosterMember[];
  mode: ServiceRangeMode;
  now: number;
  offset: number;
}

/** 汇总「报告 → 客服」三张卡片与七列明细所需的全部指标 */
export function buildServiceReport(input: BuildServiceReportInput): ServiceReportResult | undefined {
  const ranges = resolveServiceRanges(input.mode, input.offset, input.now, input.customStart, input.customEnd);
  if (!ranges) return undefined;

  const seed = serviceReportSeed(input.now, input.offset);
  const memberHistoryIncomplete = ranges.current.start < seed.memberCompleteSince;
  const teamHistoryIncomplete = ranges.current.start < seed.teamCompleteSince;
  const sessionSets = { current: new Set<string>(), previous: new Set<string>() };
  const totalsAccumulator = { current: emptyTotalsAccumulator(), previous: emptyTotalsAccumulator() };

  const rows = input.members.map((member) => {
    const current = emptyInternal();
    const previous = emptyInternal();

    seed.days.forEach((day) => {
      if (day.memberId !== member.id) return;
      aggregateDay(current, day, ranges.current);
      aggregateDay(previous, day, ranges.previous);
    });

    current.sessionIds.forEach((id) => sessionSets.current.add(id));
    previous.sessionIds.forEach((id) => sessionSets.previous.add(id));

    totalsAccumulator.current.acceptedSeconds += current.acceptedSeconds ?? 0;
    totalsAccumulator.current.firstResponseTotal += current.firstResponseTotal;
    totalsAccumulator.current.firstResponseCount += current.firstResponseCount;
    totalsAccumulator.current.repliedSessions += current.repliedSessions;
    totalsAccumulator.previous.acceptedSeconds += previous.acceptedSeconds ?? 0;
    totalsAccumulator.previous.firstResponseTotal += previous.firstResponseTotal;
    totalsAccumulator.previous.firstResponseCount += previous.firstResponseCount;
    totalsAccumulator.previous.repliedSessions += previous.repliedSessions;

    const currentValues = memberHistoryIncomplete ? emptyValues() : finalize(current);
    const previousValues = memberHistoryIncomplete ? emptyValues() : finalize(previous);

    return {
      current: currentValues,
      deltas: {
        acceptedSeconds: diff(currentValues.acceptedSeconds, previousValues.acceptedSeconds),
        chatSeconds: diff(currentValues.chatSeconds, previousValues.chatSeconds),
        efficiency: diff(currentValues.efficiency, previousValues.efficiency),
        firstResponseSeconds: diff(currentValues.firstResponseSeconds, previousValues.firstResponseSeconds),
        receivedSessions: diff(currentValues.receivedSessions, previousValues.receivedSessions),
        repliedSessions: diff(currentValues.repliedSessions, previousValues.repliedSessions),
      },
      member,
      previous: previousValues,
      unavailable: memberHistoryIncomplete,
    };
  });

  const buildTotals = (accumulator: TotalsAccumulator, sessionIds: Set<string>): ServiceTotals => ({
    efficiency: accumulator.acceptedSeconds > 0 ? accumulator.repliedSessions / (accumulator.acceptedSeconds / 3_600) : null,
    firstResponseSeconds: accumulator.firstResponseCount > 0
      ? Math.round(accumulator.firstResponseTotal / accumulator.firstResponseCount)
      : null,
    sessions: sessionIds.size,
  });

  return {
    memberHistoryIncomplete,
    range: ranges,
    rows,
    teamHistoryIncomplete,
    totals: memberHistoryIncomplete
      ? {
          current: { efficiency: null, firstResponseSeconds: null, sessions: null },
          previous: { efficiency: null, firstResponseSeconds: null, sessions: null },
        }
      : {
          current: buildTotals(totalsAccumulator.current, sessionSets.current),
          previous: buildTotals(totalsAccumulator.previous, sessionSets.previous),
        },
  };
}

/** 按团队筛选成员：团队只决定统计哪些成员，成员数据保持全租户口径 */
export function filterServiceMembers(members: ServiceRosterMember[], teamIds: string[]): ServiceRosterMember[] {
  if (teamIds.length === 0) return members;
  const selected = new Set(teamIds);
  return members.filter((member) => member.deleted !== true && member.teamIds.some((id) => selected.has(id)));
}
