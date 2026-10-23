<script lang="ts" setup>
import type { Channel } from '#/features/channels/channel-data';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { foregroundForTheme } from '#/features/channels/channel-data';
import { useChannelStore } from '#/features/channels/channel-store';

import WidgetGlyph from './WidgetGlyph.vue';

type MessageKind = 'image' | 'text' | 'video';
interface ClientMessage { content?: string; fileName?: string; fileSize?: number; fileUrl?: string; id: string; kind: MessageKind; role: 'agent' | 'customer'; sentAt: string }
interface PendingAttachment extends Omit<ClientMessage, 'role' | 'sentAt'> { error?: string; retryFile?: File; status: 'failed' | 'uploaded' | 'uploading'; uploadedAt: number }
interface ClientCopy { missingDescription: string; missingTitle: string; placeholder: string; unavailable: string; welcome: string }
interface ConversationMeta { channelName: string; createdAt: string; id: string; status: 'active' | 'ended'; teamId: string }
interface IncomingPayload extends Partial<ClientMessage> { conversationStatus?: 'active' | 'ended' }

const VISITOR_KEY = 'lingxi-channel-visitor';
const MUTE_KEY = 'lingxi-channel-muted';
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPT = '.jpg,.jpeg,.png,.webp,.gif,.heic,.mp4,.mov,.webm';
const ALLOWED_EXTENSIONS = new Set(ACCEPT.split(','));
const EMOJIS = ['😀', '😁', '😂', '😊', '😍', '👍', '👏', '🎉', '🙏', '❤️', '👋', '🤔', '😢', '🔥', '✅', '👀'];
const CLIENT_COPY: Record<string, ClientCopy> = {
  简体中文: { missingDescription: '请检查链接是否正确。', missingTitle: '聊天渠道不存在', placeholder: '输入您的消息...', unavailable: '当前客服暂不可用', welcome: '您好，请问有什么可以帮您？' },
  繁体中文: { missingDescription: '請檢查連結是否正確。', missingTitle: '聊天渠道不存在', placeholder: '輸入您的訊息...', unavailable: '目前客服暫不可用', welcome: '您好，請問有什麼可以幫您？' },
  英语: { missingDescription: 'Please check the link and try again.', missingTitle: 'Chat channel not found', placeholder: 'Type your message...', unavailable: 'Support is currently unavailable', welcome: 'Hi, how can I help you today?' },
  越南语: { missingDescription: 'Vui lòng kiểm tra lại liên kết.', missingTitle: 'Không tìm thấy kênh trò chuyện', placeholder: 'Nhập tin nhắn...', unavailable: 'Hiện không có nhân viên hỗ trợ', welcome: 'Xin chào, tôi có thể giúp gì cho bạn?' },
  泰语: { missingDescription: 'โปรดตรวจสอบลิงก์อีกครั้ง', missingTitle: 'ไม่พบช่องแชท', placeholder: 'พิมพ์ข้อความ...', unavailable: 'ขณะนี้ฝ่ายบริการไม่พร้อมใช้งาน', welcome: 'สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?' },
  高棉语: { missingDescription: 'សូមពិនិត្យតំណម្តងទៀត។', missingTitle: 'រកមិនឃើញឆានែលជជែក', placeholder: 'បញ្ចូលសាររបស់អ្នក...', unavailable: 'បច្ចុប្បន្នផ្នែកជំនួយមិនអាចប្រើបានទេ', welcome: 'សួស្តី តើខ្ញុំអាចជួយអ្វីបានខ្លះ?' },
  缅甸语: { missingDescription: 'လင့်ခ်ကို ပြန်စစ်ပါ။', missingTitle: 'ချတ်ချန်နယ် မတွေ့ပါ', placeholder: 'သင့်စာကို ရိုက်ထည့်ပါ...', unavailable: 'ဝန်ဆောင်မှုကို ယခုမရနိုင်ပါ', welcome: 'မင်္ဂလာပါ၊ ဘာများကူညီပေးရမလဲ။' },
  老挝语: { missingDescription: 'ກະລຸນາກວດສອບລິ້ງອີກຄັ້ງ.', missingTitle: 'ບໍ່ພົບຊ່ອງສົນທະນາ', placeholder: 'ພິມຂໍ້ຄວາມ...', unavailable: 'ຕອນນີ້ຝ່າຍບໍລິການບໍ່ພ້ອມ', welcome: 'ສະບາຍດີ ຂ້ອຍຊ່ວຍຫຍັງໄດ້ແດ່?' },
};

