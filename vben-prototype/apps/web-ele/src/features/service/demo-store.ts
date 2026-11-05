import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { ChannelType } from '../channels/channel-data';
import { useChannelStore } from '../channels/channel-store';
import { DEFAULT_TEAM_ID } from '../team/team-constants';
import { useTeamStore } from '../team/team-store';
import { presetTranslations, seedCustomers, seedSessions } from './demo-seed';
import { corpusTranslation } from './translation-corpus';

export type SessionStatus = 'active' | 'ended' | 'pending';
export type MessageRole = 'agent' | 'ai' | 'customer' | 'system';
export type MessageKind = 'attachment' | 'emoji' | 'image' | 'system' | 'text' | 'video';
export type MessageStatus = 'failed' | 'sending' | 'sent';
export type SystemEventType = 'assigned' | 'ended' | 'pending' | 'session-start';

export interface DemoTranslation {
  /** true 表示译文来自客服话术语料，false 表示命中预置词条；UI 据此保留翻译状态。 */
  generated?: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
  translatedAt: string;
}

export interface DemoAttachment {
  /** 媒体类型：图片或视频 */
  kind?: 'image' | 'video';
  /** 视频封面，仅视频消息使用 */
  coverUrl?: string;
  /** 视频时长（秒），仅视频消息使用 */
  durationSec?: number;
  height?: number;
  name: string;
  size?: number;
  /** 消息摘要用的一句话描述，视频消息必填 */
  summary?: string;
  type: string;
  url?: string;
  width?: number;
}

export interface DemoMessage {
  attachment?: DemoAttachment;
  content: string;
  endedAt?: string;
  eventType?: SystemEventType;
  id: string;
  kind?: MessageKind;
  originalLanguage?: string;
  role: MessageRole;
  senderId?: string;
  senderName?: string;
  sentAt: string;
  status?: MessageStatus;
  success: boolean;
  translation?: DemoTranslation;
}

export interface DemoAccessInfo {
  browser: string;
  device: string;
  durationSeconds: number;
  ip: string;
  os: string;
  referrer: string;
}

export interface DemoCustomer {
  accessInfo?: DemoAccessInfo;
  avatar?: string;
  device?: string;
  email: string;
  firstVisitAt?: string;
  id: string;
  lastActive: string;
  lastVisitAt?: string;
  name: string;
  phone: string;
  region?: string;
  remark: string;
  sourceChannelId?: string;
  sourceChannelType?: ChannelType;
  visitCount?: number;
}

export interface DemoSession {
  accessInfo?: DemoAccessInfo;
  assigneeId?: string;
  assigneeKind?: 'ai' | 'human';
  channelId: string;
  channelType?: ChannelType;
  createdAt: string;
  customerId: string;
  endedAt?: string;
  endedReason?: string;
  everAssigned?: boolean;
  firstResponseAt?: string;
  id: string;
  messages: DemoMessage[];
  originChannelId?: string;
  participants: string[];
  queueEnteredAt?: string;
  startedAt?: string;
  startUrl?: string;
  status: SessionStatus;
  teamId: string;
  unread: number;
}

export interface ReceptionSettings {
  // 租户级会话时限
  firstResponseMinutes: number;
  inactiveCloseMinutes: number;
  // 兼容旧视图的租户级占位字段；成员级通知/翻译请使用 memberNotificationFor / memberTranslationFor
  browserNotification: boolean;
  receiveTranslation: boolean;
  sendTranslation: boolean;
  sound: boolean;
  titleBlink: boolean;
  visitorLanguage: string;
  workLanguage: string;
}

export interface MemberNotificationSettings {
  browserNotification: boolean;
  sound: boolean;
  titleBlink: boolean;
}

export interface NotificationTrigger {
  at: string;
  count: number;
  customerName: string;
  messageId: string;
  sessionId: string;
}

export interface MemberTranslationSettings {
  receiveTranslation: boolean;
  sendTranslation: boolean;
  visitorLanguage: string;
  workLanguage: string;
}

