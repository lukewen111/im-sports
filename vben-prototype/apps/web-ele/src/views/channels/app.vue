<script lang="ts" setup>
import type { InputInstance } from 'element-plus';

import type { Channel, ChannelType } from '#/features/channels/channel-data';

import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw } from 'vue';
import { onBeforeRouteLeave, useRoute } from 'vue-router';

import {
  ElButton, ElDialog, ElDropdown, ElDropdownItem, ElDropdownMenu, ElForm, ElFormItem,
  ElInput, ElInputNumber, ElMessage, ElMessageBox, ElSwitch, ElTable, ElTableColumn,
} from 'element-plus';

import {
  channelMeta, channelTypes, createChannelDraft, foregroundForTheme, formatDate, languages, parseDomain,
} from '#/features/channels/channel-data';
import { useChannelStore } from '#/features/channels/channel-store';

import ChannelGlyph from './ChannelGlyph.vue';
import ChannelOptionSelect from './ChannelOptionSelect.vue';
import TeamAvatar from './TeamAvatar.vue';
import WidgetGlyph from './WidgetGlyph.vue';

type Filter = 'all' | ChannelType;
type DetailSection = 'appearance' | 'basic' | 'display';
interface PreviewMessage { content: string; fileUrl?: string; id: string; kind?: 'file' | 'image' | 'text' | 'video'; role: 'agent' | 'customer'; time: string }

const store = useChannelStore();
const route = useRoute();
const activeType = ref<Filter>('all');
const query = ref('');
const page = ref(1);
const pageSize = 20;
const detailId = ref('');
const detailSection = ref<DetailSection>('basic');
const detailDraft = ref<Channel>();
const detailSaved = ref<Channel>();
const device = ref<'desktop' | 'mobile'>('desktop');
const widgetOpen = ref(true);
const previewMuted = ref(false);
const previewInput = ref('');
const previewInputRef = ref<InputInstance>();
const previewEmojiOpen = ref(false);
const visibleTime = ref('');
const messages = ref<PreviewMessage[]>([
  { content: '您好，请问有什么可以帮您？', id: 'hello', role: 'agent', time: '10:20' },
  { content: '我想查询订单状态。', id: 'question', role: 'customer', time: '10:21' },
]);
const formVisible = ref(false);
const installVisible = ref(false);
const shareVisible = ref(false);
const editingId = ref('');
const formError = ref('');
const formBaseline = ref('');
const listLoadFailed = ref(route.query.listError === '1');
const domainError = ref('');
const deleteTarget = ref<Channel>();
const deleteName = ref('');
const domainInput = ref('');
const draft = reactive<Channel>(createChannelDraft('web-widget'));

