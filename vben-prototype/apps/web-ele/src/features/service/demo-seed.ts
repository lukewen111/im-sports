import type { ChannelType } from '../channels/channel-data';
import { DEFAULT_TEAM_ID } from '../team/team-constants';
import type {
  DemoAccessInfo,
  DemoAttachment,
  DemoCustomer,
  DemoMessage,
  DemoSession,
  SessionStatus,
  SystemEventType,
} from './demo-store';
import banNoticeShot from '../../assets/demo-media/ban-notice.jpg';
import disconnectCover from '../../assets/demo-media/disconnect-cover.jpg';
import disconnectVideo from '../../assets/demo-media/disconnect.mp4';
import gameErrorShot from '../../assets/demo-media/game-error.jpg';
import giftCodeShot from '../../assets/demo-media/gift-code.jpg';
import rechargeOrderShot from '../../assets/demo-media/recharge-order.jpg';

/* ----------------------------------------------------------------------------
 * 固定种子与时间基准
 * - 所有展示数据由固定 seed 的伪随机序列 + 相对分钟偏移生成，不使用 Math.random()。
 * - 时间基准只在种子生成时取一次，生成结果写入 localStorage；刷新后读取同一份数据。
 * -------------------------------------------------------------------------- */
const createRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
};

const seededValue = (seed: number, min: number, max: number) => {
  const rng = createRandom(seed);
  return min + Math.floor(rng() * (max - min + 1));
};

const BASE_TIME = Date.now();
const at = (minutesAgo: number) => new Date(BASE_TIME - Math.max(0, minutesAgo) * 60_000).toISOString();

/** 会话列表要同时出现今天 / 昨天 / 本年更早 / 去年四种时间格式，因此用日历日定位而不是随机偏移。 */
const startOfToday = () => {
  const date = new Date(BASE_TIME);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};
const minutesAgoOf = (time: number) => Math.max(1, Math.round((BASE_TIME - time) / 60_000));
const dayAgo = (days: number, hour: number, minute = 0) => {
  const date = new Date(startOfToday());
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return minutesAgoOf(date.getTime());
};
const dateInYear = (yearOffset: number, month: number, day: number, hour: number, minute = 0) => {
  const date = new Date(BASE_TIME);
  date.setFullYear(date.getFullYear() - yearOffset, month - 1, day);
  date.setHours(hour, minute, 0, 0);
  return minutesAgoOf(date.getTime());
};

/* ----------------------------------------------------------------------------
 * 会话脚本：gap 为相邻消息相对间隔，按 spanMinutes 等比缩放。
 * -------------------------------------------------------------------------- */
interface TextStep {
  attachment?: DemoMessage['attachment'];
  content: string;
  failed?: boolean;
  gap: number;
  id?: string;
  kind?: DemoMessage['kind'];
  language?: string;
  role: 'agent' | 'ai' | 'customer';
  translation?: string;
}

interface SystemStep {
  content: string;
  extra?: Partial<DemoMessage>;
  gap: number;
  type: SystemEventType;
}

type DialogStep = SystemStep | TextStep;

const customerStep = (gap: number, content: string, extra: Partial<TextStep> = {}): TextStep => ({
  content, gap, role: 'customer', ...extra,
});
const agentStep = (gap: number, content: string, extra: Partial<TextStep> = {}): TextStep => ({
  content, gap, role: 'agent', ...extra,
});
const aiStep = (gap: number, content: string, extra: Partial<TextStep> = {}): TextStep => ({
  content, gap, role: 'ai', ...extra,
});
const systemStep = (gap: number, type: SystemEventType, content: string, extra: Partial<DemoMessage> = {}): SystemStep => ({
  content, extra, gap, type,
});
const endedStep = (gap = 2): SystemStep => systemStep(gap, 'ended', '会话结束');
const pendingStep = (gap = 0): SystemStep => systemStep(gap, 'pending', '进入待分配');
const reassignedStep = (gap: number, memberId: string, memberName: string): SystemStep => systemStep(
  gap, 'assigned', `已分配给 ${memberName}`, { senderId: memberId, senderName: memberName },
);
const transferStep = (gap: number, memberId: string, memberName: string, reason: string): SystemStep => systemStep(
  gap, 'assigned', `转接人工客服 · ${memberName}（${reason}）`, { senderId: memberId, senderName: memberName },
);

/* 种子媒体统一走本地素材：截图来自 src/assets/demo-media，视频为 3 秒可播放 mp4 */
const SHOTS = {
  ban: { name: '封禁通知截图.jpg', url: banNoticeShot },
  error: { name: '游戏报错截图.jpg', url: gameErrorShot },
  gift: { name: '礼包码兑换失败.jpg', url: giftCodeShot },
  order: { name: '充值订单截图.jpg', url: rechargeOrderShot },
};
const VIDEO_ASSET = {
  coverUrl: disconnectCover,
  durationSec: 3,
  height: 720,
  name: '掉线录屏.mp4',
  url: disconnectVideo,
  width: 1280,
};
const shotKeyOf = (name: string) => {
  if (/封禁|申诉|身份|户口本/.test(name)) return 'ban' as const;
  if (/礼包|兑换|gift|奖励|活动/i.test(name)) return 'gift' as const;
  if (/网络|延迟|黑屏|登录|挂机|贴图|错误|报错|闪退|版本|更新|对局/.test(name)) return 'error' as const;
  return 'order' as const;
};
const image = (name: string, size?: number, type = 'image/jpeg'): DemoAttachment => {
  const shot = SHOTS[shotKeyOf(name)];
  return { height: 909, kind: 'image', name: shot.name, size, type, url: shot.url, width: 720 };
};
const file = (name: string, size?: number, type = 'application/pdf'): DemoAttachment => {
  if (type.startsWith('video/') || name.endsWith('.mp4')) {
    const summary = /外挂/.test(name)
      ? '对局录像：可疑角色连续穿墙攻击，疑似外挂。'
      : /闪退/.test(name)
        ? '闪退录屏：进入对局约 10 秒后客户端直接退出。'
        : '掉线录屏：团战中画面卡住，网络连接中断后掉出对局。';
    return { ...VIDEO_ASSET, kind: 'video', name, size, summary, type: 'video/mp4' };
  }
  if (type.startsWith('image/')) return image(name, size, type);
  // PDF / ZIP 等文件按通用附件展示，避免把“申诉材料.zip”渲染成截图。
  return { name, size, type };
};

/* ----------------------------------------------------------------------------
 * 客户资料：玩家昵称、真实城市、以手机为主
 * -------------------------------------------------------------------------- */
interface CustomerSeedInput {
  browser: string;
  channelId: string;
  channelType: ChannelType;
  device: string;
  durationSeconds?: number;
  email: string;
  firstVisitAgo: number;
  id: string;
  lastVisitAgo: number;
  name: string;
  os: string;
  phone: string;
  referrer: string;
  region: string;
  remark: string;
  seed: number;
  visitCount: number;
}

const makeCustomer = (input: CustomerSeedInput): DemoCustomer => {
  const accessInfo: DemoAccessInfo = {
    browser: input.browser,
    device: input.device,
    durationSeconds: input.durationSeconds ?? seededValue(input.seed, 90, 900),
    ip: `203.0.113.${seededValue(input.seed + 1, 10, 250)}`,
    os: input.os,
    referrer: input.referrer,
  };
  return {
    accessInfo,
    avatar: undefined,
    device: input.device,
    email: input.email,
    firstVisitAt: at(input.firstVisitAgo),
    id: input.id,
    lastActive: at(input.lastVisitAgo),
    lastVisitAt: at(input.lastVisitAgo),
    name: input.name,
    phone: input.phone,
    region: input.region,
    remark: input.remark,
    sourceChannelId: input.channelId,
    sourceChannelType: input.channelType,
    visitCount: input.visitCount,
  };
};

const WEB_WIDGET = 'channel-web-widget-main' as const;
const CHAT_PAGE = 'channel-chat-page-support' as const;
const TELEGRAM = 'channel-telegram-payment' as const;
const GAME_SITE = 'https://support.imsports.game';

