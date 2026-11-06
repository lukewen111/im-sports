<script setup lang="ts">
import type { DemoAttachment, DemoMessage, DemoSession, DemoTranslation, SystemEventType } from '#/features/service/demo-store';

import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElButton, ElDatePicker, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElInput, ElMessage, ElMessageBox, ElOption, ElPopover, ElSelect, ElTooltip } from 'element-plus';
import { QiArchive, QiAttachment, QiClock, QiCrossCircleCenter, QiEmojiSmile, QiInbox, QiMore, QiRobot, QiSendRight, QiTransfer, QiTranslate, QiUser, QiUser3 } from 'qingicon-vue';

import type { ChannelType } from '#/features/channels/channel-data';

import { channelMeta } from '#/features/channels/channel-data';
import { useChannelStore } from '#/features/channels/channel-store';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useTeamStore } from '#/features/team/team-store';
import ChannelGlyph from '../channels/ChannelGlyph.vue';
import type { ProfileIdentity } from '../personal/profile-identity';
import { resolveProfileIdentity } from '../personal/profile-identity';
import CustomerDetail from '#/features/customer-detail/CustomerDetail.vue';
import { formatChatTime } from '#/utils/chat-time';

type GroupKey = 'ai' | 'all' | 'colleagues' | 'ended' | 'mine' | 'pending';

const LANGUAGES = ['简体中文', '繁体中文', '英语', '越南语', '泰语', '高棉语', '缅甸语', '老挝语', '西班牙语'];
// 翻译预览条左端语种胶囊的简称
const LANG_CODES: Record<string, string> = { 简体中文: 'zh', 繁体中文: 'zh', 英语: 'en', 越南语: 'vi', 泰语: 'th', 高棉语: 'km', 缅甸语: 'my', 老挝语: 'lo', 西班牙语: 'es' };

const access = usePrototypeAccess();
const team = useTeamStore();
const channels = useChannelStore();
const store = useDemoServiceStore();
const route = useRoute();

const group = ref<GroupKey>('mine');
const activeId = ref('');
const input = ref('');
const endedKeyword = ref('');
const endedTeam = ref('');
const messagePane = ref<HTMLElement>();
const detailOpen = ref(true);
const detailCollapsed = ref(false);
const transferOpen = ref(false);
const endedDate = ref<[string, string] | null>(null);
const endedHuman = ref('');
const endedAi = ref('');
const endedChannel = ref<ChannelType | ''>('');
const drafts = ref<Record<string, string>>({});
const previewTarget = ref('');
const emojiOpen = ref(false);
const fileInput = ref<HTMLInputElement>();
const previewMedia = ref<null | { kind: 'image' | 'video'; name?: string; url: string }>(null);
const previewScale = ref(1);

const EMOJIS = ['😀', '😄', '😊', '🙂', '😉', '😍', '🤝', '👍', '🙏', '🎉', '🔥', '✅', '❤️', '💡', '📦', '🚚', '⏰', '🤔'];

if (access.permissions.assigned === 'none' && access.permissions.pending) group.value = 'pending';
const requestedSession = String(route.query.session || '');
if (requestedSession) {
  const session = store.sessionById(requestedSession);
  activeId.value = requestedSession;
  if (session) group.value = groupFor(session);
}
watch(() => route.query.session, (value) => {
  if (typeof value !== 'string') return;
  const session = store.sessionById(value);
  if (!session) return;
  group.value = groupFor(session);
  activeId.value = session.id;
});