const detail = computed(() => detailDraft.value);
const sectionFields: Record<DetailSection, (keyof Channel)[]> = {
  basic: ['botToken', 'language', 'name', 'teamId', 'websiteDomain'],
  appearance: ['brandAvatar', 'brandName', 'brandSignature', 'themeColor'],
  display: ['allowedDomains', 'widgetCustomIcon', 'widgetDesktopVisible', 'widgetIcon', 'widgetMobileOffsetX', 'widgetMobileOffsetY', 'widgetMobilePosition', 'widgetMobileVisible', 'widgetOffsetX', 'widgetOffsetY', 'widgetPosition'],
};
function sectionState(value: Channel | undefined, section: DetailSection) { return JSON.stringify(Object.fromEntries(sectionFields[section].map((field) => [field, value?.[field]]))); }
function cloneField<T>(value: T): T { return (Array.isArray(value) ? [...value] : value) as T; }
function sectionDirty(section: DetailSection) { return sectionState(detail.value, section) !== sectionState(detailSaved.value, section); }
const dirty = computed(() => sectionDirty(detailSection.value));
const hasUnsavedChanges = computed(() => (Object.keys(sectionFields) as DetailSection[]).some((section) => sectionDirty(section)));
const currentMeta = computed(() => activeType.value === 'all' ? undefined : channelMeta[activeType.value]);
const filtered = computed(() => {
  if (activeType.value === 'all') return [];
  const term = query.value.trim().toLowerCase();
  return store.channels
    .filter((item) => item.type === activeType.value && (!term || item.name.toLowerCase().includes(term)))
    .toSorted((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
});
const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
const formTitle = computed(() => `${editingId.value ? '编辑' : '接入'} ${channelMeta[draft.type].label}`);
const clientUrl = computed(() => detail.value ? `${window.location.origin}/${detail.value.type === 'chat-page' ? 'chat' : 'widget'}/${detail.value.type === 'chat-page' ? detail.value.teamId : detail.value.id}` : '');
const origin = window.location.origin;
const languageOptions = languages.map((label) => ({ label, value: label }));
const teamOptions = computed(() => store.validTeams.map((team) => ({ label: team.name || '未命名', team, value: team.id })));
const previewEmojis = ['😀', '😁', '😂', '😊', '😍', '👍', '👏', '🎉', '🙏', '❤️', '👋', '🤔', '😢', '🔥', '✅', '👀'];
const formDirty = computed(() => JSON.stringify(draft) !== formBaseline.value);

function cloneChannel(value: Channel) { return structuredClone(toRaw(value)); }
function assignDraft(value: Channel) { Object.assign(draft, cloneChannel(value)); }
function setType(type: Filter) { activeType.value = type; query.value = ''; page.value = 1; detailId.value = ''; }
function count(type: ChannelType) { return store.channels.filter((item) => item.type === type).length; }
function openCreate(type?: ChannelType) {
  editingId.value = ''; formError.value = ''; domainError.value = '';
  assignDraft(createChannelDraft(type ?? (activeType.value === 'all' ? 'web-widget' : activeType.value)));
  formBaseline.value = JSON.stringify(draft);
  formVisible.value = true;
}
function openEdit(channel: Channel) { editingId.value = channel.id; formError.value = ''; domainError.value = ''; assignDraft(channel); formBaseline.value = JSON.stringify(draft); formVisible.value = true; }
async function closeForm() {
  if (formDirty.value) {
    try { await ElMessageBox.confirm('关闭后未保存的内容将丢失。', '放弃未保存的内容？', { confirmButtonText: '放弃内容', cancelButtonText: '继续编辑' }); }
    catch { return; }
  }
  formVisible.value = false;
}
function validateForm() {
  if (!draft.name.trim()) return '请输入渠道名称';
  if (store.channels.some((item) => item.id !== editingId.value && item.name.trim().toLowerCase() === draft.name.trim().toLowerCase())) return '渠道名称已存在，请使用唯一名称';
  if (!draft.teamId) return '请选择接待团队';
  if (draft.type === 'chat-page' && store.hasChatPage(draft.teamId, editingId.value)) return '该接待团队已创建聊天页面';
  if (draft.type === 'telegram') {
    const result = store.verifyTelegram(draft.botToken, editingId.value);
    if (result.error) return result.error;
  }
  return '';
}
function submitForm() {
  if (draft.type === 'web-widget') {
    const result = parseDomain(draft.websiteDomain ?? '');
    if (result.error) { domainError.value = result.error; return; }
    draft.websiteDomain = result.domain;
  }
  const error = validateForm(); if (error) { formError.value = error; return; }
  const saved = store.save(cloneChannel(draft)); formVisible.value = false;
  formBaseline.value = JSON.stringify(saved);
  ElMessage.success(editingId.value ? '渠道已保存' : (saved.type === 'telegram' ? 'Telegram 已连接' : '渠道已创建'));
  if (!editingId.value && saved.type === 'web-widget') installVisible.value = true;
  if (!editingId.value && saved.type === 'chat-page') shareVisible.value = true;
}
async function requestDelete(channel: Channel) {
  if (channel.enabled) { ElMessage.warning('请先停用渠道，再执行删除'); return; }
  deleteTarget.value = channel; deleteName.value = '';
}
function confirmDelete() { if (!deleteTarget.value || deleteName.value !== deleteTarget.value.name) return; store.remove(deleteTarget.value.id); deleteTarget.value = undefined; ElMessage.success('渠道已删除，历史会话数据已保留'); }
async function toggle(channel: Channel, enabled: boolean) {
  if (!enabled) {
    try { await ElMessageBox.confirm('停用后将立即停止接收新的客户消息，已有历史会话仍会保留。', `停用渠道「${channel.name}」？`, { confirmButtonText: '确认停用', cancelButtonText: '取消' }); }
    catch { return; }
  }
  const result = store.toggle(channel.id, enabled); if (result.error) ElMessage.warning(result.error); else ElMessage.success(enabled ? '渠道已启用' : '渠道已停用');
}
function openDetail(channel: Channel) { detailId.value = channel.id; detailSection.value = 'basic'; detailDraft.value = cloneChannel(channel); detailSaved.value = cloneChannel(channel); widgetOpen.value = true; }
async function leaveDetail() {
  if (hasUnsavedChanges.value) {
    try { await ElMessageBox.confirm('返回后未保存的修改将丢失。', '放弃未保存的内容？', { confirmButtonText: '放弃内容', cancelButtonText: '继续编辑' }); }
    catch { return; }
  }
  detailId.value = ''; detailDraft.value = undefined; detailSaved.value = undefined;
}
function saveDetail() {
  if (!detail.value || !detailSaved.value) return;
  if (!dirty.value) return;
  if (detailSection.value === 'basic') {
    if (!detail.value.name.trim()) { ElMessage.error('请输入渠道名称'); return; }
    if (!detail.value.teamId) { ElMessage.error('请选择接待团队'); return; }
    if (detail.value.type === 'chat-page' && detail.value.teamId !== detailSaved.value.teamId) { ElMessage.error('聊天页面创建后不可修改接待团队'); return; }
    if (detail.value.type === 'telegram') {
      const result = store.verifyTelegram(detail.value.botToken, detail.value.id);
      if (result.error) { ElMessage.error(result.error); return; }
    }
    if (detail.value.type === 'web-widget') {
      const result = parseDomain(detail.value.websiteDomain ?? '');
      if (result.error) { ElMessage.error(result.error); return; }
      detail.value.websiteDomain = result.domain;
    }
  }
  if (detailSection.value === 'appearance' && !/^#[0-9a-f]{6}$/i.test(detail.value.themeColor || '')) {
    ElMessage.error('请输入合法的 6 位 HEX 主题颜色'); return;
  }
  const offsets = [detail.value.widgetOffsetX, detail.value.widgetOffsetY, detail.value.widgetMobileOffsetX, detail.value.widgetMobileOffsetY];
  if (detailSection.value === 'display' && offsets.some((value) => !Number.isInteger(value ?? 0) || (value ?? 0) < 0 || (value ?? 0) > 100)) {
    ElMessage.error('边距仅支持 0～100 的整数'); return;
  }
  const current = store.channels.find((item) => item.id === detail.value?.id); if (!current) return;
  if (current.updatedAt !== detailSaved.value.updatedAt) {
    void ElMessageBox.confirm('该渠道已在其他页面发生修改。请刷新为最新内容后重新编辑。', '配置已更新', { confirmButtonText: '刷新配置', cancelButtonText: '继续查看' })
      .then(() => openDetail(current)).catch(() => undefined);
    return;
  }
  const patch = Object.fromEntries(sectionFields[detailSection.value].map((field) => [field, cloneField(detail.value?.[field])]));
  store.save({ ...cloneChannel(current), ...patch }); Object.assign(detailSaved.value, patch); ElMessage.success('当前分组已保存');
}
function cancelSection() {
  if (!detail.value || !detailSaved.value) return;
  const patch = Object.fromEntries(sectionFields[detailSection.value].map((field) => [field, cloneField(detailSaved.value?.[field])]));
  Object.assign(detail.value, patch); ElMessage.info('已恢复当前分组的最近保存配置');
}
function addDomain() {
  if (!detail.value || !domainInput.value.trim()) return;
  if (detail.value.allowedDomains.length >= 50) { ElMessage.warning('允许域名最多添加 50 个'); return; }
  const result = parseDomain(domainInput.value); if (result.error) { ElMessage.warning(result.error); return; }
  if (result.domain && !detail.value.allowedDomains.includes(result.domain)) detail.value.allowedDomains.push(result.domain);
  domainInput.value = '';
}
async function removeDomain(domain: string) {
  if (!detail.value) return;
  if (detail.value.allowedDomains.length === 1) {
    try { await ElMessageBox.confirm('移除后所有网站均可使用该渠道代码。', '确认恢复不限域名？', { confirmButtonText: '确认移除', cancelButtonText: '取消' }); }
    catch { return; }
  }
  detail.value.allowedDomains = detail.value.allowedDomains.filter((item) => item !== domain);
}
function sendMessage() {
  const content = previewInput.value.trim(); if (!content) return;
  if (content.length > 2000) { ElMessage.warning('单条消息不能超过 2,000 个字符'); return; }
  messages.value.push({ content, id: `message-${Date.now()}`, role: 'customer', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }); previewInput.value = '';
}
function insertPreviewEmoji(emoji: string) {
  const input = previewInputRef.value?.input;
  const start = input?.selectionStart ?? previewInput.value.length;
  const end = input?.selectionEnd ?? previewInput.value.length;
  previewInput.value = `${previewInput.value.slice(0, start)}${emoji}${previewInput.value.slice(end)}`;
  previewEmojiOpen.value = false;
  void nextTick(() => { previewInputRef.value?.focus(); previewInputRef.value?.input?.setSelectionRange(start + emoji.length, start + emoji.length); });
}
function sendPreviewAttachment(event: Event) {
  const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
  if (file.name.length > 255) { ElMessage.error('文件名不能超过 255 个字符'); return; }
  if (file.size > 20 * 1024 * 1024) { ElMessage.error('附件不能超过 20 MB'); return; }
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { ElMessage.error('预览仅支持图片和视频'); return; }
  messages.value.push({ content: file.name, fileUrl: URL.createObjectURL(file), id: `preview-file-${Date.now()}`, kind: file.type.startsWith('image/') ? 'image' : 'video', role: 'customer', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
  input.value = ''; ElMessage.success('文件已添加');
}
async function copy(value: string, label: string) { await navigator.clipboard?.writeText(value); ElMessage.success(`${label}已复制`); }
function openClient() { if (detail.value) window.open(clientUrl.value, '_blank', 'noopener,noreferrer'); }
function uploadImage(event: Event, field: 'brandAvatar' | 'widgetCustomIcon') {
  const file = (event.target as HTMLInputElement).files?.[0]; if (!file || !detail.value) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { ElMessage.error('仅支持 JPG、PNG、WEBP 格式且不超过 2 MB'); return; }
  const reader = new FileReader(); reader.addEventListener('load', () => { if (detail.value) { detail.value[field] = String(reader.result); if (field === 'widgetCustomIcon') detail.value.widgetIcon = 'custom'; } }); reader.readAsDataURL(file);
}
function clearImage(field: 'brandAvatar' | 'widgetCustomIcon') {
  if (!detail.value) return;
  detail.value[field] = undefined;
  if (field === 'widgetCustomIcon') detail.value.widgetIcon = 'message';
}
function openInstall(channel: Channel) { openDetail(channel); nextTick(() => { installVisible.value = true; }); }
function acknowledgeInstall() {
  const channel = detail.value;
  if (!channel || channel.type !== 'web-widget') return;
  store.acknowledgeInstall(channel.id);
  channel.installStatus = 'success'; channel.installCheckedAt = new Date().toISOString();
  ElMessage.success('已收到模拟网站安装回执');
}
function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value && !(formVisible.value && formDirty.value)) return;
  event.preventDefault(); event.returnValue = '';
}
onBeforeRouteLeave(async () => {
  if (!hasUnsavedChanges.value && !(formVisible.value && formDirty.value)) return true;
  try { await ElMessageBox.confirm('离开后未保存的修改将丢失。', '放弃未保存的内容？', { confirmButtonText: '放弃内容', cancelButtonText: '继续编辑' }); return true; }
  catch { return false; }
});
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload));
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload));
</script>

