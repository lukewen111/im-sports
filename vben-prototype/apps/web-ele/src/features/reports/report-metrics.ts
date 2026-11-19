import type { DemoSession } from '#/features/service/demo-store';
import type { TeamMember } from '#/features/team/team-store';
import type { ReportGranularity, ReportRangeMode, TimeBucket } from '#/utils/report-time';

import { reportHistory } from './report-seed';
import { bucketKey, buildTimeBuckets, resolveReportRange } from '#/utils/report-time';

export interface RealtimeSnapshot {
  /** AI 接待中的未结束会话 */
  aiActive: number;
  /** 人工接待中的未结束会话 */
  humanActive: number;
  offline: number;
  online: number;
  /** 待分配的未结束会话 */
  pending: number;
}

export interface TrendFilters {
  aiIds: string[];
  customEnd?: string;
  customStart?: string;
  humanIds: string[];
  mode: ReportRangeMode;
  teamIds: string[];
}

export interface TrendBucket extends TimeBucket {
  /** null 表示该时间桶历史数据不可用，不能用 0 代替 */
  count: number | null;
}

export interface TrendResult {
  buckets: TrendBucket[];
  granularity: ReportGranularity;
  total: number | null;
  /** 是否存在历史数据不可用的时间桶 */
  unavailable: boolean;
}

/** 实时卡片：按当前会话状态与当前成员状态取快照，不受趋势筛选影响 */
export function buildRealtimeSnapshot(sessions: DemoSession[], members: TeamMember[]): RealtimeSnapshot {
  const snapshot: RealtimeSnapshot = { aiActive: 0, humanActive: 0, offline: 0, online: 0, pending: 0 };

  for (const session of sessions) {
    if (session.status === 'ended') continue;
    if (session.status === 'pending') {
      snapshot.pending += 1;
    } else if (session.assigneeKind === 'ai') {
      snapshot.aiActive += 1;
    } else {
      snapshot.humanActive += 1;
    }
  }

  const seen = new Set<string>();
  for (const member of members) {
    if (seen.has(member.id)) continue;
    // 已停用的人类成员不计入在线／离线人数；AI 成员按手动在线状态统计
    if (member.kind === 'human' && member.enabled === false) continue;
    seen.add(member.id);
    if (member.online) snapshot.online += 1;
    else snapshot.offline += 1;
  }

  return snapshot;
}

/**
 * 会话趋势：创建时间 + 创建时团队 + 成员参与（OR）三个条件同时命中，并按会话 ID 去重。
 * 自定义日期不合法时返回 undefined，调用方保留上一次结果。
 */
export function buildTrendSessions(sessions: DemoSession[], filters: TrendFilters, offset: number, now: number): TrendResult | undefined {
  const range = resolveReportRange(filters.mode, offset, now, filters.customStart, filters.customEnd);
  if (!range) return undefined;

  const history = reportHistory(now, offset);
  const teamIds = new Set(filters.teamIds);
  const participantIds = new Set([...filters.humanIds, ...filters.aiIds]);
  const filterByTeam = teamIds.size > 0;
  const filterByParticipant = participantIds.size > 0;

  const counts = new Map<number, number>();
  const seen = new Set<string>();

  for (const session of [...sessions, ...history.sessions]) {
    if (seen.has(session.id)) continue;
    const createdAt = +new Date(session.createdAt);
    if (createdAt < range.start || createdAt > range.end) continue;
    if (filterByTeam && !teamIds.has(session.teamId)) continue;
    if (filterByParticipant && !session.participants.some((id) => participantIds.has(id))) continue;
    seen.add(session.id);
    const key = bucketKey(createdAt, range.granularity, offset);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const buckets = buildTimeBuckets(range, offset).map((bucket): TrendBucket => {
    const memberUnavailable = filterByParticipant && bucket.start < history.memberCompleteSince;
    const teamUnavailable = filterByTeam && bucket.start < history.teamCompleteSince;
    const unavailable = memberUnavailable || teamUnavailable;
    return { ...bucket, count: unavailable ? null : (counts.get(bucket.key) ?? 0) };
  });

  const unavailable = buckets.some((bucket) => bucket.count === null);
  return {
    buckets,
    granularity: range.granularity,
    total: unavailable ? null : buckets.reduce((sum, bucket) => sum + (bucket.count ?? 0), 0),
    unavailable,
  };
}
