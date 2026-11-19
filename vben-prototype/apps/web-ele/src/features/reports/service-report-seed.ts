import { DEFAULT_TEAM_ID } from '#/features/team/team-constants';
import { addDays, formatZonedDate, startOfZonedDay } from '#/utils/report-time';

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** 成员维度可保证完整统计的起始天数，超过后相关指标展示「数据不可用」 */
export const SERVICE_MEMBER_COMPLETE_DAYS = 180;
/** 团队归属维度可保证完整统计的起始天数 */
export const SERVICE_TEAM_COMPLETE_DAYS = 300;
/** 演示用已删除成员，仅在「全部团队」下保留历史行 */
export const FORMER_SERVICE_MEMBER = {
  account: 'lin.ke',
  deleted: true,
  id: 'member-former',
  kind: 'human' as const,
  name: '林可',
  teamIds: [DEFAULT_TEAM_ID],
};

export interface ServiceSessionSeed {
  /** 接待段开始时间 */
  at: number;
  /** 接待段结束时间 */
  endAt: number;
  firstResponseSeconds: number | null;
  id: string;
  /** 首响成功时间，未回复时为空 */
  replyAt: number | null;
  replied: boolean;
}

export interface ServiceMemberDay {
  acceptedSeconds: number;
  dayStart: number;
  memberId: string;
  sessions: ServiceSessionSeed[];
}

export interface ServiceReportSeed {
  days: ServiceMemberDay[];
  memberCompleteSince: number;
  teamCompleteSince: number;
}

interface SeedMember {
  deletedAtDaysAgo?: number;
  id: string;
  kind: 'ai' | 'human';
  joinedDaysAgo?: number;
}

const seedMembers: SeedMember[] = [
  { id: 'member-owner', kind: 'human' },
  { id: 'member-sophie', kind: 'human' },
  { id: 'member-mika', kind: 'human' },
  { id: 'member-chenyi', kind: 'human' },
  { id: 'member-ai-sales', kind: 'ai' },
  { id: 'member-ai-after-sales', kind: 'ai' },
  // 40 天前被删除，历史接待数据保留
  { deletedAtDaysAgo: 40, id: FORMER_SERVICE_MEMBER.id, kind: 'human', joinedDaysAgo: 120 },
];

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6D_2B_79_F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

let cached: { key: string; seed: ServiceReportSeed } | undefined;

function buildDay(member: SeedMember, dayStart: number, daysAgo: number, now: number): ServiceMemberDay | undefined {
  if (member.joinedDaysAgo !== undefined && daysAgo > member.joinedDaysAgo) return undefined;
  if (member.deletedAtDaysAgo !== undefined && daysAgo < member.deletedAtDaysAgo) return undefined;

  const random = mulberry32(daysAgo * 7_919 + member.id.length * 131 + member.id.charCodeAt(member.id.length - 1) * 17);
  const isAi = member.kind === 'ai';
  const offline = random() < (isAi ? 0.01 : 0.06);
  const lastHour = daysAgo === 0 ? Math.max(9, Math.floor((now - dayStart) / HOUR_MS)) : 22;
  const hourSpan = Math.max(1, lastHour - 8 + 1);
  const count = offline ? 0 : (isAi ? 18 : 10) + Math.floor(random() * (isAi ? 21 : 17));
  const ratio = daysAgo === 0 ? Math.min(1, Math.max(0.12, (lastHour - 8 + 1) / 15)) : 1;
  const acceptedSeconds = offline ? 0 : Math.round((isAi ? 36_000 : 23_400) + random() * (isAi ? 14_400 : 9_000)) * ratio;
  const repliedRate = isAi ? 0.97 : 0.9;
  const sessions: ServiceSessionSeed[] = [];

  for (let index = 0; index < count; index++) {
    const hour = 8 + Math.floor(random() * hourSpan);
    const at = dayStart + hour * HOUR_MS + Math.floor(random() * 58) * MINUTE_MS;
    if (at >= now) continue;

    const durationMinutes = 8 + Math.floor(random() * 25);
    const endAt = at + durationMinutes * MINUTE_MS;
    let firstResponseSeconds: null | number = null;
    let replied = random() < repliedRate;

    if (replied) {
      const longTail = !isAi && random() < 0.08;
      firstResponseSeconds = isAi
        ? 2 + Math.floor(random() * 18)
        : longTail
          ? 300 + Math.floor(random() * 900)
          : 8 + Math.floor(random() * 160);
      if (firstResponseSeconds >= durationMinutes * 60) replied = false;
    }

    const replyAt = replied && firstResponseSeconds !== null ? at + firstResponseSeconds * 1_000 : null;
    if (replyAt !== null && replyAt > now) {
      replied = false;
      firstResponseSeconds = null;
    }

    sessions.push({
      at,
      endAt,
      firstResponseSeconds: replied ? firstResponseSeconds : null,
      id: `service-${member.id}-${daysAgo}-${index}`,
      replyAt: replied ? replyAt : null,
      replied,
    });
  }

  return {
    acceptedSeconds,
    dayStart,
    memberId: member.id,
    sessions,
  };
}

/**
 * 生成最近 365 天各成员的接待明细，作为「报告 → 客服」的确定性数据源。
 * 与会话 Store 相互独立，成员维度 180 天、团队维度 300 天以外标记为不可用。
 */
export function serviceReportSeed(now: number, offset: number): ServiceReportSeed {
  const todayStart = startOfZonedDay(now, offset);
  const key = `${formatZonedDate(now, offset)}:${offset}`;
  if (cached?.key === key) return cached.seed;

  const days: ServiceMemberDay[] = [];

  for (let daysAgo = 364; daysAgo >= 0; daysAgo--) {
    const dayStart = addDays(todayStart, -daysAgo);
    const dayRecords: ServiceMemberDay[] = [];

    for (const member of seedMembers) {
      const record = buildDay(member, dayStart, daysAgo, now);
      if (record) dayRecords.push(record);
    }

    // 少量跨成员共享同一会话，用于验证顶部会话总数按会话 ID 去重
    const sharedRandom = mulberry32(daysAgo * 2_791 + 97);
    const donor = dayRecords[0];
    const receiver = dayRecords[1];
    const source = donor?.sessions[0];
    const target = receiver?.sessions[0];
    if (source && target && sharedRandom() < 0.55) target.id = source.id;

    days.push(...dayRecords);
  }

  const seed: ServiceReportSeed = {
    days,
    memberCompleteSince: addDays(todayStart, -SERVICE_MEMBER_COMPLETE_DAYS),
    teamCompleteSince: addDays(todayStart, -SERVICE_TEAM_COMPLETE_DAYS),
  };
  cached = { key, seed };
  return seed;
}