<template>
  <section class="channels-page">
    <div class="channels-layout" :class="{ 'is-detail': detail }">
      <aside v-if="!detail" class="channels-subnav">
        <div class="channels-subnav-title">渠道</div>
        <button :class="{ active: activeType === 'all' }" @click="setType('all')">全部</button>
        <button v-for="type in channelTypes" :key="type" :class="{ active: activeType === type }" @click="setType(type)"><ChannelGlyph :type="type" />{{ channelMeta[type].label }}</button>
      </aside>

      <main class="channels-main">
        <template v-if="detail">
          <header class="modern-channel-head">
            <div><button class="icon-button back-button" aria-label="返回" @click="leaveDetail"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button><ChannelGlyph :type="detail.type" /><h1>{{ detail.name }}</h1></div>
            <div><ElButton v-if="detail.type === 'web-widget'" @click="installVisible = true"><span class="code-mark">&lt;/&gt;</span>安装代码</ElButton><span>{{ detail.enabled ? '已启用' : '已停用' }}</span><ElSwitch :model-value="detail.enabled" @change="(value) => toggle(detail!, Boolean(value))" /></div>
          </header>
          <div class="modern-channel-workspace">
            <nav class="modern-channel-nav">
              <button :class="{ active: detailSection === 'basic' }" @click="detailSection = 'basic'">基本设置<i v-if="sectionDirty('basic')"></i></button>
              <button :class="{ active: detailSection === 'appearance' }" @click="detailSection = 'appearance'">品牌外观<i v-if="sectionDirty('appearance')"></i></button>
              <button :class="{ active: detailSection === 'display' }" @click="detailSection = 'display'">{{ detail.type === 'web-widget' ? '可见性与位置' : detail.type === 'chat-page' ? '聊天链接' : '连接信息' }}<i v-if="sectionDirty('display')"></i></button>
            </nav>
            <section class="modern-channel-config">
              <section class="modern-config-section">
                <h2>{{ detailSection === 'basic' ? '基本设置' : detailSection === 'appearance' ? '品牌外观' : detail.type === 'web-widget' ? '可见性与位置' : detail.type === 'chat-page' ? '聊天链接' : '连接信息' }}</h2>
              <ElForm v-if="detailSection === 'basic'" label-position="top">
                <ElFormItem label="渠道名称"><ElInput v-model="detail.name" maxlength="50" show-word-limit /></ElFormItem>
                <ElFormItem v-if="detail.type === 'web-widget'" label="网站域名"><ElInput v-model="detail.websiteDomain" /></ElFormItem>
                <ElFormItem v-if="detail.type === 'telegram'" label="Bot Token"><ElInput v-model="detail.botToken" show-password /></ElFormItem>
                <ElFormItem v-if="detail.type !== 'telegram'" label="界面语言"><ChannelOptionSelect v-model="detail.language" :options="languageOptions" /></ElFormItem>
                <ElFormItem label="接待团队"><ChannelOptionSelect v-if="detail.type !== 'chat-page'" v-model="detail.teamId" :options="teamOptions" placeholder="选择接待团队" variant="team" /><div v-else class="readonly-team"><TeamAvatar :team="store.resolveTeam(detail.teamId)" />{{ store.resolveTeam(detail.teamId)?.name || '默认团队' }}</div></ElFormItem>
              </ElForm>
              <ElForm v-else-if="detailSection === 'appearance'" label-position="top">
                <div class="brand-grid"><div><ElFormItem label="品牌名称"><ElInput v-model="detail.brandName" maxlength="50" show-word-limit /></ElFormItem><ElFormItem label="签名"><ElInput v-model="detail.brandSignature" maxlength="50" show-word-limit /></ElFormItem></div><ElFormItem label="品牌 LOGO"><div class="image-upload-group"><label class="image-upload"><img v-if="detail.brandAvatar" :src="detail.brandAvatar" alt="品牌 LOGO" /><span v-else>＋</span><input type="file" accept=".jpg,.jpeg,.png,.webp" @change="uploadImage($event, 'brandAvatar')" /></label><button v-if="detail.brandAvatar" type="button" @click="clearImage('brandAvatar')">删除</button></div></ElFormItem></div>
                <ElFormItem label="主题色"><div class="color-control"><input v-model="detail.themeColor" class="native-color-input" type="color" aria-label="选择主题色" /><ElInput v-model="detail.themeColor" /></div></ElFormItem>
              </ElForm>
              <template v-else-if="detail.type === 'web-widget'">
                <label class="field-label">允许域名</label><div class="domain-editor"><span v-for="domain in detail.allowedDomains" :key="domain">{{ domain }}<button @click="removeDomain(domain)">×</button></span><input v-model="domainInput" placeholder="留空则所有域名可显示；输入后按 Enter 添加" @keydown.enter.prevent="addDomain" /></div>
                <label class="field-label">悬浮按钮图标</label><div class="icon-picker"><label class="is-upload" :class="{ selected: detail.widgetIcon === 'custom' }" aria-label="上传自定义图标"><WidgetGlyph v-if="detail.widgetIcon === 'custom' && detail.widgetCustomIcon" type="custom" :custom-icon="detail.widgetCustomIcon" /><strong v-else>＋</strong><input type="file" accept=".jpg,.jpeg,.png,.webp" @change="uploadImage($event, 'widgetCustomIcon')" /></label><button v-for="icon in ['message','message-dark','message-line'] as const" :key="icon" :aria-label="icon === 'message' ? '默认消息图标' : icon === 'message-dark' ? '深色消息图标' : '文本消息图标'" :class="{ selected: detail.widgetIcon === icon }" @click="detail.widgetIcon = icon"><WidgetGlyph :type="icon" /></button></div><button v-if="detail.widgetCustomIcon" class="restore-icon" type="button" @click="clearImage('widgetCustomIcon')">恢复默认图标</button>
                <div class="device-tabs"><button :class="{ active: device === 'desktop' }" @click="device = 'desktop'"><span class="device-desktop-icon"></span>桌面端</button><button :class="{ active: device === 'mobile' }" @click="device = 'mobile'"><span class="device-mobile-icon"></span>移动端</button></div>
                <div class="device-settings">
