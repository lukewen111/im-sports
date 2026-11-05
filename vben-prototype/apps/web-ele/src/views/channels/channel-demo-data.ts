import type { Channel } from '#/features/channels/channel-data';

import { normalizeChannel } from '#/features/channels/channel-data';
import { DEFAULT_TEAM_ID } from '#/features/team/team-constants';

/**
 * 渠道列表分页/空态验证用的本地演示数据。
 * 仅写在渠道页面目录内，不进入 features/service/demo-store.ts。
 */
const rows: Array<{ domain: string; enabled: boolean; id: string; installed: boolean; name: string; teamId: string }> = [
  { domain: 'shop.example.com', enabled: true, id: 'demo-channel-shop', installed: true, name: '官网产品页小部件', teamId: DEFAULT_TEAM_ID },
  { domain: 'help.example.com', enabled: true, id: 'demo-channel-help', installed: true, name: '帮助中心小部件', teamId: '100002' },
  { domain: 'asia.example.com', enabled: true, id: 'demo-channel-asia', installed: true, name: '亚洲站小部件', teamId: DEFAULT_TEAM_ID },
  { domain: 'eu.example.com', enabled: true, id: 'demo-channel-eu', installed: true, name: '欧洲站小部件', teamId: '100002' },
  { domain: 'us.example.com', enabled: true, id: 'demo-channel-us', installed: false, name: '北美站小部件', teamId: DEFAULT_TEAM_ID },
  { domain: 'member.example.com', enabled: true, id: 'demo-channel-member', installed: true, name: '会员中心小部件', teamId: '100003' },
  { domain: 'tracking.example.com', enabled: true, id: 'demo-channel-tracking', installed: false, name: '物流查询小部件', teamId: DEFAULT_TEAM_ID },
  { domain: 'service.example.com', enabled: true, id: 'demo-channel-service', installed: true, name: '售后支持小部件', teamId: '100002' },
  { domain: 'm.example.com', enabled: true, id: 'demo-channel-mobile', installed: false, name: '移动官网小部件', teamId: DEFAULT_TEAM_ID },
  { domain: 'partner.example.com', enabled: true, id: 'demo-channel-partner', installed: true, name: '品牌合作小部件', teamId: '100003' },
  { domain: 'legacy.example.com', enabled: false, id: 'demo-channel-legacy', installed: false, name: '长期停用测试小部件', teamId: DEFAULT_TEAM_ID },
];

const createdAt = (index: number) => new Date(Date.UTC(2026, 9, 20, 9 + (index % 8), (index * 7) % 60) - index * 86_400_000).toISOString();

export const channelDemoChannels: Channel[] = rows.map((row, index) =>
  normalizeChannel({
    allowedDomains: [],
    brandName: 'IM Support',
    brandSignature: '有问题？我们随时为您提供帮助。',
    createdAt: createdAt(index),
    enabled: row.enabled,
    id: row.id,
    installStatus: row.installed ? 'success' : 'unchecked',
    name: row.name,
    teamId: row.teamId,
    type: 'web-widget',
    updatedAt: createdAt(index),
    websiteDomain: row.domain,
  }),
);

export const channelDemoIds = new Set(channelDemoChannels.map((channel) => channel.id));
export const CHANNEL_DEMO_SEEDED_KEY = 'im-support-vben:channel-demo-seeded-v2';