export const seedCustomers: DemoCustomer[] = [
  makeCustomer({ browser: 'Safari 18', channelId: WEB_WIDGET, channelType: 'web-widget', device: '移动端', durationSeconds: 640, email: 'yefeng@game.example.com', firstVisitAgo: 4320, id: 'customer-10001', lastVisitAgo: 3, name: '夜风', os: 'iOS 18', phone: '138****1024', referrer: `${GAME_SITE}/recharge`, region: '中国·上海', remark: 'iOS 区服 1024 · 充值未到账', seed: 1001, visitCount: 4 }),
  makeCustomer({ browser: 'Chrome 128', channelId: CHAT_PAGE, channelType: 'chat-page', device: '移动端', durationSeconds: 130, email: '', firstVisitAgo: 22, id: 'customer-10002', lastVisitAgo: 5, name: '奶茶三分糖', os: 'Android 14', phone: '', referrer: `${GAME_SITE}/gift`, region: '中国·杭州', remark: '礼包码兑换失败 · 待接待', seed: 1002, visitCount: 1 }),
  makeCustomer({ browser: 'Telegram 11.2', channelId: TELEGRAM, channelType: 'telegram', device: '移动端', durationSeconds: 0, email: '', firstVisitAgo: 1440, id: 'customer-10003', lastVisitAgo: dayAgo(1, 21, 45), name: '阿哲', os: 'iOS 18', phone: '', referrer: '', region: '中国·广州', remark: '封禁申诉 · 已结案', seed: 1003, visitCount: 2 }),
  makeCustomer({ browser: 'Edge 126', channelId: WEB_WIDGET, channelType: 'web-widget', device: '桌面端', durationSeconds: 420, email: 'xiaoming@game.example.com', firstVisitAgo: 8000, id: 'customer-10004', lastVisitAgo: 20, name: '小明同学', os: 'Windows 11', phone: '139****5678', referrer: `${GAME_SITE}/refund`, region: '中国·北京', remark: '未成年人退款 · 监护材料已提交', seed: 1004, visitCount: 3 }),
  makeCustomer({ browser: 'Telegram 11', channelId: TELEGRAM, channelType: 'telegram', device: '移动端', durationSeconds: 0, email: '', firstVisitAgo: 600, id: 'customer-10005', lastVisitAgo: 48, name: 'Nok', os: 'Android 14', phone: '', referrer: '', region: '泰国·曼谷', remark: '泰国玩家 · 充值未到账', seed: 1005, visitCount: 1 }),
  makeCustomer({ browser: 'Chrome 127', channelId: WEB_WIDGET, channelType: 'web-widget', device: '桌面端', durationSeconds: 300, email: 'laowang@game.example.com', firstVisitAgo: 10080, id: 'customer-10006', lastVisitAgo: 8, name: '老王', os: 'Windows 11', phone: '137****2210', referrer: `${GAME_SITE}/download`, region: '中国·成都', remark: '版本更新闪退 · 跟进中', seed: 1006, visitCount: 5 }),
  makeCustomer({ browser: 'Safari 18', channelId: CHAT_PAGE, channelType: 'chat-page', device: '移动端', durationSeconds: 180, email: 'xiaobei@game.example.com', firstVisitAgo: 7200, id: 'customer-10007', lastVisitAgo: dayAgo(3, 14, 20), name: '小北', os: 'iOS 17', phone: '135****6644', referrer: `${GAME_SITE}/account`, region: '中国·武汉', remark: '换绑手机号 · 已完成验证', seed: 1007, visitCount: 2 }),
  makeCustomer({ browser: 'Chrome 127', channelId: WEB_WIDGET, channelType: 'web-widget', device: '移动端', durationSeconds: 520, email: 'suda@game.example.com', firstVisitAgo: 4320, id: 'customer-10008', lastVisitAgo: dayAgo(2, 21, 10), name: '苏打水', os: 'Android 13', phone: '136****7788', referrer: `${GAME_SITE}/activity`, region: '中国·南京', remark: '活动奖励未发放 · 区服 305', seed: 1008, visitCount: 5 }),
  makeCustomer({ browser: 'Chrome 128', channelId: WEB_WIDGET, channelType: 'web-widget', device: '移动端', durationSeconds: 410, email: 'an.nguyen@game.example.com', firstVisitAgo: 7200, id: 'customer-10009', lastVisitAgo: 31, name: 'An Nguyễn', os: 'Android 14', phone: '', referrer: `${GAME_SITE}/recharge`, region: '越南·胡志明市', remark: '越南玩家 · 充值未到账', seed: 1009, visitCount: 2 }),
  makeCustomer({ browser: 'Safari 18', channelId: CHAT_PAGE, channelType: 'chat-page', device: '移动端', durationSeconds: 160, email: 'shisan@game.example.com', firstVisitAgo: 5760, id: 'customer-10010', lastVisitAgo: dayAgo(1, 18, 5), name: '十三', os: 'iOS 16', phone: '133****9900', referrer: `${GAME_SITE}/chat`, region: '中国·重庆', remark: '掉线严重 · 区服 2008', seed: 1010, visitCount: 2 }),
  makeCustomer({ browser: 'Chrome 126', channelId: WEB_WIDGET, channelType: 'web-widget', device: '桌面端', durationSeconds: 380, email: 'ali@game.example.com', firstVisitAgo: 9000, id: 'customer-10011', lastVisitAgo: dayAgo(5, 10, 30), name: '阿狸', os: 'Windows 10', phone: '', referrer: `${GAME_SITE}/report`, region: '中国·苏州', remark: '外挂举报 · 录像已上传', seed: 1011, visitCount: 4 }),
  makeCustomer({ browser: 'Chrome 128', channelId: CHAT_PAGE, channelType: 'chat-page', device: '移动端', durationSeconds: 75, email: 'kekele@game.example.com', firstVisitAgo: 19, id: 'customer-10012', lastVisitAgo: 19, name: '可乐加冰', os: 'Android 13', phone: '', referrer: `${GAME_SITE}/gift`, region: '中国·天津', remark: '礼包码失效 · 待分配', seed: 1012, visitCount: 1 }),
  makeCustomer({ browser: 'Telegram 11', channelId: TELEGRAM, channelType: 'telegram', device: '移动端', durationSeconds: 0, email: 'emily@game.example.com', firstVisitAgo: 6000, id: 'customer-10013', lastVisitAgo: 28, name: 'Emily', os: 'iOS 18', phone: '', referrer: '', region: '新加坡', remark: 'English player · 礼包码兑换失败', seed: 1013, visitCount: 3 }),
  makeCustomer({ browser: 'Telegram 10.9', channelId: TELEGRAM, channelType: 'telegram', device: '移动端', durationSeconds: 0, email: '', firstVisitAgo: 1560, id: 'customer-10014', lastVisitAgo: 36, name: '糖不甜', os: 'Android 14', phone: '', referrer: '', region: '中国·福州', remark: '活动奖励未到账 · 七夕活动', seed: 1014, visitCount: 2 }),
  makeCustomer({ browser: 'Chrome 127', channelId: CHAT_PAGE, channelType: 'chat-page', device: '桌面端', durationSeconds: 205, email: 'laok@game.example.com', firstVisitAgo: 3900, id: 'customer-10015', lastVisitAgo: 44, name: '老K', os: 'Windows 11', phone: '', referrer: `${GAME_SITE}/login`, region: '中国·西安', remark: '登录不上 · 二次验证收不到码', seed: 1015, visitCount: 2 }),
  makeCustomer({ browser: 'Safari 18', channelId: CHAT_PAGE, channelType: 'chat-page', device: '移动端', durationSeconds: 260, email: 'xiaolu@game.example.com', firstVisitAgo: 5100, id: 'customer-10016', lastVisitAgo: 33, name: '小鹿', os: 'iOS 18', phone: '', referrer: `${GAME_SITE}/refund`, region: '中国·长沙', remark: '未成年退款 · 家长来电', seed: 1016, visitCount: 3 }),
  makeCustomer({ browser: 'Telegram 11.1', channelId: TELEGRAM, channelType: 'telegram', device: '移动端', durationSeconds: 0, email: '', firstVisitAgo: 1300, id: 'customer-10017', lastVisitAgo: 61, name: '钢铁直男', os: 'Android 14', phone: '', referrer: '', region: '中国·青岛', remark: '举报队友挂机 · 排位赛', seed: 1017, visitCount: 1 }),
  makeCustomer({ browser: 'Telegram 11', channelId: TELEGRAM, channelType: 'telegram', device: '移动端', durationSeconds: 0, email: 'mai.tran@game.example.com', firstVisitAgo: 2700, id: 'customer-10018', lastVisitAgo: dayAgo(1, 16, 20), name: 'Mai Trần', os: 'iOS 18', phone: '', referrer: '', region: '越南·河内', remark: '越南玩家 · 封禁申诉', seed: 1018, visitCount: 2 }),
  makeCustomer({ browser: 'Chrome 128', channelId: WEB_WIDGET, channelType: 'web-widget', device: '移动端', durationSeconds: 340, email: 'yiketang@game.example.com', firstVisitAgo: 4200, id: 'customer-10019', lastVisitAgo: 39, name: '一颗糖', os: 'Android 13', phone: '', referrer: `${GAME_SITE}/download`, region: '中国·合肥', remark: '版本更新黑屏 · 区服 120', seed: 1019, visitCount: 2 }),
  makeCustomer({ browser: 'Safari 18', channelId: CHAT_PAGE, channelType: 'chat-page', device: '移动端', durationSeconds: 55, email: 'awei@game.example.com', firstVisitAgo: 40, id: 'customer-10020', lastVisitAgo: 40, name: '阿伟', os: 'iOS 18', phone: '', referrer: `${GAME_SITE}/account`, region: '中国·厦门', remark: '账号找回 · 待分配', seed: 1020, visitCount: 1 }),
];

/* ----------------------------------------------------------------------------
 * 会话构建
 * -------------------------------------------------------------------------- */
interface ActorConfig {
  agentId?: string;
  agentName?: string;
  aiId?: string;
  aiName?: string;
}

const OWNER: ActorConfig = { agentId: 'member-owner', agentName: '卢森堡' };
const SOPHIE: ActorConfig = { agentId: 'member-sophie', agentName: '苏菲' };
const CHENYI: ActorConfig = { agentId: 'member-chenyi', agentName: '陈一' };
const AI_SALES: ActorConfig = { aiId: 'member-ai-sales', aiName: '小麦' };
/** 米卡属于售后团队且当前离线：只承接历史已结束会话，用来覆盖团队筛选与离线成员样本。 */
const MIKA: ActorConfig = { agentId: 'member-mika', agentName: '米卡' };

