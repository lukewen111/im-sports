import type { ChannelType } from '#/features/channels/channel-data';

import { channelTypes } from '#/features/channels/channel-data';

export type CampaignRepeat = 'daily' | 'monthly' | 'once' | 'weekly';
export type CampaignStatus = 'active' | 'expired' | 'paused';
export type CampaignRunStatus = 'failed' | 'running' | 'success';
/** 活动渠道类型：在渠道类型基础上增加无渠道实例的 SDK */
export type CampaignType = ChannelType | 'sdk';

export const campaignTypes: CampaignType[] = [...channelTypes, 'sdk'];

export const campaignTypeLabels: Record<CampaignType, string> = {
  'chat-page': '聊天页面',
  sdk: 'SDK',
  telegram: 'Telegram',
  'web-widget': '网站小部件',
};

/** SDK 渠道最多可创建的活动数（全租户） */
export const SDK_CAMPAIGN_LIMIT = 1;

export interface Campaign {
  /** 所属渠道类型，四个入口数据完全独立 */
  type: CampaignType;
  id: string;
  name: string;
  /** 文本消息，可为空（与图片至少一项） */
  text: string;
  imageUrl?: string;
  imageName?: string;
  /** 所选渠道实例，可多选；SDK 活动为空数组 */
  channelIds: string[];
  senderId: string;
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
  sentCustomers: number;
  successMessages: number;
  failedMessages: number;
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
