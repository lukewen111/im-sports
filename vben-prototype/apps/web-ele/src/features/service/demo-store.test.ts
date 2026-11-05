import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

import { useChannelStore } from '../channels/channel-store';
import { useTeamStore } from '../team/team-store';
import { useDemoServiceStore } from './demo-store';

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
});

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
});

describe('聊天、客户与渠道联动', () => {
  it('客户消息按渠道团队生成唯一未结束会话并累计未读', () => {
    const store = useDemoServiceStore();
    const payload = { channelId: 'channel-web-widget-main', identityId: 'visitor:test-001', sessionId: 'conversation-test', teamId: '100001' };
    const first = store.ingestCustomerMessage({ ...payload, content: '第一条' });
    const second = store.ingestCustomerMessage({ ...payload, content: '第二条' });
    expect(first.id).toBe(second.id);
    expect(first.messages.filter((message) => message.role !== 'system').map((message) => message.content)).toEqual(['第一条', '第二条']);
    expect(first.unread).toBe(2);
    expect(store.customers.some((customer) => customer.id === 'customer-visitor-test-001')).toBe(true);
  });

  it('停用渠道后当前接待人不能继续发送消息', () => {
    const store = useDemoServiceStore();
    const channels = useChannelStore();
    const session = store.sessionById('session-20261104001')!;
    const channel = channels.channels.find((item) => item.id === session.channelId)!;
    channel.enabled = false;
    expect(store.send(session.id, session.assigneeId!, '测试')).toContain('渠道已停用');
  });

  it('回聊不会为已有未结束会话重复建会话', () => {
    const store = useDemoServiceStore();
    const result = store.recall('customer-10001', 'channel-web-widget-main', 'member-owner');
    expect(result.error).toContain('已有未结束会话');
    expect(result.session?.id).toBe('session-20261104001');
  });

  it('转接只允许团队内在线成员', () => {
    const store = useDemoServiceStore();
    const team = useTeamStore();
    const session = store.sessionById('session-20261104001')!;
    team.memberById('member-mika')!.online = false;
    expect(store.assign(session.id, 'member-mika')).toContain('不可接待');
  });
});

describe('会话系统事件与分配', () => {
  it('首次分配不写分配事件，后续改派才写', () => {
    const store = useDemoServiceStore();
    const session = store.sessionById('session-20261104002')!;
    const assignedEvents = () => session.messages.filter((message) => message.eventType === 'assigned');
    expect(assignedEvents()).toHaveLength(0);
    expect(store.assign(session.id, 'member-owner')).toBeUndefined();
    expect(session.assigneeId).toBe('member-owner');
    expect(session.status).toBe('active');
    expect(assignedEvents()).toHaveLength(0);
    expect(store.assign(session.id, 'member-sophie')).toBeUndefined();
    expect(assignedEvents()).toHaveLength(1);
    expect(assignedEvents()[0]?.content).toContain('苏菲');
    expect(store.assign(session.id, 'member-sophie')).toContain('已由该成员接待');
    expect(assignedEvents()).toHaveLength(1);
  });

  it('进入待分配只写一次事件，结束事件带时间戳', () => {
    const store = useDemoServiceStore();
    const session = store.sessionById('session-20261104001')!;
    store.setPending(session.id);
    expect(session.status).toBe('pending');
    expect(session.messages.filter((message) => message.eventType === 'pending')).toHaveLength(1);
    store.setPending(session.id);
    expect(session.messages.filter((message) => message.eventType === 'pending')).toHaveLength(1);
    store.assign(session.id, 'member-owner');
    expect(store.end(session.id)).toBeUndefined();
    const ended = session.messages.filter((message) => message.eventType === 'ended');
    expect(ended).toHaveLength(1);
    expect(ended[0]?.endedAt).toBe(session.endedAt);
    expect(store.end(session.id)).toContain('已结束');
  });
});

describe('接管规则', () => {
  it('结束会话、本人会话、离线成员与 AI 成员不可接管', () => {
    const store = useDemoServiceStore();
    expect(store.takeoverCheck('session-20261103001', 'member-owner').reason).toContain('已结束');
    expect(store.takeoverCheck('session-20261104001', 'member-owner').reason).toContain('无需接管');
    expect(store.takeoverCheck('session-20261104002', 'member-mika').reason).toContain('离线');
    expect(store.takeoverCheck('session-20261104002', 'member-ai-sales').reason).toContain('人类成员');
  });

  it('待分配会话可被接管，已有接待流程的接管写入分配事件', () => {
    const store = useDemoServiceStore();
    const session = store.sessionById('session-20261104002')!;
    expect(store.takeover(session.id, 'member-sophie')).toBeUndefined();
    expect(session.assigneeId).toBe('member-sophie');
    expect(session.messages.filter((message) => message.eventType === 'assigned')).toHaveLength(0);
    expect(store.takeover(session.id, 'member-owner')).toBeUndefined();
    expect(session.messages.filter((message) => message.eventType === 'assigned')).toHaveLength(1);
  });

  it('渠道删除后不可接管', () => {
    const store = useDemoServiceStore();
    const channels = useChannelStore();
    channels.remove('channel-telegram-payment');
    expect(store.takeoverCheck('session-20261104004', 'member-sophie').reason).toContain('已删除');
  });
});

