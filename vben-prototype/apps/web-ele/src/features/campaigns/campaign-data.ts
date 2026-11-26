import type { ChannelType } from '#/features/channels/channel-data';

export type CampaignRepeat = 'daily' | 'monthly' | 'once' | 'weekly';
export type CampaignStatus = 'active' | 'expired' | 'paused';
export type CampaignRunStatus = 'failed' | 'running' | 'success';
/** 活动按渠道类型区分，与渠道模块保持一致 */
export type CampaignType = ChannelType;
/** 浏览器通知点击后的跳转方式：按渠道默认链接，或自定义 URL */
export type CampaignNotificationLinkMode = 'channel' | 'custom';

export interface Campaign {
  /** 所属渠道类型，各入口数据完全独立 */
  type: CampaignType;
  id: string;
  name: string;
  /** 文本消息，可为空（与图片至少一项） */
  text: string;
  imageUrl?: string;
  imageName?: string;
  /** 浏览器通知标题，网页渠道必填，最多 40 个可见字符 */
  notificationTitle: string;
  /** 浏览器通知点击后的跳转方式 */
  notificationLinkMode: CampaignNotificationLinkMode;
  /** 自定义跳转地址，仅 notificationLinkMode 为 custom 时使用 */
  notificationCustomUrl?: string;
  /** 所选渠道实例，可多选 */
  channelIds: string[];
  repeat: CampaignRepeat;
  /** 单次活动的计划日期 YYYY-MM-DD */
  date?: string;
  /** 每周计划，1=周一 ... 7=周日 */
  weekdays: number[];
  /** 每月计划，1-31，不存在的日期自然跳过 */
  monthDays: number[];
  /** 计划时分 HH:mm */
  time: string;
  /** 活动自身时区，保存后不再随账号时区变化 */
  timezone: string;
  enabled: boolean;
  /** 单次活动是否已消耗计划（执行结束或被人工触发后置为已过期） */
  expired: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignRun {
  id: string;
  campaignId: string;
  type: CampaignType;
  /** 活动名称快照，活动删除后仍可追溯 */
  snapshotName: string;
  status: CampaignRunStatus;
  /** 目标客户数（按客户去重）；旧记录可能缺失，展示为 — */
  targetCustomers?: number;
  /** 目标客户中具备浏览器推送资格的人数；null 表示该渠道不适用，展示为 — */
  browserTargetCustomers?: null | number;
  sentCustomers: number;
  /** 聊天消息成功数（网页）/ 消息成功数（Telegram） */
  successMessages: number;
  /** 聊天消息失败数（网页）/ 消息失败数（Telegram） */
  failedMessages: number;
  /** 浏览器推送成功数；null 表示不适用，展示为 — */
  browserSuccess?: null | number;
  /** 浏览器推送失败数；null 表示不适用，展示为 — */
  browserFailed?: null | number;
  /** 实际开始时间；为空表示尚未实际开始 */
  startedAt?: string;
  /** 计划时间，未实际开始时用于排序与展示 */
  plannedAt?: string;
  /** 已结束任务的固定耗时（秒） */
  durationSec: number;
}

export const CAMPAIGN_STORAGE_KEY = 'im-support-vben:campaigns-v1';

/** 活动消息文本上限，集中在此便于调整 */
export const CAMPAIGN_TEXT_MAX_LENGTH = 2000;

/** 浏览器通知标题上限 */
export const CAMPAIGN_NOTIFICATION_TITLE_MAX_LENGTH = 40;
/** 浏览器通知正文上限，正文由消息文本派生 */
export const CAMPAIGN_NOTIFICATION_BODY_MAX_LENGTH = 140;
/** 通知正文超出上限时保留的字符数（省略号占 1 个字符） */
export const CAMPAIGN_NOTIFICATION_BODY_KEEP_LENGTH = CAMPAIGN_NOTIFICATION_BODY_MAX_LENGTH - 1;

export const repeatMeta: Record<CampaignRepeat, string> = {
  once: '单次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
};

export const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

/** 时区下拉固定候选：UTC-08:00 ~ UTC+09:00，默认取登录账号时区 */
export const CAMPAIGN_TIMEZONES = Array.from({ length: 18 }, (_, index) => {
  const offset = index - 8;
  return `UTC${offset >= 0 ? '+' : '-'}${String(Math.abs(offset)).padStart(2, '0')}:00`;
});
export const DEFAULT_CAMPAIGN_TIMEZONE = 'UTC+08:00';

/** 网页渠道（网站小部件、聊天页面）支持浏览器通知，Telegram 不支持 */
export function supportsBrowserPush(type: CampaignType): boolean {
  return type !== 'telegram';
}