<div class="setting-row"><div><strong>展示</strong><small>控制网站小部件是否在{{ device === 'desktop' ? '桌面端' : '移动端' }}显示</small></div><ElSwitch v-if="device === 'desktop'" v-model="detail.widgetDesktopVisible" /><ElSwitch v-else v-model="detail.widgetMobileVisible" /></div>
                  <label class="field-label">按钮位置</label><div class="position-picker"><button :class="{ active: (device === 'desktop' ? detail.widgetPosition : detail.widgetMobilePosition) === 'bottom-left' }" @click="device === 'desktop' ? detail.widgetPosition = 'bottom-left' : detail.widgetMobilePosition = 'bottom-left'">左侧</button><div class="device-outline"><i :class="device === 'desktop' ? detail.widgetPosition : detail.widgetMobilePosition"></i></div><button :class="{ active: (device === 'desktop' ? detail.widgetPosition : detail.widgetMobilePosition) === 'bottom-right' }" @click="device === 'desktop' ? detail.widgetPosition = 'bottom-right' : detail.widgetMobilePosition = 'bottom-right'">右侧</button></div>
                  <label class="field-label">边缘距离</label><div class="offset-row"><label>侧边<ElInputNumber v-if="device === 'desktop'" v-model="detail.widgetOffsetX" :min="0" :max="100" /><ElInputNumber v-else v-model="detail.widgetMobileOffsetX" :min="0" :max="100" /></label><label>底部<ElInputNumber v-if="device === 'desktop'" v-model="detail.widgetOffsetY" :min="0" :max="100" /><ElInputNumber v-else v-model="detail.widgetMobileOffsetY" :min="0" :max="100" /></label></div>
                </div>
              </template>
              <div v-else-if="detail.type === 'chat-page'" class="link-card"><label>聊天页面 URL</label><div><ElInput :model-value="clientUrl" readonly /><ElButton @click="copy(clientUrl, '聊天页面链接')">复制</ElButton></div><ElButton @click="openClient">打开聊天页面</ElButton></div>
                <div v-else class="telegram-info"><strong>Telegram Bot</strong><p>通过 Bot Token 接收 Telegram 客户消息。Token 更新后保存即可重新连接。</p><span class="connected-dot">已连接</span></div>
              </section>
              <footer class="config-actions"><ElButton :disabled="!dirty" @click="cancelSection">取消</ElButton><ElButton type="primary" :disabled="!dirty" @click="saveDetail">保存</ElButton></footer>
            </section>
            <aside class="modern-channel-preview">
              <div class="modern-preview-head"><h2>预览</h2></div>
              <div class="modern-preview-stage is-desktop" :class="[`is-${detail.type}`]">
                <div v-if="detail.type !== 'web-widget' || detail.widgetDesktopVisible" class="widget-anchor" :class="detail.widgetPosition" :style="{ '--widget-offset-x': `${detail.widgetOffsetX}px`, '--widget-offset-y': `${detail.widgetOffsetY}px` }">
                  <div v-if="detail.type !== 'web-widget' || widgetOpen" class="chat-surface" :style="{ '--theme': detail.themeColor, '--theme-fg': foregroundForTheme(detail.themeColor) }">
                    <header><div class="brand-avatar"><img v-if="detail.brandAvatar" :src="detail.brandAvatar" alt="" /><span v-else>{{ (detail.brandName || detail.name).slice(0,1) }}</span></div><div><strong>{{ detail.brandName || detail.name }}</strong><small>{{ detail.brandSignature }}</small></div><button type="button" :aria-label="previewMuted ? '打开消息通知' : '关闭消息通知'" :title="previewMuted ? '打开消息通知' : '关闭消息通知'" @click="previewMuted = !previewMuted"><svg v-if="previewMuted" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.3 5.2A5.5 5.5 0 0 1 17.5 9v3l2 3H6.8M9.5 19h5M3 3l18 18" /></svg><svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg></button><button v-if="detail.type === 'web-widget'" type="button" aria-label="收起聊天窗口" title="收起聊天窗口" @click="widgetOpen = false">—</button></header>
                    <main><div v-for="message in messages" :key="message.id" :class="`is-${message.role}`"><button v-if="message.kind === 'image'" class="preview-image" @click="visibleTime = visibleTime === message.id ? '' : message.id"><img :src="message.fileUrl" :alt="message.content" /></button><video v-else-if="message.kind === 'video'" class="preview-video" :src="message.fileUrl" controls @click="visibleTime = visibleTime === message.id ? '' : message.id"></video><button v-else-if="message.kind === 'file'" class="preview-file" @click="visibleTime = visibleTime === message.id ? '' : message.id">▤ {{ message.content }}</button><button v-else @click="visibleTime = visibleTime === message.id ? '' : message.id">{{ message.content }}</button><time v-if="visibleTime === message.id">{{ message.time }}</time></div></main>
                    <footer><label class="preview-attach" title="添加文件">＋<input type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.heic,.mp4,.mov,.webm" @change="sendPreviewAttachment" /></label><button type="button" class="preview-emoji-trigger" aria-label="插入表情" title="插入表情" @click.stop="previewEmojiOpen = !previewEmojiOpen">☺</button><div v-if="previewEmojiOpen" class="preview-emoji-picker" role="dialog" aria-label="选择表情"><button v-for="emoji in previewEmojis" :key="emoji" type="button" :aria-label="`插入表情 ${emoji}`" @click="insertPreviewEmoji(emoji)">{{ emoji }}</button></div><ElInput ref="previewInputRef" v-model="previewInput" maxlength="2000" placeholder="输入您的消息..." @keyup.enter="sendMessage" /><button class="send" aria-label="发送" @click="sendMessage"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" /></svg></button></footer>
                  </div>
                  <button v-else class="widget-fab" :style="{ background: detail.themeColor, color: foregroundForTheme(detail.themeColor) }" aria-label="打开聊天窗口" @click="widgetOpen = true"><WidgetGlyph :type="detail.widgetIcon" :custom-icon="detail.widgetCustomIcon" /></button>
                </div>
                <p v-else class="hidden-hint">该设备已隐藏网站小部件</p>
              </div>
            </aside>
          </div>
        </template>

        <template v-else-if="activeType === 'all'">
          <header class="channels-panel-header"><h1>全部渠道</h1></header>
          <div class="channel-type-grid"><article v-for="type in channelTypes" :key="type" class="channel-type-card"><div class="channel-type-card-head"><ChannelGlyph :type="type" /><div><h2>{{ channelMeta[type].label }}</h2><span v-if="count(type)" class="connected-pill">已连接 {{ count(type) }}</span></div></div><p>{{ channelMeta[type].description }}</p><button @click="count(type) ? setType(type) : openCreate(type)">{{ count(type) ? '管理' : channelMeta[type].addLabel }}</button></article></div>
        </template>

        <template v-else>
          <header class="channels-panel-header"><h1>{{ currentMeta?.label }}</h1><ElButton type="primary" @click="openCreate()">＋ {{ currentMeta?.addLabel }}</ElButton></header>
          <div class="channel-list-content">
            <div v-if="listLoadFailed" class="list-error-banner"><span>列表加载失败，已保留当前查询条件和已有数据。</span><ElButton size="small" @click="listLoadFailed = false">重试</ElButton></div>
            <ElInput v-if="store.channels.some((item) => item.type === activeType)" v-model="query" :maxlength="50" class="channel-search" clearable placeholder="搜索渠道名称" @input="page = 1" />
            <ElTable :data="paged" class="channel-table" empty-text="暂无渠道">
              <ElTableColumn label="渠道名称" min-width="270"><template #default="scope"><button class="channel-name-cell" @click="scope.row.type === 'telegram' ? openEdit(scope.row) : openDetail(scope.row)"><ChannelGlyph :type="scope.row.type" /><span><strong>{{ scope.row.name }}</strong><small v-if="scope.row.websiteDomain">{{ scope.row.websiteDomain }}</small></span></button></template></ElTableColumn>
              <ElTableColumn label="接待团队" min-width="180"><template #default="scope"><span class="agent-cell"><TeamAvatar :team="store.resolveTeam(scope.row.teamId)" />{{ store.resolveTeam(scope.row.teamId)?.name || '默认团队' }}</span></template></ElTableColumn>
              <ElTableColumn label="创建时间" width="180"><template #default="scope">{{ formatDate(scope.row.createdAt) }}</template></ElTableColumn>
              <ElTableColumn v-if="activeType === 'web-widget'" label="状态" width="110"><template #default="scope"><span class="status-pill" :class="[scope.row.installStatus === 'success' ? 'connected' : '']">{{ scope.row.installStatus === 'success' ? '已连接' : '未连接' }}</span></template></ElTableColumn>
              <ElTableColumn label="启用状态" width="110"><template #default="scope"><ElSwitch :model-value="scope.row.enabled" @change="(value) => toggle(scope.row, Boolean(value))" /></template></ElTableColumn>
              <ElTableColumn label="操作" width="72"><template #default="scope"><ElDropdown trigger="click"><ElButton text class="more-button">•••</ElButton><template #dropdown><ElDropdownMenu><ElDropdownItem @click="scope.row.type === 'telegram' ? openEdit(scope.row) : openDetail(scope.row)">编辑</ElDropdownItem><ElDropdownItem v-if="scope.row.type === 'web-widget'" @click="openInstall(scope.row)">安装代码</ElDropdownItem><ElDropdownItem divided @click="requestDelete(scope.row)">删除</ElDropdownItem></ElDropdownMenu></template></ElDropdown></template></ElTableColumn>
            </ElTable><div class="table-footer"><span>共 {{ filtered.length }} 条</span><button :disabled="page === 1" @click="page--">‹</button><button class="active">{{ page }}</button><button :disabled="page === pageCount" @click="page++">›</button></div>
          </div>
        </template>
      </main>
    </div>

    <ElDialog v-model="formVisible" class="channel-config-dialog" width="560px" :before-close="closeForm" destroy-on-close>
