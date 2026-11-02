<script lang="ts" setup>
import type { Channel, ChannelType } from '#/features/channels/channel-data';

import { computed, reactive, ref, watch } from 'vue';

import {
  ElButton,
  ElColorPicker,
  ElDialog,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTag,
} from 'element-plus';
import { QiArrowLeft, QiCharPlus, QiSearch, QiSendRight } from 'qingicon-vue';

import {
  channelMeta,
  channelTypes,
  loadChannels,
  saveChannels,
} from '#/features/channels/channel-data';

import ChannelGlyph from './ChannelGlyph.vue';

type ChannelFilter = 'all' | ChannelType;

const channels = ref<Channel[]>(loadChannels());
const activeType = ref<ChannelFilter>('all');
const query = ref('');
const detail = ref<Channel>();
const dialogVisible = ref(false);
const editingId = ref<string>();
const detailSection = ref<'appearance' | 'basic' | 'display'>('basic');

const emptyForm = (): Channel => ({
  agent: '',
  brandName: 'IM Support',
  brandSignature: '有问题？我们随时为您提供帮助。',
  createdAt: '',
  enabled: true,
  id: '',
  language: '自动',
  name: '',
  themeColor: '#1664ff',
  type: activeType.value === 'all' ? 'web-widget' : activeType.value,
  websiteDomain: '',
});

const form = reactive<Channel>(emptyForm());

const filteredChannels = computed(() => {
  if (activeType.value === 'all') return [];
  const normalized = query.value.trim().toLowerCase();
  return channels.value.filter(
    (channel) =>
      channel.type === activeType.value &&
      (!normalized || channel.name.toLowerCase().includes(normalized)),
  );
});

const currentMeta = computed(() =>
  activeType.value === 'all' ? undefined : channelMeta[activeType.value],
);

watch(channels, (value) => saveChannels(value), { deep: true });

function channelCount(type: ChannelType) {
  return channels.value.filter((channel) => channel.type === type).length;
}

function setType(type: ChannelFilter) {
  activeType.value = type;
  detail.value = undefined;
  query.value = '';
}

function openCreate(type?: ChannelType) {
  editingId.value = undefined;
  Object.assign(form, emptyForm(), {
    type: type ?? (activeType.value === 'all' ? 'web-widget' : activeType.value),
  });
  dialogVisible.value = true;
}

function openEdit(channel: Channel) {
  editingId.value = channel.id;
  Object.assign(form, channel);
  dialogVisible.value = true;
}

