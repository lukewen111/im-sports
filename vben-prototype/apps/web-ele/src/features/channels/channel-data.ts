import { formatChatTime } from '#/utils/chat-time';

import { DEFAULT_TEAM_ID, normalizeTeamId } from '../team/team-constants';

export type ChannelType = 'chat-page' | 'telegram' | 'web-widget';
export type WidgetPosition = 'bottom-left' | 'bottom-right';
export type WidgetIcon = 'custom' | 'message' | 'message-dark' | 'message-line';

export interface Team { accepting: boolean; avatar?: string; color?: string; id: string; name: string; status: 'active' | 'invalid' }
export interface Channel {
  allowedDomains: string[]; botToken?: string; brandAvatar?: string; brandName: string;
  brandSignature: string; chatPageUrl?: string; createdAt: string; enabled: boolean; id: string; installCode?: string;
  installCheckedAt?: string; installStatus?: 'success' | 'unchecked'; language: string; name: string; soundEnabled: boolean; teamId?: string;
  telegramBotId?: string; themeColor: string; type: ChannelType; updatedAt: string; websiteDomain?: string; widgetCustomIcon?: string;
  widgetDesktopVisible: boolean; widgetIcon: WidgetIcon; widgetMobileOffsetX: number; widgetMobileOffsetY: number;
  widgetMobilePosition: WidgetPosition; widgetMobileVisible: boolean; widgetOffsetX: number; widgetOffsetY: number;
  widgetPosition: WidgetPosition;
}
export const channelMeta: Record<ChannelType, { addLabel: string; description: string; label: string }> = {
  'web-widget': { addLabel: '添加网站', description: '在客户浏览网站时，与他们实时聊天。', label: '网站小部件' },
  telegram: { addLabel: '添加新连接', description: 'Telegram 消息会以会话形式进入你的收件箱。', label: 'Telegram' },
  'chat-page': { addLabel: '添加新连接', description: '向客户分享聊天链接，让他们可以随时发起咨询。', label: '聊天页面' },
};
export const channelTypes: ChannelType[] = ['web-widget', 'telegram', 'chat-page'];
export const languages = ['自动', '简体中文', '繁体中文', '英语', '越南语', '泰语', '高棉语', '缅甸语', '老挝语', '西班牙语'];
export const teams: Team[] = [
  { accepting: true, id: DEFAULT_TEAM_ID, name: '通用团队', status: 'active' },
  { accepting: true, id: '100002', name: '售前服务团队', status: 'active' },
  { accepting: false, id: '100003', name: '售后服务团队', status: 'active' },
  { accepting: false, id: '199999', name: '历史失效团队', status: 'invalid' },
];

const now = () => new Date().toISOString();
const defaults = (type: ChannelType, id: string): Omit<Channel, 'createdAt' | 'id' | 'name' | 'type' | 'updatedAt'> => ({
  allowedDomains: [], brandName: 'IM Support', brandSignature: '有问题？我们随时为您提供帮助。', enabled: true, teamId: DEFAULT_TEAM_ID,
  installCode: type === 'web-widget' ? `<script src="https://cdn.example.com/widget.js" data-channel="${id}" async></script>` : undefined,
  installStatus: type === 'web-widget' ? 'unchecked' : undefined, language: '自动', soundEnabled: true, themeColor: '#1c1f26',
  widgetDesktopVisible: true, widgetIcon: 'message', widgetMobileOffsetX: 24, widgetMobileOffsetY: 24,
  widgetMobilePosition: 'bottom-right', widgetMobileVisible: true, widgetOffsetX: 24, widgetOffsetY: 24, widgetPosition: 'bottom-right',
});
const seedChannels: Channel[] = [
  { ...defaults('web-widget', 'channel-web-widget-main'), createdAt: '2026-10-21T10:30:00.000Z', id: 'channel-web-widget-main', installCheckedAt: '2026-10-21T10:12:00.000Z', installStatus: 'success', name: '官网网站小部件', type: 'web-widget', updatedAt: now(), websiteDomain: 'support.example.com', widgetMobileOffsetX: 16, widgetMobileOffsetY: 16 },
  { ...defaults('telegram', 'channel-telegram-payment'), botToken: '123456789:mock_telegram_payment_bot', createdAt: '2026-10-20T15:18:00.000Z', id: 'channel-telegram-payment', name: 'TG 充值渠道', teamId: '100002', telegramBotId: '123456789', type: 'telegram', updatedAt: now() },
  { ...defaults('chat-page', 'channel-chat-page-support'), brandSignature: '在线客户服务', chatPageUrl: `/chat/${DEFAULT_TEAM_ID}`, createdAt: '2026-10-19T09:42:00.000Z', id: 'channel-chat-page-support', name: '客户服务聊天页面', type: 'chat-page', updatedAt: now() },
];
export const STORAGE_KEY = 'im-support-vben:channels-v4';

