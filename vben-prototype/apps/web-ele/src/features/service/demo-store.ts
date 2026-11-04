import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useChannelStore } from '../channels/channel-store';
import { useTeamStore } from '../team/team-store';

export type SessionStatus = 'active' | 'ended' | 'pending';
export interface DemoCustomer { id: string; name: string; email: string; phone: string; remark: string; lastActive: string }
export interface DemoMessage { id: string; role: 'agent' | 'customer' | 'system'; content: string; sentAt: string; success: boolean }
export interface DemoSession { id: string; customerId: string; channelId: string; teamId: string; assigneeId?: string; status: SessionStatus; createdAt: string; endedAt?: string; unread: number; messages: DemoMessage[]; participants: string[] }
export interface ReceptionSettings { firstResponseMinutes: number; inactiveCloseMinutes: number; titleBlink: boolean; browserNotification: boolean; sound: boolean; receiveTranslation: boolean; sendTranslation: boolean; workLanguage: string; visitorLanguage: string }
export interface PersonalSettings { nickname: string; avatar?: string; accepting: boolean; locale: 'zh-CN' | 'en-US' }
const KEY = 'im-support-vben:service-demo-v1';
const now = Date.now();
const seeds = {
  customers: [
    { id: 'customer-10001', name: '王女士', email: 'wang@example.com', phone: '138****1234', remark: '关注订单物流', lastActive: new Date(now - 6e5).toISOString() },
    { id: 'customer-10002', name: '访客 8246', email: '', phone: '', remark: '', lastActive: new Date(now - 36e5).toISOString() },
    { id: 'customer-10003', name: 'Telegram 用户', email: '', phone: '', remark: '充值渠道客户', lastActive: new Date(now - 864e5).toISOString() },
  ] as DemoCustomer[],
  sessions: [] as DemoSession[],
};
function seedSessions(): DemoSession[] {
  return [
    { id: 'session-20261104001', customerId: 'customer-10001', channelId: 'channel-web-widget-main', teamId: '100001', assigneeId: 'member-owner', status: 'active', createdAt: new Date(now - 18e5).toISOString(), unread: 1, participants: ['member-owner'], messages: [
      { id: 'm1', role: 'customer', content: '您好，我想查询订单物流。', sentAt: new Date(now - 18e5).toISOString(), success: true },
      { id: 'm2', role: 'agent', content: '您好，请提供订单号。', sentAt: new Date(now - 12e5).toISOString(), success: true },
      { id: 'm3', role: 'customer', content: '订单号是 CS20261104。', sentAt: new Date(now - 6e5).toISOString(), success: true },
    ] },
    { id: 'session-20261104002', customerId: 'customer-10002', channelId: 'channel-chat-page-support', teamId: '100001', status: 'pending', createdAt: new Date(now - 4e5).toISOString(), unread: 0, participants: [], messages: [{ id: 'm4', role: 'customer', content: '现在有人在线吗？', sentAt: new Date(now - 4e5).toISOString(), success: true }] },
    { id: 'session-20261103001', customerId: 'customer-10003', channelId: 'channel-telegram-payment', teamId: '100002', assigneeId: 'member-sophie', status: 'ended', createdAt: new Date(now - 9e7).toISOString(), endedAt: new Date(now - 8.8e7).toISOString(), unread: 0, participants: ['member-sophie'], messages: [{ id: 'm5', role: 'customer', content: '充值多久到账？', sentAt: new Date(now - 9e7).toISOString(), success: true }, { id: 'm6', role: 'agent', content: '通常会在 5 分钟内到账。', sentAt: new Date(now - 8.9e7).toISOString(), success: true }] },
  ];
}
export const useDemoServiceStore = defineStore('demo-service', () => {
  const team = useTeamStore(); const channels = useChannelStore();
  let saved: any = {}; try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { saved = {}; }
  const customers = ref<DemoCustomer[]>(saved.customers || seeds.customers);
  const sessions = ref<DemoSession[]>(saved.sessions || seedSessions());
  const reception = ref<ReceptionSettings>(saved.reception || { firstResponseMinutes: 2, inactiveCloseMinutes: 10, titleBlink: true, browserNotification: false, sound: true, receiveTranslation: false, sendTranslation: false, workLanguage: '简体中文', visitorLanguage: '英语' });
  const personal = ref<Record<string, PersonalSettings>>(saved.personal || {});
  watch([customers, sessions, reception, personal], () => localStorage.setItem(KEY, JSON.stringify({ customers: customers.value, sessions: sessions.value, reception: reception.value, personal: personal.value })), { deep: true });
  const customerById = (id?: string) => customers.value.find((item) => item.id === id);
  const sessionById = (id?: string) => sessions.value.find((item) => item.id === id);
  const sessionChannel = (session: DemoSession) => channels.channels.find((item) => item.id === session.channelId) || channels.deletedChannelSnapshots.find((item) => item.id === session.channelId);
  const lastMessage = (session: DemoSession) => [...session.messages].reverse().find((m) => m.success && m.role !== 'system');
  const settingsFor = (memberId: string) => personal.value[memberId] || { nickname: team.memberById(memberId)?.name || '', accepting: Boolean(team.memberById(memberId)?.online), locale: 'zh-CN' };
  function updateCustomer(id: string, patch: Partial<Pick<DemoCustomer, 'email' | 'phone' | 'remark'>>) { const item = customerById(id); if (!item) return '客户不存在。'; Object.assign(item, patch); }
  function assign(id: string, memberId: string) { const session = sessionById(id); const member = team.memberById(memberId); if (!session || !member?.online || !member.teamIds.includes(session.teamId)) return '该成员当前不可接待此会话。'; session.assigneeId = memberId; session.status = 'active'; session.participants = [...new Set([...session.participants, memberId])]; session.messages.push({ id: crypto.randomUUID(), role: 'system', content: `已分配给 ${member.name}`, sentAt: new Date().toISOString(), success: true }); }
  function takeover(id: string, memberId: string) { const session = sessionById(id); const member = team.memberById(memberId); if (!session || !member?.online) return '当前账号不可接管。'; session.assigneeId = memberId; session.status = 'active'; session.participants = [...new Set([...session.participants, memberId])]; }
  function send(id: string, memberId: string, content: string) { const session = sessionById(id); if (!session || session.status !== 'active' || session.assigneeId !== memberId) return '仅当前接待人可以回复。'; const channel = channels.channels.find((item) => item.id === session.channelId); if (!channel?.enabled) return '渠道已停用，当前无法发送消息。'; if (!content.trim()) return '请输入消息。'; session.messages.push({ id: crypto.randomUUID(), role: 'agent', content: content.trim(), sentAt: new Date().toISOString(), success: true }); session.unread = 0; }
  function end(id: string) { const session = sessionById(id); if (!session || session.status === 'ended') return '会话已结束。'; session.status = 'ended'; session.endedAt = new Date().toISOString(); session.messages.push({ id: crypto.randomUUID(), role: 'system', content: '会话已结束', sentAt: session.endedAt, success: true }); }
  function recall(customerId: string, channelId: string, memberId: string) { const unfinished = sessions.value.find((s) => s.customerId === customerId && s.status !== 'ended'); if (unfinished) return { error: '该客户已有未结束会话。', session: unfinished }; const channel = channels.channels.find((item) => item.id === channelId); if (!channel) return { error: '渠道不存在。' }; const session: DemoSession = { id: `session-${Date.now()}`, customerId, channelId, teamId: channel.teamId || '100001', assigneeId: memberId, status: 'active', createdAt: new Date().toISOString(), unread: 0, participants: [memberId], messages: [] }; sessions.value.unshift(session); return { session }; }
  function ingestCustomerMessage(payload: { channelId: string; content: string; identityId: string; sessionId: string; teamId: string }) {
    const sentAt = new Date().toISOString();
    const customerId = `customer-${payload.identityId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
    let customer = customerById(customerId);
    if (!customer) {
      const trustedName = payload.identityId.startsWith('account:') ? payload.identityId.slice(8) : '';
      customer = { id: customerId, name: trustedName || `访客 ${payload.identityId.slice(-4)}`, email: '', phone: '', remark: '', lastActive: sentAt };
      customers.value.unshift(customer);
    }
    customer.lastActive = sentAt;
    let session = sessions.value.find((item) => item.id === payload.sessionId && item.status !== 'ended');
    if (!session) {
      const candidates = team.humans
        .filter((member) => member.enabled && member.online && member.teamIds.includes(payload.teamId))
        .sort((a, b) => sessions.value.filter((item) => item.status === 'active' && item.assigneeId === a.id).length - sessions.value.filter((item) => item.status === 'active' && item.assigneeId === b.id).length);
      const assignee = candidates[0];
      session = { id: payload.sessionId, customerId, channelId: payload.channelId, teamId: payload.teamId, assigneeId: assignee?.id, status: assignee ? 'active' : 'pending', createdAt: sentAt, unread: 0, participants: assignee ? [assignee.id] : [], messages: [] };
      sessions.value.unshift(session);
    }
    session.messages.push({ id: crypto.randomUUID(), role: 'customer', content: payload.content, sentAt, success: true });
    session.unread += 1;
    return session;
  }
  function savePersonal(memberId: string, patch: Partial<PersonalSettings>) { personal.value[memberId] = { ...settingsFor(memberId), ...patch }; const member = team.memberById(memberId); if (member) { if (patch.nickname) member.name = patch.nickname; if (patch.avatar !== undefined) member.avatar = patch.avatar; if (patch.accepting !== undefined) member.online = patch.accepting && Boolean(member.enabled); member.version += 1; } }
  return { customers, sessions, reception, personal, customerById, sessionById, sessionChannel, lastMessage, settingsFor, updateCustomer, assign, takeover, send, end, recall, ingestCustomerMessage, savePersonal };
});