const buildMessage = (sessionId: string, step: TextStep, sentAt: string, index: number, actor: ActorConfig): DemoMessage => {
  const isAi = step.role === 'ai';
  const isAgent = step.role === 'agent';
  const language = step.language || '简体中文';
  const attachmentKind = step.attachment?.kind;
  const kind = step.kind || (step.attachment
    ? (attachmentKind === 'video' ? 'video' : attachmentKind === 'image' ? 'image' : 'attachment')
    : 'text');
  const content = step.content || (step.attachment?.kind === 'video' ? step.attachment.summary || '玩家上传了一段录屏。' : '');
  // 种子只预置译文缓存，不写 translatedBy：进入会话先看原文，手动翻译命中缓存即出
  const translations = step.translation && language !== '简体中文'
    ? { 简体中文: { generated: false, sourceLanguage: language, targetLanguage: '简体中文', text: step.translation, translatedAt: sentAt } }
    : undefined;
  return {
    attachment: step.attachment,
    content,
    id: step.id || `${sessionId}-m${index}`,
    kind,
    originalLanguage: language,
    role: step.role,
    senderId: isAi ? actor.aiId : isAgent ? actor.agentId : undefined,
    senderName: isAi ? actor.aiName : isAgent ? actor.agentName : undefined,
    sentAt,
    status: step.failed ? 'failed' : 'sent',
    success: !step.failed,
    translations,
  };
};

const buildSystemMessage = (id: string, type: SystemEventType, content: string, sentAt: string, extra: Partial<DemoMessage> = {}): DemoMessage => {
  const message: DemoMessage = { content, eventType: type, id, kind: 'system', role: 'system', sentAt, success: true, ...extra };
  if (type === 'ended') message.endedAt = sentAt;
  return message;
};

interface BuiltDialog {
  createdAt: string;
  endedAt?: string;
  firstResponseAt?: string;
  lastMessageAt: string;
  messages: DemoMessage[];
  queueEnteredAt?: string;
}

/** 按相对间隔生成对话；finalAgo 即最后一步距离现在的分钟数。 */
const buildDialog = (sessionId: string, finalAgo: number, spanMinutes: number, steps: DialogStep[], actor: ActorConfig): BuiltDialog => {
  const totalGap = steps.reduce((sum, step) => sum + Math.max(0, step.gap), 0);
  const scale = totalGap > 0 ? spanMinutes / totalGap : 0;
  let cursor = finalAgo + spanMinutes;
  const messages: DemoMessage[] = [buildSystemMessage(`${sessionId}-sys-start`, 'session-start', '会话开始', at(cursor))];
  let endedAt: string | undefined;
  let firstResponseAt: string | undefined;
  let queueEnteredAt: string | undefined;
  let index = 1;
  for (const step of steps) {
    cursor -= Math.max(0, step.gap) * scale;
    const sentAt = at(cursor);
    if ('type' in step) {
      messages.push(buildSystemMessage(`${sessionId}-sys-${step.type}-${index}`, step.type, step.content, sentAt, step.extra));
      if (step.type === 'ended') endedAt = sentAt;
      if (step.type === 'pending') queueEnteredAt = sentAt;
    } else {
      messages.push(buildMessage(sessionId, step, sentAt, index, actor));
      if (!firstResponseAt && (step.role === 'agent' || step.role === 'ai')) firstResponseAt = sentAt;
    }
    index += 1;
  }
  return { createdAt: at(finalAgo + spanMinutes), endedAt, firstResponseAt, lastMessageAt: at(finalAgo), messages, queueEnteredAt };
};

interface SessionSeedInput {
  actor?: ActorConfig;
  assignee?: { id: string; kind: 'ai' | 'human' };
  channelId: string;
  channelType: ChannelType;
  customerId: string;
  endedReason?: string;
  everAssigned?: boolean;
  finalAgo: number;
  id: string;
  participants?: string[];
  spanMinutes: number;
  startUrl?: string;
  status: SessionStatus;
  steps: DialogStep[];
  teamId: string;
  unread?: number;
}

const defaultStartUrl = (channelType: ChannelType, customerId: string) => {
  if (channelType === 'chat-page') return `${GAME_SITE}/chat`;
  if (channelType === 'telegram') return undefined;
  return seedCustomers.find((customer) => customer.id === customerId)?.accessInfo?.referrer || GAME_SITE;
};

const buildSession = (input: SessionSeedInput): DemoSession => {
  const dialog = buildDialog(input.id, input.finalAgo, input.spanMinutes, input.steps, input.actor || {});
  const customer = seedCustomers.find((item) => item.id === input.customerId);
  return {
    accessInfo: customer?.accessInfo ? { ...customer.accessInfo } : undefined,
    assigneeId: input.assignee?.id,
    assigneeKind: input.assignee?.kind,
    channelId: input.channelId,
    channelType: input.channelType,
    createdAt: dialog.createdAt,
    customerId: input.customerId,
    endedAt: dialog.endedAt,
    endedReason: input.endedReason,
    everAssigned: input.everAssigned ?? Boolean(input.assignee),
    firstResponseAt: dialog.firstResponseAt,
    id: input.id,
    messages: dialog.messages,
    originChannelId: input.channelId,
    participants: input.participants ?? (input.assignee ? [input.assignee.id] : []),
    queueEnteredAt: dialog.queueEnteredAt,
    startedAt: dialog.createdAt,
    startUrl: input.startUrl ?? defaultStartUrl(input.channelType, input.customerId),
    status: input.status,
    teamId: input.teamId,
    unread: input.unread ?? 0,
  };
};

const WEB = { channelId: WEB_WIDGET, channelType: 'web-widget' as ChannelType, teamId: DEFAULT_TEAM_ID };
const CHAT = { channelId: CHAT_PAGE, channelType: 'chat-page' as ChannelType, teamId: DEFAULT_TEAM_ID };
const TG = { channelId: TELEGRAM, channelType: 'telegram' as ChannelType, teamId: '100002' };

const owner = { id: 'member-owner', kind: 'human' as const };
const sophie = { id: 'member-sophie', kind: 'human' as const };
const chenyi = { id: 'member-chenyi', kind: 'human' as const };
const aiSales = { id: 'member-ai-sales', kind: 'ai' as const };
const mika = { id: 'member-mika', kind: 'human' as const };

/* ---------------------- 工单脚本：充值未到账 / 订单失败 ---------------------- */
interface RechargeContext {
  amount: string;
  channel: string;
  orderNo: string;
  server: string;
}
const rechargeSteps = ({ amount, channel, orderNo, server }: RechargeContext): DialogStep[] => [
  customerStep(0.5, '在吗？刚充的钻石一直没到账，等着抽卡呢😭'),
  agentStep(1.1, '您好，在的。麻烦发一下充值订单号，或者支付成功的截图，我帮您查。'),
  customerStep(0.6, `订单号 ${orderNo}，${channel}付的 ${amount}。`),
  customerStep(0.3, '', { attachment: image(`order-${orderNo.replace('RC', '')}.png`, 402_118) }),
  agentStep(1.2, '收到，稍等我查一下这笔订单。'),
  agentStep(1.1, `查到了，${server} 这笔支付成功，但发货回调还没回来，属于渠道延迟。`),
  customerStep(0.5, '要等多久啊，活动今晚 12 点就结束了'),
  agentStep(1, '常规 10 分钟内会补发，我先给您登记加急。'),
  customerStep(0.5, '已经等了快四十分钟了……'),
  agentStep(1.2, '不好意思，我这边提交工单给充值组核实，预计 24 小时内回复。'),
  customerStep(0.6, '能不能快一点，我抽卡券还没用'),
  agentStep(1, '已备注活动截止时间，充值组会优先处理。'),
  customerStep(0.4, '好，那我等消息'),
  agentStep(1, `工单号 RC-${orderNo.slice(-8)}，有结果我第一时间在这里同步。`),
  customerStep(0.4, '', { attachment: file('充值记录.pdf', 226_511) }),
  customerStep(0.5, '这是我的支付记录，你看下对不对'),
  agentStep(1.1, '核对一致，金额和订单号都对得上。'),
  customerStep(0.5, '👍', { kind: 'emoji' }),
  agentStep(0.6, '到账前别重复下单，避免重复扣款。'),
];

/* ---------------------- 工单脚本：账号封禁申诉 ---------------------- */
interface BanContext {
  reason: string;
  server: string;
  uid: string;
}
const banAppealSteps = ({ reason, server, uid }: BanContext): DialogStep[] => [
  customerStep(0.5, '我的号怎么被封了？昨天还在打排位'),
  agentStep(1, '您好，请提供游戏 ID 和区服，我帮您查封禁记录。'),
  customerStep(0.6, `ID ${uid}，${server} 的`),
  agentStep(1.1, '稍等，我查一下。'),
  agentStep(1, `查到账号在 11 月 2 日因「${reason}」被临时封禁 7 天。`),
  customerStep(0.5, '我什么都没干啊，是不是误封'),
  customerStep(0.3, '', { attachment: image(`封禁截图-${uid}.jpg`, 518_204, 'image/jpeg') }),
  agentStep(1.1, '系统检测到异常登录和第三方插件记录，不是误封。'),
  customerStep(0.5, '我就用了个加速器，这也算外挂吗'),
  agentStep(1.1, '加速器类工具会注入客户端进程，按规则属于第三方软件。'),
  customerStep(0.5, '那我申诉要准备什么'),
  agentStep(1, '需要本人手持身份证照片、常用设备型号和最近一次登录时间。'),
  customerStep(0.4, '身份证照片和手机信息都在这了'),
  customerStep(0.3, '', { attachment: file(`申诉材料-${uid}.zip`, 3_942_118, 'application/zip') }),
  agentStep(1.2, '材料收到了，我提交申诉工单，预计 3 个工作日内出结果。'),
  customerStep(0.5, '能不能解封，我这个号充了不少钱'),
  agentStep(1, '封禁期内的充值无法退还，申诉结果会短信通知。'),
  customerStep(0.4, '好吧，麻烦尽快'),
  agentStep(0.8, '已提交工单，有结果我在这里回复您。'),
];