<template #header><div class="dialog-title"><ChannelGlyph :type="draft.type" /><span>{{ formTitle }}</span></div></template><ElForm label-position="top">
      <ElFormItem label="渠道名称"><ElInput v-model="draft.name" maxlength="50" show-word-limit /></ElFormItem>
      <ElFormItem v-if="draft.type === 'web-widget'" label="网站域名" :error="domainError"><ElInput v-model="draft.websiteDomain" placeholder="example.com" /></ElFormItem>
      <ElFormItem v-if="draft.type === 'telegram'" label="Bot Token"><ElInput v-model="draft.botToken" show-password placeholder="123456789:token" /><small class="field-tip">在 Telegram 的 BotFather 中创建 Bot 并复制 Token。</small></ElFormItem>
      <ElFormItem v-if="draft.type !== 'telegram'" label="界面语言"><ChannelOptionSelect v-model="draft.language" :options="languageOptions" /></ElFormItem>
      <ElFormItem label="接待团队"><ChannelOptionSelect v-model="draft.teamId" :options="teamOptions" placeholder="选择接待团队" variant="team" /></ElFormItem>
      <p v-if="formError" class="form-error">{{ formError }}</p>
    </ElForm><template #footer><ElButton @click="closeForm">取消</ElButton><ElButton type="primary" @click="submitForm">{{ editingId ? '保存' : channelMeta[draft.type].addLabel }}</ElButton></template>
