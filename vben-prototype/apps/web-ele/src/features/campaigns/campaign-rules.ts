import type { Channel } from '#/features/channels/channel-data';
import type { TeamMember } from '#/features/team/team-store';
import type { Campaign, CampaignRun, CampaignStatus } from './campaign-data';

import { DEFAULT_CAMPAIGN_TIMEZONE, weekdayLabels } from './campaign-data';

const pad = (value: number) => String(value).padStart(2, '0');

/** 单次活动的计划时间点；周期活动不产生绝对时间点 */
export function plannedAt(campaign: Campaign): Date | undefined {
  if (campaign.repeat !== 'once' || !campaign.date) return undefined;
  const value = new Date(`${campaign.date}T${campaign.time}:00`);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

/** 活动启停状态：已过期优先，其次按启用开关判定 */
export function campaignStatus(campaign: Campaign, now = new Date()): CampaignStatus {
  if (campaign.repeat === 'once') {
    const planned = plannedAt(campaign);
    if (campaign.expired || (planned && planned.getTime() <= now.getTime())) return 'expired';
  }
  return campaign.enabled ? 'active' : 'paused';
}

/** 计划时间摘要，例如「每周一、二 10:00」「每月1日、2日 10:00」 */
export function scheduleSummary(campaign: Campaign): string {
  if (campaign.repeat === 'once') return `${campaign.date || ''} ${campaign.time}`.trim();
  if (campaign.repeat === 'daily') return `每天 ${campaign.time}`;
  if (campaign.repeat === 'weekly') {
    const days = [...campaign.weekdays]
      .sort((a, b) => a - b)
      .map((day) => weekdayLabels[day - 1]?.replace('周', '') ?? '')
      .filter(Boolean)
      .join('、');
    return `每周${days} ${campaign.time}`;
  }
  const days = [...campaign.monthDays].sort((a, b) => a - b).map((day) => `${day}日`).join('、');
  return `每月${days} ${campaign.time}`;
}

export function memberUsable(member: TeamMember): boolean {
  if (member.kind === 'ai') return member.exception !== 'agent';
  return member.enabled !== false;
}

/** 配置失效原因，用于活动卡片提示与保存校验；渠道问题只报数量，不点名 */
export function campaignInvalidReason(campaign: Campaign, channels: Array<Channel | undefined>, sender: TeamMember | undefined): string | undefined {
  if (campaign.type !== 'sdk') {
    if (channels.length === 0) return '未选择渠道';
    const disabled = channels.filter((channel) => channel && !channel.enabled).length;
    const missing = channels.filter((channel) => !channel).length;
    if (disabled || missing) {
      const parts: string[] = [];
      if (disabled) parts.push(`${disabled} 个已停用`);
      if (missing) parts.push(`${missing} 个已删除`);
      return `所选渠道中有 ${parts.join('、')}`;
    }
  }
  if (!sender || !memberUsable(sender)) return '发送者已失效';
  return undefined;
}

/** 耗时展示：0s / 20m21s / 1h10m10s，超过 24 小时继续累计小时 */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours === 0) return `${minutes}m${rest}s`;
  return `${hours}h${minutes}m${rest}s`;
}

/** 数量按英文逗号千分位展示 */
export function formatCount(value: number): string {
  return Math.max(0, Math.floor(value)).toLocaleString('en-US');
}

interface ZoneClock {
  date: string;
  day: number;
  month: number;
  time: string;
  year: number;
}

/** 把某一时刻换算到 UTC±HH:MM 时区的墙钟时间 */
function zoneClock(instant: Date, timezone: string): ZoneClock {
  const match = /^UTC([+-])(\d{2}):(\d{2})$/.exec(timezone);
  const offsetMinutes = match ? (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
  const shifted = new Date(instant.getTime() + offsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = shifted.getUTCMonth() + 1;
  const day = shifted.getUTCDate();
  return {
    date: `${year}-${pad(month)}-${pad(day)}`,
    day,
    month,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
    year,
  };
}

/** 按活动时区（UTC±HH:MM）取当前墙钟日期与时间，用于单次计划时间校验 */
export function zonedNow(timezone: string, now = new Date()) {
  const clock = zoneClock(now, timezone);
  return { date: clock.date, time: clock.time };
}

/** 运行时间按账号时区展示，格式沿用聊天时间规则 */
export function formatZonedChatTime(value: string, timezone: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return '—';
  const clock = zoneClock(instant, timezone);
  const now = zoneClock(new Date(), timezone);
  if (clock.date === now.date) return clock.time;
  const yesterday = new Date(`${now.date}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (clock.date === yesterday.toISOString().slice(0, 10)) return `昨天 ${clock.time}`;
  if (clock.year === now.year) return `${clock.month}月${clock.day}日 ${clock.time}`;
  return `${clock.year}年${clock.month}月${clock.day}日 ${clock.time}`;
}

/** 运行历史「运行时间」：按账号时区展示，未实际开始时显示 — */
export function runTimeText(run: CampaignRun, timezone = DEFAULT_CAMPAIGN_TIMEZONE): string {
  if (!run.startedAt) return '—';
  return formatZonedChatTime(run.startedAt, timezone);
}

/** 运行历史「耗时」：运行中按当前时刻累计，未开始显示 — */
export function runDurationText(run: CampaignRun, nowMs = Date.now()): string {
  if (!run.startedAt) return '—';
  if (run.status === 'running') return formatDuration((nowMs - new Date(run.startedAt).getTime()) / 1000);
  return formatDuration(run.durationSec);
}

export function runStatusText(status: CampaignRun['status']): string {
  return status === 'running' ? '运行中' : status === 'success' ? '成功' : '失败';
}

/** 运行历史按实际开始时间倒序，未开始时按计划时间 */
export function sortRuns(runs: CampaignRun[]): CampaignRun[] {
  const stamp = (run: CampaignRun) => new Date(run.startedAt || run.plannedAt || 0).getTime();
  return [...runs].sort((a, b) => stamp(b) - stamp(a));
}

export interface CampaignTarget {
  customerId: string;
  /** 该客户最近一次已结束会话所在的所选渠道 */
  channelId: string;
}

/** 发送对象：所选渠道中曾建立正式会话、且当前没有任何未结束会话的客户，按客户 ID 去重并各选一条发送渠道 */
export function candidateCustomers(
  sessions: Array<{ channelId: string; createdAt?: string; customerId: string; endedAt?: string; status: string }>,
  channelIds: string[],
): CampaignTarget[] {
  const busyCustomerIds = new Set(sessions.filter((session) => session.status !== 'ended').map((session) => session.customerId));
  const latest = new Map<string, { channelId: string; stamp: number }>();
  for (const session of sessions) {
    if (session.status !== 'ended' || !channelIds.includes(session.channelId)) continue;
    const stamp = new Date(session.endedAt || session.createdAt || 0).getTime();
    const previous = latest.get(session.customerId);
    if (!previous || stamp >= previous.stamp) latest.set(session.customerId, { channelId: session.channelId, stamp });
  }
  return [...latest.entries()]
    .filter(([customerId]) => !busyCustomerIds.has(customerId))
    .map(([customerId, item]) => ({ customerId, channelId: item.channelId }));
}

/** 候选发送客户数：多个所选渠道取并集后按客户去重 */
export function candidateCustomerCount(
  sessions: Array<{ channelId: string; createdAt?: string; customerId: string; endedAt?: string; status: string }>,
  channelIds: string[],
): number {
  return candidateCustomers(sessions, channelIds).length;
}

/** 由当前时间生成单次活动默认日期（次日） */
export function defaultOnceDate(now = new Date()): string {
  const value = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