export function normalizeChannel(input: Partial<Channel> & { id: string; name: string; type: ChannelType }): Channel {
  const base = defaults(input.type, input.id);
  const teamId = normalizeTeamId(input.teamId);
  const value = { ...base, createdAt: input.createdAt || now(), updatedAt: input.updatedAt || input.createdAt || now(), ...input, teamId } as Channel;
  if (value.type === 'chat-page') value.chatPageUrl = `/chat/${teamId}`;
  return value;
}
export function loadChannels(): Channel[] {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value) {
      const channels = (JSON.parse(value) as Channel[]).map((item) => normalizeChannel(item));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(channels));
      return channels;
    }
  } catch { /* use mock */ }
  return structuredClone(seedChannels);
}
export function persistChannels(channels: Channel[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(channels)); }
export const saveChannels = persistChannels;
export function createChannelDraft(type: ChannelType): Channel { const id = `channel-${type}-${Date.now()}`; const channel = normalizeChannel({ id, name: '', type }); if (type === 'chat-page') channel.chatPageUrl = `/chat/${channel.teamId}`; return channel; }
export function formatDate(value: string) { return formatChatTime(value); }
export function countVisibleCharacters(value = '') {
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value)].length;
  return [...value].length;
}
export function truncateVisibleCharacters(value: string, limit: number) {
  if (countVisibleCharacters(value) <= limit) return value;
  if (typeof Intl.Segmenter === 'function') return [...new Intl.Segmenter('zh-CN', { granularity: 'grapheme' }).segment(value)].slice(0, limit).map((item) => item.segment).join('');
  return [...value].slice(0, limit).join('');
}
export function parseDomain(value: string): { domain?: string; error?: string } {
  const raw = value.trim();
  if (!raw) return { error: '请输入网站域名' };
  if (/^http:\/\//i.test(raw)) return { error: '仅支持 HTTPS 网站，请勿使用 http://' };
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(raw) && !/^https:\/\//i.test(raw)) return { error: '仅支持 HTTPS 根地址' };
  let parsed: URL;
  try { parsed = new URL(/^https:\/\//i.test(raw) ? raw : `https://${raw}`); }
  catch { return { error: '请输入有效域名' }; }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return { error: '仅支持 HTTPS 根地址，不可包含端口、账号、路径、参数或片段' };
  }
  const domain = parsed.hostname.replace(/\.$/, '').toLowerCase();
  if (domain.length > 253) return { error: '域名不能超过 253 个字符' };
  if (/[/?#:@\s]/.test(domain) || /^\d{1,3}(\.\d{1,3}){3}$/.test(domain) || domain.includes('*') || domain.startsWith('[')) return { error: '请输入有效域名，不支持 IP 或通配符' };
  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => !label || label.length > 63 || !/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))) return { error: '请输入有效域名' };
  return { domain };
}
export function domainsEquivalent(left: string, right: string) {
  const normalized = (value: string) => value.toLowerCase().replace(/^www\./, '');
  return normalized(left) === normalized(right);
}
export function foregroundForTheme(hex: string) {
  const value = hex.replace('#', ''); if (!/^[0-9a-f]{6}$/i.test(value)) return '#ffffff';
  const channels = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255)
    .map((channel) => channel <= 0.039_28 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const luminance = (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722;
  const whiteContrast = 1.05 / (luminance + 0.05);
  const darkContrast = (luminance + 0.05) / 0.05;
  return whiteContrast >= darkContrast ? '#ffffff' : '#0c0d0e';
}