/* ---------------------- 工单脚本：活动奖励未发放 ---------------------- */
interface ActivityContext {
  activity: string;
  claimDate: string;
  uid: string;
}
const activityRewardSteps = ({ activity, claimDate, uid }: ActivityContext): DialogStep[] => [
  customerStep(0.5, `${activity}的奖励到现在没发，我 ${claimDate} 就集齐了`),
  agentStep(1, '您好，请提供活动名称、领取时间和角色 ID，我帮您核对。'),
  customerStep(0.6, `活动叫「${activity}」，${claimDate} 领的，ID ${uid}`),
  agentStep(1.2, '稍等，我查一下活动发放记录。'),
  agentStep(1.1, '查到您已经满足任务条件，但这批奖励里没有您的记录。'),
  customerStep(0.5, '啥意思，白做了？'),
  agentStep(1, '可能是发放时区服同步延迟，我提交补发申请。'),
  customerStep(0.4, '', { attachment: image(`奖励领取截图-${uid}.jpg`, 462_330, 'image/jpeg') }),
  agentStep(1.1, '截图收到，任务进度和领取时间都能看到，可以作为凭证。'),
  customerStep(0.5, '大概多久补'),
  agentStep(1, '补发一般 1-2 个工作日，到账会有游戏内邮件通知。'),
  customerStep(0.5, '我朋友当天就收到了'),
  agentStep(1.1, '不同区服发放批次不同，您这个区服确实晚一批。'),
  customerStep(0.4, '好吧'),
  agentStep(1, `已提交补发工单，单号 AC-${uid}。`),
  customerStep(0.5, '有结果记得说一声'),
  agentStep(0.8, '会的，到账我第一时间通知您。'),
  customerStep(0.4, '谢谢'),
  agentStep(0.6, '不客气，抱歉让您多等了两天。'),
];

/* ---------------------- 工单脚本：礼包码兑换失败 ---------------------- */
interface GiftCodeContext {
  code: string;
  error: string;
  server: string;
  usedServer: string;
}
const giftCodeSteps = ({ code, error, server, usedServer }: GiftCodeContext): DialogStep[] => [
  customerStep(0.5, '兑换码一直提示失败，是不是假的'),
  agentStep(1, '您好，把兑换码和提示内容发我，我帮您查。'),
  customerStep(0.6, `码是 ${code}，提示「${error}」`),
  agentStep(1.2, '稍等，我查一下这个码的状态。'),
  agentStep(1.1, `这个码是 11 月礼包批次，系统显示已在 ${usedServer} 使用过。`),
  customerStep(0.5, '我朋友用同一个码就成功了'),
  agentStep(1, '兑换码是一码一账号，您朋友用的可能是同批次另一个码。'),
  customerStep(0.5, '那我现在怎么办'),
  agentStep(1, `我这边查到码绑定在 ${usedServer}，不是您常玩的 ${server}。`),
  customerStep(0.6, '可能是之前切区服的时候误兑了'),
  agentStep(1, '兑换码不支持跨区转移，我可以帮您申请一次人工补发。'),
  customerStep(0.4, '', { attachment: image(`兑换失败截图-${code.slice(-4)}.png`, 388_442) }),
  agentStep(1.1, '截图已作为凭证提交，预计 24 小时内处理。'),
  customerStep(0.5, '能补发同样的礼包吗'),
  agentStep(1, '会按同批次礼包内容补发，具体以到账为准。'),
  customerStep(0.4, '好，麻烦了'),
  agentStep(1, `已提交工单 GC-${code.slice(-6)}，有结果我在这里回复。`),
  customerStep(0.4, '🙏', { kind: 'emoji' }),
  agentStep(0.6, '不客气，这个码先别再试了，避免锁定。'),
];

/* ---------------------- 工单脚本：掉线 / 卡顿 / 登录不上 ---------------------- */
const loginIssueSteps = (): DialogStep[] => [
  customerStep(0.5, '一直掉线，打团的时候直接卡出去了'),
  agentStep(1, '您好，方便说一下机型和网络吗？'),
  customerStep(0.6, 'iPhone 13，家里 Wi-Fi，区服 2008'),
  agentStep(1.1, '稍等，我查一下这个区服的运行状态。'),
  agentStep(1, '区服当前没有大面积故障，不过今晚刚做了版本热更。'),
  customerStep(0.5, '更新完就开始卡了'),
  agentStep(1, '建议先清理缓存，再切换 Wi-Fi 和流量试一下。'),
  customerStep(0.5, '都试了，还是掉', { failed: true }),
  agentStep(1, '您截图里延迟多少？'),
  customerStep(0.3, '', { attachment: image('网络延迟截图.png', 344_207) }),
  agentStep(1.1, '延迟 180ms 还丢包 12%，更像是本地网络问题。'),
  customerStep(0.5, '我玩别的游戏不卡'),
  agentStep(1, '那可能是这个区服节点离您较远，我帮您切到就近节点。'),
  customerStep(0.4, '怎么切'),
  agentStep(1, '在登录页右上角选「线路」→「自动选择」。'),
  customerStep(0.6, '好了，好像不掉了'),
  agentStep(1, '先观察一下，还有问题把发生时间发我。'),
  customerStep(0.4, '👌', { kind: 'emoji' }),
  agentStep(0.7, '我这边也登记一下，方便后续排查。'),
];

/* ---------------------- 工单脚本：账号找回 / 换绑手机 ---------------------- */
const rebindPhoneSteps = (): DialogStep[] => [
  customerStep(0.5, '我想换绑手机号，旧号停机了收不到验证码'),
  agentStep(1, '您好，换绑需要先验证身份，请提供游戏 ID 和注册手机号后四位。'),
  customerStep(0.6, 'ID 552104，尾号 8899'),
  agentStep(1.1, '稍等，我核对账号信息。'),
  agentStep(1, '账号实名信息一致，可以走人工换绑。'),
  customerStep(0.5, '要准备什么材料'),
  agentStep(1, '需要新手机号的实名证明和手持身份证照片。'),
  customerStep(0.4, '新号是我本人的，实名一样'),
  customerStep(0.3, '', { attachment: image('身份验证材料.jpg', 612_118, 'image/jpeg') }),
  agentStep(1.1, '材料收到了，我提交换绑工单。'),
  customerStep(0.5, '旧号已经注销了会不会有影响'),
  agentStep(1, '不影响，但换绑后 7 天内不能再次修改。'),
  customerStep(0.4, '好的'),
  agentStep(1, '另外提醒，换绑后需要重新绑定安全令牌。'),
  customerStep(0.5, '安全令牌是什么'),
  agentStep(1, '就是登录时的动态验证码，换绑后要重新绑定一次。'),
  customerStep(0.4, '明白了，麻烦快点'),
  agentStep(1, '工单已提交，预计 24 小时内完成，结果会短信通知。'),
];

/* ---------------------- 工单脚本：版本更新后异常 ---------------------- */
const versionUpdateSteps = (): DialogStep[] => [
  customerStep(0.5, '更新完新版本一直闪退，进不去游戏'),
  agentStep(1, '您好，说一下机型和系统版本，我帮您记录。'),
  customerStep(0.6, 'iPhone 15，iOS 18.2'),
  agentStep(1, '是更新后第一次启动就闪退吗？'),
  customerStep(0.5, '是的，看到登录界面就退了'),
  agentStep(1, '建议先卸载重装，注意提前绑定账号，避免游客数据丢失。'),
  customerStep(0.5, '重装了还是闪退'),
  agentStep(1, '麻烦发一下闪退录屏，我提交技术排查。'),
  customerStep(0.3, '', { attachment: file('闪退录屏.mp4', 7_842_330, 'video/mp4') }),
  agentStep(1.1, '收到，iPhone 15 在本次版本确实有兼容问题。'),
  customerStep(0.5, '什么时候能修'),
  agentStep(1, '技术已经在灰度修复，预计今晚热更。'),
  customerStep(0.5, '那我今天没法玩了'),
  agentStep(1, '可以先用云游戏入口登录，数据互通。'),
  customerStep(0.5, '云游戏在哪'),
  agentStep(1, '官网首页 → 云游戏 → 选择区服 1024。'),
  customerStep(0.6, '进去了，谢谢'),
  agentStep(1, '不客气，热更后正常客户端也能登录。'),
  customerStep(0.4, '热更装完还是闪退，又录了一段', { attachment: file('热更后闪退录屏.mp4', 7_842_330, 'video/mp4') }),
];

/* ---------------------- 工单脚本：未成年人充值退款 ---------------------- */
const minorRefundSteps = (): DialogStep[] => [
  customerStep(0.5, '我孩子拿我手机充了 648，能不能退'),
  agentStep(1, '您好，未成年人充值退款需要监护人发起，请提供订单号和孩子的年龄。'),
  customerStep(0.6, '订单号 RC202611031188，孩子 10 岁'),
  agentStep(1.2, '收到，我先说明流程：需要监护关系证明、充值记录和退款申请。'),
  customerStep(0.5, '身份证和户口本可以吗'),
  agentStep(1, '可以，户口本需要能看出监护关系。'),
  customerStep(0.3, '', { attachment: image('户口本-监护页.jpg', 724_118, 'image/jpeg') }),
  customerStep(0.3, '', { attachment: file('充值记录.pdf', 318_442) }),
  agentStep(1.2, '材料齐全，我提交未成年人退款工单。'),
  customerStep(0.5, '能全退吗'),
  agentStep(1, '已消耗的道具部分可能无法退还，具体以审核结果为准。'),
  customerStep(0.5, '他没怎么玩，就抽了几次卡'),
  agentStep(1.1, '审核会核对道具消耗记录，未消耗部分优先退款。'),
  customerStep(0.5, '大概多久'),
  agentStep(1, '审核周期 3-5 个工作日，结果会电话联系您。'),
  customerStep(0.4, '能不能加急'),
  agentStep(1, '我已备注家长诉求，会尽量优先。'),
  agentStep(0.5, '工单号 MR-20261104-118，后续进度我在这里同步。'),
  customerStep(0.5, '谢谢'),
  agentStep(0.6, '不客气，也建议后续给孩子的设备开启支付密码。'),
];