const route = useRoute();
const store = useChannelStore();
const isWidget = computed(() => route.name === 'ChannelWidget');
const channel = computed<Channel | undefined>(() => isWidget.value
  ? store.channels.find((item) => item.id === String(route.params.channelId))
  : store.channels.find((item) => item.type === 'chat-page' && item.teamId === String(route.params.channelId)));
const isMobile = ref(window.innerWidth < 768);
const open = ref(!isWidget.value);
const muted = ref(localStorage.getItem(`${MUTE_KEY}:${String(route.params.channelId)}`) === 'true');
const input = ref('');
const pendingAttachments = ref<PendingAttachment[]>([]);
const emojiOpen = ref(false);
const sending = ref(false);
const error = ref('');
const failedOutgoing = ref<ClientMessage[]>([]);
const unread = ref(0);
const zoomImage = ref('');
const messageArea = ref<HTMLElement>();
const textarea = ref<HTMLTextAreaElement>();
const fileInput = ref<HTMLInputElement>();
const messages = ref<ClientMessage[]>([]);
const conversationMeta = ref<ConversationMeta>();
const visibleCount = ref(40);
const atBottom = ref(true);
let lastSoundAt = 0;
const visitorSessionKey = `${VISITOR_KEY}:${String(route.params.channelId)}`;
if (!sessionStorage.getItem(visitorSessionKey)) sessionStorage.setItem(visitorSessionKey, runtimeId('visitor'));
const visitorId = sessionStorage.getItem(visitorSessionKey) ?? 'anonymous';
const identityId = computed(() => route.query.trusted === '1' && route.query.identity ? `account:${String(route.query.identity)}` : `visitor:${visitorId}`);
const storageKey = computed(() => `im-support-vben:conversation:${channel.value?.id || 'missing'}:${identityId.value}`);
const pendingKey = computed(() => `${storageKey.value}:pending`);
const incomingKey = computed(() => `${storageKey.value}:incoming`);
const metaKey = computed(() => `${storageKey.value}:meta`);
const themeForeground = computed(() => foregroundForTheme(channel.value?.themeColor ?? '#1c1f26'));
const requestedHost = computed(() => String(route.query.host || '').toLowerCase());
const domainAllowed = computed(() => !requestedHost.value || !channel.value?.allowedDomains.length || channel.value.allowedDomains.some((domain) => requestedHost.value === domain || (domain.startsWith('www.') ? requestedHost.value === domain.slice(4) : requestedHost.value === `www.${domain}`)));
const teamAvailable = computed(() => {
  const team = conversationMeta.value?.status === 'active' ? store.findTeam(conversationMeta.value.teamId) : store.resolveTeam(channel.value?.teamId);
  return Boolean(channel.value?.enabled && team?.status === 'active' && domainAllowed.value);
});
const copy = computed(() => resolveCopy(channel.value?.language, isWidget.value ? String(route.query.lang || '') : ''));
const visibleMessages = computed(() => messages.value.slice(Math.max(0, messages.value.length - visibleCount.value)));
const widgetVisible = computed(() => isMobile.value ? channel.value?.widgetMobileVisible : channel.value?.widgetDesktopVisible);
const widgetPosition = computed(() => isMobile.value ? (channel.value?.widgetMobilePosition || channel.value?.widgetPosition) : channel.value?.widgetPosition);
const widgetStyle = computed(() => ({
  '--offset-x': `${isMobile.value ? channel.value?.widgetMobileOffsetX : channel.value?.widgetOffsetX}px`,
  '--offset-y': `${isMobile.value ? channel.value?.widgetMobileOffsetY : channel.value?.widgetOffsetY}px`,
}));

