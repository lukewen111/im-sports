import type { DemoSession } from '#/features/service/demo-store';

import { DEFAULT_TEAM_ID } from '#/features/team/team-constants';
import { addDays, formatZonedDate, startOfZonedDay } from '#/utils/report-time';

const HOUR_MS = 3_600_000;

/** 报告演示用历史会话池：只服务「报告 → 概览」的趋势统计，不写入会话 Store */
export interface ReportHistory {
  /** 成员维度可保证完整统计的起始时间 */
  memberCompleteSince: number;
  sessions: DemoSession[];
  /** 团队维度可保证完整统计的起始时间 */
  teamCompleteSince: number;
}

const TEAM_IDS = [DEFAULT_TEAM_ID, '100002', '100003'];
const HUMAN_IDS = ['member-owner', 'member-sophie', 'member-mika', 'member-chenyi'];
const AI_IDS = ['member-ai-sales', 'member-ai-after-sales'];
const FORMER_MEMBER_ID = 'member-former';
const MEMBER_COMPLETE_DAYS = 180;
const TEAM_COMPLETE_DAYS = 300;

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

const pick = <T,>(items: T[], random: () => number): T => items[Math.floor(random() * items.length)] ?? items[0]!;

let cached: { history: ReportHistory; key: string } | undefined;

/**
 * 生成最近 365 天的确定性历史会话，用于支撑近 7 天／近 30 天／自定义长周期的趋势展示。
 * 超过 180 天缺少成员归属、超过 300 天缺少创建时团队，用于演示「历史数据不可用」。
 */
export function reportHistory(now: number, offset: number): ReportHistory {
  const todayStart = startOfZonedDay(now, offset);
  const key = `${formatZonedDate(now, offset)}:${offset}`;
  if (cached?.key === key) return cached.history;

  const sessions: DemoSession[] = [];
  const currentHour = Math.floor((now - todayStart) / HOUR_MS);

  for (let daysAgo = 364; daysAgo >= 0; daysAgo--) {
    const dayStart = addDays(todayStart, -daysAgo);
    const random = mulberry32(daysAgo * 7919 + 104_729);
    const lastHour = daysAgo === 0 ? Math.max(currentHour, 0) : 22;
    const firstHour = Math.min(8, lastHour);
    // 每个自然日都保证有足够会话量，各时间粒度下不出现空桶
    const fullDayCount = 20 + Math.floor(random() * 24);
    // 今天按已过去的营业时段折算会话量，保证当天的桶同样有数据
    const todayProgress = Math.min(1, Math.max(0.3, (currentHour - 8 + 1) / 15));
    const count = daysAgo === 0 ? Math.max(8, Math.round(fullDayCount * todayProgress)) : fullDayCount;
    const hasMemberHistory = daysAgo < MEMBER_COMPLETE_DAYS;
    const hasTeamHistory = daysAgo < TEAM_COMPLETE_DAYS;

    for (let index = 0; index < count; index++) {
      const hour = firstHour + Math.floor(random() * (lastHour - firstHour + 1));
      const createdAt = dayStart + hour * HOUR_MS + Math.floor(random() * 58) * 60_000;
      const assigneeKind = random() < 0.42 ? 'ai' : 'human';
      const participants: string[] = [];

      if (hasMemberHistory) {
        participants.push(assigneeKind === 'ai' ? pick(AI_IDS, random) : pick(HUMAN_IDS, random));
        if (random() < 0.2) participants.push(pick(HUMAN_IDS, random));
        if (random() < 0.06) participants.push(FORMER_MEMBER_ID);
      }

      sessions.push({
        assigneeKind,
        channelId: 'report-seed-channel',
        createdAt: new Date(createdAt).toISOString(),
        customerId: `report-customer-${daysAgo}-${index}`,
        endedAt: new Date(createdAt + 40 * 60_000).toISOString(),
        id: `report-session-${formatZonedDate(dayStart, offset)}-${index}`,
        messages: [],
        participants: [...new Set(participants)],
        status: daysAgo === 0 ? (random() < 0.18 ? 'pending' : 'active') : 'ended',
        teamId: hasTeamHistory ? pick(TEAM_IDS, random) : '',
        unread: 0,
      });
    }
  }

  const history: ReportHistory = {
    memberCompleteSince: addDays(todayStart, -MEMBER_COMPLETE_DAYS),
    sessions,
    teamCompleteSince: addDays(todayStart, -TEAM_COMPLETE_DAYS),
  };
  cached = { history, key };
  return history;
}
