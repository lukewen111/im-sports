import type { Channel } from '#/features/channels/channel-data';
import type { DemoSession } from '#/features/service/demo-store';

/** 浏览器推送订阅（演示用本地 mock 表，按历史会话稳定生成） */
export interface CampaignSubscription {
  tenantId: string;
  channelId: string;
  customerId: string;
  deviceId: string;
  deviceLabel: string;
  sourceUrl: string;
  authorizedAt: string;
  valid: boolean;
}

export const CAMPAIGN_SUBSCRIPTION_STORAGE_KEY = 'im-support-vben:campaign-subscriptions-v1';

const TENANT_ID = 'adam-tenant-main';
const DEVICE_LABELS = ['Chrome · Windows', 'Safari · macOS', 'Chrome · Android', 'Safari · iOS'];

/** 稳定哈希，保证每次生成同一批订阅 */
function hash(value: string): number {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  return result >>> 0;
}

function resolveSourceUrl(channel: Channel): string {
  if (channel.type === 'web-widget' && channel.websiteDomain) return `https://${channel.websiteDomain}/`;
  if (channel.chatPageUrl) return `https://support.example.com${channel.chatPageUrl}`;
  return 'https://support.example.com/';
}

/** 按历史已结束会话生成订阅：每位客户约 55% 有效，约 20% 客户有 2 台设备 */
export function buildSubscriptions(sessions: DemoSession[], channels: Channel[]): CampaignSubscription[] {
  const channelMap = new Map(channels.map((channel) => [channel.id, channel]));
  const pairs = new Map<string, { authorizedAt: string; channelId: string; customerId: string }>();
  for (const session of sessions) {
    const channel = channelMap.get(session.channelId);
    if (!channel || channel.type === 'telegram') continue;
    const key = `${session.channelId}:${session.customerId}`;
    const authorizedAt = session.endedAt || session.createdAt;
    const previous = pairs.get(key);
    if (!previous || new Date(authorizedAt).getTime() > new Date(previous.authorizedAt).getTime()) {
      pairs.set(key, { authorizedAt, channelId: session.channelId, customerId: session.customerId });
    }
  }

  const result: CampaignSubscription[] = [];
  for (const pair of [...pairs.values()].sort((left, right) => left.customerId.localeCompare(right.customerId))) {
    const channel = channelMap.get(pair.channelId);
    if (!channel) continue;
    const seed = hash(`${pair.channelId}:${pair.customerId}`);
    const customerValid = seed % 100 < 55;
    const deviceCount = hash(`devices:${pair.customerId}`) % 5 === 0 ? 2 : 1;
    for (let index = 0; index < deviceCount; index += 1) {
      const deviceId = `device-${seed.toString(36)}-${index}`;
      result.push({
        tenantId: TENANT_ID,
        channelId: pair.channelId,
        customerId: pair.customerId,
        deviceId,
        deviceLabel: DEVICE_LABELS[(seed + index) % DEVICE_LABELS.length]!,
        sourceUrl: resolveSourceUrl(channel),
        authorizedAt: pair.authorizedAt,
        // 首位设备继承客户级有效标记，保证有效客户至少有一台设备可接收
        valid: index === 0 ? customerValid : hash(deviceId) % 100 < 55,
      });
    }
  }
  return result;
}

let cache: CampaignSubscription[] | undefined;

/** 读取本地订阅表；首次访问时按历史会话生成并写入 localStorage */
export function loadSubscriptions(sessions: DemoSession[], channels: Channel[]): CampaignSubscription[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(CAMPAIGN_SUBSCRIPTION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CampaignSubscription[];
      if (Array.isArray(parsed)) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    // 解析失败时按会话重新生成
  }
  cache = buildSubscriptions(sessions, channels);
  try {
    localStorage.setItem(CAMPAIGN_SUBSCRIPTION_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // 演示环境配额不足时保留内存态
  }
  return cache;
}
