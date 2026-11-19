<script lang="ts" setup>
import type { ServiceRosterMember } from '#/features/reports/service-report-metrics';

import { computed, ref, watch } from 'vue';

import { ElButton, ElDatePicker, ElOption, ElSelect } from 'element-plus';

import { useRouter } from 'vue-router';

import QIcon from '#/components/q-icon/QIcon.vue';
import {
  buildServiceReport,
  filterServiceMembers,
  resolveServiceRanges,
} from '#/features/reports/service-report-metrics';
import { FORMER_SERVICE_MEMBER } from '#/features/reports/service-report-seed';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useTeamStore } from '#/features/team/team-store';
import { addDays, formatZonedDate, formatZonedTime, startOfZonedDay, timezoneOffsetMinutes } from '#/utils/report-time';

import ServiceAgentTable from './ServiceAgentTable.vue';
import ServiceMetricCards from './ServiceMetricCards.vue';

const router = useRouter();
const teamStore = useTeamStore();
const access = usePrototypeAccess();

const offset = computed(() => timezoneOffsetMinutes(access.current?.timezone));
const todayStart = () => startOfZonedDay(Date.now(), offset.value);

const teamIds = ref<string[]>([]);
const customRange = ref<[string, string]>([
  formatZonedDate(addDays(todayStart(), -6), offset.value),
  formatZonedDate(todayStart(), offset.value),
]);

const now = ref(Date.now());
const refreshing = ref(false);
const updatedAt = computed(() => formatZonedTime(now.value, offset.value));

/** 快捷选项与概览页一致，点击时按成员时区重新计算「今天」 */
const shortcuts: { text: string; value: () => [Date, Date] }[] = [
  {
    text: '今天',
    value: () => {
      const today = new Date(todayStart());
      return [today, today];
    },
  },
  {
    text: '昨天',
    value: () => {
      const yesterday = new Date(addDays(todayStart(), -1));
      return [yesterday, yesterday];
    },
  },
  {
    text: '近 7 天',
    value: () => [new Date(addDays(todayStart(), -6)), new Date(todayStart())],
  },
  {
    text: '近 30 天',
    value: () => [new Date(addDays(todayStart(), -29)), new Date(todayStart())],
  },
];

const roster = computed<ServiceRosterMember[]>(() => [
  ...teamStore.members.map((member) => ({
    account: member.account,
    avatar: member.avatar,
    id: member.id,
    kind: member.kind,
    name: member.name,
    teamIds: member.teamIds,
  })),
  FORMER_SERVICE_MEMBER,
]);

const members = computed(() => filterServiceMembers(roster.value, teamIds.value));

const ranges = computed(() => resolveServiceRanges('custom', offset.value, now.value, customRange.value[0], customRange.value[1]));

const report = computed(() => buildServiceReport({
  customEnd: customRange.value[1],
  customStart: customRange.value[0],
  members: members.value,
  mode: 'custom',
  now: now.value,
  offset: offset.value,
}));

const rangeInvalid = computed(() => !ranges.value);

/** 切换筛选条件后重置明细表排序：回到「接待会话数」降序 */
const tableKey = computed(() => `${teamIds.value.join(',')}|${customRange.value.join(',')}`);

const rangeText = computed(() => `${customRange.value[0]} → ${customRange.value[1]}`);

function disabledDate(date: Date) {
  const latest = todayStart();
  return date.getTime() > latest || date.getTime() < addDays(latest, -364);
}

function touchNow() {
  now.value = Date.now();
}

async function refresh() {
  if (refreshing.value) return;
  refreshing.value = true;
  // 与概览页一致：短延迟模拟请求过程
  await new Promise((resolve) => setTimeout(resolve, 300));
  touchNow();
  refreshing.value = false;
}

watch([teamIds, customRange], touchNow, { deep: true });

watch(
  () => access.permissions.reportsService,
  (allowed) => {
    if (!allowed) void router.replace(access.home);
  },
);
</script>