/* ---------------------- 工单脚本：举报外挂 ---------------------- */
const reportCheatSteps = (): DialogStep[] => [
  customerStep(0.5, '我要举报一个外挂，透视加自瞄，太离谱了'),
  agentStep(1, '您好，请提供对方游戏 ID、区服和对局时间。'),
  customerStep(0.6, 'ID 778899，区服 120，昨晚 23:40 那局'),
  agentStep(1, '有录屏或截图吗？'),
  customerStep(0.3, '', { attachment: file('外挂录像.mp4', 12_584_220, 'video/mp4') }),
  agentStep(1.1, '收到，画面里确实有准星异常跟随。'),
  customerStep(0.5, '他一个人把我们全队打穿了'),
  agentStep(1, '我提交反外挂工单，核查后会按规则处罚。'),
  customerStep(0.5, '会封号吗'),
  agentStep(1, '确认使用外挂会封禁，具体时长由系统判定。'),
  customerStep(0.5, '能不能告诉我结果'),
  agentStep(1.1, '处罚结果涉及隐私，只能告知是否处理，不会公开细节。'),
  customerStep(0.4, '行吧'),
  agentStep(1, '工单号 AC-20261104-552，处理完成后我会回复您。'),
  customerStep(0.5, '希望别又是警告了事'),
  agentStep(1, '录像证据比较完整，会按外挂条款处理。'),
  customerStep(0.4, '谢谢'),
  agentStep(0.6, '感谢您对游戏环境的维护。'),
];

/* ---------------------- 工单脚本：举报队友挂机 ---------------------- */
const reportAfkSteps = (): DialogStep[] => [
  customerStep(0.5, '排位遇到队友全程挂机，四打五怎么玩'),
  agentStep(1, '您好，请提供对局时间和对方 ID，我帮您提交举报。'),
  customerStep(0.6, '对局 661024887，ID 339021'),
  agentStep(1, '方便说一下具体表现吗？'),
  customerStep(0.5, '开局就在泉水转圈，中途回来放了个技能又挂机'),
  customerStep(0.3, '', { attachment: image('挂机对局截图.jpg', 526_118, 'image/jpeg') }),
  agentStep(1.1, '截图里能看到长时间未移动，符合挂机判定。'),
  customerStep(0.5, '这种会扣分吗'),
  agentStep(1, '首次确认会扣信誉分并限制匹配，多次会临时封禁。'),
  customerStep(0.5, '我们四个人白掉一颗星'),
  agentStep(1.1, '对局结果无法回滚，但举报成立会有补偿邮件。'),
  customerStep(0.4, '补偿是什么'),
  agentStep(1, '通常是排位保护卡或积分，具体以邮件为准。'),
  customerStep(0.4, '好吧'),
  agentStep(1, '已提交举报工单 BL-20261104-209。'),
  customerStep(0.4, '麻烦处理快点'),
  agentStep(1, '处理结果会通过游戏内邮件通知。'),
  customerStep(0.4, '谢谢'),
  agentStep(0.6, '也谢谢您愿意反馈。'),
];

/* ---------------------- 外语客户：泰语充值未到账 ---------------------- */
const thaiRechargeSteps = (): DialogStep[] => [
  customerStep(0.5, 'สวัสดีค่ะ เติม 300 บาทเมื่อกี้ เพชรยังไม่เข้าค่ะ', { language: '泰语', translation: '你好，刚才充值 300 泰铢，钻石还没到账。' }),
  agentStep(1, '您好，请提供充值订单号，我帮您查一下。'),
  customerStep(0.6, 'เลขคำสั่งซื้อ RC202611045521 ค่ะ', { language: '泰语', translation: '订单号 RC202611045521。' }),
  customerStep(0.3, '', { attachment: image('promptpay-slip-5521.jpg', 388_442, 'image/jpeg') }),
  customerStep(0.4, 'แนบสลิปโอนเงินมาให้แล้วค่ะ', { language: '泰语', translation: '转账凭证已经附上了。' }),
  agentStep(1.1, '收到，稍等我核对一下这笔订单。'),
  agentStep(1, '查到支付成功，但发货回调延迟，钻石还没发放。'),
  customerStep(0.5, 'ต้องรอนานไหมคะ', { language: '泰语', translation: '要等很久吗？' }),
  agentStep(1, '常规 10 分钟内补发，我已经登记加急。'),
  customerStep(0.5, 'เพิ่งเริ่มเล่น ยังไม่ค่อยเข้าใจค่ะ', { language: '泰语', translation: '我刚玩不久，不太懂这些。' }),
  agentStep(1, '没关系，到账后钻石会直接进背包。'),
  customerStep(0.4, 'ขอบคุณค่ะ', { language: '泰语', translation: '谢谢。' }),
  agentStep(1, '工单号 RC-20261104-773，有结果我在这里同步。'),
  customerStep(0.5, 'ถ้ายังไม่เข้าจะมาถามใหม่นะคะ', { language: '泰语', translation: '如果还没到账我再来问。' }),
  agentStep(0.8, '好的，随时找我。'),
  customerStep(0.4, '🙏', { kind: 'emoji' }),
  agentStep(1, '另外提醒，到账前不要重复充值，避免重复扣款。'),
  agentStep(0.4, 'By the way, the reissued diamonds will appear in your bag automatically.', { language: '英语', translation: '另外，补发的钻石会自动进入你的背包。' }),
  customerStep(0.5, 'เข้าใจแล้วค่ะ', { language: '泰语', translation: '明白了。' }),
];

/* ---------------------- 外语客户：越南语充值未到账 ---------------------- */
const vietnameseRechargeSteps = (): DialogStep[] => [
  customerStep(0.5, 'Chào shop, mình nạp 500k từ 20 phút trước mà chưa thấy kim cương, check giúp mình với.', { id: 'm1', language: '越南语', translation: '你好，我 20 分钟前充值 50 万越南盾，钻石还没到账，能帮我查一下吗？' }),
  agentStep(1, '您好，请提供充值订单号，我帮您查询。'),
  customerStep(0.6, 'Mã đơn là RC202611044412.', { language: '越南语', translation: '订单号是 RC202611044412。' }),
  customerStep(0.3, '', { attachment: image('order-20261104-4412.png', 402_118) }),
  customerStep(0.5, 'Ví đã trừ tiền rồi.', { language: '越南语', translation: '钱包里已经扣款了。' }),
  agentStep(1.1, '稍等，我查一下这笔订单。'),
  agentStep(1, '查到支付成功，钻石还没有发放。'),
  customerStep(0.5, 'Bao lâu thì có?', { language: '越南语', translation: '多久能到？' }),
  agentStep(1, '常规 10 分钟内补发，我先给您登记加急。'),
  customerStep(0.6, 'Mình đang cần mua skin, hôm nay hết hạn giảm giá.', { language: '越南语', translation: '我等着买皮肤，今天折扣最后一天。' }),
  agentStep(1, '已备注活动时间，会优先处理。'),
  customerStep(0.5, 'Cảm ơn, mong sớm có kết quả.', { language: '越南语', translation: '谢谢，希望能快点。' }),
  agentStep(1, '工单号 RC-20261104-882，有结果我在这里同步。'),
  customerStep(0.3, '', { attachment: file('充值记录.pdf', 226_511) }),
  agentStep(1.1, '凭证收到，和订单信息一致。'),
  customerStep(0.4, 'Ok bạn.', { language: '越南语', translation: '好的。' }),
  agentStep(1, '到账前不要重复下单。'),
  customerStep(0.4, 'Hiểu rồi.', { language: '越南语', translation: '明白了。' }),
];

/* ---------------------- 外语客户：越南语封禁申诉 ---------------------- */
const vietnameseBanSteps = (): DialogStep[] => [
  customerStep(0.5, 'Ad ơi, sao acc mình bị khóa vậy?', { language: '越南语', translation: '客服在吗，我的账号怎么被封了？' }),
  agentStep(1, '您好，请提供游戏 ID 和区服，我帮您查封禁记录。'),
  customerStep(0.6, 'ID 66120488, server 305 ạ.', { language: '越南语', translation: 'ID 66120488，区服 305。' }),
  agentStep(1.1, '稍等，我查一下。'),
  agentStep(1, '查到账号因使用第三方软件被临时封禁 7 天。'),
  customerStep(0.5, 'Mình chỉ dùng app giảm ping thôi.', { language: '越南语', translation: '我只是用了降延迟的软件。' }),
  customerStep(0.3, '', { attachment: image('封禁截图-66120488.jpg', 518_204, 'image/jpeg') }),
  agentStep(1.1, '降延迟工具会注入客户端进程，按规则属于第三方软件。'),
  customerStep(0.5, 'Vậy có xin xem xét lại được không ạ?', { language: '越南语', translation: '那能申请复核吗？' }),
  agentStep(1, '可以提交申诉，需要身份证照片和常用设备信息。'),
  customerStep(0.3, '', { attachment: file('申诉材料-66120488.zip', 2_842_330, 'application/zip') }),
  customerStep(0.4, 'Mình gửi đủ rồi, nhờ ad xem giúp.', { language: '越南语', translation: '我都发齐了，麻烦帮忙看下。' }),
  agentStep(1.2, '材料收到，已提交申诉工单，3 个工作日内出结果。'),
  customerStep(0.6, 'Acc mình nạp nhiều tiền lắm, mong được mở.', { language: '越南语', translation: '我账号充了不少钱，希望能解封。' }),
  agentStep(1, '封禁期内的充值不会退还，申诉结果会短信通知。'),
  customerStep(0.4, 'Vâng, cảm ơn ad.', { language: '越南语', translation: '好的，谢谢客服。' }),
  agentStep(0.8, '有结果我在这里回复您。'),
  agentStep(0.4, 'Please avoid any ping tools or modified clients from now on.', { language: '英语', translation: '请从现在起不要再使用任何加速或改包工具。' }),
  customerStep(0.4, '🙏', { kind: 'emoji' }),
  agentStep(0.6, '也提醒一下，后续不要使用任何改包或加速工具。'),
];