/* ---------------- 时间与状态 ---------------- */
const pad = (value: number) => String(value).padStart(2, '0');
const now = ref(Date.now());
const ticker = window.setInterval(() => (now.value = Date.now()), 1000);
onBeforeUnmount(() => {
  window.clearInterval(ticker);
  window.removeEventListener('keydown', onPreviewKey);
  window.removeEventListener('pointerdown', onLangMenuPointerDown);
});
function onPreviewKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && previewMedia.value) closePreview();
}
window.addEventListener('keydown', onPreviewKey);
function avatarStyle(identity: ProfileIdentity) {
  return { backgroundColor: identity.avatarColor, color: '#fff' };
}
function identityOfCustomer(id?: string) {
  const item = store.customerById(id);
  return resolveProfileIdentity({ avatar: item?.avatar, id: id || 'empty', name: item?.name });
}
/* 客户档案缺失时按访客标识兜底，不虚构客户名（PRD §3.1） */
function displayCustomerName(id?: string) {
  const name = store.customerById(id)?.name;
  if (name) return name;
  return id ? `Visitor #${id.slice(-4)}` : 'Visitor';
}
function identityOfMessage(message: DemoMessage) {
  if (message.role === 'customer') return identityOfCustomer(customer.value?.id);
  const member = team.memberById(message.senderId);
  return resolveProfileIdentity({ avatar: member?.avatar, id: message.senderId, name: member?.name || message.senderName });
}
function waitLabel(session: DemoSession) {
  const from = +new Date(session.queueEnteredAt || session.createdAt);
  const seconds = Math.max(0, Math.floor((now.value - from) / 1000));
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`;
}

/* ---------------- 分组与列表 ---------------- */
function groupFor(session: DemoSession): GroupKey {
  if (session.status === 'ended') return 'ended';
  if (session.status === 'pending') return 'pending';
  if (session.assigneeKind === 'ai') return 'ai';
  if (session.assigneeId && session.assigneeId !== access.currentId) return 'colleagues';
  return 'mine';
}
const assignedScope = computed(() => access.permissions.assigned);
const inAssignedScope = (session: DemoSession) => {
  const scope = assignedScope.value;
  if (scope === 'all') return true;
  if (scope === 'team') return Boolean(access.current?.teamIds.includes(session.teamId));
  if (scope === 'self') return session.assigneeId === access.currentId || session.participants.includes(access.currentId);
  return false;
};
const showAssigned = computed(() => assignedScope.value !== 'none');
const showPending = computed(() => access.permissions.pending);
const showEnded = computed(() => assignedScope.value !== 'none' || access.permissions.pending);

const localDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(+date)) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const filterOpen = ref(false);
/* PRD §3.3：搜索与筛选仅「已结束」分组提供，项为关键词/日期/团队/人类/AI/渠道类型 */
const activeFilterCount = computed(() => {
  let count = 0;
  if (endedTeam.value) count += 1;
  if (endedHuman.value) count += 1;
  if (endedAi.value) count += 1;
  if (endedChannel.value) count += 1;
  if (endedDate.value) count += 1;
  return count;
});
const listFiltersActive = computed(() => group.value === 'ended' && Boolean(endedKeyword.value.trim() || activeFilterCount.value));
function sessionMatchesKeyword(session: DemoSession) {
  const keyword = endedKeyword.value.trim().toLowerCase();
  if (!keyword) return true;
  const source = [
    session.id,
    session.customerId,
    store.customerById(session.customerId)?.name || '',
    ...session.messages.filter((message) => !store.isSystemEvent(message)).map((message) => message.content),
  ].join(' ').toLowerCase();
  return source.includes(keyword);
}
function matchesEndedFilters(session: DemoSession) {
  if (!sessionMatchesKeyword(session)) return false;
  if (endedTeam.value && session.teamId !== endedTeam.value) return false;
  if (endedHuman.value && !(session.assigneeKind === 'human' && session.assigneeId === endedHuman.value)) return false;
  if (endedAi.value && !(session.assigneeKind === 'ai' && session.assigneeId === endedAi.value)) return false;
  if (endedChannel.value && store.sessionChannelType(session) !== endedChannel.value) return false;
  if (endedDate.value && endedDate.value.length === 2) {
    const [start, end] = endedDate.value;
    const endedOn = localDate(session.endedAt);
    if (!endedOn || endedOn < start || endedOn > end) return false;
  }
  return true;
}
function clearListFilters() {
  endedKeyword.value = '';
  endedTeam.value = '';
  endedDate.value = null;
  endedHuman.value = '';
  endedAi.value = '';
  endedChannel.value = '';
}

const visible = computed(() => {
  if (group.value === 'ended') {
    return store.sessions
      .filter((session) => session.status === 'ended' && (session.everAssigned ? inAssignedScope(session) : access.permissions.pending))
      .filter(matchesEndedFilters)
      .sort((left, right) => +new Date(right.endedAt || right.createdAt) - +new Date(left.endedAt || left.createdAt));
  }
  const rows = store.sessions.filter((session) => session.status !== 'ended');
  let scoped: DemoSession[];
  if (group.value === 'mine') scoped = rows.filter((session) => session.assigneeId === access.currentId && session.assigneeKind === 'human');
  else if (group.value === 'ai') scoped = rows.filter((session) => session.assigneeKind === 'ai' && inAssignedScope(session));
  else if (group.value === 'colleagues') scoped = rows.filter((session) => session.assigneeKind === 'human' && session.assigneeId !== access.currentId && inAssignedScope(session));
  else if (group.value === 'pending') scoped = rows.filter((session) => session.status === 'pending');
  else scoped = rows.filter((session) => inAssignedScope(session) || (session.status === 'pending' && access.permissions.pending));
  /* PRD §3.3：其他分组不提供搜索与筛选 */
  return scoped.sort((left, right) => group.value === 'pending'
    ? +new Date(left.queueEnteredAt || left.createdAt) - +new Date(right.queueEnteredAt || right.createdAt)
    : +new Date(store.lastMessage(right)?.sentAt || right.createdAt) - +new Date(store.lastMessage(left)?.sentAt || left.createdAt));
});

const active = computed(() => store.sessionById(activeId.value) || visible.value[0]);
const customer = computed(() => store.customerById(active.value?.customerId));
const customerIdentity = computed(() => identityOfCustomer(customer.value?.id));
const info = computed(() => (active.value ? store.sessionInfo(active.value.id) : undefined));
const sessionChannelType = computed(() => (active.value ? store.sessionChannelType(active.value) : undefined));
const activeChannelType = computed<ChannelType>(() => (active.value ? typeOf(active.value) : 'web-widget'));
function typeOf(session: DemoSession): ChannelType {
  return store.sessionChannelType(session) || 'web-widget';
}
const channelDeleted = computed(() => Boolean(active.value && channels.deletedChannelSnapshots.some((item) => item.id === active.value?.channelId)));
const canSend = computed(() => Boolean(active.value && info.value?.channelEnabled && active.value.assigneeId === access.currentId && active.value.assigneeKind === 'human' && active.value.status === 'active'));
const onlineState = computed<'offline' | 'online' | undefined>(() => {
  if (!active.value || !customer.value) return undefined;
  // 仅 Web 渠道能较可靠地给出在线状态；Telegram 不虚构。
  if (sessionChannelType.value === 'telegram') return undefined;
  const lastActive = +new Date(customer.value.lastActive || 0);
  if (!lastActive || Number.isNaN(lastActive)) return undefined;
  return now.value - lastActive < 10 * 60_000 ? 'online' : 'offline';
});
function messageSummary(session: DemoSession) {
  // PRD：摘要只取最后一条成功的业务消息，系统事件与失败消息不进入摘要
  const message = store.lastMessage(session);
  if (!message) return '暂无消息';
  if (message.kind === 'video') return message.attachment?.summary || message.content || '[视频]';
  if (message.kind === 'image') return '[图片]';
  if (message.kind === 'attachment') return `[附件] ${message.attachment?.name || ''}`.trim();
  if (message.kind === 'emoji') return message.content || '[表情]';
  return message.content || '暂无消息';
}
watch(visible, (rows) => {
  if (!rows.some((session) => session.id === activeId.value)) activeId.value = rows[0]?.id || '';
}, { immediate: true });
watch(group, () => {
  /* PRD §3.3：切换离开「已结束」时清空关键词与筛选，再次进入不带入 */
  endedKeyword.value = '';
  endedTeam.value = '';
  endedDate.value = null;
  endedHuman.value = '';
  endedAi.value = '';
  endedChannel.value = '';
});

const emptyText = computed(() => ({
  ai: '暂无 AI 成员接待中的会话',
  all: '暂无可见的未结束会话',
  colleagues: '暂无同事接待中的会话',
  ended: '没有符合条件的已结束会话',
  mine: '暂无由你接待的会话，可从「待分配」或「AI 成员」接管',
  pending: '暂无等待分配的会话',
})[group.value]);
/* 分组数字口径：该分组当前进行中的会话数，与未读无关 */
const groupCounts = computed(() => {
  const open = store.sessions.filter((session) => session.status === 'active' || session.status === 'pending');
  return {
    all: open.filter((session) => inAssignedScope(session) || (session.status === 'pending' && access.permissions.pending)).length,
    ai: open.filter((session) => session.assigneeKind === 'ai' && inAssignedScope(session)).length,
    colleagues: open.filter((session) => session.assigneeKind === 'human' && session.assigneeId !== access.currentId && inAssignedScope(session)).length,
    mine: open.filter((session) => session.assigneeKind === 'human' && session.assigneeId === access.currentId).length,
    pending: open.filter((session) => session.status === 'pending').length,
  };
});
const groupCount = computed(() => (group.value === 'ended' ? 0 : groupCounts.value[group.value]));

/* ---------------- 会话操作 ---------------- */
function selectSession(session: DemoSession) {
  group.value = groupFor(session);
  activeId.value = session.id;
}
/* 列表内点击只换选中行与聊天区，不改用户手动选中的分组 */
function pickSession(session: DemoSession) {
  activeId.value = session.id;
}
function canViewSession(session: DemoSession) {
  return session.everAssigned ? inAssignedScope(session) : access.permissions.pending;
}
function openRecent(session: DemoSession) {
  if (!canViewSession(session)) return ElMessage.warning('无权查看该会话，请联系管理员确认数据范围。');
  selectSession(session);
}
const isMineActive = computed(() => Boolean(active.value
  && active.value.status === 'active'
  && active.value.assigneeKind === 'human'
  && active.value.assigneeId === access.currentId));
const eligible = computed(() => {
  const session = active.value;
  return session ? team.humans.filter((member) => member.online && member.id !== session.assigneeId && member.teamIds.includes(session.teamId)) : [];
});
const takeoverBar = computed(() => {
  const session = active.value;
  if (!session || session.status === 'ended' || isMineActive.value) return undefined;
  const check = store.takeoverCheck(session.id, access.currentId);
  const name = session.assigneeId ? team.memberById(session.assigneeId)?.name || '其他成员' : '';
  let text = '客户正在等待分配，接管后即可回复。';
  if (session.status !== 'pending' && session.assigneeKind === 'ai') text = `由 AI 成员${name ? `「${name}」` : ''}接待中，接管后可回复客户。`;
  else if (session.status !== 'pending') text = `由${name ? `「${name}」` : '同事'}接待中，接管后将转由你接待。`;
  return { canRequest: access.permissions.takeover, canTake: check.allowed, reason: check.reason, text };
});
function takeover() {
  if (!active.value) return;
  const check = store.takeoverCheck(active.value.id, access.currentId);
  if (!check.allowed) return ElMessage.warning(check.reason || '当前不可接管该会话。');
  const error = store.takeover(active.value.id, access.currentId);
  if (error) return ElMessage.error(error);
  const sessionId = active.value.id;
  group.value = 'mine';
  activeId.value = sessionId;
  ElMessage.success('已接管会话');
}

/* 已结束会话按 PRD「回聊 / 去聊天」互斥入口：有关联未结束会话时去聊天，否则创建新的正式人工会话 */
const recallBar = computed(() => {
  const session = active.value;
  if (!session || session.status !== 'ended') return undefined;
  const unfinished = store.sessions.find((item) => item.customerId === session.customerId && item.status !== 'ended');
  if (unfinished) return { action: 'chat' as const, label: '去聊天' };
  return { action: 'recall' as const, label: '回聊' };
});
function recallAction() {
  const session = active.value;
  if (!session) return;
  const unfinished = store.sessions.find((item) => item.customerId === session.customerId && item.status !== 'ended');
  if (unfinished) {
    selectSession(unfinished);
    return;
  }
  if (!access.permissions.recall) return ElMessage.warning('暂无权限发起回聊');
  if (!access.current?.online || !store.settingsFor(access.currentId).accepting) return ElMessage.warning('请先开启「接受聊天」');
  const channelId = session.channelId || customer.value?.sourceChannelId;
  if (!channelId) return ElMessage.error('客户缺少原咨询渠道信息，无法回聊，也不会改用其他渠道。');
  const result = store.recall(session.customerId, channelId, access.currentId);
  if (result.code === 'channel-deleted') return ElMessage.error(`${result.error || '原咨询渠道已删除。'} 不会改用其他渠道创建会话。`);
  if (result.error) return ElMessage.error(result.error);
  if (!result.session) return;
  group.value = 'mine';
  activeId.value = result.session.id;
  ElMessage.success('已按客户原渠道发起回聊');
}
function onMoreCommand(command: string) {
  if (command === 'transfer') transferOpen.value = true;
  else if (command === 'end') void end();
}
function transferTo(memberId: string) {
  transfer(memberId);
  transferOpen.value = false;
}
function transfer(memberId: string) {
  if (!active.value || !memberId) return;
  const error = store.assign(active.value.id, memberId);
  if (error) return ElMessage.error(error);
  ElMessage.success('会话已转接');
}
async function end() {
  if (!active.value) return;
  try {
    await ElMessageBox.confirm('结束后会话进入只读历史。', '结束会话', { confirmButtonText: '结束', cancelButtonText: '取消', type: 'warning' });
  } catch { return; }
  const sessionId = active.value.id;
  const error = store.end(sessionId);
  if (error) return ElMessage.error(error);
  if (showEnded.value) { group.value = 'ended'; activeId.value = sessionId; }
}

/* ---------------- 发送与翻译 ---------------- */
const translation = computed(() => store.memberTranslationFor(access.currentId));
const notification = computed(() => store.memberNotificationFor(access.currentId));
const noticeState = computed(() => store.notificationState(access.currentId));
const workLanguage = computed(() => translation.value.workLanguage);
const displayMode = computed(() => translation.value.displayMode);
// 消息级临时切换：只在当前会话有效，切换会话或显示效果设置后清空
const tempMode = ref<Record<string, 'bilingual' | 'source' | 'translation'>>({});
// 预览语种菜单展示全部可用语种，不再排除工作语言
const previewLanguages = LANGUAGES;
// 目标语种优先取本会话手动选的，其次取成员设置的访客语言
const previewLanguage = computed(() => previewTarget.value || translation.value.visitorLanguage || LANGUAGES[0]);
const previewLanguageCode = computed(() => {
  const language = previewLanguage.value;
  return (language && LANG_CODES[language]) || language || '';
});

/* 发送预览状态机：开关开启后常驻；输入停止约 800ms 触发翻译，再模拟 400ms 耗时。 */
type PreviewState = 'idle' | 'pending' | 'ready';
const previewState = ref<PreviewState>('idle');
const previewResult = ref<DemoTranslation>();
// 使用译文或切换会话后的基准输入，等于它时不触发翻译，只保留「翻译为...」占位
const previewBase = ref('');
let previewTimer: number | undefined;
let previewSeq = 0;
const transPreviewVisible = computed(() => translation.value.sendTranslation);
const previewLoading = computed(() => previewState.value === 'pending');
const previewText = computed(() => previewResult.value?.text || '');
const canUsePreview = computed(() => previewState.value === 'ready' && Boolean(previewResult.value?.text));
// 目标语种菜单只有一份状态，由左端语种胶囊触发
const langMenuOpen = ref(false);

function resetPreview() {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = undefined;
  previewSeq += 1;
  previewState.value = 'idle';
  previewResult.value = undefined;
}
function schedulePreview() {
  if (previewTimer) window.clearTimeout(previewTimer);
  previewTimer = undefined;
  previewSeq += 1;
  const seq = previewSeq;
  previewResult.value = undefined;
  const text = input.value.trim();
  const target = previewLanguage.value;
  // 开关关闭 / 内容为空 / 与工作语言相同 / 刚使用过译文：保留占位，跳过翻译
  if (!translation.value.sendTranslation || !text || !target || target === workLanguage.value || input.value === previewBase.value) {
    previewState.value = 'idle';
    return;
  }
  // 防抖期间保持占位：800ms 到点后才进入加载态
  previewState.value = 'idle';
  previewTimer = window.setTimeout(() => {
    previewState.value = 'pending';
    window.setTimeout(() => {
      // 只接收「最新输入 + 最新语种」的结果，过期结果直接丢弃
      if (seq !== previewSeq || input.value.trim() !== text || previewLanguage.value !== target) return;
      const result = store.previewTranslation(text, target, workLanguage.value);
      if (result.error || !result.translation) {
        previewState.value = 'idle';
        ElMessage.warning('翻译失败，请重试');
        return;
      }
      previewResult.value = result.translation;
      previewState.value = 'ready';
    }, 400);
  }, 800);
}
watch(input, schedulePreview);
watch(previewLanguage, schedulePreview);
watch(displayMode, () => { tempMode.value = {}; });
watch(() => translation.value.sendTranslation, (enabled) => {
  if (enabled) schedulePreview();
  else resetPreview();
});

/* 接收侧自动翻译：只处理「打开会话之后新追加」的客户文本消息。 */
const messageCursor = ref(0);
const isForeground = () => document.visibilityState === 'visible' && document.hasFocus();
function messageLanguage(message: DemoMessage) {
  return message.originalLanguage || (/\p{Script=Han}/u.test(message.content) ? '简体中文' : '英语');
}
function autoTranslatePending(pending: DemoMessage[]) {
  const session = active.value;
  if (!session || !translation.value.receiveTranslation || session.status === 'ended' || !isForeground()) return;
  const target = workLanguage.value;
  pending
    .filter((message) => message.role === 'customer' && message.kind === 'text' && !store.isSystemEvent(message))
    .filter((message) => messageLanguage(message) !== target)
    .forEach((message) => store.translateMessage(message.id, target, access.currentId));
}
watch(active, (session, previous) => {
  if (previous && previous.id !== session?.id) drafts.value[previous.id] = input.value;
  input.value = session ? drafts.value[session.id] || '' : '';
  // 恢复草稿但不保留上次译文：占位等待再次输入
  previewBase.value = input.value;
  previewTarget.value = '';
  langMenuOpen.value = false;
  emojiOpen.value = false;
  tempMode.value = {};
  messageCursor.value = session?.messages.length || 0;
  resetPreview();
  if (!session) return;
  if (session.assigneeId === access.currentId && session.assigneeKind === 'human') store.markRead(session.id, access.currentId);
  nextTick(() => { if (messagePane.value) messagePane.value.scrollTop = messagePane.value.scrollHeight; });
}, { immediate: true });
watch(() => active.value?.messages.length, () => {
  const session = active.value;
  if (!session) return;
  // 失焦期间同样推进游标：回来不补翻历史
  const pending = session.messages.slice(messageCursor.value);
  messageCursor.value = session.messages.length;
  autoTranslatePending(pending);
  nextTick(() => { if (messagePane.value) messagePane.value.scrollTop = messagePane.value.scrollHeight; });
});

/* 消息级翻译：缓存命中直接出译文；未命中走 650ms 加载态，期间不可重复触发。 */
const translating = ref<Record<string, boolean>>({});
const translationTimers = new Map<string, number>();
const isPureEmoji = (text: string) => {
  const rest = text.replace(/[\p{Extended_Pictographic}\u200D\uFE0F\s]/gu, '');
  return rest.length === 0 && /\p{Extended_Pictographic}/u.test(text);
};
function translateMessage(message: DemoMessage) {
  if (message.role !== 'customer' || translating.value[message.id]) return;
  const target = workLanguage.value;
  if (message.translations?.[target]) {
    const cached = store.translateMessage(message.id, target, access.currentId);
    if (cached.error) ElMessage.warning('翻译失败，请重试');
    return;
  }
  translating.value[message.id] = true;
  translationTimers.set(message.id, window.setTimeout(() => {
    translating.value[message.id] = false;
    translationTimers.delete(message.id);
    const result = store.translateMessage(message.id, target, access.currentId);
    if (result.error || !result.translation) ElMessage.warning('翻译失败，请重试');
  }, 650));
}
onBeforeUnmount(() => {
  translationTimers.forEach((timerId) => window.clearTimeout(timerId));
  if (previewTimer) window.clearTimeout(previewTimer);
});

function toggleLangMenu() {
  langMenuOpen.value = !langMenuOpen.value;
}
function selectPreviewLanguage(language: string) {
  previewTarget.value = language;
  langMenuOpen.value = false;
}
function onLangMenuPointerDown(event: PointerEvent) {
  if (!langMenuOpen.value) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest('.trans-lang, .trans-lang-menu')) return;
  langMenuOpen.value = false;
}
window.addEventListener('pointerdown', onLangMenuPointerDown);
watch(transPreviewVisible, (value) => { if (!value) langMenuOpen.value = false; });
function usePreview() {
  if (!canUsePreview.value || !previewResult.value) return;
  input.value = previewResult.value.text;
  // 使用后保留预览区占位，不清空输入框、不发送
  previewBase.value = input.value;
  resetPreview();
  langMenuOpen.value = false;
}

/* 展示许可：译文缓存存在，且本人触发过翻译，才展示 */
function translationOf(message: DemoMessage) {
  const cached = message.translations?.[workLanguage.value];
  if (!cached || !message.translatedBy?.includes(access.currentId)) return undefined;
  return cached;
}
function messageMode(message: DemoMessage): 'bilingual' | 'source' | 'translation' {
  const temp = tempMode.value[message.id];
  if (temp) return temp;
  if (!translationOf(message)) return 'source';
  return displayMode.value === 'bilingual' ? 'bilingual' : 'translation';
}
function toggleMessageMode(message: DemoMessage) {
  // 已隐藏译文时再点恢复当前显示效果；否则临时只留原文
  if (messageMode(message) === 'source') delete tempMode.value[message.id];
  else tempMode.value[message.id] = 'source';
}
function translationText(message: DemoMessage) {
  return translationOf(message)?.text || message.content;
}
// 可翻译入口：仅客户发送的文本消息（PRD 补充条款：成员己方与 AI 消息不提供手动翻译入口）
function canTranslate(message: DemoMessage) {
  if (message.role !== 'customer') return false;
  if (message.kind !== 'text' || store.isSystemEvent(message)) return false;
  if (!message.content.trim() || isPureEmoji(message.content)) return false;
  if (message.translations?.[workLanguage.value]) return true;
  return messageLanguage(message) !== workLanguage.value;
}
function addEmoji(emoji: string) {
  input.value += emoji;
  emojiOpen.value = false;
}
function formatFileSize(size?: number) {
  if (!size) return '';
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)}MB` : `${Math.max(1, Math.round(size / 1024))}KB`;
}
function sendOutgoing(content: string, kind: DemoMessage['kind'], attachment?: DemoAttachment): 'error' | 'sent' {
  const session = active.value;
  if (!session) return 'error';
  const error = store.send(session.id, access.currentId, content, { attachment, kind });
  if (error) {
    ElMessage.error(error);
    return 'error';
  }
  return 'sent';
}
function send() {
  const content = input.value.trim();
  if (!content || !active.value) return;
  const outcome = sendOutgoing(content, 'text');
  if (outcome === 'sent') store.markRead(active.value.id, access.currentId);
  input.value = '';
  previewTarget.value = '';
  previewBase.value = '';
  resetPreview();
  if (active.value) drafts.value[active.value.id] = '';
}
function pickFiles() {
  fileInput.value?.click();
}
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
}
function isMediaFile(file: File) {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}
function probeImage(url: string) {
  return new Promise<{ height: number; width: number }>((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ height: image.naturalHeight, width: image.naturalWidth });
    image.onerror = () => resolve({ height: 0, width: 0 });
    image.src = url;
  });
}
function probeVideo(url: string) {
  return new Promise<{ durationSec: number; height: number; width: number }>((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => resolve({
      durationSec: Number.isFinite(video.duration) ? video.duration : 0,
      height: video.videoHeight,
      width: video.videoWidth,
    });
    video.onerror = () => resolve({ durationSec: 0, height: 0, width: 0 });
    video.src = url;
  });
}
function formatDuration(seconds?: number) {
  const total = Math.max(0, Math.round(seconds || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
/* 输入框只接收图片与视频：其它类型直接拒绝，避免产生无法预览的文件卡片 */
async function sendFiles(files: FileList | null) {
  if (!files?.length) return;
  for (const file of Array.from(files)) {
    if (!isMediaFile(file)) {
      ElMessage.warning(`${file.name} 不是图片或视频，仅支持发送图片和视频。`);
      continue;
    }
    if (file.size > 20 * 1024 * 1024) {
      ElMessage.warning(`${file.name}：文件不能超过 20MB。`);
      continue;
    }
    const url = await fileToDataUrl(file);
    if (file.type.startsWith('video/')) {
      const meta = await probeVideo(url);
      const summary = `发送了一段视频${meta.durationSec ? `（${formatDuration(meta.durationSec)}）` : ''}。`;
      sendOutgoing(summary, 'video', {
        ...meta,
        kind: 'video',
        name: file.name,
        size: file.size,
        summary,
        type: file.type,
        url,
      });
      continue;
    }
    const meta = await probeImage(url);
    sendOutgoing('', 'image', {
      ...meta,
      kind: 'image',
      name: file.name,
      size: file.size,
      type: file.type,
      url,
    });
  }
  const filesInput = fileInput.value;
  if (filesInput) filesInput.value = '';
}
function onFilePicked(event: Event) {
  void sendFiles((event.target as HTMLInputElement).files);
}

/* ---------------- 媒体全屏预览 ---------------- */
function isMedia(message: DemoMessage) {
  return message.kind === 'image' || message.kind === 'video';
}
function mediaUrl(message: DemoMessage) {
  return message.attachment?.url || '';
}
function mediaCover(message: DemoMessage) {
  return message.attachment?.coverUrl || message.attachment?.url || '';
}
function openPreview(message: DemoMessage) {
  const url = message.attachment?.url;
  if (!url || !isMedia(message)) return;
  previewScale.value = 1;
  previewMedia.value = { kind: message.attachment?.kind || (message.kind === 'video' ? 'video' : 'image'), name: message.attachment?.name, url };
}
function closePreview() {
  previewMedia.value = null;
  previewScale.value = 1;
}
function zoomBy(delta: number) {
  previewScale.value = Math.min(4, Math.max(0.5, Math.round((previewScale.value + delta) * 100) / 100));
}
function resetMediaZoom() {
  previewScale.value = 1;
}
function onPreviewWheel(event: WheelEvent) {
  if (previewMedia.value?.kind !== 'image') return;
  event.preventDefault();
  zoomBy(event.deltaY < 0 ? 0.15 : -0.15);
}

/* ---------------- 消息展示 ---------------- */
function eventLabel(message: DemoMessage) {
  const type = message.eventType as SystemEventType | undefined;
  const name = message.senderId ? team.memberById(message.senderId)?.name : undefined;
  if (type === 'session-start') return '会话开始';
  if (type === 'pending') return '进入待分配';
  if (type === 'assigned') return `已分配给 ${name || message.content.replace(/^已分配给\s*/, '')}`;
  if (type === 'ended') return '会话结束';
  return message.content;
}
function systemText(message: DemoMessage) {
  return `${eventLabel(message)} · ${formatChatTime(message.endedAt || message.sentAt)}`;
}
const isSystem = (message: DemoMessage) => store.isSystemEvent(message);
function senderInitial(message: DemoMessage) {
  if (message.role === 'ai') return 'AI';
  return identityOfMessage(message).initial || '客';
}
function senderLabel(message: DemoMessage) {
  if (message.role === 'ai') return message.senderName || 'AI 成员';
  if (message.role === 'agent') return message.senderName || '接待成员';
  return customer.value?.name || '客户';
}
function bubbleClass(message: DemoMessage) {
  if (message.role === 'ai') return 'is-ai';
  if (message.role === 'agent') return message.senderId === access.currentId ? 'is-me' : 'is-agent';
  return 'is-customer';
}
const isFailed = (message: DemoMessage) => message.status === 'failed' || message.success === false;
/* 重试只恢复本地状态并刷新时间，不做真实发送 */
function retryMessage(message: DemoMessage) {
  message.status = 'sent';
  message.success = true;
  if (active.value?.messages.at(-1)?.id === message.id) message.sentAt = new Date().toISOString();
  ElMessage.success('消息已恢复为成功状态');
}

/* ---------------- 消息通知 ---------------- */
const originalTitle = ref(document.title);
let titleTimer: number | undefined;
function startTitleBlink(triggerName: string) {
  if (titleTimer) return;
  let highlighted = false;
  titleTimer = window.setInterval(() => {
    highlighted = !highlighted;
    document.title = highlighted ? `● 新消息 · ${triggerName}` : originalTitle.value;
  }, 800);
}
function stopTitleBlink() {
  if (titleTimer) window.clearInterval(titleTimer);
  titleTimer = undefined;
  document.title = originalTitle.value;
}
function playBeep() {
  try {
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = new AudioCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.05;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    window.setTimeout(() => { oscillator.stop(); void context.close(); }, 180);
  } catch {
    // 浏览器限制自动播放时忽略声音失败，消息本身仍然正常展示。
  }
}
watch(() => noticeState.value.lastTrigger?.at, () => {
  const trigger = noticeState.value.lastTrigger;
  if (!trigger) return stopTitleBlink();
  if (notification.value.sound) playBeep();
  if (notification.value.titleBlink) startTitleBlink(trigger.customerName || '客户');
}, { immediate: true });
watch(() => notification.value.titleBlink, (enabled) => {
  const trigger = noticeState.value.lastTrigger;
  if (enabled && trigger) startTitleBlink(trigger.customerName || '客户');
  else stopTitleBlink();
});
onBeforeUnmount(stopTitleBlink);
function openTrigger() {
  const trigger = noticeState.value.lastTrigger;
  const session = trigger ? store.sessionById(trigger.sessionId) : undefined;
  if (!session) return;
  selectSession(session);
  if (session.assigneeId === access.currentId && session.assigneeKind === 'human') store.markRead(session.id, access.currentId);
}
function consumeNotice() {
  if (active.value && active.value.assigneeId === access.currentId) store.markRead(active.value.id, access.currentId);
  else store.consumeNotification(access.currentId);
}

/* ---------------- 客户资料权限 ---------------- */
const editable = computed(() => access.isAdmin && access.permissions.customers !== 'none');
</script>

<template>
  <div class="inbox-page" :class="{ 'is-detail-collapsed': detailCollapsed }">
    <aside class="group-rail">
      <header class="rail-head">
        <span class="rail-title">聊天</span>
      </header>
      <nav class="rail-groups" aria-label="会话分组">
        <button v-if="showAssigned" class="rail-row" :class="{ active: group === 'mine' }" @click="group = 'mine'">
          <QiUser :size="14" /><span>我的</span><b v-if="groupCounts.mine" class="count">{{ groupCounts.mine }}</b>
        </button>
        <button v-if="showPending" class="rail-row" :class="{ active: group === 'pending' }" @click="group = 'pending'">
          <QiClock :size="14" /><span>待分配</span><b v-if="groupCounts.pending" class="count">{{ groupCounts.pending }}</b>
        </button>
        <button v-if="showAssigned" class="rail-row" :class="{ active: group === 'ai' }" @click="group = 'ai'">
          <QiRobot :size="14" /><span>AI 成员</span><b v-if="groupCounts.ai" class="count">{{ groupCounts.ai }}</b>
        </button>
        <button v-if="showAssigned" class="rail-row" :class="{ active: group === 'colleagues' }" @click="group = 'colleagues'">
          <QiUser3 :size="14" /><span>同事</span><b v-if="groupCounts.colleagues" class="count">{{ groupCounts.colleagues }}</b>
        </button>
        <button v-if="showAssigned || showPending" class="rail-row" :class="{ active: group === 'all' }" @click="group = 'all'">
          <QiInbox :size="14" /><span>全部</span><b v-if="groupCounts.all" class="count">{{ groupCounts.all }}</b>
        </button>
        <button v-if="showEnded" class="rail-row" :class="{ active: group === 'ended' }" @click="group = 'ended'">
          <QiArchive :size="14" /><span>已结束</span>
        </button>
      </nav>
    </aside>

    <div class="workspace-card">
      <aside class="list-pane">
        <header class="list-head">
          <h2>会话列表</h2>
          <span v-if="groupCount > 0" class="list-head-count">{{ groupCount }}</span>
          <ElPopover v-if="group === 'ended'" v-model:visible="filterOpen" placement="bottom-end" trigger="click" :width="400" :offset="8" :show-arrow="false" popper-class="inbox-filter-popper">
            <template #reference>
              <button type="button" class="list-filter-btn" aria-label="筛选会话" :aria-expanded="filterOpen">
                <svg class="filter-icon" viewBox="0 0 12 12" aria-hidden="true"><path d="M1.4 2h9.2l-3.5 4.2v3.9l-2.2-1.2V6.2L1.4 2Z" /></svg>
                <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
              </button>
            </template>
            <div class="list-filter-panel">
              <div class="filter-group-label">团队</div>
              <div class="filter-row">
                <span class="filter-label">团队</span>
                <ElSelect v-model="endedTeam" clearable placeholder="全部团队" class="filter-control" :teleported="false">
                  <ElOption v-for="item in access.visibleTeams" :key="item.id" :label="item.name" :value="item.id" />
                </ElSelect>
              </div>
              <div class="filter-group-label">成员</div>
              <div class="filter-row">
                <span class="filter-label">人工成员</span>
                <ElSelect v-model="endedHuman" clearable placeholder="全部人类成员" class="filter-control" :teleported="false">
                  <ElOption v-for="item in team.humans" :key="item.id" :label="item.name" :value="item.id" />
                </ElSelect>
              </div>
              <div class="filter-row">
                <span class="filter-label">AI 成员</span>
                <ElSelect v-model="endedAi" clearable placeholder="全部 AI 成员" class="filter-control" :teleported="false">
                  <ElOption v-for="item in team.aiMembers" :key="item.id" :label="item.name" :value="item.id" />
                </ElSelect>
              </div>
              <div class="filter-group-label">渠道</div>
              <div class="filter-row">
                <span class="filter-label">渠道类型</span>
                <ElSelect v-model="endedChannel" clearable placeholder="全部渠道" class="filter-control" :teleported="false">
                  <ElOption v-for="(meta, type) in channelMeta" :key="type" :label="meta.label" :value="type" />
                </ElSelect>
              </div>
              <div class="filter-group-label">时间</div>
              <div class="filter-row">
                <span class="filter-label">日期</span>
                <ElDatePicker v-model="endedDate" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始" end-placeholder="结束" range-separator="－" clearable class="filter-control filter-date" :teleported="false" />
              </div>
              <div class="filter-footer">
                <span v-if="activeFilterCount" class="filter-summary">已生效 {{ activeFilterCount }} 项</span>
                <button v-if="listFiltersActive" type="button" class="clear-filters" @click="clearListFilters">清除筛选条件</button>
              </div>
            </div>
          </ElPopover>
        </header>
        <div v-if="group === 'ended'" class="list-search">
          <ElInput v-model="endedKeyword" clearable placeholder="搜索聊天、客户或会话 ID" class="list-search-input" />
        </div>
        <div class="conv-list">
          <button
            v-for="session in visible"
            :key="session.id"
            :class="['conv', { active: active?.id === session.id }]"
            @click="pickSession(session)"
          >
            <span class="conv-avatar-wrap">
              <i class="conv-avatar" :style="avatarStyle(identityOfCustomer(session.customerId))"><img v-if="identityOfCustomer(session.customerId).avatarUrl" :src="identityOfCustomer(session.customerId).avatarUrl" alt="" /><template v-else>{{ identityOfCustomer(session.customerId).initial }}</template></i>
              <span v-if="store.sessionChannelType(session)" class="conv-channel-badge"><ChannelGlyph :type="typeOf(session)" /></span>
            </span>
            <span class="conv-body">
              <span class="conv-top">
                <b>{{ displayCustomerName(session.customerId) }}</b>
                <span class="conv-top-right">
                  <time>{{ formatChatTime(store.lastMessage(session)?.sentAt || session.createdAt) }}</time>
                </span>
              </span>
              <span class="conv-mid">
                <small>{{ messageSummary(session) }}</small>
                <em v-if="session.assigneeId === access.currentId && session.unread" class="unread">{{ session.unread }}</em>
                <span v-if="group === 'pending'" class="wait">{{ waitLabel(session) }}</span>
              </span>
            </span>
          </button>
          <div v-if="!visible.length" class="list-empty">
            <span class="empty-dot"></span>
            <p>{{ listFiltersActive ? '未找到符合条件的会话' : emptyText }}</p>
            <button v-if="listFiltersActive" type="button" class="clear-filters" @click="clearListFilters">清除筛选条件</button>
          </div>
        </div>
      </aside>

      <main v-if="active" class="chat-pane">
      <div v-if="noticeState.lastTrigger" class="notice-banner">
        <div>
          <b>新消息提醒</b>
          <span>{{ noticeState.lastTrigger?.customerName }} 发来第 {{ noticeState.lastTrigger?.count }} 条消息 · {{ formatChatTime(noticeState.lastTrigger?.at) }}</span>
        </div>
        <div class="banner-actions">
          <ElButton size="small" @click="openTrigger">查看</ElButton>
          <ElButton size="small" text @click="consumeNotice">忽略</ElButton>
        </div>
      </div>
      <header class="chat-head">
        <div class="identity">
          <i class="head-avatar" :style="avatarStyle(customerIdentity)"><img v-if="customerIdentity.avatarUrl" :src="customerIdentity.avatarUrl" alt="" /><template v-else>{{ customerIdentity.initial }}</template></i>
          <div class="head-info">
            <div class="head-title">
              <h2>{{ displayCustomerName(active.customerId) }}</h2>
              <span v-if="onlineState" class="online-state" :class="onlineState">
                <i class="status-dot"></i>{{ onlineState === 'online' ? '在线' : '离线' }}
              </span>
            </div>
            <div class="head-meta">
              <span class="channel-chip" v-if="sessionChannelType">
                <ChannelGlyph :type="activeChannelType" />
                {{ info?.channelName || '已删除渠道' }}
              </span>
              <span v-if="channelDeleted" class="channel-warning">渠道已删除，仅可查看</span>
            </div>
          </div>
        </div>
        <div class="head-actions">
          <button type="button" class="icon-action info-toggle" :aria-label="detailOpen ? '收起客户详情' : '展开客户详情'" :title="detailOpen ? '收起客户详情' : '展开客户详情'" @click="detailOpen = !detailOpen"><QiUser :size="18" /></button>
          <ElDropdown trigger="click" placement="bottom-end" popper-class="inbox-more-menu" @command="onMoreCommand">
            <button class="icon-action" aria-label="更多操作"><QiMore :size="18" /></button>
            <template #dropdown>
              <ElDropdownMenu>
                <ElDropdownItem command="transfer" :disabled="active.status === 'ended' || !access.permissions.transfer">
                  <QiTransfer :size="14" /><span>转接</span>
                </ElDropdownItem>
                <ElDropdownItem command="end" :divided="true" :disabled="active.status === 'ended' || !access.permissions.end">
                  <QiCrossCircleCenter :size="14" /><span>结束</span>
                </ElDropdownItem>
              </ElDropdownMenu>
            </template>
          </ElDropdown>
        </div>
      </header>

      <section ref="messagePane" class="messages">
        <template v-for="message in active.messages" :key="message.id">
          <div v-if="isSystem(message)" :class="['system-event', message.eventType === 'session-start' ? 'is-start' : 'is-plain']">
            <template v-if="message.eventType === 'session-start'">
              <span class="system-line"></span>
              <span class="system-pill">{{ systemText(message) }}</span>
              <span class="system-line"></span>
            </template>
            <span v-else class="system-text">{{ systemText(message) }}</span>
          </div>
          <div v-else :class="['msg-row', message.role, { 'is-failed': isFailed(message) }]">
            <i class="msg-avatar" :class="{ 'is-ai': message.role === 'ai' }" :style="avatarStyle(identityOfMessage(message))"><img v-if="identityOfMessage(message).avatarUrl" :src="identityOfMessage(message).avatarUrl" alt="" /><template v-else>{{ senderInitial(message) }}</template><em v-if="message.role === 'ai'" class="ai-badge">AI</em></i>
            <div class="msg-main">
              <span class="msg-sender">{{ senderLabel(message) }}</span>
              <div class="bubble-shell">
                <div :class="['bubble', bubbleClass(message), { 'has-media': isMedia(message) }]">
                  <button v-if="message.kind === 'image'" type="button" class="media-card is-image" :aria-label="`查看图片 ${message.attachment?.name || ''}`" @click="openPreview(message)">
                    <img v-if="mediaUrl(message)" :src="mediaUrl(message)" :alt="message.attachment?.name || '图片'" />
                    <span v-else class="media-fallback">图片 · {{ message.attachment?.name || '未命名' }}</span>
                  </button>
                  <button v-else-if="message.kind === 'video'" type="button" class="media-card is-video" :aria-label="`播放视频 ${message.attachment?.name || ''}`" @click="openPreview(message)">
                    <img v-if="mediaCover(message)" class="media-cover" :src="mediaCover(message)" :alt="message.attachment?.name || '视频封面'" />
                    <span class="media-play"><i></i></span>
                    <span class="media-duration">{{ formatDuration(message.attachment?.durationSec) }}</span>
                  </button>
                  <div v-else-if="message.kind === 'attachment'" class="attachment-card">
                    <span class="attachment-icon">附件</span>
                    <div>
                      <a v-if="message.attachment?.url" :href="message.attachment.url" :download="message.attachment.name" class="attachment-name">{{ message.attachment.name }}</a>
                      <b v-else class="attachment-name">{{ message.attachment?.name || '未命名附件' }}</b>
                      <small>{{ formatFileSize(message.attachment?.size) }}</small>
                    </div>
                  </div>
                  <div v-else-if="messageMode(message) === 'bilingual'" class="bubble-text bubble-bilingual">
                    <p class="bubble-line">{{ message.content }}</p>
                    <span class="bubble-divider" aria-hidden="true"></span>
                    <p class="bubble-line is-translation">{{ translationText(message) }}</p>
                  </div>
                  <p v-else class="bubble-text">{{ messageMode(message) === 'translation' ? translationText(message) : message.content }}</p>
                  <div class="bubble-meta">
                    <span>{{ formatChatTime(message.sentAt) }}</span>
                    <span v-if="isFailed(message)" class="failed-text">发送失败</span>
                    <button v-if="isFailed(message)" type="button" class="retry-btn" @click="retryMessage(message)">重试</button>
                  </div>
                </div>
                <button
                  v-if="canTranslate(message) && !translationOf(message)"
                  type="button"
                  class="msg-translate"
                  :class="{ 'is-loading': translating[message.id] }"
                  title="翻译"
                  aria-label="翻译"
                  :disabled="Boolean(translating[message.id])"
                  @click="translateMessage(message)"
                >
                  <span v-if="translating[message.id]" class="msg-translate-spinner" aria-hidden="true"></span>
                  <QiTranslate v-else :size="15" />
                </button>
              </div>
              <div v-if="canTranslate(message) && translationOf(message)" class="msg-translation-status">
                <span class="status-label">文本已翻译</span>
                <button type="button" class="status-btn" @click="toggleMessageMode(message)">
                  {{ messageMode(message) === 'source' ? '显示译文' : messageMode(message) === 'bilingual' ? '隐藏译文' : '显示原文' }}
                </button>
              </div>
            </div>
          </div>
        </template>
        <div v-if="!active.messages.length" class="messages-empty">暂无消息</div>
      </section>

      <footer v-if="active.status === 'ended'" class="recall-bar">
        <div class="recall-copy"><p>已结束的会话</p></div>
        <ElButton class="ui-btn-secondary recall-btn" @click="recallAction">{{ recallBar?.label }}</ElButton>
      </footer>
      <footer v-else-if="isMineActive" class="composer">
        <div v-if="transPreviewVisible" class="trans-preview">
          <div class="trans-lang">
            <button
              type="button"
              class="trans-chip"
              :class="{ 'is-open': langMenuOpen }"
              aria-haspopup="listbox"
              :aria-expanded="langMenuOpen"
              aria-label="切换目标语种"
              @click.stop="toggleLangMenu"
            >{{ previewLanguageCode }}</button>
            <div v-if="langMenuOpen" class="trans-lang-menu" role="listbox" aria-label="目标语种">
              <button
                v-for="language in previewLanguages"
                :key="language"
                type="button"
                role="option"
                class="trans-lang-option"
                :class="{ 'is-selected': language === previewLanguage }"
                :aria-selected="language === previewLanguage"
                @click="selectPreviewLanguage(language)"
              >
                <span>{{ language }}</span>
                <span class="trans-lang-check">{{ language === previewLanguage ? '✓' : '' }}</span>
              </button>
            </div>
          </div>
          <span v-if="previewLoading" class="trans-text is-loading">翻译中...</span>
          <span v-else-if="previewText" class="trans-text">{{ previewText }}</span>
          <span v-else class="trans-placeholder">翻译为...</span>
          <div class="trans-actions">
            <button type="button" class="trans-use" :disabled="!canUsePreview" @click="usePreview">使用</button>
          </div>
        </div>
        <div class="composer-box" :class="{ 'is-disabled': !canSend }">
          <textarea
            v-model="input"
            class="composer-input"
            rows="3"
            :placeholder="canSend ? '输入消息，Enter 发送，Shift + Enter 换行' : '当前渠道不可回复，历史消息仍可查看'"
            :disabled="!canSend"
            @keydown.enter.exact.prevent="send"
          ></textarea>
          <div class="composer-bar">
            <button type="button" class="composer-icon" :class="{ active: emojiOpen }" :disabled="!canSend" aria-label="表情" @click="emojiOpen = !emojiOpen"><QiEmojiSmile :size="18" /></button>
            <button type="button" class="composer-icon" :disabled="!canSend" aria-label="附件" @click="pickFiles"><QiAttachment :size="18" /></button>
            <button type="button" class="send-btn" :disabled="!input.trim() || !canSend" aria-label="发送" @click="send"><QiSendRight :size="18" /></button>
          </div>
          <div v-if="emojiOpen" class="emoji-panel">
            <button v-for="emoji in EMOJIS" :key="emoji" type="button" @click="addEmoji(emoji)">{{ emoji }}</button>
          </div>
        </div>
        <input ref="fileInput" class="hidden-file" type="file" accept="image/*,video/*" multiple @change="onFilePicked" />
        <small v-if="!canSend && !channelDeleted" class="composer-note">渠道已停用，暂不可回复，历史消息仍可查看。</small>
      </footer>
      <footer v-else class="takeover-bar">
        <p class="takeover-copy">{{ takeoverBar?.text }}</p>
        <ElTooltip v-if="takeoverBar?.canRequest" :content="takeoverBar.reason || '接管后由你接待该会话'" placement="top" :disabled="takeoverBar.canTake">
          <span class="action-wrap">
            <ElButton class="ui-btn-secondary takeover-btn" :disabled="!takeoverBar.canTake" @click="takeover">接管</ElButton>
          </span>
        </ElTooltip>
      </footer>
    </main>
    </div>

    <CustomerDetail
      v-if="active"
      v-model:open="detailOpen"
      v-model:collapsed="detailCollapsed"
      class="info-card"
      :class="{ 'is-open': detailOpen }"
      :customer="customer"
      :editable="editable"
      :session="active"
      @select="openRecent"
    />
    <button
      v-if="active"
      type="button"
      class="info-card-close"
      :class="{ 'is-visible': detailOpen }"
      aria-label="关闭客户详情"
      title="关闭客户详情"
      @click="detailOpen = false"
    >
      ×
    </button>

    <ElDialog v-model="transferOpen" title="转接会话" width="360px" append-to-body>
      <div class="transfer-list">
        <button v-for="member in eligible" :key="member.id" type="button" class="transfer-row" @click="transferTo(member.id)">
          <span class="transfer-avatar">{{ member.name.slice(0, 1) }}</span>
          <span class="transfer-name">{{ member.name }}</span>
        </button>
        <p v-if="!eligible.length" class="transfer-empty">当前没有可转接的成员。</p>
      </div>
    </ElDialog>

    <Teleport to="body">
      <div v-if="previewMedia" class="media-overlay" @click.self="closePreview" @wheel.prevent="onPreviewWheel">
        <button type="button" class="media-overlay-close" aria-label="关闭预览" @click="closePreview">×</button>
        <img v-if="previewMedia.kind === 'image'" class="media-overlay-image" :style="{ transform: `scale(${previewScale})` }" :src="previewMedia.url" :alt="previewMedia.name || '图片预览'" @click.stop />
        <video v-else class="media-overlay-video" :src="previewMedia.url" controls autoplay playsinline @click.stop></video>
        <div v-if="previewMedia.kind === 'image'" class="media-zoom" @click.stop>
          <button type="button" aria-label="缩小" @click="zoomBy(-0.2)">−</button>
          <span>{{ Math.round(previewScale * 100) }}%</span>
          <button type="button" aria-label="放大" @click="zoomBy(0.2)">+</button>
          <button type="button" class="media-zoom-reset" @click="resetMediaZoom">还原</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.inbox-page {
  --canvas: #f5f5f5;
  --surface: #fff;
  --surface-muted: #eeeeef;
  --surface-control: #e6e6e7;
  --ink: #131317;
  --ink-2: #62626d;
  --ink-3: #8c8c8e;
  --line: #ececed;
  --line-strong: #e2e2e3;
  --info-surface: #daedff;
  --info-ink: #0b4a82;
  --agent-surface: #f2f0fe;
  --danger: #ca0005;
  --success: #1e9e5b;
  display: grid;
  --detail-width: 304px;
  grid-template-columns: 196px minmax(0, 1fr) var(--detail-width);
  transition: grid-template-columns 0.24s ease;
  gap: 0;
  height: calc(100vh - var(--ui-header-height, 48px));
  min-height: 560px;
  box-sizing: border-box;
  padding: 0;
  overflow: hidden;
  color: var(--ink);
  background: var(--canvas);
  font-size: 14px;
}

/* ---------- 第一栏 ---------- */
.group-rail { display: flex; flex-direction: column; min-width: 0; padding: 12px 10px; overflow: auto; }
.rail-head { display: flex; flex: 0 0 auto; align-items: center; min-height: 52px; margin: 0 0 8px 2px; padding: 0 10px; }
.rail-groups { display: grid; gap: 2px; }
.rail-title { display: inline-flex; align-items: center; color: var(--ui-ink); font-size: 17px; font-weight: 600; line-height: 24px; }
.rail-row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 9px 10px; color: var(--ink-2); font: inherit; font-size: 13px; text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 8px; transition: background-color 0.15s ease, color 0.15s ease; }
.rail-row:hover { color: var(--ink); background: var(--surface-control); }
.rail-row.active { color: var(--ink); font-weight: 600; background: var(--surface-selected, #d9d9da); }
.rail-row span { flex: 1; min-width: 0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.count { font-size: 11px; font-weight: 600; color: var(--ink-2); }

/* ---------- 第二栏 ---------- */
/* 浮起白面板：画布灰底 + 四周 12px 灰间隙，无投影，圆角内裁切 */
.workspace-card {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  margin: 12px;
  overflow: hidden;
  background: var(--surface);
  border: 0;
  border-radius: 16px;
}
.list-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: transparent;
  border-right: 1px solid #ececed;
}
.list-head { display: flex; align-items: center; gap: 6px; box-sizing: border-box; min-height: 52px; padding: 0 16px; }
.list-head h2 { margin: 0; color: var(--ui-ink); font-size: 17px; font-weight: 600; line-height: 24px; }
.list-head-count { color: var(--ink-2); font-size: 13px; font-weight: 600; }
.list-filter-btn { position: relative; display: grid; place-items: center; width: 28px; height: 28px; margin-left: auto; padding: 0; color: var(--ink-2); cursor: pointer; background: transparent; border: 0; border-radius: 8px; transition: color 0.15s ease, background-color 0.15s ease; }
.list-filter-btn:hover { color: var(--ink); background: var(--surface-muted); }
.filter-icon { width: 14px; height: 14px; fill: currentColor; }
.filter-count { position: absolute; top: -3px; right: -4px; display: grid; place-items: center; box-sizing: border-box; min-width: 15px; height: 15px; padding: 0 4px; color: #fff; font-size: 10px; font-weight: 600; line-height: 1; background: var(--info-ink); border-radius: 999px; }
.list-search { padding: 0 16px 10px; }
.list-search-input { width: 220px; }
.list-search-input :deep(.el-input__wrapper) { min-height: 32px; }
.clear-filters { justify-self: start; padding: 0; color: var(--info-ink); font: inherit; font-size: 11px; cursor: pointer; background: transparent; border: 0; }
/* 筛选浮层由 ElPopover 挂到 body，样式需全局作用域 */
:global(.inbox-filter-popper) { box-sizing: border-box; padding: 12px; border-radius: 12px; }
:global(.inbox-filter-popper .list-filter-panel) { display: grid; gap: 6px; }
:global(.inbox-filter-popper .filter-group-label) { margin-top: 2px; color: #8c8c8e; font-size: 11px; line-height: 16px; }
:global(.inbox-filter-popper .filter-row) { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
:global(.inbox-filter-popper .filter-label) { flex: 0 0 auto; color: #62626d; font-size: 12px; }
:global(.inbox-filter-popper .filter-control) { flex: 1 1 auto; min-width: 0; }
:global(.inbox-filter-popper .filter-control .el-select__wrapper),
:global(.inbox-filter-popper .filter-control .el-input__wrapper) { min-height: 30px; }
:global(.inbox-filter-popper .filter-date) { width: 100%; }
:global(.inbox-filter-popper .filter-footer) { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 2px; padding-top: 8px; border-top: 1px solid #ececed; }
:global(.inbox-filter-popper .filter-summary) { color: #8c8c8e; font-size: 11px; }
:global(.inbox-filter-popper .clear-filters) { margin-left: auto; padding: 0; color: #0b4a82; font: inherit; font-size: 11px; cursor: pointer; background: transparent; border: 0; }
.conv-list { display: flex; flex: 1; flex-direction: column; gap: 4px; min-height: 0; padding: 4px 6px 10px; overflow: auto; }
.conv {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  width: 100%;
  padding: 10px;
  overflow: visible;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition: background-color 0.15s ease;
}
.conv:hover { background: #f5f5f6; }
.conv.active { background: #f0f0f1; }
.conv-avatar-wrap { position: relative; flex: 0 0 auto; width: 34px; height: 34px; overflow: visible; }
.conv-avatar {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  font-style: normal;
  font-size: 12px;
  font-weight: 600;
  border-radius: 50%;
  overflow: hidden;
}
.conv-channel-badge { position: absolute; right: -7px; bottom: -7px; z-index: 2; display: grid; width: 16px; height: 16px; place-items: center; overflow: hidden; background: #fff; border: 1px solid #ececed; border-radius: 50%; }
/* 角标内不复用 36px 大图标再缩放，直接给 12px 尺寸，避免缩放后偏移被圆环裁掉 */
.conv-channel-badge :deep(.channel-glyph) { position: absolute; top: 50%; left: 50%; width: 12px; height: 12px; overflow: visible; background: transparent; border: 0; border-radius: 0; transform: translate(-50%, -50%); }
.conv-channel-badge :deep(.q-icon) { width: 12px !important; height: 12px !important; }
.conv-channel-badge :deep(.telegram-brand-icon) { width: 12px; height: 12px; }
.conv-channel-badge :deep(.channel-glyph.is-telegram) { color: #229ed9; }
.conv-channel-badge :deep(.channel-glyph.is-web-widget) { color: #131317; }
.conv-channel-badge :deep(.channel-glyph.is-chat-page) { color: #3b5bdb; }
.conv-avatar img, .head-avatar img, .msg-avatar img, .summary-avatar img, .client-preview header i img, .client-msg i img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.conv-body { display: flex; flex: 1; flex-direction: column; gap: 4px; min-width: 0; }
.conv-top { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
.conv-top b { min-width: 0; overflow: hidden; font-size: 13px; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.conv-top-right { display: flex; flex: 0 0 auto; gap: 4px; align-items: center; }
.conv-top time { color: var(--ink-3); font-size: 11px; }
.conv-mid { display: flex; gap: 6px; align-items: center; min-width: 0; }
.conv-mid small { flex: 0 1 auto; min-width: 0; overflow: hidden; color: var(--ink-2); font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }
.wait { flex: 0 0 auto; margin-left: auto; color: var(--ink-3); font-size: 10px; }
.unread { flex: 0 0 auto; padding: 1px 6px; font-style: normal; color: #fff; background: var(--danger); border-radius: 999px; }
.list-empty { display: grid; gap: 8px; place-items: center; padding: 48px 20px; color: var(--ink-3); font-size: 12px; text-align: center; }
.empty-dot { width: 26px; height: 26px; border: 1px dashed var(--line-strong); border-radius: 50%; }

/* ---------- 第三栏 ---------- */
.chat-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: transparent;
  border: 0;
  border-radius: 0;
}
.notice-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 10px 12px 0;
  padding: 10px 12px;
  color: var(--info-ink);
  background: var(--info-surface);
  border-radius: 10px;
}
.notice-banner b { display: block; font-size: 13px; }
.notice-banner span { display: block; margin-top: 2px; font-size: 12px; }
.banner-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 4px; }
.chat-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
}
.identity { display: flex; flex: 1 1 200px; gap: 10px; min-width: 0; }
.head-info { min-width: 0; }
.head-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  place-items: center;
  font-style: normal;
  font-size: 13px;
  font-weight: 600;
  border-radius: 50%;
}
.head-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.head-assignee { color: var(--ink-2); font-size: 12px; }
.identity h2 { margin: 0; font-size: 16px; font-weight: 600; }
.online-state { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-3); font-size: 11px; }
.status-dot { width: 6px; height: 6px; background: var(--ink-3); border-radius: 50%; }
.online-state.online { color: var(--success); }
.online-state.online .status-dot { background: var(--success); }
.online-state.offline .status-dot { background: #b9b9bf; }
.head-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
.status-pill { padding: 2px 8px; font-size: 11px; color: var(--ink-2); background: var(--surface-muted); border-radius: 999px; }
.channel-chip { display: inline-flex; align-items: center; gap: 4px; max-width: 220px; overflow: hidden; color: var(--ink-2); font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }
.channel-chip :deep(.channel-glyph) { width: 20px; height: 20px; border: 0; background: #f5f5f5; }
.channel-chip :deep(.channel-glyph svg) { width: 15px; height: 15px; }
.team-chip { color: var(--ink-3); font-size: 12px; }
.channel-warning { color: var(--danger); font-size: 12px; }
.head-actions { display: flex; flex: 1 1 auto; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 6px; min-width: 0; }
.action-wrap { display: inline-flex; }
.icon-action { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; color: var(--ink-2); cursor: pointer; background: var(--surface-muted); border: 1px solid transparent; border-radius: 8px; transition: color 0.15s ease, background-color 0.15s ease; }
.icon-action:hover:not(:disabled) { color: var(--ink); background: var(--surface-control); }
.icon-action:disabled { cursor: not-allowed; opacity: 0.42; }
.icon-action.is-danger:hover:not(:disabled) { color: var(--danger); }
.transfer-select { width: 100px; }
.transfer-select :deep(.el-select__wrapper) { min-height: 32px; }

.messages { display: flex; flex: 1; flex-direction: column; gap: 2px; min-height: 0; padding: 18px 20px; overflow: auto; background: #fff; }
.messages::before { content: ''; margin-top: auto; }
.messages-empty { margin: auto; padding: 40px 0; color: var(--ink-3); font-size: 12px; text-align: center; }
.system-event { display: flex; align-items: center; gap: 12px; margin: 14px 0; }
.system-event.is-plain { justify-content: center; margin: 10px 0; }
.system-line { flex: 1; height: 1px; background: #e4e4e6; }
.system-pill { flex: 0 0 auto; padding: 6px 12px; color: #8c8c8e; font-size: 12px; white-space: nowrap; background: #f0f0f1; border-radius: 999px; }
.system-text { color: #8a8a93; font-size: 12px; text-align: center; }
.msg-row { display: flex; gap: 10px; align-items: flex-start; margin: 12px 0; }
.msg-row.agent, .msg-row.ai { flex-direction: row-reverse; }
.msg-avatar {
  position: relative;
  display: grid;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  margin-top: 2px;
  place-items: center;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  border-radius: 50%;
  overflow: hidden;
}
.ai-badge { position: absolute; right: -5px; bottom: -4px; display: grid; width: 15px; height: 15px; place-items: center; color: #fff; font-size: 7px; font-style: normal; font-weight: 600; background: var(--ink); border: 1px solid #fff; border-radius: 5px; }
.msg-main { display: flex; flex-direction: column; gap: 5px; max-width: 72%; min-width: 0; width: fit-content; align-items: flex-start; }
.msg-row.agent .msg-main, .msg-row.ai .msg-main { align-items: flex-end; }
.msg-sender { padding: 0 2px; color: #62626d; font-size: 12px; line-height: 1.4; }
.bubble-shell { display: flex; align-items: flex-start; gap: 8px; max-width: 100%; }
.bubble { padding: 12px 16px; color: #131317; background: #f3f3f3; border-radius: 16px; }
.bubble.is-me, .bubble.is-agent, .bubble.is-ai { background: #f7f4ff; }
.bubble-text { margin: 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
/* 双语：同一个气泡内原文在上、浅色分隔线、译文在下 */
.bubble-bilingual { display: grid; gap: 8px; }
.bubble-line { margin: 0; font-size: 13px; line-height: 1.55; white-space: pre-wrap; overflow-wrap: anywhere; }
.bubble-divider { display: block; height: 1px; background: #e3e3e5; }
.bubble-meta { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 6px; color: #8c8c8e; font-size: 11px; }
.msg-translate { display: grid; flex: 0 0 auto; width: 28px; height: 28px; padding: 0; place-items: center; color: #62626d; cursor: pointer; background: #fff; border: 1px solid #e3e3e5; border-radius: 8px; box-shadow: 0 2px 6px rgb(19 19 23 / 8%); opacity: 0; visibility: hidden; transition: opacity 0.13s ease, visibility 0.13s ease, color 0.15s ease, border-color 0.15s ease; }
.msg-translate:hover:not(:disabled) { color: #003fa4; border-color: #c2cad9; }
.msg-translate:disabled { cursor: default; }
.msg-translate-spinner { width: 14px; height: 14px; border: 2px solid #d6dce8; border-top-color: #003fa4; border-radius: 50%; animation: msg-translate-spin 0.7s linear infinite; }
@keyframes msg-translate-spin { to { transform: rotate(360deg); } }
/* 悬浮气泡（含外侧图标区）或键盘 focus 时才显示 */
.bubble-shell:hover .msg-translate, .bubble-shell:focus-within .msg-translate { opacity: 1; visibility: visible; }
.msg-translation-status { display: flex; gap: 6px; align-items: baseline; padding: 0 2px; color: #8c8c8e; font-size: 11px; line-height: 16px; }
.status-btn { padding: 0; color: #003fa4; font: inherit; font-size: 11px; line-height: 16px; cursor: pointer; background: transparent; border: 0; }
.status-btn:hover { text-decoration: underline; }
.retry-btn { padding: 0; color: #62626d; font: inherit; font-size: 11px; text-decoration: underline; cursor: pointer; background: transparent; border: 0; }
.retry-btn:hover { color: #131317; }
.failed-text { color: var(--danger); }
.msg-row.is-failed .bubble { border: 1px solid rgb(202 0 5 / 28%); }
.bubble.has-media { padding: 6px; }
.media-card { position: relative; display: block; padding: 0; overflow: hidden; cursor: zoom-in; background: #ececee; border: 0; border-radius: 12px; }
.media-card.is-image img { display: block; width: auto; max-width: 240px; max-height: 240px; min-width: 120px; object-fit: cover; }
.media-card.is-video { width: 280px; max-width: 100%; }
.media-card.is-video .media-cover { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.media-play { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.media-play i { position: relative; width: 44px; height: 44px; background: rgb(19 19 23 / 72%); border-radius: 50%; transition: background-color 0.15s ease; }
.media-play i::after { position: absolute; top: 50%; left: 50%; width: 0; height: 0; content: ''; border-top: 7px solid transparent; border-bottom: 7px solid transparent; border-left: 11px solid #fff; transform: translate(-40%, -50%); }
.media-card:hover .media-play i { background: rgb(19 19 23 / 88%); }
.media-duration { position: absolute; right: 8px; bottom: 8px; padding: 1px 6px; color: #fff; font-size: 11px; background: rgb(19 19 23 / 72%); border-radius: 5px; }
.media-overlay { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 48px; background: rgb(9 9 12 / 84%); }
.media-overlay-image { max-width: 100%; max-height: 100%; cursor: zoom-in; user-select: none; transition: transform 0.12s ease; }
.media-overlay-video { max-width: 100%; max-height: 100%; background: #000; border-radius: 8px; }
.media-overlay-close { position: absolute; top: 20px; right: 24px; display: grid; width: 36px; height: 36px; place-items: center; padding: 0; color: #fff; font-size: 22px; line-height: 1; cursor: pointer; background: rgb(255 255 255 / 12%); border: 0; border-radius: 50%; }
.media-overlay-close:hover { background: rgb(255 255 255 / 22%); }
.media-zoom { position: absolute; bottom: 24px; left: 50%; display: flex; align-items: center; gap: 6px; padding: 6px; background: rgb(255 255 255 / 12%); border-radius: 999px; transform: translateX(-50%); }
.media-zoom button { display: grid; width: 30px; height: 30px; place-items: center; padding: 0; color: #fff; font-size: 16px; cursor: pointer; background: transparent; border: 0; border-radius: 50%; }
.media-zoom button:hover { background: rgb(255 255 255 / 16%); }
.media-zoom span { min-width: 46px; color: #fff; font-size: 12px; text-align: center; }
.media-zoom .media-zoom-reset { width: auto; padding: 0 10px; font-size: 12px; }
.media-fallback { color: var(--ink-2); font-size: 12px; }
.attachment-card { display: flex; gap: 8px; align-items: center; min-width: 150px; }
.attachment-icon { display: grid; flex: 0 0 auto; width: 30px; height: 30px; place-items: center; color: var(--ink-2); font-size: 10px; background: rgb(19 19 23 / 6%); border-radius: 8px; }
.attachment-name { display: block; overflow: hidden; color: inherit; font-size: 12px; font-weight: 500; text-decoration: none; text-overflow: ellipsis; }
a.attachment-name { text-decoration: underline; }
.attachment-card small { display: block; margin-top: 2px; color: var(--ink-3); font-size: 10px; }
.bubble.is-me .attachment-icon { color: var(--ink-2); background: rgb(19 19 23 / 6%); }
.bubble.is-me .attachment-card small { color: var(--ink-3); }

.composer { position: relative; padding: 12px 16px 14px; border-top: 1px solid var(--line); }
.composer-box { position: relative; background: var(--surface); border: 1px solid var(--line-strong); border-radius: 14px; transition: border-color 0.15s ease; }
.composer-box:focus-within { border-color: #c9c9cd; }
.composer-box.is-disabled { background: #f7f7f8; }
.composer-input { display: block; width: 100%; min-height: 76px; max-height: 180px; box-sizing: border-box; padding: 12px 14px 2px; color: var(--ink); font: inherit; font-size: 13px; line-height: 1.6; resize: none; background: transparent; border: 0; outline: none; }
.composer-input::placeholder { color: var(--ink-3); }
.composer-input:disabled { cursor: not-allowed; }
.composer-bar { display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 6px 8px 10px; }
.composer-icon { display: grid; place-items: center; width: 30px; height: 30px; padding: 0; color: var(--ink-2); cursor: pointer; background: transparent; border: 0; border-radius: 8px; transition: color 0.15s ease, background-color 0.15s ease; }
.composer-icon:hover:not(:disabled), .composer-icon.active { color: var(--ink); background: var(--surface-muted); }
.composer-icon:disabled { color: var(--ink-3); cursor: not-allowed; opacity: 0.5; }
.send-btn { display: grid; place-items: center; width: 32px; height: 32px; margin-left: 2px; padding: 0; color: #fff; cursor: pointer; background: var(--ink); border: 0; border-radius: 10px; transition: opacity 0.15s ease; }
.send-btn:disabled { cursor: not-allowed; opacity: 0.28; }
.composer-note { display: block; margin-top: 8px; color: var(--ink-3); font-size: 11px; }
.emoji-panel { position: absolute; bottom: 50px; left: 10px; z-index: 5; display: flex; flex-wrap: wrap; gap: 2px; width: 272px; padding: 8px; background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 8px 24px rgb(19 19 23 / 8%); }
.emoji-panel button { width: 30px; height: 30px; font-size: 17px; line-height: 1; cursor: pointer; background: transparent; border: 0; border-radius: 6px; }
.emoji-panel button:hover { background: var(--surface-muted); }
.hidden-file { display: none; }
/* ---------- 发送翻译预览条（输入框正上方） ---------- */
.trans-preview { display: flex; align-items: center; gap: 10px; box-sizing: border-box; min-height: 42px; margin-bottom: 8px; padding: 0 12px; background: #f6f6f7; border-radius: 12px; }
.trans-lang { position: relative; flex: 0 0 auto; }
.trans-chip { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 22px; padding: 0 7px; color: #131317; font: inherit; font-size: 12px; font-weight: 500; line-height: 1; cursor: pointer; background: #fff; border: 1px solid #e4e4e6; border-radius: 6px; transition: background-color 0.15s ease, border-color 0.15s ease; }
.trans-chip:hover { background: #f2f4f8; border-color: #c2cad9; }
.trans-chip.is-open { background: #eef1f7; border-color: #b9c4d8; }
.trans-chip:focus-visible { outline: 2px solid #003fa4; outline-offset: 1px; }
.trans-lang-menu { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 30; display: grid; gap: 2px; min-width: 148px; padding: 4px; background: #fff; border: 1px solid #e4e4e6; border-radius: 10px; box-shadow: 0 8px 24px rgb(19 19 23 / 12%); }
.trans-lang-option { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 6px 8px; color: #131317; font: inherit; font-size: 13px; text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 6px; }
.trans-lang-option:hover { background: #f3f4f6; }
.trans-lang-option.is-selected { color: #003fa4; font-weight: 500; }
.trans-lang-check { min-width: 12px; color: #003fa4; font-size: 12px; text-align: right; }
.trans-text { flex: 1; min-width: 0; overflow: hidden; color: #131317; font-size: 13px; line-height: 18px; white-space: nowrap; text-overflow: ellipsis; }
.trans-text.is-loading { color: #8c8c8e; }
.trans-placeholder { flex: 1; min-width: 0; color: #8c8c8e; font-size: 13px; line-height: 18px; }
.trans-actions { display: flex; flex: 0 0 auto; align-items: center; }
.trans-use { display: inline-flex; align-items: center; height: 28px; padding: 0 8px; color: #003fa4; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; background: transparent; border: 0; border-radius: 6px; }
.trans-use:hover:not(:disabled) { background: #eef1f7; }
.trans-use:disabled { color: #a7b0c2; cursor: not-allowed; }
.takeover-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; box-sizing: border-box; padding: 16px 18px; border-top: 1px solid var(--line); }
.takeover-copy { max-width: 64%; margin: 0; color: var(--ink-2); font-size: 13px; line-height: 1.6; }
.takeover-btn { flex: 0 0 auto; min-width: 96px; }
.recall-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; box-sizing: border-box; padding: 16px 18px; border-top: 1px solid var(--line); }
.recall-copy { display: flex; align-items: center; min-width: 0; margin: 0; }
.recall-copy p { margin: 0; color: var(--ink-2); font-size: 13px; line-height: 1.6; }
.recall-btn { flex: 0 0 auto; min-width: 96px; }
.transfer-list { display: grid; gap: 4px; }
.transfer-row { display: flex; gap: 10px; align-items: center; width: 100%; padding: 10px; text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 10px; }
.transfer-row:hover { background: #f5f5f5; }
.transfer-avatar { display: grid; flex: 0 0 auto; width: 32px; height: 32px; place-items: center; color: #fff; font-size: 12px; font-weight: 600; background: #62626d; border-radius: 50%; }
.transfer-name { color: var(--ink); font-size: 13px; }
.transfer-empty { margin: 4px 0; color: var(--ink-3); font-size: 12px; text-align: center; }

:global(.inbox-more-menu) {
  padding: 4px;
  background: #fff;
  border: 1px solid #e2e2e3;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgb(19 19 23 / 10%);
}
:global(.inbox-more-menu .el-dropdown-menu) { padding: 0; background: transparent; }
:global(.inbox-more-menu .el-dropdown-menu__item) { display: flex; gap: 8px; align-items: center; min-width: 132px; padding: 9px 12px; color: #131317; font-size: 13px; border-radius: 8px; }
:global(.inbox-more-menu .el-dropdown-menu__item:not(.is-disabled):hover) { color: #131317; background: #f5f5f5; }
:global(.inbox-more-menu .el-dropdown-menu__item--divided) { margin-top: 4px; border-top: 1px solid #ececed; }
:global(.inbox-more-menu .el-dropdown-menu__item--divided::before) { display: none; }

/* ---------- 第四栏 ---------- */
.inbox-page .info-card { min-width: 0; min-height: 0; margin: 12px 12px 12px 0; overflow: hidden; border: 0; }
.inbox-page.is-detail-collapsed .info-card { margin-right: 0; }
.inbox-page.is-detail-collapsed { --detail-width: 32px; }
.info-toggle { display: none; }
.info-card-close { display: none; }
.customer-summary { display: flex; align-items: center; gap: 10px; padding: 16px; }
.summary-avatar { display: grid; flex: 0 0 auto; width: 44px; height: 44px; place-items: center; color: var(--ink); font-size: 14px; font-style: normal; font-weight: 600; border-radius: 50%; }
.summary-main { flex: 1; min-width: 0; }
.summary-main h3 { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin: 0; font-size: 15px; font-weight: 600; }
.summary-main small { display: block; margin-top: 4px; overflow: hidden; color: var(--ink-3); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
.summary-main .summary-id { margin-top: 1px; font-family: ui-monospace, 'SF Mono', Consolas, monospace; }
.summary-status { display: inline-flex; align-items: center; gap: 4px; color: var(--ink-3); font-size: 10px; font-weight: 400; }
.summary-status.online { color: var(--success); }
.summary-status.online .status-dot { background: var(--success); }
.summary-edit { display: grid; flex: 0 0 auto; width: 30px; height: 30px; place-items: center; padding: 0; color: var(--ink-2); cursor: pointer; background: var(--surface-muted); border: 0; border-radius: 8px; }
.summary-edit:hover { color: var(--ink); background: var(--surface-control); }
.contact-actions { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; padding: 0 16px 12px; }
.contact-actions button { min-width: 0; padding: 8px 10px; text-align: left; cursor: pointer; background: var(--surface-muted); border: 0; border-radius: 8px; }
.contact-actions button:hover:not(:disabled) { background: var(--surface-control); }
.contact-actions button:disabled { cursor: default; }
.contact-actions span { display: block; color: var(--ink-3); font-size: 10px; }
.contact-actions b { display: block; margin-top: 2px; overflow: hidden; color: var(--ink); font-size: 11px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.customer-meta { display: flex; flex-wrap: wrap; gap: 4px 12px; padding: 0 16px 12px; border-bottom: 1px solid var(--line); color: var(--ink-3); font-size: 11px; }
.customer-meta .meta-remark { flex-basis: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.visit-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px 12px; padding: 0 16px 16px; }
.visit-grid > div { min-width: 0; }
.visit-grid span { display: block; margin-bottom: 2px; color: var(--ink-3); font-size: 10px; }
.visit-grid b { display: block; overflow-wrap: anywhere; color: var(--ink); font-size: 12px; font-weight: 500; line-height: 1.4; }
.visit-grid .is-wide { grid-column: 1 / -1; }
.info-section + .info-section { border-top: 1px solid var(--line); }
.info-section > header { display: flex; align-items: center; justify-content: space-between; padding: 13px 16px; cursor: pointer; }
.info-section h3 { margin: 0; font-size: 13px; font-weight: 600; }
.section-tools { display: flex; align-items: center; gap: 10px; }
.edit-btn { padding: 0; color: var(--info-ink); font: inherit; font-size: 11px; cursor: pointer; background: transparent; border: 0; }
.chevron { width: 7px; height: 7px; border-right: 1.5px solid var(--ink-3); border-bottom: 1.5px solid var(--ink-3); transform: rotate(45deg); transition: transform 0.15s ease; }
.chevron.open { transform: rotate(-135deg); }
.info-section dl { display: grid; grid-template-columns: 76px minmax(0, 1fr); gap: 8px 10px; margin: 0; padding: 0 16px 16px; font-size: 12px; }
.info-section dt { color: var(--ink-3); }
.info-section dd { min-width: 0; margin: 0; color: var(--ink); overflow-wrap: anywhere; }
.info-section dd.mono { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 11px; }
.info-section dd.break { line-height: 1.45; word-break: break-all; }
.recent-list { display: grid; gap: 2px; padding: 0 10px 10px; }
.recent-item { display: grid; gap: 4px; width: 100%; padding: 9px 8px; text-align: left; cursor: pointer; background: transparent; border: 0; border-radius: 8px; }
.recent-item:hover:not(:disabled) { background: #f5f5f5; }
.recent-item:disabled { cursor: default; }
.recent-no-access { color: var(--ink-3); font-size: 11px; }
.recent-top { display: flex; align-items: center; gap: 6px; min-width: 0; }
.recent-top small { overflow: hidden; color: var(--ink); font-size: 12px; white-space: nowrap; text-overflow: ellipsis; }
.recent-bottom { display: flex; justify-content: space-between; gap: 8px; padding-left: 2px; color: var(--ink-3); font-size: 11px; }
.info-empty { margin: 0; padding: 4px 16px 16px; color: var(--ink-3); font-size: 12px; }
.toggle-list { display: grid; gap: 2px; padding: 0 16px 14px; }
.toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.toggle-row:last-of-type { border-bottom: 0; }
.toggle-row b { display: block; font-size: 12px; font-weight: 500; }
.toggle-row small { display: block; margin-top: 2px; color: var(--ink-3); font-size: 11px; line-height: 1.4; }
.select-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 10px; color: var(--ink-2); font-size: 12px; }
.select-row :deep(.el-select) { width: 122px; }
.notice-demo { display: grid; gap: 8px; margin-top: 12px; padding: 10px; background: #f7f7f8; border-radius: 10px; font-size: 11px; color: var(--ink-3); }
.notice-demo > div { display: flex; gap: 6px; }
.client-preview { overflow: hidden; background: #f5f5f5; border: 1px solid var(--line); border-radius: 14px; }
.client-preview > header { display: flex; gap: 10px; align-items: center; padding: 12px 14px; background: #fff; border-bottom: 1px solid var(--line); }
.client-preview > header > i { display: grid; width: 34px; height: 34px; place-items: center; font-style: normal; font-weight: 600; border-radius: 50%; }
.client-preview > header b { display: block; font-size: 13px; }
.client-preview > header small { display: block; margin-top: 2px; color: var(--ink-3); font-size: 11px; }
.client-messages { display: flex; flex-direction: column; gap: 2px; max-height: 360px; padding: 12px; overflow: auto; }
.client-messages::before { content: ''; margin-top: auto; }
.client-system { align-self: center; margin: 8px 0; color: var(--ink-3); font-size: 10px; text-align: center; }
.client-msg { display: flex; gap: 6px; align-items: flex-end; margin: 6px 0; }
.client-msg.agent, .client-msg.ai { flex-direction: row-reverse; }
.client-msg > i { position: relative; display: grid; flex: 0 0 auto; width: 24px; height: 24px; place-items: center; font-size: 10px; font-style: normal; font-weight: 600; border-radius: 50%; }
.client-bubble { max-width: 78%; padding: 7px 10px; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
.client-msg.agent .client-bubble, .client-msg.ai .client-bubble { background: var(--agent-surface, #f2f0fe); border-color: #e6e2fb; }
.client-bubble span { display: block; color: var(--ink-3); font-size: 10px; }
.client-bubble p { margin: 3px 0 0; font-size: 12px; line-height: 1.5; }
.client-image { display: block; max-width: 200px; max-height: 160px; margin-top: 4px; border-radius: 8px; object-fit: cover; }
.client-file { display: inline-block; margin-top: 4px; padding: 4px 8px; color: var(--ink-2); font-size: 11px; background: rgb(19 19 23 / 6%); border-radius: 6px; }
.client-bubble em { display: block; margin-top: 5px; padding-top: 5px; color: var(--ink-2); font-size: 11px; font-style: normal; border-top: 1px dashed rgb(19 19 23 / 12%); }
.client-empty { padding: 24px; color: var(--ink-3); font-size: 11px; text-align: center; }
.client-preview > footer { padding: 9px 14px; color: var(--ink-3); font-size: 10px; line-height: 1.5; background: #fff; border-top: 1px solid var(--line); }
.edit-form { display: grid; gap: 12px; }
.edit-form label { display: grid; gap: 6px; color: var(--ink-2); font-size: 13px; }

@media (max-width: 1440px) {
  .inbox-page { --detail-width: 288px; grid-template-columns: 176px minmax(0, 1fr) var(--detail-width); }
  .workspace-card { grid-template-columns: 260px minmax(0, 1fr); }
}
@media (max-width: 1366px) {
  .inbox-page { grid-template-columns: 168px minmax(0, 1fr); }
  .workspace-card { grid-template-columns: 252px minmax(0, 1fr); }
  .inbox-page .info-card { margin: 0; }
  .info-card { position: fixed; top: calc(var(--ui-header-height, 48px) + 8px); right: 8px; bottom: 8px; z-index: 30; display: none; width: 316px; margin: 0; box-shadow: 0 18px 40px rgb(19 19 23 / 14%); }
  .info-card.is-open { display: flex; }
  .info-card :deep(.head-icon.is-collapse) { display: none; }
  .info-toggle { display: inline-flex; }
  .info-card-close.is-visible { position: fixed; top: calc(var(--ui-header-height, 48px) + 19px); right: 16px; z-index: 31; display: grid; width: 24px; height: 24px; padding: 0; place-items: center; color: var(--ink-2); font-size: 16px; line-height: 1; cursor: pointer; background: transparent; border: 0; border-radius: 6px; }
  .info-card-close.is-visible:hover { color: var(--ink); background: #f5f5f5; }
}
@media (max-width: 860px) {
  .inbox-page { grid-template-columns: minmax(0, 1fr); }
  .workspace-card { grid-template-columns: 236px minmax(0, 1fr); }
  .group-rail { display: none; }
}
</style>