function resolveCopy(language = '自动', requestedLanguage = ''): ClientCopy {
  const fallback = CLIENT_COPY.简体中文 as ClientCopy;
  if (language && language !== '自动') return CLIENT_COPY[language] ?? fallback;
  const browserLanguage = (requestedLanguage || navigator.language).toLowerCase();
  if (browserLanguage.startsWith('zh-tw') || browserLanguage.startsWith('zh-hk')) return CLIENT_COPY.繁体中文 ?? fallback;
  if (browserLanguage.startsWith('zh')) return fallback;
  const map: Record<string, string> = { en: '英语', km: '高棉语', lo: '老挝语', my: '缅甸语', th: '泰语', vi: '越南语' };
  const languageCode = browserLanguage.split('-')[0] ?? '';
  return CLIENT_COPY[map[languageCode] ?? '英语'] ?? fallback;
}
function runtimeId(prefix: string) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
function persist() { localStorage.setItem(storageKey.value, JSON.stringify(messages.value)); }
function persistMeta() { if (conversationMeta.value) localStorage.setItem(metaKey.value, JSON.stringify(conversationMeta.value)); }
function persistPending() {
  const serializable = pendingAttachments.value.filter((item) => item.status === 'uploaded').map(({ retryFile: _retryFile, ...item }) => item);
  localStorage.setItem(pendingKey.value, JSON.stringify(serializable));
}
function isRetained(sentAt: string) {
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 6);
  return new Date(sentAt) >= cutoff;
}
function loadMessages() {
  if (!domainAllowed.value) { messages.value = []; return; }
  try {
    const storedMeta = JSON.parse(localStorage.getItem(metaKey.value) || 'null') as ConversationMeta | null;
    conversationMeta.value = storedMeta || undefined;
    if (conversationMeta.value && channel.value && conversationMeta.value.channelName !== channel.value.name) {
      conversationMeta.value.channelName = channel.value.name;
      persistMeta();
    }
  } catch { conversationMeta.value = undefined; }
  try { messages.value = (JSON.parse(localStorage.getItem(storageKey.value) || '[]') as ClientMessage[]).filter((message) => isRetained(message.sentAt)); } catch { messages.value = []; }
  try { pendingAttachments.value = (JSON.parse(localStorage.getItem(pendingKey.value) || '[]') as PendingAttachment[]).filter((item) => Date.now() - item.uploadedAt < 86_400_000); } catch { pendingAttachments.value = []; }
  persist(); persistPending();
  if (messages.value.length === 0 && channel.value) messages.value = [{ content: copy.value.welcome, id: `welcome-${channel.value.id}`, kind: 'text', role: 'agent', sentAt: new Date().toISOString() }];
}
function scrollToEnd(behavior: ScrollBehavior = 'auto') { nextTick(() => messageArea.value?.scrollTo({ behavior, top: messageArea.value.scrollHeight })); }
function messageDate(sentAt: string) { const date = new Date(sentAt); return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`; }
function showDate(index: number) {
  const previous = visibleMessages.value[index - 1]; const current = visibleMessages.value[index];
  return index === 0 || !previous || !current || messageDate(previous.sentAt) !== messageDate(current.sentAt);
}
function fileKind(file: File): MessageKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'video';
}
function fileExtension(file: File) { const extension = file.name.split('.').pop(); return file.name.includes('.') && extension ? `.${extension.toLowerCase()}` : ''; }
function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.addEventListener('load', () => resolve(String(reader.result))); reader.addEventListener('error', reject); reader.readAsDataURL(file);
  });
}
async function hasValidSignature(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const extension = fileExtension(file);
  const text = new TextDecoder('latin1').decode(bytes);
  if (['.jpeg', '.jpg'].includes(extension)) return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  if (extension === '.png') return bytes.slice(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (extension === '.gif') return text.startsWith('GIF8');
  if (extension === '.webp') return text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP';
  if (extension === '.webm') return bytes.slice(0, 4).join(',') === '26,69,223,163';
  if (['.heic', '.mov', '.mp4'].includes(extension)) return text.slice(4, 8) === 'ftyp';
  return false;
}
async function uploadFile(file: File, attachment: PendingAttachment) {
  attachment.status = 'uploading'; attachment.error = undefined; attachment.retryFile = file;
  try {
    if (!await hasValidSignature(file)) throw new Error('文件内容与格式不一致');
    attachment.fileUrl = await fileToDataUrl(file); attachment.status = 'uploaded'; attachment.uploadedAt = Date.now(); attachment.retryFile = undefined;
  } catch (uploadError) {
    attachment.status = 'failed'; attachment.error = uploadError instanceof Error ? uploadError.message : '读取失败';
  }
  persistPending();
}
async function uploadFiles(files: File[] | FileList | null) {
  if (!files) return;
  const remaining = Math.max(0, 5 - pendingAttachments.value.length);
  if (!remaining) { error.value = '每次最多上传 5 个文件'; return; }
  for (const file of [...files].slice(0, remaining)) {
    if (!ALLOWED_EXTENSIONS.has(fileExtension(file)) || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) { error.value = '仅支持图片和视频文件'; continue; }
    if (file.name.length > 255) { error.value = '文件名不能超过 255 个字符'; continue; }
    if (file.size > MAX_FILE_SIZE) { error.value = `${file.name} 超过 20 MB，无法发送`; continue; }
    const attachment = reactive<PendingAttachment>({ fileName: file.name, fileSize: file.size, id: runtimeId('attachment'), kind: fileKind(file), retryFile: file, status: 'uploading', uploadedAt: Date.now() });
    pendingAttachments.value.push(attachment);
    await uploadFile(file, attachment);
  }
  if (files.length > remaining) error.value = '每次最多上传 5 个文件';
}
async function handleFileChange(event: Event) {
  const element = event.target as HTMLInputElement;
  await uploadFiles(element.files ? [...element.files] : null);
  element.value = '';
}
function retryAttachment(attachment: PendingAttachment) {
  if (!attachment.retryFile) { error.value = '请重新选择该文件后重试'; return; }
  void uploadFile(attachment.retryFile, attachment);
}
function removeAttachment(id: string) { pendingAttachments.value = pendingAttachments.value.filter((item) => item.id !== id); persistPending(); }
function append(message: ClientMessage) { messages.value.push(message); persist(); scrollToEnd(); }
function ensureActiveConversation() {
  if (conversationMeta.value?.status === 'active' || !channel.value) return;
  conversationMeta.value = { channelName: channel.value.name, createdAt: new Date().toISOString(), id: runtimeId('conversation'), status: 'active', teamId: channel.value.teamId || '' };
  persistMeta();
}
function sendMessages(outgoing: ClientMessage[]) {
  if (!teamAvailable.value) { error.value = domainAllowed.value ? copy.value.unavailable : '当前网站未获授权，无法使用客服'; return false; }
  if (!navigator.onLine) { failedOutgoing.value = outgoing; error.value = '网络异常，消息未发送'; return false; }
  sending.value = true;
  window.setTimeout(() => {
    ensureActiveConversation();
    outgoing.forEach((message) => append(message)); failedOutgoing.value = []; error.value = ''; sending.value = false;
  }, 240);
  return true;
}
function send() {
  const content = input.value.trim();
  const activeAttachments = pendingAttachments.value.filter((item) => item.status === 'uploaded' && Date.now() - item.uploadedAt < 86_400_000);
  if (!content && activeAttachments.length === 0) return;
  if (content.length > 2000) { error.value = '单条消息不能超过 2,000 个字符'; return; }
  if (activeAttachments.length !== pendingAttachments.value.length) error.value = '文件已过期，请重新上传';
  const sentAt = new Date().toISOString(); const outgoing: ClientMessage[] = [];
  if (content) outgoing.push({ content, id: runtimeId('message'), kind: 'text', role: 'customer', sentAt });
  activeAttachments.forEach((item) => outgoing.push({ ...item, id: runtimeId('message'), role: 'customer', sentAt }));
  if (!sendMessages(outgoing)) return;
  input.value = ''; pendingAttachments.value = []; persistPending(); emojiOpen.value = false;
}
function handleInputEnter(event: KeyboardEvent) {
  if (event.isComposing) return;
  event.preventDefault();
  send();
}
function retry() { if (failedOutgoing.value.length > 0) sendMessages(failedOutgoing.value); }
function insertEmoji(emoji: string) {
  const start = textarea.value?.selectionStart ?? input.value.length; const end = textarea.value?.selectionEnd ?? input.value.length;
  input.value = `${input.value.slice(0, start)}${emoji}${input.value.slice(end)}`; emojiOpen.value = false;
  nextTick(() => { textarea.value?.focus(); textarea.value?.setSelectionRange(start + emoji.length, start + emoji.length); });
}
function handleScroll() {
  const area = messageArea.value; if (!area) return;
  if (area.scrollTop < 24 && visibleCount.value < messages.value.length) visibleCount.value = Math.min(messages.value.length, visibleCount.value + 40);
  atBottom.value = area.scrollHeight - area.scrollTop - area.clientHeight < 24; if (atBottom.value) unread.value = 0;
}
function toggleMute() { muted.value = !muted.value; localStorage.setItem(`${MUTE_KEY}:${String(route.params.channelId)}`, String(muted.value)); }
function toggleOpen() { open.value = !open.value; if (open.value) { unread.value = 0; scrollToEnd(); } }
function playNotificationSound() {
  if (muted.value || Date.now() - lastSoundAt < 2000) return;
  lastSoundAt = Date.now();
  const context = new AudioContext();
  const oscillator = context.createOscillator(); const gain = context.createGain();
  oscillator.frequency.value = 880; gain.gain.value = 0.035; oscillator.connect(gain).connect(context.destination); oscillator.start();
  window.setTimeout(() => { oscillator.stop(); void context.close(); }, 180);
}
function receiveAgentMessage(payload: unknown) {
  if (!teamAvailable.value || !payload || typeof payload !== 'object') return;
  const incoming = payload as IncomingPayload;
  if (incoming.conversationStatus === 'ended') {
    if (conversationMeta.value) { conversationMeta.value.status = 'ended'; persistMeta(); }
    return;
  }
  ensureActiveConversation();
  const message: ClientMessage = { content: String(incoming.content || ''), fileName: incoming.fileName, fileSize: incoming.fileSize, fileUrl: incoming.fileUrl, id: incoming.id || runtimeId('agent'), kind: incoming.kind || 'text', role: 'agent', sentAt: incoming.sentAt || new Date().toISOString() };
  if (!message.content && !message.fileUrl) return;
  if (messages.value.some((item) => item.id === message.id)) return;
  append(message); playNotificationSound();
  if (!open.value || !atBottom.value || document.hidden) unread.value += 1;
}
function handleIncomingStorage(event: StorageEvent) {
  if (event.key !== incomingKey.value || !event.newValue) return;
  try { receiveAgentMessage(JSON.parse(event.newValue)); } catch { /* ignore invalid mock events */ }
}
function handleIncomingEvent(event: Event) { receiveAgentMessage((event as CustomEvent).detail); }
function resize() { isMobile.value = window.innerWidth < 768; }
function closeEmoji(event: PointerEvent) { if (!(event.target as Element).closest('.channel-client-chat > footer')) emojiOpen.value = false; }

onMounted(() => {
  document.body.classList.add('channel-client-body');
  loadMessages(); scrollToEnd(); window.addEventListener('resize', resize); window.addEventListener('pointerdown', closeEmoji); window.addEventListener('storage', handleIncomingStorage); window.addEventListener('im-support:agent-message', handleIncomingEvent);
});
watch(unread, (value) => { document.title = value && channel.value ? `(${value}) ${channel.value.brandName || channel.value.name}` : (channel.value?.brandName || channel.value?.name || 'IM Support'); });
onUnmounted(() => { document.body.classList.remove('channel-client-body'); document.title = 'IM Support'; window.removeEventListener('resize', resize); window.removeEventListener('pointerdown', closeEmoji); window.removeEventListener('storage', handleIncomingStorage); window.removeEventListener('im-support:agent-message', handleIncomingEvent); });
</script>

<template>
  <main v-if="channel" :class="isWidget ? 'channel-widget-host' : 'channel-client-page'">
    <div v-if="isWidget" class="channel-widget-host-copy"><strong>{{ channel.websiteDomain || '网站小部件测试页' }}</strong><span>通过右下角入口模拟网站访客发起聊天。</span></div>
    <div v-if="!isWidget || widgetVisible" :class="isWidget ? ['channel-widget-runtime', `is-${widgetPosition}`] : undefined" :style="isWidget ? widgetStyle : undefined">
      <section v-if="open" class="channel-client-chat" :class="{ 'is-page': !isWidget }" :style="{ '--client-theme': channel.themeColor, '--client-foreground': themeForeground }">
        <header>
          <span class="channel-client-avatar"><img v-if="channel.brandAvatar" :src="channel.brandAvatar" alt="" /><span v-else>{{ (channel.brandName || channel.name).slice(0, 1) }}</span></span>
          <span class="channel-client-brand"><strong>{{ channel.brandName || channel.name }}</strong><small v-if="channel.brandSignature">{{ channel.brandSignature }}</small></span>
          <button type="button" :aria-label="muted ? '打开消息提示音' : '关闭消息提示音'" @click="toggleMute"><svg v-if="!muted" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m2 2 20 20M18 8a6 6 0 0 0-9.4-4.9M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 7-3 9h14M10 21h4" /></svg></button>
          <button v-if="isWidget" type="button" aria-label="关闭聊天窗口" @click="toggleOpen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg></button>
        </header>
        <div ref="messageArea" class="channel-client-messages" @scroll="handleScroll">
          <template v-for="(message, index) in visibleMessages" :key="message.id">
            <div v-if="showDate(index)" class="channel-client-date-divider"><span>{{ messageDate(message.sentAt) }}</span></div>
            <div class="channel-client-message-row" :class="`is-${message.role}`">
<div class="channel-client-message">
              <button v-if="message.kind === 'image'" type="button" class="client-message-image-button" @click="zoomImage = message.fileUrl || ''"><img class="client-message-image" :src="message.fileUrl" :alt="message.fileName" /></button>
              <span v-else-if="message.kind === 'video'" class="client-video-wrap"><video class="client-message-video" :src="message.fileUrl" controls></video><a :href="message.fileUrl" :download="message.fileName">下载视频</a></span>
              <template v-else>{{ message.content }}</template>
            </div>
</div>
          </template>
        </div>
        <button v-if="unread > 0" type="button" class="channel-client-new-messages" @click="scrollToEnd('smooth')">{{ unread }} 条新消息</button>
        <div class="channel-client-compose-status">
          <div v-if="pendingAttachments.length > 0" class="channel-client-pending-files"><span v-for="attachment in pendingAttachments" :key="attachment.id" :class="`is-${attachment.status}`"><img v-if="attachment.kind === 'image' && attachment.fileUrl" :src="attachment.fileUrl" alt="" /><svg v-else viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" /></svg><span><b :title="attachment.fileName">{{ attachment.fileName }}</b><small>{{ attachment.status === 'uploading' ? '上传中…' : attachment.status === 'failed' ? attachment.error : '已上传' }}</small></span><button v-if="attachment.status === 'failed'" type="button" :aria-label="`重试 ${attachment.fileName}`" @click="retryAttachment(attachment)">↻</button><button type="button" :aria-label="`移除 ${attachment.fileName}`" @click="removeAttachment(attachment.id)">×</button></span></div>
          <div v-if="sending" class="channel-client-send-state">正在发送…</div>
          <div v-if="error" class="channel-client-error">{{ error }}<button v-if="failedOutgoing.length > 0" type="button" @click="retry">重试</button></div>
        </div>
        <footer @dragover.prevent @drop.prevent="uploadFiles($event.dataTransfer?.files || null)">
          <button type="button" aria-label="上传附件" :disabled="!teamAvailable || sending" @click="fileInput?.click()"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg></button>
          <input ref="fileInput" type="file" hidden multiple :accept="ACCEPT" @change="handleFileChange" />
          <button type="button" class="channel-client-emoji-trigger" aria-label="插入表情" :disabled="!teamAvailable || sending" @click.stop="emojiOpen = !emojiOpen">☺</button>
          <div v-if="emojiOpen" class="channel-client-emoji-picker" role="dialog" aria-label="选择表情"><button v-for="emoji in EMOJIS" :key="emoji" type="button" :aria-label="`插入表情 ${emoji}`" @click="insertEmoji(emoji)">{{ emoji }}</button></div>
          <textarea ref="textarea" v-model="input" rows="1" :disabled="!teamAvailable || sending" :placeholder="teamAvailable ? copy.placeholder : (domainAllowed ? copy.unavailable : '当前网站未获授权，无法使用客服')" @paste="uploadFiles($event.clipboardData?.files || null)" @keydown.enter.exact="handleInputEnter"></textarea>
          <button type="button" class="is-send" aria-label="发送消息" :disabled="!teamAvailable || sending || (!input.trim() && pendingAttachments.length === 0)" @click="send"><svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4zM22 2 11 13" /></svg></button>
        </footer>
      </section>
      <button v-if="isWidget && !open" type="button" class="channel-client-fab" :style="{ background: channel.themeColor, color: themeForeground }" aria-label="打开聊天窗口" @click="toggleOpen"><WidgetGlyph :type="channel.widgetIcon" :custom-icon="channel.widgetCustomIcon" /><b v-if="unread">{{ unread > 99 ? '99+' : unread }}</b></button>
    </div>
  </main>
  <main v-else class="channel-client-state"><strong>{{ copy.missingTitle }}</strong><span>{{ copy.missingDescription }}</span></main>
  <button v-if="zoomImage" type="button" class="channel-client-image-viewer" aria-label="关闭图片预览" @click="zoomImage = ''"><img :src="zoomImage" alt="图片预览" /></button>
</template>

<style scoped>
:global(body.channel-client-body){min-width:0;margin:0}.channel-client-page,.channel-widget-host{width:100vw;min-height:100vh;color:#1d2129;background:#f5f7fb;font:14px/22px -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}.channel-client-page{display:grid}.channel-widget-host{position:relative;display:grid;place-items:center;overflow:hidden}.channel-widget-host-copy{display:grid;justify-items:center;gap:8px;color:#86909c}.channel-widget-host-copy strong{color:#1d2129;font-size:20px}.channel-widget-runtime{position:fixed;z-index:10;bottom:var(--offset-y,24px);display:grid;justify-items:end;gap:12px}.channel-widget-runtime.is-bottom-left{right:auto;left:var(--offset-x,24px);justify-items:start}.channel-widget-runtime.is-bottom-right{right:var(--offset-x,24px)}.channel-client-chat{position:relative;display:grid;width:min(388px,calc(100vw - 32px));height:min(620px,calc(100vh - 48px));grid-template-rows:auto minmax(0,1fr) auto auto;overflow:hidden;background:#fff;border-radius:16px;box-shadow:0 18px 48px rgb(29 33 41 / 18%);animation:channel-client-open 420ms cubic-bezier(.16,1,.3,1);transform-origin:bottom right}.channel-client-chat.is-page{width:100%;height:100vh;border-radius:0;box-shadow:none}.channel-client-chat>header{display:grid;min-height:76px;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:12px 16px;color:var(--client-foreground,#fff);background:var(--client-theme)}.channel-client-chat>header button,.channel-client-chat>footer button{display:grid;width:32px;height:32px;place-items:center;padding:0;color:inherit;background:transparent;border:0;border-radius:50%;cursor:pointer}.channel-client-chat button svg{width:20px;height:20px;fill:none;stroke:currentcolor;stroke-linecap:round;stroke-linejoin:round;stroke-width:1.8}.channel-client-avatar{display:grid;width:44px;height:44px;place-items:center;overflow:hidden;background:rgb(255 255 255 / 18%);border-radius:50%;font-weight:600}.channel-client-avatar img{display:block;width:100%;height:100%;object-fit:cover}.channel-client-brand{display:grid;min-width:0;gap:3px}.channel-client-brand strong,.channel-client-brand small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.channel-client-brand small{color:inherit;opacity:.72}.channel-client-messages{display:flex;min-height:0;flex-direction:column;gap:12px;overflow:auto;padding:16px}.channel-client-date-divider{display:grid;place-items:center;margin:4px 0;color:#86909c;font-size:12px}.channel-client-date-divider span{padding:2px 9px;background:#f2f3f5;border-radius:999px}.channel-client-message-row{display:flex;justify-content:flex-start}.channel-client-message-row.is-customer{justify-content:flex-end}.channel-client-message{width:fit-content;max-width:82%;padding:9px 12px;overflow-wrap:anywhere;background:#f2f3f5;border-radius:12px 12px 12px 3px}.channel-client-message-row.is-customer .channel-client-message{color:var(--client-foreground,#fff);background:var(--client-theme);border-radius:12px 12px 3px 12px}.client-message-image,.client-message-video{display:block;max-width:min(280px,100%);max-height:260px;border-radius:8px;object-fit:contain}.client-message-audio{display:block;width:min(260px,100%)}.channel-client-message.is-file{min-width:min(100%,252px);padding:0;background:transparent}.client-file-message{display:grid;grid-template-columns:56px minmax(0,1fr);align-items:center;gap:12px;padding:12px;color:#1d2129;background:#f2f3f5;border-radius:16px}.client-file-icon{display:grid;width:56px;height:56px;place-items:center;background:#e5e7eb;border-radius:12px}.client-file-message>span:last-child{display:grid;min-width:0;gap:4px}.client-file-message a{overflow:hidden;color:#1664ff;text-overflow:ellipsis;white-space:nowrap;font-weight:600;text-decoration:none}.client-file-message small{color:#4e5969}.channel-client-compose-status:empty{display:none}.channel-client-pending-files{display:flex;gap:8px;overflow-x:auto;padding:8px 12px;border-top:1px solid #e5e6eb}.channel-client-pending-files>span{display:grid;min-width:0;flex:0 1 180px;grid-template-columns:28px minmax(0,1fr) 20px;align-items:center;gap:6px;padding:5px 6px;background:#f2f3f5;border-radius:8px}.channel-client-pending-files img{width:28px;height:28px;object-fit:cover;border-radius:5px}.channel-client-pending-files svg{width:18px;height:18px;fill:none;stroke:currentcolor}.channel-client-pending-files b{overflow:hidden;font-size:12px;font-weight:500;text-overflow:ellipsis;white-space:nowrap}.channel-client-pending-files button{padding:0;color:#86909c;background:transparent;border:0;font-size:18px}.channel-client-error,.channel-client-send-state{padding:6px 16px;font-size:12px}.channel-client-error{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#f53f3f;background:#ffece8}.channel-client-send-state{color:#86909c;background:#f2f3f5}.channel-client-error button{min-height:24px;padding:0 8px;color:inherit;background:transparent;border:1px solid currentcolor;border-radius:4px}.channel-client-new-messages{position:absolute;z-index:2;bottom:76px;left:50%;min-height:30px;padding:0 12px;color:#1664ff;background:#fff;border:1px solid #1664ff;border-radius:16px;box-shadow:0 4px 14px rgb(29 33 41 / 14%);transform:translateX(-50%)}.channel-client-chat>footer{position:relative;display:grid;min-height:64px;grid-template-columns:auto auto minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid #e5e6eb}.channel-client-chat>footer textarea{min-width:0;max-height:88px;resize:none;padding:8px 10px;color:#1d2129;background:#f2f3f5;border:1px solid transparent;border-radius:6px;font:inherit}.channel-client-chat>footer textarea:focus{border-color:#1664ff;outline:none}.channel-client-chat>footer button{color:#4e5969}.channel-client-chat>footer button.is-send{color:var(--client-foreground,#fff);background:var(--client-theme)}.channel-client-chat>footer button:disabled{opacity:.45;cursor:not-allowed}.channel-client-emoji-trigger{font-size:19px}.channel-client-emoji-picker{position:absolute;z-index:3;bottom:calc(100% + 8px);left:12px;display:grid;width:248px;grid-template-columns:repeat(8,1fr);gap:4px;padding:8px;background:#fff;border:1px solid #e5e6eb;border-radius:10px;box-shadow:0 18px 48px rgb(29 33 41 / 18%)}.channel-client-emoji-picker button{width:28px!important;height:28px!important;color:#1d2129!important;font-size:18px}.channel-client-fab{position:relative;display:grid;width:56px;height:56px;place-items:center;overflow:visible;padding:0;border:0;border-radius:50%;box-shadow:0 18px 48px rgb(29 33 41 / 18%);cursor:pointer}.channel-client-fab :deep(svg){width:24px;height:24px}.channel-client-fab>b{position:absolute;top:-5px;right:-5px;display:grid;min-width:20px;height:20px;place-items:center;padding:0 5px;color:#fff;background:#f53f3f;border:2px solid #fff;border-radius:10px;font-size:11px}.channel-client-state{display:grid;min-height:100vh;place-content:center;justify-items:center;gap:8px;color:#86909c}.channel-client-state strong{color:#1d2129;font-size:20px}@keyframes channel-client-open{from{opacity:0;transform:translateY(20px) scale(.92)}to{opacity:1;transform:none}}@media(max-width:767px){.channel-client-chat:not(.is-page){width:calc(100vw - 24px);height:calc(100vh - 96px)}}
.client-message-image-button{display:block;padding:0;background:transparent;border:0;cursor:zoom-in}.client-video-wrap{display:grid;gap:4px}.client-video-wrap a{color:#1664ff;font-size:12px}.channel-client-pending-files>span{grid-template-columns:28px minmax(0,1fr) auto auto}.channel-client-pending-files>span>span{display:grid;min-width:0}.channel-client-pending-files small{overflow:hidden;color:#86909c;font-size:11px;text-overflow:ellipsis;white-space:nowrap}.channel-client-pending-files .is-failed small{color:#f53f3f}.channel-client-image-viewer{position:fixed;z-index:100;inset:0;display:grid;width:100%;height:100%;place-items:center;padding:32px;background:rgb(0 0 0 / 72%);border:0;cursor:zoom-out}.channel-client-image-viewer img{max-width:100%;max-height:100%;object-fit:contain}
</style>
