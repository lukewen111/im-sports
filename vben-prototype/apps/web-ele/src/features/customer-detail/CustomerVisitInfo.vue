<script setup lang="ts">
import type { Component } from 'vue';
import type { DemoCustomer, DemoSession } from '#/features/service/demo-store';

import { computed } from 'vue';
import { ElTooltip } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';

import IconSlot from './IconSlot.vue';
import { detailIcons as icons } from './icons';
import { useCustomerDetail } from './useCustomerDetail';

interface EnvBadge {
  icon: string;
  tooltip: string;
}

interface VisitRow {
  icon: Component;
  label: string;
  value: string;
  /** 访问来源页面：悬停展示完整 URL */
  tooltip?: string;
}

const props = defineProps<{
  customer: DemoCustomer;
  session?: DemoSession;
}>();

const hook = useCustomerDetail();

const visit = computed(() => hook.store.visitSummary(props.customer.id));

/** 访问来源页面取当前会话的 startUrl（PRD §5.5），拿不到则按空值 */
const sourceSession = computed(() => props.session ?? hook.sessionsOf(props.customer)[0]);
const sourceUrl = computed(() => {
  const session = sourceSession.value;
  if (!session) return '';
  const value = hook.startUrlOf(session);
  return value === '—' ? '' : value;
});

/** 压成可读的页面标识：去掉协议，长 URL 省略中段 */
function pageLabel(raw: string) {
  if (!raw) return '—';
  let display = raw.trim();
  try {
    const url = new URL(display);
    display = `${url.host}${url.pathname}${url.search}`.replace(/\/$/, '');
  } catch {
    display = display.replace(/^https?:\/\//i, '').replace(/^www\./i, '');
  }
  if (display.length <= 40) return display;
  const [hostPart = '', ...rest] = display.split('/');
  const host = hostPart.length > 26 ? `${hostPart.slice(0, 24)}…` : hostPart;
  const tail = rest.filter(Boolean).pop() || '';
  const shortTail = tail.length > 18 ? `${tail.slice(0, 16)}…` : tail;
  return shortTail ? `${host}/…/${shortTail}` : `${display.slice(0, 28)}…${display.slice(-8)}`;
}

/** 浏览器品牌图标：按 browser 值映射，未识别回退通用环球图标 */
function browserIconOf(value: string) {
  const name = value.toLowerCase();
  if (name.includes('chrome') || name.includes('chromium')) return 'brand-chrome';
  if (name.includes('edge')) return 'brand-edge';
  if (name.includes('safari')) return 'brand-safari';
  if (name.includes('firefox')) return 'brand-firefox';
  return 'browser';
}

/** 操作系统品牌图标：Windows / Apple（macOS、iOS）/ Android，未识别回退通用电脑图标 */
function osIconOf(value: string) {
  const name = value.toLowerCase();
  if (name.includes('windows')) return 'brand-windows';
  if (name.includes('mac') || name.includes('ios') || name.includes('iphone') || name.includes('ipad')) return 'brand-apple';
  if (name.includes('android')) return 'brand-android';
  return 'os';
}

/** 设备 / 操作系统 / 浏览器合并为一行纯图标徽章，完整值走 tooltip */
const environment = computed<EnvBadge[]>(() => {
  const data = visit.value;
  const osValue = data?.accessInfo?.os || '—';
  const browserValue = data?.accessInfo?.browser || '—';
  return [
    { icon: 'device', tooltip: data?.accessInfo?.device || data?.device || '—' },
    { icon: osIconOf(osValue), tooltip: osValue },
    { icon: browserIconOf(browserValue), tooltip: browserValue },
  ];
});

const rows = computed<VisitRow[]>(() => {
  const data = visit.value;
  return [
    // PRD §5.5：访问来源页面、访问时长、IP（设备 / 操作系统 / 浏览器见上方徽章行）
    {
      icon: icons.link,
      label: '访问来源页面',
      tooltip: sourceUrl.value || undefined,
      value: pageLabel(sourceUrl.value),
    },
    { icon: icons.duration, label: '访问时长', value: hook.formatDuration(data?.accessInfo?.durationSeconds) },
    { icon: icons.ip, label: 'IP', value: data?.accessInfo?.ip || '—' },
  ];
});
</script>

<template>
  <div class="visit-info">
    <div class="info-row is-environment">
      <IconSlot>
        <component :is="icons.device" :size="14" class="row-icon" />
      </IconSlot>
      <span class="row-label">设备</span>
      <div class="row-value">
        <ElTooltip
          v-for="badge in environment"
          :key="badge.icon"
          :content="badge.tooltip"
          placement="top"
          :show-after="0"
        >
          <span class="env-badge" :aria-label="badge.tooltip">
            <QIcon :name="badge.icon" :size="16" color="#131317" />
          </span>
        </ElTooltip>
      </div>
    </div>

    <div v-for="row in rows" :key="row.label" class="info-row">
      <IconSlot>
        <component :is="row.icon" :size="14" class="row-icon" />
      </IconSlot>
      <span class="row-label">{{ row.label }}</span>
      <div class="row-value">
        <ElTooltip
          v-if="row.tooltip"
          :content="row.tooltip"
          placement="top"
          :show-after="0"
        >
          <span class="row-text is-url">{{ row.value }}</span>
        </ElTooltip>
        <span v-else class="row-text">{{ row.value }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.visit-info {
  display: grid;
  gap: 8px;
}
.info-row {
  display: grid;
  grid-template-columns: 20px 84px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.row-icon {
  color: #8c8c8e;
}
.row-label {
  overflow: hidden;
  font-size: 12px;
  color: #8c8c8e;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.row-value {
  display: flex;
  gap: 4px;
  align-items: center;
  min-width: 0;
}
.is-environment .row-value {
  gap: 8px;
}
/* 设备 / 操作系统 / 浏览器：纯图标徽章，完整值走 tooltip */
.env-badge {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  color: var(--ui-ink, #131317);
  cursor: default;
  background: var(--ui-canvas, #f1f1f2);
  border-radius: 8px;
}
.row-text {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.45;
  color: #131317;
}
.row-text.is-url {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