/* ---------------------- AI 分流：英文礼包码兑换失败 ---------------------- */
const englishGiftCodeAiSteps = (): DialogStep[] => [
  customerStep(0.5, 'Hi, my gift code says "code not available in this region". Can you check?', { language: '英语', translation: '你好，我的礼包码提示“该地区不可用”，能查一下吗？' }),
  aiStep(1, 'Hi Emily, I can help. Please share the code and your server region.', { language: '英语', translation: '你好 Emily，我可以帮你。请提供兑换码和你的区服。' }),
  customerStep(0.6, 'Code is IMSPORT-8891-TH, I am on the Asia server.', { language: '英语', translation: '兑换码是 IMSPORT-8891-TH，我在亚洲服。' }),
  aiStep(1, 'Thanks. Let me check the batch and region rules.', { language: '英语', translation: '谢谢，我先核对一下批次和区域规则。' }),
  aiStep(1.1, 'This code was issued for the Thailand launch batch and is region-locked.', { language: '英语', translation: '这个兑换码属于泰国首发批次，有区域限制。' }),
  customerStep(0.5, 'Oh, I got it from a friend in Bangkok.', { language: '英语', translation: '哦，这是我在曼谷的朋友给我的。' }),
  aiStep(1, 'That explains it. Region-locked codes can only be redeemed on the TH server.', { language: '英语', translation: '这就对上了。区域限制的兑换码只能在泰国服兑换。' }),
  customerStep(0.5, 'Is there any way to get an equivalent reward on Asia?', { language: '英语', translation: '有没有办法在亚洲服拿到同样的奖励？' }),
  aiStep(1.1, 'I can log a manual review request. Could you confirm your account ID?', { language: '英语', translation: '我可以提交人工复核，请确认你的账号 ID。' }),
  customerStep(0.6, 'ID 88210453, nickname NightOwl.', { language: '英语', translation: 'ID 88210453，昵称 NightOwl。' }),
  aiStep(1.1, 'Got it. This needs a human agent to verify the code batch and issue a replacement.', { language: '英语', translation: '收到。这需要人工客服核实批次并补发。' }),
  transferStep(0.8, 'member-sophie', '苏菲', '跨国礼包码需人工核验'),
  aiStep(0.5, 'I have passed this to Sophie. She will reply here within 24 hours.', { language: '英语', translation: '我已经转给苏菲，她会在 24 小时内在这里回复。' }),
  customerStep(0.5, 'Thanks, appreciate it.', { language: '英语', translation: '谢谢，辛苦了。' }),
  aiStep(1, 'No problem. Please keep the code screenshot handy.', { language: '英语', translation: '没问题，请保留好兑换码截图。' }),
  customerStep(0.3, '', { attachment: image('gift-code-error.png', 356_118) }),
  customerStep(0.4, 'Screenshot attached.', { language: '英语', translation: '截图附上了。' }),
  aiStep(0.6, 'Received. Sophie can see it in this conversation.', { language: '英语', translation: '已收到，苏菲能在这个会话里看到。' }),
];

/* ---------------------- AI 分流：未成年人充值退款 ---------------------- */
const minorRefundAiSteps = (): DialogStep[] => [
  customerStep(0.5, '孩子偷偷拿我手机充了 648，这个能退吗？'),
  aiStep(1, '您好，我在。未成年人充值退款需要监护人发起，先确认几件事。'),
  customerStep(0.5, '怎么弄，我第一次弄这个'),
  aiStep(1, '请问充值发生在哪个区服，订单号还记得吗？'),
  customerStep(0.6, '区服 1024，订单号 RC202611031188'),
  aiStep(1, '收到。孩子今年多大？'),
  customerStep(0.5, '10 岁，刚上四年级'),
  aiStep(1.1, '好的。这类工单需要监护关系证明和充值记录，我先把信息整理好。'),
  customerStep(0.5, '户口本照片行不行'),
  aiStep(1, '可以，需要能看清监护关系。还需要出生证明或学籍信息之一。'),
  customerStep(0.3, '', { attachment: image('户口本-监护页.jpg', 724_118, 'image/jpeg') }),
  customerStep(0.5, '出生证明在家里，晚上拍给您'),
  aiStep(1, '没问题，可以稍后补。先确认：这笔充值是否已经消费道具？'),
  customerStep(0.6, '抽了几次卡，出了两个皮肤'),
  aiStep(1.1, '已消耗部分可能无法全额退款，审核会核对消耗记录。'),
  customerStep(0.5, '那能退多少'),
  aiStep(1, '具体金额由审核确认。这个工单涉及未成年人保护，需要人工客服核验材料后提交。'),
  transferStep(0.8, 'member-sophie', '苏菲', '未成年人退款需人工核验监护材料'),
  aiStep(0.6, '已转接给苏菲，她会在 24 小时内联系您补充材料。'),
  customerStep(0.5, '好，谢谢'),
];

/* ---------------------- 待分配：礼包码兑换失败 ---------------------- */
const pendingGiftCodeSteps = (code: string, error: string): DialogStep[] => [
  pendingStep(),
  customerStep(0.6, '在吗？我的礼包码兑换不了'),
  customerStep(0.5, `码是 ${code}`),
  customerStep(0.4, `一直提示「${error}」`),
  customerStep(0.3, '', { attachment: image(`兑换失败截图-${code.slice(-4)}.png`, 388_442) }),
  customerStep(0.5, '我朋友昨天还能用'),
  customerStep(0.4, '是不是活动结束了'),
  customerStep(0.5, '有人处理吗'),
  customerStep(0.4, '我这边等着呢'),
  customerStep(0.5, '麻烦看一下'),
  customerStep(0.4, '急'),
  customerStep(0.4, '谢谢'),
  customerStep(0.5, '在线等'),
  customerStep(0.4, 'Any update? I have been waiting all morning.', { language: '英语', translation: '有进展吗？我已经等了一上午。' }),
];

/* ---------------------- 待分配：活动奖励未到账 ---------------------- */
const pendingActivitySteps = (activity: string, date: string): DialogStep[] => [
  pendingStep(),
  customerStep(0.6, `在吗？${activity}的奖励还没发`),
  customerStep(0.5, `我 ${date} 就完成任务了`),
  customerStep(0.4, '活动页面显示已领取'),
  customerStep(0.3, '', { attachment: image('活动进度截图.jpg', 448_118, 'image/jpeg') }),
  customerStep(0.5, '但背包里没有'),
  customerStep(0.4, '是不是漏发了'),
  customerStep(0.5, '有人看一下吗'),
  customerStep(0.4, '这个活动今天就结束了'),
  customerStep(0.5, '麻烦尽快'),
  customerStep(0.4, '我 ID 663021'),
  customerStep(0.4, '谢谢'),
  customerStep(0.5, '在线等回复'),
];

/* ---------------------- 待分配：未成年人退款咨询 ---------------------- */
const pendingMinorSteps = (): DialogStep[] => [
  pendingStep(),
  customerStep(0.6, '你好，孩子在游戏里充了钱，能退吗'),
  customerStep(0.5, '充了两次，一共 328'),
  customerStep(0.4, '订单号 RC202611042206'),
  customerStep(0.3, '', { attachment: file('充值记录.pdf', 318_442) }),
  customerStep(0.5, '孩子才 8 岁'),
  customerStep(0.4, '我这边需要准备什么材料'),
  customerStep(0.5, '有人能回复一下吗'),
  customerStep(0.4, '比较着急'),
  customerStep(0.5, '户口本照片我有'),
  customerStep(0.3, '', { attachment: image('户口本-监护页.jpg', 724_118, 'image/jpeg') }),
  customerStep(0.4, '麻烦尽快联系我'),
  customerStep(0.5, '谢谢'),
  customerStep(0.4, '在线等'),
];

/* ---------------------- 待分配：版本更新黑屏 ---------------------- */
const pendingVersionSteps = (): DialogStep[] => [
  pendingStep(),
  customerStep(0.6, '更新完游戏黑屏，进不去'),
  customerStep(0.5, 'vivo X90，Android 13'),
  customerStep(0.4, '一直卡在黑屏界面'),
  customerStep(0.3, '', { attachment: image('黑屏截图.jpg', 402_118, 'image/jpeg') }),
  customerStep(0.5, '重装也一样'),
  customerStep(0.4, '区服 120'),
  customerStep(0.5, '有人处理吗'),
  customerStep(0.4, '我今天的体力还没清'),
  customerStep(0.5, '麻烦帮忙看下'),
  customerStep(0.4, '急', { failed: true }),
  customerStep(0.5, '谢谢'),
  customerStep(0.4, '在线等'),
];

