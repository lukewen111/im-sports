export type ChannelType = 'web-widget' | 'telegram' | 'chat-page';
export type AgentStatus = 'draft' | 'published';

export interface ChannelAgent {
  id: string;
  name: string;
  avatar?: string;
  status: AgentStatus;
  acceptingChats: boolean;
}

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  agentId?: string;
  enabled: boolean;
  botToken?: string;
  language?: string;
  websiteDomain?: string;
  allowedDomains?: string[];
  installCode?: string;
  installStatus?: 'unchecked' | 'success' | 'failed';
  installCheckedAt?: string;
  brandName?: string;
  brandSignature?: string;
  brandAvatar?: string;
  themeColor?: string;
  widgetIcon?: 'message' | 'message-dark' | 'message-line' | 'custom';
  widgetCustomIcon?: string;
  widgetPosition?: 'bottom-left' | 'bottom-right';
  widgetOffsetX?: number;
  widgetOffsetY?: number;
  widgetDesktopVisible?: boolean;
  widgetMobileVisible?: boolean;
  widgetMobilePosition?: 'bottom-left' | 'bottom-right';
  widgetMobileOffsetX?: number;
  widgetMobileOffsetY?: number;
  soundEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMessage {
  id: string;
  role: 'customer' | 'agent' | 'system';
  content: string;
  type?: 'text' | 'image' | 'video' | 'audio' | 'file';
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  sentAt: string;
}

export interface ChannelConversation {
  id: string;
  visitorId: string;
  channelId: string;
  agentId: string;
  state: 'processing' | 'closed';
  updatedAt: string;
  messages: ChannelMessage[];
}

export interface ChannelState {
  channels: Channel[];
  agents: ChannelAgent[];
  conversations: ChannelConversation[];
}