function submitForm() {
  const name = form.name.trim();
  if (!name) return ElMessage.warning('请输入渠道名称');
  if (!form.agent) return ElMessage.warning('请选择接待 AI Agent');
  if (
    channels.value.some(
      (channel) =>
        channel.id !== editingId.value &&
        channel.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    return ElMessage.warning('渠道名称已存在');
  }
  if (
    form.type === 'web-widget' &&
    !/^[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)+$/i.test(
      form.websiteDomain?.trim() ?? '',
    )
  ) {
    return ElMessage.warning('请输入有效的网站域名');
  }

  const value: Channel = {
    ...form,
    createdAt:
      form.createdAt ||
      new Intl.DateTimeFormat('zh-CN', {
        day: '2-digit',
        hour: '2-digit',
        hour12: false,
        minute: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
        .format(new Date())
        .replaceAll('/', '-'),
    id: editingId.value ?? `channel-${Date.now()}`,
    name,
    websiteDomain: form.websiteDomain?.trim(),
  };

  const index = channels.value.findIndex((channel) => channel.id === value.id);
  if (index === -1) channels.value.unshift(value);
  else channels.value[index] = value;
  if (detail.value?.id === value.id) detail.value = value;
  dialogVisible.value = false;
  ElMessage.success(editingId.value ? '渠道已保存' : '渠道已创建');
}

async function removeChannel(channel: Channel) {
  try {
    await ElMessageBox.confirm(
      `删除后无法恢复，确认删除“${channel.name}”吗？`,
      '删除渠道',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' },
    );
    channels.value = channels.value.filter((item) => item.id !== channel.id);
    if (detail.value?.id === channel.id) detail.value = undefined;
    ElMessage.success('渠道已删除');
  } catch {
    // User cancelled the destructive action.
  }
}

function openDetail(channel: Channel) {
  detail.value = channel;
  detailSection.value = 'basic';
}

function handleRowAction(command: string, channel: Channel) {
  if (command === 'edit') openEdit(channel);
  if (command === 'delete') void removeChannel(channel);
}

function saveDetail() {
  if (!detail.value) return;
  const index = channels.value.findIndex(
    (channel) => channel.id === detail.value?.id,
  );
  if (index !== -1) channels.value[index] = { ...detail.value };
  ElMessage.success('渠道配置已保存');
}
</script>

<template>
  <section class="channel-page">
    <div class="channel-shell">
      <aside v-if="!detail" class="channel-subnav">
        <h2>渠道</h2>
        <button :class="{ active: activeType === 'all' }" @click="setType('all')">
          全部
        </button>
        <button
          v-for="type in channelTypes"
          :key="type"
          :class="{ active: activeType === type }"
          @click="setType(type)"
        >
          <ChannelGlyph :type="type" />
          {{ channelMeta[type].label }}
        </button>
      </aside>

      <main class="channel-content">
        <template v-if="detail">
          <header class="content-header detail-title">
            <div>
              <ElButton text circle aria-label="返回列表" @click="detail = undefined"><QiArrowLeft :size="18" /></ElButton>
              <ChannelGlyph :type="detail.type" />
              <h2>{{ detail.name }}</h2>
            </div>
            <div class="detail-toolbar"><ElButton v-if="detail.type === 'web-widget'" class="install-button" @click="ElMessage.success('安装代码已复制')">&lt;/&gt;&nbsp; 安装代码</ElButton><div class="enabled-control"><span>{{ detail.enabled ? '已启用' : '已停用' }}</span><ElSwitch v-model="detail.enabled" /></div></div>
          </header>
          <div class="detail-layout">
            <nav class="detail-nav">
              <button :class="{ active: detailSection === 'basic' }" @click="detailSection = 'basic'">基本设置</button>
              <button :class="{ active: detailSection === 'appearance' }" @click="detailSection = 'appearance'">品牌外观</button>
              <button :class="{ active: detailSection === 'display' }" @click="detailSection = 'display'">{{ detail.type === 'web-widget' ? '可见性与位置' : '聊天链接' }}</button>
            </nav>
            <section class="detail-form">
              <h3>{{ detailSection === 'basic' ? '基本设置' : detailSection === 'appearance' ? '品牌外观' : detail.type === 'web-widget' ? '可见性与位置' : '聊天链接' }}</h3>
              <ElForm v-if="detailSection === 'basic'" label-position="top">
                <ElFormItem label="渠道名称"><ElInput v-model="detail.name" /></ElFormItem>
                <ElFormItem v-if="detail.type === 'web-widget'" label="网站域名"><ElInput v-model="detail.websiteDomain" /></ElFormItem>
                <ElFormItem label="界面语言"><ElSelect v-model="detail.language"><ElOption label="自动" value="自动" /><ElOption label="简体中文" value="简体中文" /><ElOption label="英语" value="英语" /></ElSelect></ElFormItem>
                <ElFormItem label="接待 AI Agent"><ElSelect v-model="detail.agent"><ElOption label="客服接待" value="客服接待" /><ElOption label="售前咨询" value="售前咨询" /></ElSelect></ElFormItem>
              </ElForm>
              <ElForm v-else-if="detailSection === 'appearance'" label-position="top">
                <ElFormItem label="品牌名称"><ElInput v-model="detail.brandName" /></ElFormItem>
                <ElFormItem label="签名"><ElInput v-model="detail.brandSignature" /></ElFormItem>
                <ElFormItem label="主题色"><div class="color-control"><ElColorPicker v-model="detail.themeColor" /><ElInput v-model="detail.themeColor" /></div></ElFormItem>
              </ElForm>
              <div v-else class="share-settings">
                <template v-if="detail.type === 'web-widget'">
                  <div class="setting-row"><span>桌面端显示</span><ElSwitch :model-value="true" /></div>
                  <div class="setting-row"><span>移动端显示</span><ElSwitch :model-value="true" /></div>
                  <ElForm label-position="top"><ElFormItem label="允许展示的域名"><ElInput :model-value="detail.websiteDomain" /></ElFormItem></ElForm>
                </template>
                <template v-else>
                  <label>聊天链接</label>
                  <ElInput :model-value="`https://support.example.com/chat/${detail.id}`" readonly />
                </template>
              </div>
              <footer><ElButton @click="detail = undefined">取消</ElButton><ElButton type="primary" @click="saveDetail">保存</ElButton></footer>
            </section>
            <aside class="channel-preview">
              <h3>预览</h3>
              <div class="preview-stage">
                <div class="preview-chat">
                  <header :style="{ background: detail.themeColor }"><span>{{ detail.brandName.slice(0, 1) }}</span><div><strong>{{ detail.brandName }}</strong><small>{{ detail.brandSignature }}</small></div><button aria-label="关闭消息通知">♧</button><button aria-label="收起聊天窗口">—</button></header>
                  <main><p>您好，请问有什么可以帮您？</p><p class="is-customer" :style="{ background: detail.themeColor }">我想查询订单状态。</p></main>
                  <footer><button class="attach-button"><QiCharPlus :size="18" /></button><span>输入您的消息...</span><button class="send-button" :style="{ background: detail.themeColor }"><QiSendRight :size="18" /></button></footer>
                </div>
              </div>
            </aside>
          </div>
        </template>

        <template v-else-if="activeType === 'all'">
          <header class="content-header"><h2>全部渠道</h2></header>
          <div class="channel-card-grid">
            <article v-for="type in channelTypes" :key="type" class="channel-card">
              <div class="card-title"><ChannelGlyph :type="type" /><h3>{{ channelMeta[type].label }}</h3><ElTag v-if="channelCount(type)" type="success" round>已连接 {{ channelCount(type) }}</ElTag></div>
              <p>{{ channelMeta[type].description }}</p>
              <button class="manage-link" @click="channelCount(type) ? setType(type) : openCreate(type)">{{ channelCount(type) ? '管理' : channelMeta[type].addLabel }}</button>
            </article>
          </div>
        </template>

        <template v-else>
          <header class="content-header"><h2>{{ currentMeta?.label }}</h2><ElButton class="channel-add-button" type="primary" @click="openCreate()"><QiCharPlus :size="16" />{{ currentMeta?.addLabel }}</ElButton></header>
          <div class="list-area">
            <ElInput v-model="query" clearable class="channel-search" placeholder="搜索渠道名称"><template #prefix><QiSearch class="search-icon" :size="16" /></template></ElInput>
            <ElTable :data="filteredChannels" class="channel-table" empty-text="暂无渠道">
              <ElTableColumn label="渠道名称" min-width="260"><template #default="scope"><button class="channel-name" @click="openDetail(scope.row)"><ChannelGlyph :type="scope.row.type" /><span><strong>{{ scope.row.name }}</strong><small v-if="scope.row.websiteDomain">{{ scope.row.websiteDomain }}</small></span></button></template></ElTableColumn>
              <ElTableColumn label="接待 AI Agent" prop="agent" min-width="170" />
              <ElTableColumn label="创建时间" prop="createdAt" min-width="170" />
              <ElTableColumn label="状态" width="120"><template #default><ElTag type="success" round>已连接</ElTag></template></ElTableColumn>
              <ElTableColumn label="启用状态" width="120"><template #default="scope"><ElSwitch v-model="scope.row.enabled" /></template></ElTableColumn>
              <ElTableColumn label="操作" width="72"><template #default="scope"><ElDropdown trigger="click" @command="(command: string) => handleRowAction(command, scope.row)"><ElButton class="more-button" text aria-label="更多操作">···</ElButton><template #dropdown><ElDropdownMenu><ElDropdownItem command="edit">编辑</ElDropdownItem><ElDropdownItem command="delete" divided>删除</ElDropdownItem></ElDropdownMenu></template></ElDropdown></template></ElTableColumn>
            </ElTable>
            <div class="table-footer"><span>共 {{ filteredChannels.length }} 条</span><button disabled>‹</button><button class="active">1</button><button disabled>›</button></div>
          </div>
        </template>
      </main>
    </div>

    <ElDialog v-model="dialogVisible" class="channel-config-dialog" width="560px" destroy-on-close>
      <template #header><div class="dialog-title"><ChannelGlyph :type="form.type" /><span>{{ editingId ? '编辑' : '接入' }} {{ channelMeta[form.type].label }}</span></div></template>
      <ElForm label-position="top">
        <ElFormItem label="渠道名称"><ElInput v-model="form.name" maxlength="50" show-word-limit /></ElFormItem>
        <ElFormItem v-if="form.type === 'web-widget'" label="网站域名"><ElInput v-model="form.websiteDomain" placeholder="example.com" /></ElFormItem>
        <ElFormItem label="界面语言"><ElSelect v-model="form.language"><ElOption label="自动" value="自动" /><ElOption label="简体中文" value="简体中文" /><ElOption label="英语" value="英语" /></ElSelect></ElFormItem>
        <ElFormItem label="接待 AI Agent"><ElSelect v-model="form.agent" placeholder="请选择已发布的 AI Agent"><ElOption label="客服接待" value="客服接待" /><ElOption label="售前咨询" value="售前咨询" /></ElSelect></ElFormItem>
      </ElForm>
      <template #footer><ElButton @click="dialogVisible = false">取消</ElButton><ElButton type="primary" @click="submitForm">{{ editingId ? '保存' : channelMeta[form.type].addLabel }}</ElButton></template>
    </ElDialog>
  </section>
</template>

<style scoped>
.channel-page {
  --channel-primary: #1664ff;
  --channel-primary-bg: #f3f7ff;
  --channel-surface: #f7f9fb;
  --channel-foreground: #0c0d0e;
  --channel-text: #4e5969;
  --channel-muted: #86909c;
  --channel-border: #dde2e9;
  min-height: 100%;
  padding: 16px 16px 0;
  color: var(--channel-foreground);
  background: #f3f5f8;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif;
  font-size: 14px;
  line-height: 22px;
}

.content-header h2, .detail-title h2 { margin: 0; font-weight: 600; letter-spacing: 0; }
.channel-shell { min-height: calc(100dvh - 86px); display: grid; grid-template-columns: 220px minmax(0, 1fr); overflow: hidden; border: 1px solid var(--channel-border); border-bottom: 0; border-radius: 12px 12px 0 0; background: #fff; }
.channel-shell:has(.detail-layout) { grid-template-columns: 1fr; }
.channel-subnav { padding: 0 16px 24px; border-right: 1px solid var(--channel-border); background: #fff; }
.channel-subnav h2 { display: flex; min-height: 56px; align-items: center; margin: 0 0 12px; color: var(--channel-foreground); font-size: 16px; line-height: 24px; font-weight: 600; }
.channel-subnav button { width: 100%; min-height: 36px; margin-bottom: 4px; padding: 0 12px; display: flex; align-items: center; gap: 12px; border: 0; border-radius: 4px; background: transparent; color: var(--channel-text); text-align: left; cursor: pointer; transition: color 150ms ease, background-color 150ms ease; }
.channel-subnav button:hover { color: var(--channel-foreground); background: #f2f3f5; }
.channel-subnav button.active { color: var(--channel-primary); background: var(--channel-primary-bg); font-weight: 500; }
.channel-subnav :deep(.channel-glyph) { width: 24px; height: 24px; border-radius: 4px; }
.channel-subnav :deep(.channel-glyph svg) { width: 18px; height: 18px; }
.channel-content { min-width: 0; }
.content-header { min-height: 56px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--channel-border); }
.content-header h2 { font-size: 16px; line-height: 24px; }
.channel-card-grid { padding: 16px 24px 24px; display: grid; grid-template-columns: repeat(3, minmax(240px, 1fr)); gap: 20px; }
.channel-card { min-height: 176px; padding: 20px; display: flex; flex-direction: column; align-items: flex-start; border: 1px solid transparent; border-radius: 18px; background: var(--channel-surface); transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
.channel-card:hover { border-color: var(--channel-border); box-shadow: 0 2px 6px rgb(12 13 14 / 8%); transform: translateY(-1px); }
.card-title { width: 100%; display: flex; align-items: flex-start; gap: 16px; }
.card-title h3 { margin: 0; font-size: 18px; line-height: 26px; font-weight: 600; }
.card-title .el-tag { margin-left: auto; }
.channel-card p { max-width: 32em; min-height: 48px; margin: 16px 0 0; color: var(--channel-text); line-height: 1.6; }
.manage-link { margin: 20px 0 0 -8px; padding: 0 8px; border: 0; background: transparent; color: var(--channel-foreground); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.list-area { padding: 16px 24px 0; }
.channel-search { width: 244px; margin-bottom: 16px; }
.channel-table { border: 1px solid var(--channel-border); border-bottom: 0; }
.channel-name { min-width: 0; padding: 0; display: flex; align-items: center; gap: 8px; border: 0; background: transparent; text-align: left; cursor: pointer; }
.channel-name > span:last-child { display: grid; min-width: 0; gap: 3px; }
.channel-name strong { overflow: hidden; color: var(--channel-foreground); font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.channel-name small { color: var(--channel-muted); font-size: 12px; }
.channel-name :deep(.channel-glyph) { width: 30px; height: 30px; border-radius: 4px; }
.channel-name :deep(.channel-glyph svg) { width: 18px; height: 18px; }
.channel-add-button { min-width: 136px; height: 36px; }
.more-button { min-width: 28px; padding: 0; color: var(--channel-primary); font-weight: 700; letter-spacing: 1px; }
.table-footer { display: flex; height: 52px; align-items: center; justify-content: flex-end; gap: 8px; color: var(--channel-foreground); }
.table-footer button { width: 32px; height: 32px; border: 0; border-radius: 4px; color: var(--channel-muted); background: transparent; }
.table-footer button.active { color: var(--channel-primary); background: var(--channel-primary-bg); }
.table-footer button:disabled { opacity: .45; }
.channel-card :deep(.el-tag), .channel-table :deep(.el-tag) { height: 28px; padding: 0 12px; color: #2a814b; background: #e2f5eb; border: 0; font-size: 12px; font-weight: 500; }
.channel-table :deep(.el-tag) { height: 24px; padding: 0 8px; }
.channel-table :deep(.el-table__header th.el-table__cell) { height: 42px; color: var(--channel-foreground); background: #f2f3f5; font-weight: 600; }
.channel-table :deep(.el-table__row td.el-table__cell) { height: 62px; color: var(--channel-text); }
.channel-table :deep(.el-table__inner-wrapper::before) { display: none; }
.channel-search :deep(.el-input__wrapper) { background: #f2f3f5; box-shadow: 0 0 0 1px transparent inset; }
.channel-search :deep(.el-input__wrapper:hover), .channel-search :deep(.el-input__wrapper.is-focus) { background: #fff; box-shadow: 0 0 0 1px var(--channel-primary) inset, 0 0 0 2px var(--channel-primary-bg); }
.search-icon { width: 16px; height: 16px; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-width: 1.6; }
.detail-title > div, .enabled-control { display: flex; align-items: center; gap: 10px; }
.detail-title { padding-left: 16px; }
.detail-title :deep(.channel-glyph) { width: 34px; height: 34px; border-radius: 4px; }
.detail-title :deep(.channel-glyph svg) { width: 22px; height: 22px; }
.detail-toolbar { display: flex; align-items: center; gap: 12px; }
.install-button { height: 32px; border-color: var(--channel-border); border-radius: 8px; color: var(--channel-foreground); font-weight: 500; }
.enabled-control { color: var(--channel-text); }
.detail-layout { min-height: calc(100dvh - 143px); display: grid; grid-template-columns: 148px minmax(260px, 1fr) minmax(520px, .92fr); }
.detail-nav { padding: 16px 12px; border-right: 1px solid var(--channel-border); background: #fff; }
.detail-nav button { width: 100%; min-height: 36px; margin-bottom: 4px; padding: 0 12px; border: 0; border-radius: 4px; background: transparent; color: var(--channel-text); text-align: left; cursor: pointer; }
.detail-nav button:hover { color: var(--channel-foreground); background: #f2f3f5; }
.detail-nav button.active { color: var(--channel-primary); background: var(--channel-primary-bg); font-weight: 500; }
.detail-form { min-width: 0; padding: 24px 24px 0; display: flex; flex-direction: column; }
.detail-form h3, .channel-preview h3 { margin: 0 0 20px; font-size: 16px; line-height: 24px; font-weight: 600; }
.detail-form :deep(.el-select) { width: 100%; }
.detail-form :deep(.el-form-item) { margin-bottom: 20px; }
.detail-form :deep(.el-form-item__label) { padding-bottom: 8px; color: var(--channel-text); font-weight: 500; }
.detail-form :deep(.el-input__wrapper), .detail-form :deep(.el-select__wrapper) { min-height: 40px; background: #f2f3f5; box-shadow: 0 0 0 1px transparent inset; }
.detail-form footer { margin: auto -24px 0; padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--channel-border); box-shadow: 0 -4px 12px rgb(22 24 35 / 5%); }
.color-control { width: 100%; display: flex; align-items: center; gap: 8px; }
.share-settings { display: grid; gap: 20px; }
.share-settings > label { color: var(--channel-text); font-weight: 500; }
.setting-row { min-height: 48px; padding: 0 16px; display: flex; align-items: center; justify-content: space-between; border: 1px solid var(--channel-border); border-radius: 8px; }
.channel-preview { min-width: 0; display: flex; flex-direction: column; overflow: hidden; border-left: 1px solid var(--channel-border); background: var(--channel-surface); }
.channel-preview h3 { min-height: 56px; margin: 0; padding: 0 16px; display: flex; align-items: center; background: #fff; border-bottom: 1px solid var(--channel-border); }
.preview-stage { min-height: 0; flex: 1; padding: 20px 24px 40px; display: grid; place-items: end; overflow: hidden; background-color: #fff; background-image: linear-gradient(45deg,#edf0f5 25%,transparent 25%),linear-gradient(-45deg,#edf0f5 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#edf0f5 75%),linear-gradient(-45deg,transparent 75%,#edf0f5 75%); background-size: 20px 20px; background-position: 0 0,0 10px,10px -10px,-10px 0; }
.preview-chat { width: min(388px, 100%); height: min(580px, 100%); display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; border: 1px solid var(--channel-border); border-radius: 16px; background: #fff; box-shadow: 0 5px 15px rgb(12 13 14 / 8%), 0 2px 4px rgb(12 13 14 / 4%); }
.preview-chat header { min-height: 68px; padding: 12px 16px; display: flex; align-items: center; gap: 12px; color: #fff; }
.preview-chat header > span { width: 36px; height: 36px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; background: rgb(255 255 255 / 18%); }
.preview-chat header div { display: grid; gap: 3px; }
.preview-chat header small { opacity: .72; }
.preview-chat header div { min-width: 0; flex: 1; }
.preview-chat header button { width: 28px; height: 28px; padding: 0; display: grid; place-items: center; border: 0; border-radius: 50%; color: inherit; background: transparent; }
.preview-chat main { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.preview-chat main p { width: fit-content; margin: 0; padding: 9px 12px; border-radius: 12px 12px 12px 3px; background: #f2f3f5; }
.preview-chat main p.is-customer { align-self: flex-end; color: #fff; border-radius: 12px 12px 3px 12px; }
.preview-chat footer { min-height: 64px; padding: 10px 12px; display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; border-top: 1px solid var(--channel-border); color: var(--channel-muted); }
.preview-chat footer span { padding: 8px 10px; background: #f2f3f5; }
.preview-chat footer button { border: 0; border-radius: 50%; }
.preview-chat footer .attach-button { width: 30px; height: 30px; color: var(--channel-text); background: transparent; font-size: 20px; }
.preview-chat footer .send-button { width: 34px; height: 34px; color: #fff; }
.dialog-title { display: flex; align-items: center; gap: 12px; color: var(--channel-foreground); font-size: 16px; line-height: 24px; font-weight: 600; }
.dialog-title :deep(.channel-glyph) { width: 32px; height: 32px; border-radius: 4px; }
.dialog-title :deep(.channel-glyph svg) { width: 20px; height: 20px; }

:global(.channel-config-dialog) { border-radius: 12px; }
:global(.channel-config-dialog .el-dialog__header) { margin: 0; padding: 20px 24px; border-bottom: 1px solid #dde2e9; }
:global(.channel-config-dialog .el-dialog__headerbtn) { top: 10px; right: 12px; }
:global(.channel-config-dialog .el-dialog__body) { padding: 20px 24px 0; }
:global(.channel-config-dialog .el-dialog__footer) { padding: 16px 24px 24px; }
:global(.channel-config-dialog .el-form-item) { margin-bottom: 20px; }
:global(.channel-config-dialog .el-form-item__label) { padding-bottom: 8px; color: #4e5969; font-weight: 500; }
:global(.channel-config-dialog .el-input__wrapper), :global(.channel-config-dialog .el-select__wrapper) { min-height: 40px; background: #f2f3f5; box-shadow: 0 0 0 1px transparent inset; }

@media (max-width: 1200px) { .channel-card-grid { grid-template-columns: 1fr; } .detail-layout { grid-template-columns: 120px 1fr; } .channel-preview { display: none; } }
</style>