export interface PersonalSettings {
  accepting: boolean;
  avatar?: string;
  locale: 'en-US' | 'zh-CN';
  nickname: string;
}

export interface RecallResult {
  code?: 'channel-deleted' | 'member-unavailable' | 'unfinished-session';
  error?: string;
  session?: DemoSession;
}

export interface TakeoverCheck {
  allowed: boolean;
  reason?: string;
  session?: DemoSession;
}

export interface TranslationResult {
  error?: string;
  translation?: DemoTranslation;
}

export interface NotificationState extends MemberNotificationSettings {
  lastTrigger?: NotificationTrigger;
}

// v4 种子数据换成游戏客服场景，升级 key 后旧数据直接丢弃，避免浏览器里残留的通用售后会话遮住新种子。
const KEY = 'im-support-vben:service-demo-v7';
const LEGACY_KEYS = ['im-support-vben:service-demo-v6', 'im-support-vben:service-demo-v5', 'im-support-vben:service-demo-v4', 'im-support-vben:service-demo-v3', 'im-support-vben:service-demo-v2', 'im-support-vben:service-demo-v1'];
const LANGUAGES = ['简体中文', '繁体中文', '英语', '越南语', '泰语', '高棉语', '缅甸语', '老挝语', '西班牙语'];
const nowIso = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(value);
let eventSeed = 0;
const uid = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${(eventSeed += 1)}`}`;

const systemEvent = (type: SystemEventType, sentAt: string, content: string, extra: Partial<DemoMessage> = {}): DemoMessage => ({
  content, eventType: type, id: uid('event'), kind: 'system', role: 'system', sentAt, success: true, ...extra,
});


const normalizeLanguage = (value?: string) => {
  const language = value?.trim() || '';
  if (['en', 'en-US', 'English', '英语'].includes(language)) return '英语';
  if (['zh', 'zh-CN', '简体中文'].includes(language)) return '简体中文';
  return language;
};

interface PersistedState {
  customers: DemoCustomer[];
  memberNotifications: Record<string, MemberNotificationSettings>;
  memberTranslations: Record<string, MemberTranslationSettings>;
  personal: Record<string, PersonalSettings>;
  reception: ReceptionSettings;
  runtimeNotifications: Record<string, NotificationTrigger>;
  sessions: DemoSession[];
}

function loadState(): Partial<PersistedState> {
  try {
    // 迁移策略：旧版本 key 不做兼容解析，直接删除，首次启动写入新种子。
    LEGACY_KEYS.forEach((legacyKey) => localStorage.removeItem(legacyKey));
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    // 回退到内置种子数据。
  }
  return {};
}