const seedSessionList: DemoSession[] = [
  /* 我的（本人接待）：充值 / 版本 / 换绑 / 活动 / 越南语充值 / 掉线 */
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10001', finalAgo: 6, id: 'session-20261104001',
    spanMinutes: 42, startUrl: 'https://support.imsports.game/orders/CS20261104', status: 'active', unread: 1,
    steps: [
      ...rechargeSteps({ amount: '¥328', channel: '微信支付', orderNo: 'RC202611038821', server: 'iOS 区服 1024' }),
      customerStep(0.5, 'Sorry, my English is not good. Will the diamonds arrive tonight?', { language: '英语', translation: '抱歉，我英文不太好，钻石今晚能到账吗？' }),
      agentStep(1, 'Yes, the reissue is already queued and should arrive within the hour.'),
      customerStep(0.4, 'Great, thanks a lot!', { language: '英语', translation: '太好了，非常感谢！' }),
    ],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10006', endedReason: '客户超时未回复', finalAgo: 9, id: 'session-20261104005',
    spanMinutes: 70, status: 'ended', steps: [...versionUpdateSteps(), endedStep()],
  }),
  buildSession({
    ...CHAT, actor: OWNER, assignee: owner, customerId: 'customer-10007', endedReason: '客户问题已解决', finalAgo: dayAgo(3, 14, 20), id: 'session-20261104006',
    spanMinutes: 55, status: 'ended', steps: [...rebindPhoneSteps(), endedStep()],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10008', endedReason: '客户问题已解决', finalAgo: dayAgo(2, 21, 10), id: 'session-20261104007',
    spanMinutes: 40, status: 'ended',
    steps: [...activityRewardSteps({ activity: '七夕集卡活动', claimDate: '11 月 1 日', uid: '3058821' }), endedStep()],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10009', endedReason: '客户超时未回复', finalAgo: 31, id: 'session-20261104008',
    spanMinutes: 80, status: 'ended', steps: [...vietnameseRechargeSteps(), endedStep()],
  }),
  buildSession({
    ...CHAT, actor: OWNER, assignee: owner, customerId: 'customer-10010', finalAgo: dayAgo(1, 18, 5), id: 'session-20261104009',
    spanMinutes: 60, status: 'active', unread: 4, steps: [
      ...loginIssueSteps(),
      customerStep(0.5, 'Do I need to change my password after the limit is lifted?', { language: '英语', translation: '限制解除后我需要改密码吗？' }),
      agentStep(1, 'We recommend changing it once, just to be safe.'),
    ],
  }),

  /* AI 成员接待：先问诊归类，再转人工 */
  buildSession({
    ...WEB, actor: AI_SALES, assignee: aiSales, customerId: 'customer-10004', finalAgo: 20, id: 'session-20261104003',
    spanMinutes: 35, status: 'active', steps: minorRefundAiSteps(),
  }),
  buildSession({
    ...TG, actor: AI_SALES, assignee: aiSales, customerId: 'customer-10013', finalAgo: 28, id: 'session-20261104010',
    spanMinutes: 50, status: 'active', steps: englishGiftCodeAiSteps(),
  }),

  /* 待分配：客户连续追问、尚未有人接待 */
  buildSession({
    ...CHAT, customerId: 'customer-10002', finalAgo: 4, id: 'session-20261104002', spanMinutes: 3.5, status: 'pending',
    steps: pendingGiftCodeSteps('IMSPRING-7788', '该兑换码已失效'),
  }),
  buildSession({
    ...CHAT, customerId: 'customer-10012', finalAgo: 19, id: 'session-20261104011', spanMinutes: 14, status: 'pending',
    steps: pendingGiftCodeSteps('IMSPRING-3321', '兑换码不适用于当前区服'),
  }),
  buildSession({
    ...TG, customerId: 'customer-10014', finalAgo: 36, id: 'session-20261104012', spanMinutes: 28, status: 'pending',
    steps: pendingActivitySteps('七夕集卡活动', '11 月 2 日'),
  }),
  buildSession({
    ...WEB, customerId: 'customer-10016', finalAgo: 33, id: 'session-20261104013', spanMinutes: 24, status: 'pending',
    steps: pendingMinorSteps(),
  }),
  buildSession({
    ...WEB, customerId: 'customer-10019', finalAgo: 39, id: 'session-20261104014', spanMinutes: 34, status: 'pending',
    steps: pendingVersionSteps(),
  }),

  /* 同事接待：泰语充值 / 外挂 / 登录 / 挂机 / 越南语申诉 / 账号找回 */
  buildSession({
    ...TG, actor: CHENYI, assignee: chenyi, customerId: 'customer-10005', finalAgo: 48, id: 'session-20261104004',
    spanMinutes: 45, status: 'active', unread: 2, steps: thaiRechargeSteps(),
  }),
  buildSession({
    ...WEB, actor: SOPHIE, assignee: sophie, customerId: 'customer-10011', endedReason: '客户超时未回复', finalAgo: dayAgo(5, 10, 30), id: 'session-20261104015',
    spanMinutes: 60, status: 'ended', steps: [
      ...reportCheatSteps(),
      customerStep(0.5, '又录了一段更完整的，你看这个自瞄', { attachment: file('外挂录像补充.mp4', 12_584_220, 'video/mp4') }),
      customerStep(0.5, 'Will his account be banned? He ruined three ranked games.', { language: '英语', translation: '他的号会被封吗？他毁了三场排位。' }),
      agentStep(1, 'Yes. Once the review confirms the plugin, the account gets a 30-day ban.'),
      endedStep(),
    ],
  }),
  buildSession({
    ...CHAT, actor: SOPHIE, assignee: sophie, customerId: 'customer-10015', finalAgo: 44, id: 'session-20261104016',
    spanMinutes: 50, status: 'active', unread: 1, steps: [
      customerStep(0.5, '登录一直提示二次验证，但是收不到验证码'),
      agentStep(1, '您好，请确认绑定手机号是否还在使用。'),
      customerStep(0.6, '号码在用，短信一条都没收到'),
      agentStep(1.1, '稍等，我查一下账号的验证状态。'),
      agentStep(1, '查到验证码发送失败，运营商侧被拦截了。'),
      customerStep(0.5, '那怎么登录'),
      agentStep(1, '可以先用备用验证方式：邮箱验证码或安全令牌。'),
      customerStep(0.5, '邮箱也收不到'),
      agentStep(1.2, '那我帮您走人工校验，请提供实名信息和最近登录设备。'),
      customerStep(0.3, '', { attachment: image('登录报错截图.jpg', 366_118, 'image/jpeg') }),
      customerStep(0.5, 'Windows 11，Chrome，昨天还能登'),
      agentStep(1.1, '信息核对一致，我提交登录异常工单。'),
      customerStep(0.5, '大概多久能好'),
      agentStep(1, '预计 2 小时内解除限制，期间请不要频繁尝试登录。'),
      customerStep(0.4, '好的'),
      agentStep(1, '工单号 LG-20261104-318，处理完我会短信通知您。'),
      customerStep(0.5, '谢谢'),
      agentStep(0.6, '不客气，给您添麻烦了。'),
    ],
  }),
  buildSession({
    ...TG, actor: CHENYI, assignee: chenyi, customerId: 'customer-10017', finalAgo: 61, id: 'session-20261104017',
    spanMinutes: 80, status: 'active', unread: 3, steps: reportAfkSteps(),
  }),
  buildSession({
    ...TG, actor: SOPHIE, assignee: sophie, customerId: 'customer-10018', finalAgo: dayAgo(1, 16, 20), id: 'session-20261104018',
    spanMinutes: 90, status: 'active', participants: ['member-chenyi', 'member-sophie'], steps: vietnameseBanSteps(),
  }),
  buildSession({
    ...CHAT, actor: SOPHIE, assignee: sophie, customerId: 'customer-10020', finalAgo: 40, id: 'session-20261104019',
    spanMinutes: 40, status: 'active', steps: [
      customerStep(0.5, '账号登不上了，密码忘了，绑定手机也换号了'),
      agentStep(1, '您好，账号找回需要先确认实名信息和注册时间。'),
      customerStep(0.6, '实名是陈伟，注册大概 2021 年'),
      agentStep(1.2, '稍等，我核对一下账号状态。'),
      agentStep(1, '账号还在，最近一次登录是 10 月 30 日。'),
      customerStep(0.5, '对，就是我'),
      agentStep(1, '需要提供身份证照片和原手机号的充值记录。'),
      customerStep(0.3, '', { attachment: image('身份证.jpg', 518_204, 'image/jpeg') }),
      customerStep(0.3, '', { attachment: image('充值订单截图.png', 402_118) }),
      agentStep(1.2, '材料收到，实名信息一致。'),
      customerStep(0.5, '能直接改密码吗'),
      agentStep(1, '找回流程会重置密码并解绑旧手机，需要 24 小时审核。'),
      customerStep(0.5, '这期间账号会被别人登吗'),
      agentStep(1, '提交后账号会临时冻结登录，避免被盗。'),
      customerStep(0.4, '好'),
      agentStep(1, '工单号 AR-20261104-663，审核结果会短信通知。'),
      customerStep(0.5, '谢谢，麻烦快点'),
      agentStep(0.6, '已加急备注，有结果我在这里回复。'),
    ],
  }),

  /* 已结束：已解决 / 超时未回复 / 重复会话合并 */
  buildSession({
    ...TG, actor: SOPHIE, assignee: sophie, customerId: 'customer-10003', endedReason: '客户确认收到处理结果', finalAgo: dayAgo(1, 21, 40),
    id: 'session-20261103001', participants: ['member-owner', 'member-sophie'], spanMinutes: 70, status: 'ended',
    steps: [
      ...banAppealSteps({ reason: '检测到透视插件运行记录', server: '区服 1024', uid: '661204' }),
      reassignedStep(1, 'member-sophie', '苏菲'),
      agentStep(1.1, '申诉工单已由苏菲复核，7 天封禁调整为 3 天，剩余时长会按小时扣减。'),
      customerStep(0.6, '那就是明天晚上能解封？'),
      agentStep(1, '是的，解封后首次登录需要重新验证设备。'),
      customerStep(0.5, '行，能接受，谢谢'),
      endedStep(),
    ],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10001', endedReason: '客户超时未回复', finalAgo: dateInYear(0, 2, 15, 10, 30),
    id: 'session-20260215001', spanMinutes: 1440, status: 'ended',
    steps: [...minorRefundSteps(), endedStep()],
  }),
  /* 跨渠道客户：夜风首次来自网站小部件，额外挂一条 Telegram 会话，用于演示「按关联渠道筛选客户」 */
  buildSession({
    ...TG, actor: SOPHIE, assignee: sophie, customerId: 'customer-10001', endedReason: '客户问题已解决',
    finalAgo: dateInYear(0, 11, 2, 21, 10), id: 'session-20261102003', spanMinutes: 35, status: 'ended',
    steps: [
      customerStep(0.6, '我是官网工单 RC2026110158 的玩家，听说 Telegram 也能联系你们？'),
      agentStep(1.1, '您好，可以的。两个渠道都进同一个客户档案，我这边能看到您在官网的充值记录。'),
      customerStep(0.5, '那笔订单昨天就补发到账了吗'),
      agentStep(1, '查到了，订单 RC2026110158 已完成补发，钻石昨天 18:40 到账。'),
      customerStep(0.4, '刚看了，确实到了，官网那边的工单还需要我回吗'),
      agentStep(1, '不用，我会在两边一起标记处理完成，您不用重复提交。'),
      customerStep(0.5, '行，以后充值有问题我直接来这里问'),
      agentStep(1.1, '没问题，记得附上订单号和区服，处理会更快。'),
      customerStep(0.4, '好，辛苦'),
      agentStep(0.8, '不客气，这个会话我先标记为已解决。'),
      endedStep(),
    ],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10004', endedReason: '重复会话合并', finalAgo: dateInYear(0, 8, 12, 19, 45),
    id: 'session-20261101001', spanMinutes: 100, status: 'ended',
    steps: [...rechargeSteps({ amount: '¥648', channel: '支付宝', orderNo: 'RC202611014488', server: 'iOS 区服 1024' }), endedStep()],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10006', endedReason: '客户问题已解决', finalAgo: dateInYear(0, 6, 18, 14, 10),
    id: 'session-20261102001', spanMinutes: 120, status: 'ended',
    steps: [
      customerStep(0.5, '更新后主城贴图全变成黑块，角色也看不清'),
      agentStep(1, '您好，请发一下截图和机型，我提交技术排查。'),
      customerStep(0.3, '', { attachment: image('贴图异常截图.png', 486_220) }),
      customerStep(0.5, 'Windows 11，显卡是 4060'),
      agentStep(1.1, '收到，这是新版本资源包未完整下载导致的问题。'),
      customerStep(0.5, '怎么解决'),
      agentStep(1, '在启动器里点「修复资源」，重新校验一次资源包。'),
      customerStep(0.5, '修复要多久'),
      agentStep(1, '大约 10 分钟，修复后重启客户端。'),
      customerStep(0.5, '好了，贴图正常了'),
      agentStep(0.8, '问题已解决，我就先把会话结束了，后续有问题随时联系。'),
      endedStep(),
    ],
  }),
  buildSession({
    ...CHAT, actor: SOPHIE, assignee: sophie, customerId: 'customer-10007', endedReason: '客户确认收到处理结果', finalAgo: dateInYear(0, 4, 9, 11, 25),
    id: 'session-20261102002', spanMinutes: 180, status: 'ended',
    steps: [
      ...giftCodeSteps({ code: 'IMSPRING-9902', error: '该兑换码已被使用', server: '区服 1024', usedServer: '区服 2048' }),
      endedStep(),
    ],
  }),
  buildSession({
    ...WEB, actor: SOPHIE, assignee: sophie, customerId: 'customer-10008', endedReason: '客户问题已解决', finalAgo: dateInYear(0, 3, 21, 9, 50),
    id: 'session-20261031001', spanMinutes: 200, status: 'ended',
    steps: [...activityRewardSteps({ activity: '中秋登录活动', claimDate: '10 月 28 日', uid: '3058821' }), endedStep()],
  }),
  buildSession({
    ...WEB, actor: OWNER, assignee: owner, customerId: 'customer-10009', endedReason: '客户超时未回复', finalAgo: dateInYear(1, 11, 20, 15, 40),
    id: 'session-20261030001', spanMinutes: 240, status: 'ended',
    steps: [...vietnameseRechargeSteps(), endedStep()],
  }),
  buildSession({
    ...WEB, teamId: '100003', actor: MIKA, assignee: mika, customerId: 'customer-10011', endedReason: '客户问题已解决', finalAgo: dateInYear(1, 9, 15, 11, 20),
    id: 'session-20261029001', spanMinutes: 300, status: 'ended',
    steps: [...reportCheatSteps(), endedStep()],
  }),
  buildSession({
    ...TG, teamId: '100003', actor: MIKA, assignee: mika, customerId: 'customer-10017', endedReason: '重复会话合并', finalAgo: 10000,
    id: 'session-20261028001', spanMinutes: 360, status: 'ended',
    steps: [
      customerStep(0.5, '又掉线了，刚那把排位直接判我逃跑'),
      agentStep(1, '您好，是刚才 22:10 那局吗？'),
      customerStep(0.6, '对，区服 2008，小米 14'),
      agentStep(1.1, '稍等，我查一下那段时间的区服日志。'),
      agentStep(1, '那个时段确实有一次短时波动，已经恢复。'),
      customerStep(0.5, '扣分了能补回来吗'),
      agentStep(1, '异常掉线可以申诉补回信誉分，我提交记录。'),
      customerStep(0.5, '好'),
      agentStep(1.1, '已提交，同类问题请合并到这条会话跟进。'),
      endedStep(),
    ],
  }),
];