describe('回聊原渠道', () => {
  it('按客户原渠道创建会话', () => {
    const store = useDemoServiceStore();
    const result = store.recall('customer-10003', 'channel-telegram-payment', 'member-owner');
    expect(result.session?.channelId).toBe('channel-telegram-payment');
    expect(result.session?.originChannelId).toBe('channel-telegram-payment');
    expect(result.session?.status).toBe('active');
  });

  it('原渠道删除时拒绝创建并返回原因', () => {
    const store = useDemoServiceStore();
    const channels = useChannelStore();
    channels.remove('channel-telegram-payment');
    const before = store.sessions.length;
    const result = store.recall('customer-10003', 'channel-telegram-payment', 'member-owner');
    expect(result.code).toBe('channel-deleted');
    expect(result.error).toContain('已删除');
    expect(store.sessions.length).toBe(before);
    expect(store.sessions.some((session) => session.customerId === 'customer-10003' && session.status !== 'ended')).toBe(false);
  });
});

describe('成员级翻译与通知', () => {
  it('翻译开关按成员隔离', () => {
    const store = useDemoServiceStore();
    expect(store.setMemberTranslation('member-owner', { receiveTranslation: true, sendTranslation: true })).toBeUndefined();
    expect(store.memberTranslationFor('member-owner').receiveTranslation).toBe(true);
    expect(store.memberTranslationFor('member-sophie').receiveTranslation).toBe(false);
    expect(store.setMemberTranslation('member-sophie', { workLanguage: '法语' })).toContain('暂不可用');
    store.setMemberTranslation('member-sophie', { visitorLanguage: '英语' });
    expect(store.memberTranslationFor('member-sophie').visitorLanguage).toBe('英语');
    expect(store.memberTranslationFor('member-owner').workLanguage).toBe('简体中文');
  });

  it('消息翻译返回预置译文，未命中时用稳定语料兜底且不出现方括号占位', () => {
    const store = useDemoServiceStore();
    const session = store.sessionById('session-20261104008')!;
    const message = session.messages.find((item) => item.id === 'm1')!;
    const result = store.translateMessage('m1', '简体中文');
    expect(result.translation?.text).toBe('你好，我 20 分钟前充值 50 万越南盾，钻石还没到账，能帮我查一下吗？');
    expect(result.translation?.generated).toBe(false);
    expect(message.translation?.sourceLanguage).toBe('越南语');
    expect(store.messageText(message, 'source')).toBe('Chào shop, mình nạp 500k từ 20 phút trước mà chưa thấy kim cương, check giúp mình với.');
    expect(store.messageText(message, 'translation')).toBe('你好，我 20 分钟前充值 50 万越南盾，钻石还没到账，能帮我查一下吗？');
    expect(store.translateMessage(session.messages[0]!.id, '英语').error).toContain('文本业务消息');
    expect(store.translateMessage('m1', '法语').error).toContain('暂不可用');

    const fallback = store.previewTranslation('我充了328怎么还没到账啊', '英语');
    expect(fallback.translation?.text).not.toContain('[');
    expect(fallback.translation?.generated).toBe(true);
    expect(store.previewTranslation('我充了328怎么还没到账啊', '英语').translation?.text).toBe(fallback.translation?.text);
  });

  it('通知触发状态可序列化并按成员隔离', () => {
    const store = useDemoServiceStore();
    store.setMemberNotification('member-owner', { sound: false, browserNotification: true });
    const trigger = store.triggerNotification('session-20261104001');
    expect(trigger?.sessionId).toBe('session-20261104001');
    expect(store.notificationState('member-owner').lastTrigger?.count).toBe(1);
    expect(store.notificationState('member-owner').sound).toBe(false);
    expect(store.notificationState('member-sophie').lastTrigger).toBeUndefined();
    expect(store.triggerNotification('session-20261104003')).toBeUndefined();
    store.consumeNotification('member-owner');
    expect(store.notificationState('member-owner').lastTrigger).toBeUndefined();
  });
});

describe('客户访问信息与 AI 会话', () => {
  it('客户访问信息覆盖次数、首末访问、来源渠道、设备与地区', () => {
    const store = useDemoServiceStore();
    const summary = store.visitSummary('customer-10001')!;
    expect(summary.visitCount).toBe(4);
    expect(summary.firstVisitAt).toBeTruthy();
    expect(summary.lastVisitAt).toBeTruthy();
    expect(summary.sourceChannelId).toBe('channel-web-widget-main');
    expect(summary.sourceChannelType).toBe('web-widget');
    expect(summary.device).toBe('移动端');
    expect(summary.region).toContain('上海');
    expect(summary.accessInfo?.browser).toBe('Safari 18');
    expect(store.sessionInfo('session-20261104001')?.startUrl).toContain('CS20261104');
  });

  it('AI 会话与 AI 消息可与人类客服区分', () => {
    const store = useDemoServiceStore();
    const team = useTeamStore();
    const session = store.sessionById('session-20261104003')!;
    expect(session.assigneeKind).toBe('ai');
    expect(session.messages.some((message) => message.role === 'ai')).toBe(true);
    expect(session.messages.every((message) => message.role === 'ai' || message.role === 'customer' || message.role === 'system')).toBe(true);
    expect(team.aiMembers.some((member) => member.id === session.assigneeId)).toBe(true);
  });
});