export const useDemoServiceStore = defineStore('demo-service', () => {
  const team = useTeamStore();
  const channels = useChannelStore();
  const saved = loadState();
  const customers = ref<DemoCustomer[]>(Array.isArray(saved.customers) && saved.customers.length > 0 ? saved.customers : clone(seedCustomers));
  const sessions = ref<DemoSession[]>(Array.isArray(saved.sessions) && saved.sessions.length > 0 ? saved.sessions : seedSessions());
  const reception = ref<ReceptionSettings>(saved.reception || {
    browserNotification: false, firstResponseMinutes: 2, inactiveCloseMinutes: 10, receiveTranslation: false,
    sendTranslation: false, sound: true, titleBlink: true, visitorLanguage: '英语', workLanguage: '简体中文',
  });
  const personal = ref<Record<string, PersonalSettings>>(saved.personal || {});
  const memberNotifications = ref<Record<string, MemberNotificationSettings>>(saved.memberNotifications || {});
  const memberTranslations = ref<Record<string, MemberTranslationSettings>>(saved.memberTranslations || {});
  const runtimeNotifications = ref<Record<string, NotificationTrigger>>(saved.runtimeNotifications || {});

  watch([customers, sessions, reception, personal, memberNotifications, memberTranslations, runtimeNotifications], () => {
    localStorage.setItem(KEY, JSON.stringify({
      customers: customers.value, sessions: sessions.value, reception: reception.value, personal: personal.value,
      memberNotifications: memberNotifications.value, memberTranslations: memberTranslations.value, runtimeNotifications: runtimeNotifications.value,
    }));
  }, { deep: true });

  const customerById = (id?: string) => customers.value.find((item) => item.id === id);
  const sessionById = (id?: string) => sessions.value.find((item) => item.id === id);
  const channelById = (id?: string) => channels.channels.find((item) => item.id === id);
  const sessionChannel = (session: DemoSession) => channelById(session.channelId)
    || channels.deletedChannelSnapshots.find((item) => item.id === session.channelId);
  const sessionChannelType = (session?: DemoSession) => session
    ? session.channelType || channelById(session.channelId)?.type
      || channels.deletedChannelSnapshots.find((item) => item.id === session.channelId)?.type
    : undefined;
  const isSystemEvent = (message: DemoMessage) => message.role === 'system' || message.kind === 'system';
  const lastMessage = (session: DemoSession) => [...session.messages].reverse().find((message) => message.success && !isSystemEvent(message));
  const customerSessions = (customerId: string) => sessions.value
    .filter((session) => session.customerId === customerId)
    .sort((left, right) => +new Date(right.endedAt || right.createdAt) - +new Date(left.endedAt || left.createdAt));
  const recentSessions = (customerId: string, excludeId?: string, limit = 3) => customerSessions(customerId)
    .filter((session) => session.id !== excludeId)
    .sort((left, right) => +new Date(lastMessage(right)?.sentAt || right.createdAt) - +new Date(lastMessage(left)?.sentAt || left.createdAt))
    .slice(0, limit);

  const defaultNotification = (): MemberNotificationSettings => ({ browserNotification: false, sound: true, titleBlink: true });
  const defaultTranslation = (): MemberTranslationSettings => ({ receiveTranslation: false, sendTranslation: false, visitorLanguage: '英语', workLanguage: '简体中文' });
  const memberNotificationFor = (memberId: string): MemberNotificationSettings => ({ ...defaultNotification(), ...memberNotifications.value[memberId] });
  const memberTranslationFor = (memberId: string): MemberTranslationSettings => ({ ...defaultTranslation(), ...memberTranslations.value[memberId] });
  const settingsFor = (memberId: string): PersonalSettings => personal.value[memberId] || {
    accepting: Boolean(team.memberById(memberId)?.online), locale: 'zh-CN', nickname: team.memberById(memberId)?.name || '',
  };

  const visitSummary = (customerId: string) => {
    const customer = customerById(customerId);
    if (!customer) return undefined;
    const sourceChannel = channelById(customer.sourceChannelId);
    const source = sourceChannel || channels.deletedChannelSnapshots.find((item) => item.id === customer.sourceChannelId);
    return {
      accessInfo: customer.accessInfo, device: customer.device || customer.accessInfo?.device, firstVisitAt: customer.firstVisitAt || customer.lastActive,
      lastActive: customer.lastActive, lastVisitAt: customer.lastVisitAt || customer.lastActive, region: customer.region,
      sourceChannelId: customer.sourceChannelId, sourceChannelName: source?.name, sourceChannelType: customer.sourceChannelType || source?.type,
      visitCount: customer.visitCount || 1,
    };
  };

  const sessionInfo = (sessionId: string) => {
    const session = sessionById(sessionId);
    if (!session) return undefined;
    const channel = channelById(session.channelId);
    const snapshot = channels.deletedChannelSnapshots.find((item) => item.id === session.channelId);
    return {
      accessInfo: session.accessInfo, assigneeId: session.assigneeId, assigneeName: team.memberById(session.assigneeId)?.name,
      channelEnabled: channel?.enabled ?? false, channelId: session.channelId, channelName: channel?.name || snapshot?.name,
      channelType: sessionChannelType(session), endedAt: session.endedAt, endedReason: session.endedReason, originChannelId: session.originChannelId,
      queueEnteredAt: session.queueEnteredAt, startedAt: session.startedAt || session.createdAt, startUrl: session.startUrl, status: session.status,
    };
  };

  function pushEvent(session: DemoSession, type: SystemEventType, content: string, sentAt = nowIso(), extra: Partial<DemoMessage> = {}) {
    const message = systemEvent(type, sentAt, content, extra);
    session.messages.push(message);
    return message;
  }

  function setPending(id: string) {
    const session = sessionById(id);
    if (!session) return '会话不存在。';
    if (session.status === 'ended') return '会话已结束，不能进入待分配。';
    const alreadyPending = session.status === 'pending' && !session.assigneeId;
    session.assigneeId = undefined;
    session.assigneeKind = undefined;
    session.status = 'pending';
    if (!alreadyPending) {
      session.queueEnteredAt = nowIso();
      pushEvent(session, 'pending', '进入待分配');
    }
    return undefined;
  }
  function assignSession(session: DemoSession, memberId: string): string | undefined {
    if (session.status === 'ended') return '会话已结束，不能分配。';
    const member = team.memberById(memberId);
    if (!member) return '成员不存在。';
    if (!member.enabled) return '该成员已停用，不可接待此会话。';
    if (!member.online) return '该成员当前离线，不可接待此会话。';
    if (member.kind === 'human' && !member.teamIds.includes(session.teamId)) return '该成员当前不可接待此会话。';
    if (session.assigneeId === memberId) return '该会话已由该成员接待。';
    const wasAssigned = session.everAssigned === true;
    session.assigneeId = memberId;
    session.assigneeKind = member.kind;
    session.status = 'active';
    session.queueEnteredAt = undefined;
    session.participants = [...new Set([...session.participants, memberId])];
    session.everAssigned = true;
    if (wasAssigned) pushEvent(session, 'assigned', `已分配给 ${member.name}`, nowIso(), { senderId: member.id, senderName: member.name });
    return undefined;
  }

  function assign(id: string, memberId: string) {
    const session = sessionById(id);
    if (!session) return '会话不存在。';
    return assignSession(session, memberId);
  }

  function autoAssign(session: DemoSession) {
    const ai = team.aiMembers.find((member) => member.enabled !== false && member.online && member.teamIds.includes(session.teamId));
    if (ai) return assignSession(session, ai.id);
    const humans = team.humans
      .filter((member) => member.enabled && member.online && member.teamIds.includes(session.teamId))
      .sort((left, right) => sessions.value.filter((item) => item.status === 'active' && item.assigneeId === left.id).length
        - sessions.value.filter((item) => item.status === 'active' && item.assigneeId === right.id).length);
    const candidate = humans[0];
    return candidate ? assignSession(session, candidate.id) : '当前没有可接待的成员。';
  }

  function takeoverCheck(id: string, memberId: string): TakeoverCheck {
    const session = sessionById(id);
    if (!session) return { allowed: false, reason: '会话不存在。' };
    if (session.status === 'ended') return { allowed: false, reason: '已结束会话不可接管。' };
    const member = team.memberById(memberId);
    if (!member || member.kind !== 'human') return { allowed: false, reason: '仅人类成员可接管会话。' };
    if (!member.enabled) return { allowed: false, reason: '该成员已停用，不能接管会话。' };
    if (!member.online) return { allowed: false, reason: '该成员当前离线，不能接管会话。' };
    if (session.assigneeId === memberId) return { allowed: false, reason: '你正在接待该会话，无需接管。' };
    if (!channelById(session.channelId)) {
      const snapshot = channels.deletedChannelSnapshots.find((item) => item.id === session.channelId);
      if (snapshot) return { allowed: false, reason: `渠道「${snapshot.name}」已删除，不能接管该会话。` };
    }
    return { allowed: true, session };
  }

  function takeover(id: string, memberId: string) {
    const check = takeoverCheck(id, memberId);
    if (!check.allowed || !check.session) return check.reason;
    const member = team.memberById(memberId)!;
    const session = check.session;
    const wasAssigned = session.everAssigned === true;
    session.assigneeId = memberId;
    session.assigneeKind = 'human';
    session.status = 'active';
    session.queueEnteredAt = undefined;
    session.participants = [...new Set([...session.participants, memberId])];
    session.everAssigned = true;
    // 首次接管等同首次分配，不写“已分配给”事件；从其他成员手里接管时才记录一条。
    if (wasAssigned) pushEvent(session, 'assigned', `已分配给 ${member.name}`, nowIso(), { senderId: member.id, senderName: member.name });
    return undefined;
  }

  function end(id: string, reason = '人工结束') {
    const session = sessionById(id);
    if (!session) return '会话不存在。';
    if (session.status === 'ended') return '会话已结束。';
    const endedAt = nowIso();
    session.status = 'ended';
    session.endedAt = endedAt;
    session.endedReason = reason;
    session.queueEnteredAt = undefined;
    pushEvent(session, 'ended', '会话结束', endedAt, { endedAt });
    return undefined;
  }

  function translateText(content: string, targetLanguage: string) {
    const language = normalizeLanguage(targetLanguage);
    if (!LANGUAGES.includes(language)) return { error: '该语言暂不可用。' };
    if (!content.trim()) return { error: '请输入要翻译的内容。' };
    const preset = presetTranslations[content]?.[language];
    if (preset) return { generated: false, language, text: preset };
    // 词条未命中时不再拼 `[English] 原文`，改从游戏客服语料池取一条同语气的句子。
    return { generated: true, language, text: corpusTranslation(content, language) };
  }

  function translateMessage(messageId: string, targetLanguage: string): TranslationResult {
    const message = sessions.value.flatMap((session) => session.messages).find((item) => item.id === messageId);
    if (!message) return { error: '消息不存在。' };
    if (isSystemEvent(message) || (message.kind && message.kind !== 'text')) return { error: '仅支持文本业务消息翻译。' };
    const result = translateText(message.content, targetLanguage);
    if (result.error || !result.text) return { error: result.error };
    const translation: DemoTranslation = {
      generated: result.generated,
      sourceLanguage: message.originalLanguage || (message.role === 'customer' ? '英语' : '简体中文'),
      targetLanguage: result.language!, text: result.text, translatedAt: nowIso(),
    };
    message.translation = translation;
    return { translation };
  }

  function previewTranslation(content: string, targetLanguage: string, sourceLanguage = '简体中文'): TranslationResult {
    const result = translateText(content, targetLanguage);
    if (result.error || !result.text) return { error: result.error };
    return {
      translation: { generated: result.generated, sourceLanguage: normalizeLanguage(sourceLanguage), targetLanguage: result.language!, text: result.text, translatedAt: nowIso() },
    };
  }

  const messageText = (message: DemoMessage, mode: 'source' | 'translation' = 'source') => mode === 'translation'
    ? message.translation?.text || message.content
    : message.content;

  function setMemberTranslation(memberId: string, patch: Partial<MemberTranslationSettings>) {
    const invalidLanguage = (['visitorLanguage', 'workLanguage'] as const)
      .some((key) => patch[key] !== undefined && !LANGUAGES.includes(normalizeLanguage(patch[key])));
    if (invalidLanguage) return '该语言暂不可用。';
    memberTranslations.value[memberId] = { ...memberTranslationFor(memberId), ...patch };
    return undefined;
  }

  function setMemberNotification(memberId: string, patch: Partial<MemberNotificationSettings>) {
    memberNotifications.value[memberId] = { ...memberNotificationFor(memberId), ...patch };
  }

  const notificationState = (memberId: string): NotificationState => ({
    ...memberNotificationFor(memberId), lastTrigger: runtimeNotifications.value[memberId],
  });

  function triggerNotification(sessionId: string) {
    const session = sessionById(sessionId);
    if (!session || session.status === 'ended' || session.assigneeKind !== 'human' || !session.assigneeId) return undefined;
    const previous = runtimeNotifications.value[session.assigneeId];
    const customer = customerById(session.customerId);
    const message = [...session.messages].reverse().find((item) => item.role === 'customer' && item.success);
    const trigger: NotificationTrigger = {
      at: nowIso(), count: previous?.sessionId === sessionId ? previous.count + 1 : 1,
      customerName: customer?.name || '', messageId: message?.id || '', sessionId,
    };
    runtimeNotifications.value[session.assigneeId] = trigger;
    return trigger;
  }

  function consumeNotification(memberId: string) {
    delete runtimeNotifications.value[memberId];
  }

  function markRead(sessionId: string, memberId: string) {
    const session = sessionById(sessionId);
    if (!session || session.assigneeId !== memberId || session.assigneeKind !== 'human') return false;
    session.unread = 0;
    consumeNotification(memberId);
    return true;
  }

  function send(id: string, memberId: string, content: string, options: { attachment?: DemoAttachment; kind?: MessageKind } = {}) {
    const session = sessionById(id);
    if (!session) return '会话不存在。';
    if (session.status === 'ended') return '会话已结束，无法发送消息。';
    if (session.status !== 'active' || session.assigneeId !== memberId || session.assigneeKind !== 'human') return '仅当前接待人可以回复。';
    const channel = channelById(session.channelId);
    if (!channel) return '渠道已删除，当前无法发送消息。';
    if (!channel.enabled) return '渠道已停用，当前无法发送消息。';
    const text = content.trim();
    if (!text && !options.attachment) return '请输入消息。';
    const member = team.memberById(memberId);
    const settings = memberTranslationFor(memberId);
    session.messages.push({
      attachment: options.attachment, content: text, id: uid('msg'), kind: options.kind || (options.attachment ? (options.attachment.kind === 'video' ? 'video' : 'image') : 'text'),
      originalLanguage: settings.workLanguage, role: 'agent', senderId: memberId, senderName: member?.name, sentAt: nowIso(), status: 'sent', success: true,
    });
    if (!session.firstResponseAt) session.firstResponseAt = nowIso();
    session.unread = 0;
    consumeNotification(memberId);
    return undefined;
  }

  function recall(customerId: string, channelId: string, memberId: string): RecallResult {
    const unfinished = sessions.value.find((session) => session.customerId === customerId && session.status !== 'ended');
    if (unfinished) return { code: 'unfinished-session', error: '该客户已有未结束会话。', session: unfinished };
    const customer = customerById(customerId);
    if (!customer) return { error: '客户不存在。' };
    const channel = channelById(channelId);
    if (!channel) {
      const snapshot = channels.deletedChannelSnapshots.find((item) => item.id === channelId);
      return { code: 'channel-deleted', error: snapshot ? `客户原咨询渠道「${snapshot.name}」已删除，无法发起回聊。` : '客户原咨询渠道不存在或已删除，无法发起回聊。' };
    }
    const member = team.memberById(memberId);
    if (!member || member.kind !== 'human' || !member.enabled) return { code: 'member-unavailable', error: '当前成员不可发起回聊。' };
    const teamId = channel.teamId || channels.resolveTeam(channel.teamId)?.id || DEFAULT_TEAM_ID;
    const canAssign = member.online;
    const createdAt = nowIso();
    const session: DemoSession = {
      accessInfo: customer.accessInfo, assigneeId: canAssign ? member.id : undefined, assigneeKind: canAssign ? 'human' : undefined,
      channelId: channel.id, channelType: channel.type, createdAt, everAssigned: canAssign, id: uid('session'),
      customerId, messages: [systemEvent('session-start', createdAt, '会话开始')], originChannelId: channel.id,
      participants: canAssign ? [member.id] : [], queueEnteredAt: canAssign ? undefined : createdAt,
      startUrl: channel.type === 'chat-page' ? channel.chatPageUrl : undefined, status: canAssign ? 'active' : 'pending', teamId, unread: 0,
    };
    if (!canAssign) session.messages.push(systemEvent('pending', createdAt, '进入待分配'));
    sessions.value.unshift(session);
    return { session };
  }

  function ingestCustomerMessage(payload: {
    accessInfo?: DemoAccessInfo; channelId: string; content: string; identityId: string; language?: string;
    sessionId: string; startUrl?: string; teamId: string;
  }) {
    const sentAt = nowIso();
    const customerId = `customer-${payload.identityId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    const channel = channelById(payload.channelId);
    const snapshot = channels.deletedChannelSnapshots.find((item) => item.id === payload.channelId);
    const channelType = channel?.type || snapshot?.type;
    let customer = customerById(customerId);
    if (!customer) {
      const trustedName = payload.identityId.startsWith('account:') ? payload.identityId.slice(8) : '';
      customer = {
        accessInfo: payload.accessInfo, device: payload.accessInfo?.device, email: '', firstVisitAt: sentAt, id: customerId,
        lastActive: sentAt, lastVisitAt: sentAt, name: trustedName || `访客 ${payload.identityId.slice(-4)}`, phone: '', remark: '',
        sourceChannelId: payload.channelId, sourceChannelType: channelType, visitCount: 1,
      };
      customers.value.unshift(customer);
    } else {
      customer.lastActive = sentAt;
      customer.lastVisitAt = sentAt;
      customer.sourceChannelId = customer.sourceChannelId || payload.channelId;
      customer.sourceChannelType = customer.sourceChannelType || channelType;
      customer.accessInfo = payload.accessInfo || customer.accessInfo;
      customer.device = payload.accessInfo?.device || customer.device;
    }
    let session = sessions.value.find((item) => item.id === payload.sessionId && item.status !== 'ended');
    if (!session) {
      const created: DemoSession = {
        accessInfo: payload.accessInfo, channelId: payload.channelId, channelType, createdAt: sentAt, customerId,
        everAssigned: false, id: payload.sessionId, messages: [systemEvent('session-start', sentAt, '会话开始')],
        originChannelId: payload.channelId, participants: [], startUrl: payload.startUrl, status: 'pending', teamId: payload.teamId,
        unread: 0,
      };
      customer.visitCount = (customer.visitCount || 0) + 1;
      sessions.value.unshift(created);
      const assigned = autoAssign(created);
      if (assigned) created.status = 'pending';
      // 访客渠道演示种子：补齐访客端允许展示的「进入待分配」「已分配给 X」两个系统事件
      if (!assigned && (channelType === 'web-widget' || channelType === 'chat-page')) {
        setPending(created.id);
        autoAssign(created);
      }
      session = created;
    } else if (session.status === 'pending' && !session.assigneeId) {
      autoAssign(session);
    }
    const target = session;
    if (target.status === 'pending' && !target.assigneeId && !target.queueEnteredAt) {
      target.queueEnteredAt = sentAt;
      pushEvent(target, 'pending', '进入待分配');
    }
    target.messages.push({
      content: payload.content, id: uid('msg'), kind: 'text', originalLanguage: payload.language || '简体中文',
      role: 'customer', sentAt, status: 'sent', success: true,
    });
    if (target.assigneeKind === 'human') target.unread += 1;
    triggerNotification(target.id);
    return target;
  }

  function updateCustomer(id: string, patch: Partial<Pick<DemoCustomer, 'email' | 'phone' | 'remark'>>) {
    const item = customerById(id);
    if (!item) return '客户不存在。';
    Object.assign(item, patch);
    return undefined;
  }

  function savePersonal(memberId: string, patch: Partial<PersonalSettings>) {
    personal.value[memberId] = { ...settingsFor(memberId), ...patch };
    const member = team.memberById(memberId);
    if (member) {
      if (patch.nickname) member.name = patch.nickname;
      if (patch.avatar !== undefined) member.avatar = patch.avatar;
      if (patch.accepting !== undefined) member.online = patch.accepting && Boolean(member.enabled);
      member.version += 1;
    }
  }

  return {
    assign, autoAssign, consumeNotification, customerById, customerSessions, customers, end, ingestCustomerMessage, isSystemEvent,
    lastMessage, markRead, memberNotificationFor, memberNotifications, memberTranslationFor, memberTranslations, messageText,
    notificationState, personal, previewTranslation, reception, recall, recentSessions, send, sessionById, sessionChannel,
    sessionChannelType, sessionInfo, sessions, setMemberNotification, setMemberTranslation, setPending, settingsFor, takeover, takeoverCheck,
    translateMessage, triggerNotification, updateCustomer, savePersonal, visitSummary,
  };
});