/* ----------------------------------------------------------------------------
 * 预置译文：仅外语客户消息需要中文译文；中文消息不写译文。
 * -------------------------------------------------------------------------- */
const baseTranslations: Record<string, Record<string, string>> = {
  '我的充值一直没到账': { 英语: 'My recharge has not arrived yet.' },
  '账号被封了怎么申诉': { 英语: 'How do I appeal a banned account?' },
  '礼包码兑换失败': { 英语: 'The gift code cannot be redeemed.' },
};

const foreignTranslations: Array<[string, string]> = [
  ['สวัสดีค่ะ เติม 300 บาทเมื่อกี้ เพชรยังไม่เข้าค่ะ', '你好，刚才充值 300 泰铢，钻石还没到账。'],
  ['เลขคำสั่งซื้อ RC202611045521 ค่ะ', '订单号 RC202611045521。'],
  ['แนบสลิปโอนเงินมาให้แล้วค่ะ', '转账凭证已经附上了。'],
  ['ต้องรอนานไหมคะ', '要等很久吗？'],
  ['เพิ่งเริ่มเล่น ยังไม่ค่อยเข้าใจค่ะ', '我刚玩不久，不太懂这些。'],
  ['ขอบคุณค่ะ', '谢谢。'],
  ['ถ้ายังไม่เข้าจะมาถามใหม่นะคะ', '如果还没到账我再来问。'],
  ['เข้าใจแล้วค่ะ', '明白了。'],
  ['Chào shop, mình nạp 500k từ 20 phút trước mà chưa thấy kim cương, check giúp mình với.', '你好，我 20 分钟前充值 50 万越南盾，钻石还没到账，能帮我查一下吗？'],
  ['Mã đơn là RC202611044412.', '订单号是 RC202611044412。'],
  ['Ví đã trừ tiền rồi.', '钱包里已经扣款了。'],
  ['Bao lâu thì có?', '多久能到？'],
  ['Mình đang cần mua skin, hôm nay hết hạn giảm giá.', '我等着买皮肤，今天折扣最后一天。'],
  ['Cảm ơn, mong sớm có kết quả.', '谢谢，希望能快点。'],
  ['Ok bạn.', '好的。'],
  ['Hiểu rồi.', '明白了。'],
  ['Ad ơi, sao acc mình bị khóa vậy?', '客服在吗，我的账号怎么被封了？'],
  ['ID 66120488, server 305 ạ.', 'ID 66120488，区服 305。'],
  ['Mình chỉ dùng app giảm ping thôi.', '我只是用了降延迟的软件。'],
  ['Vậy có xin xem xét lại được không ạ?', '那能申请复核吗？'],
  ['Mình gửi đủ rồi, nhờ ad xem giúp.', '我都发齐了，麻烦帮忙看下。'],
  ['Acc mình nạp nhiều tiền lắm, mong được mở.', '我账号充了不少钱，希望能解封。'],
  ['Vâng, cảm ơn ad.', '好的，谢谢客服。'],
  ['Hi, my gift code says "code not available in this region". Can you check?', '你好，我的礼包码提示“该地区不可用”，能查一下吗？'],
  ['Code is IMSPORT-8891-TH, I am on the Asia server.', '兑换码是 IMSPORT-8891-TH，我在亚洲服。'],
  ['Oh, I got it from a friend in Bangkok.', '哦，这是我在曼谷的朋友给我的。'],
  ['Is there any way to get an equivalent reward on Asia?', '有没有办法在亚洲服拿到同样的奖励？'],
  ['ID 88210453, nickname NightOwl.', 'ID 88210453，昵称 NightOwl。'],
  ['Thanks, appreciate it.', '谢谢，辛苦了。'],
  ['Screenshot attached.', '截图附上了。'],
];

export const seedSessions = (): DemoSession[] => structuredClone(seedSessionList);

export const presetTranslations: Record<string, Record<string, string>> = (() => {
  const map: Record<string, Record<string, string>> = structuredClone(baseTranslations);
  foreignTranslations.forEach(([content, translation]) => {
    map[content] = { ...(map[content] || {}), 简体中文: translation };
  });
  return map;
})();
