import type { ChannelState } from './types';

const now = new Date().toISOString();

export const seedState: ChannelState = {
  agents: [
    { id: 'agent-support', name: '客服接待', status: 'published', acceptingChats: true },
    { id: 'agent-sales', name: '售前咨询', status: 'published', acceptingChats: true },
    { id: 'agent-vip', name: '会员服务', status: 'published', acceptingChats: false },
    { id: 'agent-draft', name: '退款处理', status: 'draft', acceptingChats: false },
  ],
  channels: [
    {
      id: 'channel-web-widget-main', type: 'web-widget', name: '官网网站小部件', agentId: 'agent-support', enabled: true,
      language: 'auto', websiteDomain: 'support.example.com', allowedDomains: [], installStatus: 'success',
      installCode: '<script src="https://cdn.example.com/widget.js" data-channel="channel-web-widget-main" async></script>',
      brandName: 'IM Support', brandSignature: '有问题？我们随时为您提供帮助。', themeColor: '#1c1f26',
      widgetIcon: 'message', widgetPosition: 'bottom-right', widgetOffsetX: 24, widgetOffsetY: 24,
      widgetDesktopVisible: true, widgetMobileVisible: true, widgetMobilePosition: 'bottom-right',
      widgetMobileOffsetX: 16, widgetMobileOffsetY: 16, soundEnabled: true, createdAt: now, updatedAt: now,
    },
    {
      id: 'channel-telegram-main', type: 'telegram', name: 'Telegram 客服', agentId: 'agent-sales', enabled: true,
      botToken: '123456789:demo_telegram_bot_token', createdAt: now, updatedAt: now,
    },
    {
      id: 'channel-chat-page-support', type: 'chat-page', name: '客户服务聊天页面', agentId: 'agent-support', enabled: true,
      language: 'auto', brandName: 'IM Support', brandSignature: '在线客户服务', themeColor: '#1c1f26',
      soundEnabled: true, createdAt: now, updatedAt: now,
    },
  ],
  conversations: [],
};

