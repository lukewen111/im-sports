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

/** 配置失效原因，用于活动卡片提示与保存校验 */
export function campaignInvalidReason(_campaign: Campaign, channel: Channel | undefined, sender: TeamMember | undefined, teamExists: boolean): string | undefined {
  if (!channel) return '渠道已删除';
  if (!channel.enabled) return '渠道已停用';
  if (!teamExists) return '接待团队已失效';
  if (!sender || !channel.teamId || !sender.teamIds.includes(channel.teamId)) return '发送者已失效';
  return memberUsable(sender) ? undefined : '发送者已失效';
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

/** 发送对象：该渠道实例下曾建立正式会话、且当前没有任何未结束会话的客户，按客户 ID 去重 */
export function candidateCustomerCount(sessions: Array<{ channelId: string; customerId: string; status: string }>, channelId: string): number {
  const channelCustomerIds = new Set(sessions.filter((session) => session.channelId === channelId).map((session) => session.customerId));
  const busyCustomerIds = new Set(sessions.filter((session) => session.status !== 'ended').map((session) => session.customerId));
  return [...channelCustomerIds].filter((id) => !busyCustomerIds.has(id)).length;
}

/** 由当前时间生成单次活动默认日期（次日） */
export function defaultOnceDate(now = new Date()): string {
  const value = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}