</ElDialog>

    <ElDialog v-model="installVisible" class="install-code-modal" title="安装网站小部件" width="860px"><p>将以下代码粘贴到页面 <code>&lt;/body&gt;</code> 标签之前。</p><pre><code>{{ detail?.installCode || draft.installCode }}</code></pre><div class="install-code-modal-actions"><ElButton class="install-code-copy-button" type="primary" @click="copy(detail?.installCode || draft.installCode || '', '安装代码')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>复制代码</ElButton><ElButton v-if="detail?.type === 'web-widget' && detail.installStatus !== 'success'" @click="acknowledgeInstall">模拟安装回执</ElButton></div></ElDialog>
    <ElDialog v-model="shareVisible" class="chat-page-setup-modal" title="与客户分享您的聊天页面" width="720px"><p class="dialog-copy">在新闻简报、网站和社交媒体上分享聊天链接，以便客户随时与你聊天。</p><div class="share-row"><ElInput :model-value="`${origin}/chat/${draft.teamId}`" readonly /><ElButton @click="copy(`${origin}/chat/${draft.teamId}`, '聊天页面链接')">复制链接</ElButton></div></ElDialog>
    <ElDialog :model-value="Boolean(deleteTarget)" title="删除渠道？" width="480px" @update:model-value="(value) => { if (!value) deleteTarget = undefined }"><p class="dialog-copy">删除后该渠道的入站消息将立即停止，历史会话保留但不可继续接收。请输入渠道名称以确认。</p><label class="delete-label">渠道名称<ElInput v-model="deleteName" :placeholder="deleteTarget?.name" /></label><template #footer><ElButton @click="deleteTarget = undefined">取消</ElButton><ElButton type="danger" :disabled="deleteName !== deleteTarget?.name" @click="confirmDelete">确认删除</ElButton></template></ElDialog>
  </section>
</template>

