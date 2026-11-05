import type { ChannelType } from '#/features/channels/channel-data';
import type { DemoCustomer, DemoSession } from '#/features/service/demo-store';

import { computed } from 'vue';
import { ElMessage } from 'element-plus';

import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useTeamStore } from '#/features/team/team-store';

export type EditableField = 'email' | 'phone' | 'remark';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEB_RETENTION_MS = 180 * DAY_MS;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d+\-\s()]{6,24}$/;

/**
 * 客户详情共享逻辑：权限、可编辑、近期会话脱敏、格式化、字段校验。
 * 两个页面（客户模块 / 聊天第四栏）共用同一份实现，避免出现两套规则。
 */
export function useCustomerDetail() {
  const store = useDemoServiceStore();
  const access = usePrototypeAccess();
  const team = useTeamStore();

  /** 仅管理员且拥有客户权限时可原位编辑 */
  const canEdit = computed(() => access.isAdmin && access.permissions.customers !== 'none');

  function inAssignedScope(session: DemoSession) {
    const scope = access.permissions.assigned;
    if (scope === 'all') return true;
    if (scope === 'team') return Boolean(access.current?.teamIds.includes(session.teamId));
    if (scope === 'self') return session.assigneeId === access.currentId || session.participants.includes(access.currentId);
    return false;
  }

  /** 先判权限：无权条目不允许暴露摘要/接待人/时间 */
  function canViewSession(session: DemoSession) {
    if (session.status === 'pending') return access.permissions.pending;
    if (session.status === 'ended' && !session.everAssigned) return access.permissions.pending;
    return access.permissions.assigned !== 'none' && inAssignedScope(session);
  }

  /** Web 渠道 180 天过期判断（Telegram 由后端规则控制，这里不参与） */
  function isExpired(session: DemoSession) {
    const type = channelTypeOf(session);
    if (type !== 'web-widget' && type !== 'chat-page') return false;
    const message = store.lastMessage(session);
    if (!message) return false;
    return Date.now() - +new Date(message.sentAt) > WEB_RETENTION_MS;
  }

  function timeOf(session: DemoSession) {
    return store.lastMessage(session)?.sentAt || session.endedAt || session.createdAt;
  }

  /** 空摘要按 PRD 渲染为空，不补「暂无消息」 */
  function summaryOf(session: DemoSession) {
    const message = store.lastMessage(session);
    if (!message) return '';
    if (message.kind === 'image') return `[图片]${message.content ? ` ${message.content}` : ''}`;
    if (message.kind === 'attachment') return `[附件] ${message.attachment?.name || message.content || ''}`.trim();
    if (message.kind === 'emoji') return `[表情]${message.content ? ` ${message.content}` : ''}`;
    return message.content;
  }

  function assigneeLabel(session: DemoSession) {
    if (session.assigneeKind === 'ai') return team.memberById(session.assigneeId)?.name || 'AI 成员';
    if (session.assigneeId) return team.memberById(session.assigneeId)?.name || '未知成员';
    return '未分配';
  }

  function channelTypeOf(session: DemoSession): ChannelType {
    return store.sessionChannelType(session) || 'web-widget';
  }

  function channelNameOf(session: DemoSession) {
    return store.sessionChannel(session)?.name || '已删除渠道';
  }

  function teamNameOf(session: DemoSession) {
    return team.teamById(session.teamId)?.name || '—';
  }

  function startUrlOf(session: DemoSession) {
    return store.sessionInfo(session.id)?.startUrl || session.startUrl || '—';
  }

  /** 客户名下会话，按最近消息倒序 */
  function sessionsOf(customer: DemoCustomer) {
    return store.sessions
      .filter((session) => session.customerId === customer.id)
      .sort((left, right) => +new Date(timeOf(right)) - +new Date(timeOf(left)));
  }

  /** 访问时长按时长口径展示（小时/分钟），不输出长串秒数；拿不到时按空值 */
  function formatDuration(seconds?: number) {
    if (!seconds || seconds < 1) return '—';
    if (seconds < 60) return '不足 1 分钟';
    const totalMinutes = Math.floor(seconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}分钟`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes ? `${hours}小时${minutes}分钟` : `${hours}小时`;
  }

  /** 字段校验：沿用客户侧既有规则，返回空字符串表示通过 */
  function validateField(field: EditableField, raw: string) {
    const value = raw.trim();
    if (field === 'email') {
      if (!value) return '';
      if (!EMAIL_RE.test(value)) return '请输入有效的邮箱地址，例如 name@example.com';
      if (value.length > 64) return '邮箱地址最多 64 个字符';
    }
    if (field === 'phone') {
      if (!value) return '';
      if (!PHONE_RE.test(value)) return '请输入 6–24 位有效手机号，仅可包含数字、+、-、空格和括号';
    }
    if (field === 'remark' && value.length > 50) return '备注名最多 50 个字符';
    return '';
  }

  function saveField(customer: DemoCustomer, field: EditableField, raw: string) {
    return store.updateCustomer(customer.id, { [field]: raw.trim() });
  }

  async function copyText(value: string, label: string) {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(value);
      ElMessage.success(`${label}已复制`);
    } catch {
      ElMessage.error(`${label}复制失败，请重试`);
    }
  }

  return {
    access,
    assigneeLabel,
    canEdit,
    canViewSession,
    channelNameOf,
    channelTypeOf,
    copyText,
    formatDuration,
    isExpired,
    saveField,
    sessionsOf,
    startUrlOf,
    store,
    summaryOf,
    team,
    teamNameOf,
    timeOf,
    validateField,
  };
}
