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
    expect(first.messages.map((message) => message.content)).toEqual(['第一条', '第二条']);
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