<template>
  <div class="team-page report-page">
    <header class="team-page-header">
      <h1>客服</h1>
      <div class="report-actions">
        <span class="report-updated">数据更新于 {{ updatedAt }}</span>
        <ElButton class="ui-btn-outline" :loading="refreshing" @click="refresh">
          <QIcon name="refresh" :size="15" />刷新
        </ElButton>
      </div>
    </header>

    <section class="team-content service-content">
      <div class="service-toolbar">
        <ElSelect
          v-model="teamIds"
          class="service-team-select"
          collapse-tags
          collapse-tags-tooltip
          clearable
          multiple
          placeholder="全部团队"
        >
          <ElOption v-for="team in teamStore.teams" :key="team.id" :label="team.name" :value="team.id" />
        </ElSelect>

        <div class="range-field" :class="{ 'is-invalid': rangeInvalid }">
          <QIcon name="clock" :size="14" class="range-icon" />
          <span class="range-value">{{ rangeText }}</span>
          <div class="range-picker">
            <ElDatePicker
              v-model="customRange"
              :clearable="false"
              :disabled-date="disabledDate"
              :fallback-placements="['bottom-start']"
              :shortcuts="shortcuts"
              placement="bottom-start"
              popper-class="report-range-popper"
              type="daterange"
              value-format="YYYY-MM-DD"
            />
          </div>
        </div>

        <span v-if="rangeInvalid" class="service-range-error">请选择不超过 365 天且不晚于今天的时间范围</span>
      </div>

      <ServiceMetricCards :report="report" />
      <ServiceAgentTable :key="tableKey" :report="report" />
    </section>
  </div>
</template>

<style scoped>
.report-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.report-updated {
  font-size: 12px;
  color: var(--ui-ink-muted);
  font-variant-numeric: tabular-nums;
}

.service-content {
  gap: 16px;
  overflow-y: auto;
}

.service-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}

.service-team-select {
  width: 140px;
}

.service-range-error {
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-danger);
}

.range-field {
  position: relative;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  overflow: hidden;
  font-size: 14px;
  color: var(--ui-ink);
  white-space: nowrap;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  border: 0;
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.range-field:hover {
  box-shadow: 0 0 0 1px var(--el-border-color-hover) inset;
}

.range-field:focus-within {
  box-shadow: 0 0 0 1px var(--ui-accent) inset, 0 0 0 3px var(--ui-accent-ring);
}

.range-field.is-invalid {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

.range-icon {
  flex: none;
  color: var(--ui-ink-muted);
}

.range-value {
  font-variant-numeric: tabular-nums;
}

.range-picker {
  position: absolute;
  inset: 0;
  opacity: 0;
}

.range-picker :deep(.el-date-editor) {
  box-sizing: border-box;
  width: 100% !important;
  height: 100% !important;
  padding: 0;
  background: transparent;
  box-shadow: none;
}

.range-picker :deep(.el-range-input) {
  cursor: pointer;
}
</style>

<style>
.report-range-popper.el-popper {
  --el-color-primary: var(--ui-ink);
  --el-color-primary-light-3: var(--ui-ink-secondary);
  --el-color-primary-light-5: var(--ui-ink-muted);
  --el-color-primary-light-7: var(--ui-line-strong);
  --el-color-primary-light-8: var(--ui-line);
  --el-color-primary-light-9: var(--ui-surface-muted);

  padding: 0 !important;
  overflow: hidden;
  border: 1px solid var(--ui-line) !important;
  border-radius: var(--ui-radius-card) !important;
  box-shadow: 0 16px 40px rgb(19 19 23 / 12%) !important;
}

.report-range-popper .el-picker-panel {
  border: 0;
}

.report-range-popper .el-picker-panel__sidebar {
  top: 0;
  bottom: 0;
  width: 104px;
  padding: 10px 6px;
  border-right: 1px solid var(--ui-line);
}

.report-range-popper .el-picker-panel__shortcut {
  padding: 7px 10px;
  margin-bottom: 2px;
  font-size: 12px;
  line-height: 18px;
  color: var(--ui-ink-secondary);
  text-align: left;
  border-radius: var(--ui-radius-control);
}

.report-range-popper .el-picker-panel__shortcut:hover {
  color: var(--ui-ink);
  background: var(--ui-surface-muted);
}

.report-range-popper .el-date-range-picker__header {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
</style>
