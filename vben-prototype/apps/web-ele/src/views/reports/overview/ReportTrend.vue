<script lang="ts" setup>
import type { ECOption, EchartsUIType } from '@vben/plugins/echarts';

import type { DemoSession } from '#/features/service/demo-store';
import type { TrendFilters, TrendResult } from '#/features/reports/report-metrics';

import { computed, onMounted, ref, watch } from 'vue';

import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { ElDatePicker, ElOption, ElOptionGroup, ElSelect } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import { buildTrendSessions } from '#/features/reports/report-metrics';
import { useTeamStore } from '#/features/team/team-store';
import { daysBeforeToday, formatZonedDate, parseZonedDate, zonedDayCount } from '#/utils/report-time';

const props = defineProps<{
  offset: number;
  refreshToken: number;
  sessions: DemoSession[];
}>();

const teamStore = useTeamStore();
const chartRef = ref<EchartsUIType>();
const { renderEcharts } = useEcharts(chartRef);

const teamIds = ref<string[]>([]);
/** 团队、成员、时间为三个并排入口，人类成员与 AI 成员在同一个成员入口内分组展示 */
const memberIds = ref<string[]>([]);

const formatDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftDay = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

/** 成员时区下的「今天」，快捷选项在点击时重新计算，避免跨天失效 */
function zonedToday() {
  const parts = formatZonedDate(Date.now(), props.offset).split('-');
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

const shortcuts: { text: string; value: () => [Date, Date] }[] = [
  {
    text: '今天',
    value: () => {
      const today = zonedToday();
      return [today, today];
    },
  },
  {
    text: '近 7 天',
    value: () => {
      const today = zonedToday();
      return [shiftDay(today, -6), today];
    },
  },
  {
    text: '近 30 天',
    value: () => {
      const today = zonedToday();
      return [shiftDay(today, -29), today];
    },
  },
];

function defaultRange(): [string, string] {
  const today = zonedToday();
  return [formatDay(shiftDay(today, -6)), formatDay(today)];
}

const range = ref<[string, string] | null>(defaultRange());

const humans = computed(() => teamStore.members.filter((member) => member.kind === 'human'));
const aiMembers = computed(() => teamStore.members.filter((member) => member.kind === 'ai'));

const withinSelectedTeams = (memberTeamIds: string[]) => {
  const selected = new Set(teamIds.value);
  if (selected.size === 0) return true;
  return memberTeamIds.some((id) => selected.has(id));
};

const humanCandidates = computed(() => humans.value.filter((member) => withinSelectedTeams(member.teamIds)));
const aiCandidates = computed(() => aiMembers.value.filter((member) => withinSelectedTeams(member.teamIds)));
const humanCandidateIds = computed(() => new Set(humanCandidates.value.map((member) => member.id)));
const aiCandidateIds = computed(() => new Set(aiCandidates.value.map((member) => member.id)));

const rangeValid = computed(() => {
  const current = range.value;
  if (!current?.[0] || !current[1]) return false;
  const start = parseZonedDate(current[0], props.offset);
  const end = parseZonedDate(current[1], props.offset);
  const today = parseZonedDate(formatZonedDate(Date.now(), props.offset), props.offset);
  if (start === undefined || end === undefined || today === undefined || end < start || end > today) return false;
  return zonedDayCount(start, end) <= 365;
});

const rangeText = computed(() => {
  const current = range.value;
  return current?.[0] && current[1] ? `${current[0]} → ${current[1]}` : '请选择时间范围';
});

const currentFilters = computed<TrendFilters>(() => ({
  aiIds: memberIds.value.filter((id) => aiCandidateIds.value.has(id)),
  customEnd: range.value?.[1],
  customStart: range.value?.[0],
  humanIds: memberIds.value.filter((id) => humanCandidateIds.value.has(id)),
  mode: 'custom',
  teamIds: teamIds.value,
}));

const result = ref<TrendResult>();

function query() {
  if (!rangeValid.value) return;
  const next = buildTrendSessions(props.sessions, currentFilters.value, props.offset, Date.now());
  if (next) result.value = next;
}

const disabledDate = (date: Date) => {
  const value = date.getTime();
  if (value > Date.now()) return true;
  return daysBeforeToday(value, Date.now(), props.offset) > 364;
};

// 团队切换后自动移除不再属于候选集合的成员，保证筛选条件始终合法
watch(teamIds, () => {
  const valid = new Set([...humanCandidates.value, ...aiCandidates.value].map((member) => member.id));
  memberIds.value = memberIds.value.filter((id) => valid.has(id));
});

watch([teamIds, memberIds, range], query, { deep: true });
watch(() => props.refreshToken, query);
watch(() => props.offset, query);

onMounted(query);

const totalText = computed(() => {
  const total = result.value?.total;
  return total === null || total === undefined ? '—' : total.toLocaleString('en-US');
});

const allUnavailable = computed(() => Boolean(result.value?.buckets.length) && result.value?.buckets.every((bucket) => bucket.count === null));

const formatCount = (value: number) => value.toLocaleString('en-US');

const chartOption = computed<ECOption>(() => {
  const current = result.value;
  if (!current) return {};
  const labels = current.buckets.map((bucket) => bucket.label);
  const values = current.buckets.map((bucket) => bucket.count);

  return {
    animationDuration: 220,
    grid: { bottom: 0, containLabel: true, left: 0, right: 8, top: 18 },
    series: [
      {
        barMaxWidth: 64,
        data: values,
        itemStyle: { borderRadius: [3, 3, 0, 0], color: '#003FA4' },
        name: '总会话数',
        type: 'bar',
      },
    ],
    tooltip: {
      axisPointer: { type: 'shadow' },
      backgroundColor: '#131317',
      borderWidth: 0,
      padding: [8, 10],
      textStyle: { color: '#FFFFFF', fontSize: 12 },
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = Array.isArray(params) ? (params as { dataIndex: number }[]) : [];
        const index = list[0]?.dataIndex ?? 0;
        const bucket = current.buckets[index];
        if (!bucket) return '';
        const value = bucket.count === null ? '数据不可用' : formatCount(bucket.count);
        return `${bucket.tooltip}<br/>总会话数：${value}`;
      },
    },
    xAxis: {
      axisLabel: { color: '#8C8C8E', fontSize: 11, interval: labels.length > 20 ? 2 : 0 },
      axisLine: { show: false },
      axisTick: { show: false },
      data: labels,
      type: 'category',
    },
    yAxis: {
      axisLabel: { color: '#8C8C8E', fontSize: 11 },
      minInterval: 1,
      splitLine: { lineStyle: { color: '#ECECED' } },
      type: 'value',
    },
  };
});

watch(
  chartOption,
  () => {
    void renderEcharts(chartOption.value);
  },
  { flush: 'post' },
);

onMounted(() => {
  void renderEcharts(chartOption.value);
});
</script>

<template>
  <section class="trend ui-card">
    <header class="trend-head">
      <h2 class="trend-title ui-card-title">会话趋势</h2>

      <div class="trend-filters">
        <ElSelect v-model="teamIds" class="filter-select" collapse-tags clearable multiple placeholder="全部团队">
          <ElOption v-for="team in teamStore.teams" :key="team.id" :label="team.name" :value="team.id" />
        </ElSelect>

        <ElSelect
          v-model="memberIds"
          class="filter-select member-select"
          collapse-tags
          clearable
          multiple
          no-data-text="暂无可选成员"
          placeholder="全部成员"
        >
          <ElOptionGroup label="人类成员">
            <ElOption
              v-for="member in humanCandidates"
              :key="member.id"
              :label="member.enabled === false ? `${member.name}（已停用）` : member.name"
              :value="member.id"
            />
            <ElOption v-if="!humanCandidates.length" disabled label="暂无可选成员" value="__empty-human" />
          </ElOptionGroup>
          <ElOptionGroup label="AI 成员">
            <ElOption v-for="member in aiCandidates" :key="member.id" :label="member.name" :value="member.id" />
            <ElOption v-if="!aiCandidates.length" disabled label="暂无可选成员" value="__empty-ai" />
          </ElOptionGroup>
        </ElSelect>

        <div class="range-field">
          <QIcon name="clock" :size="14" class="range-icon" />
          <span class="range-label">会话开始时间：</span>
          <span class="range-value">{{ rangeText }}</span>
          <div class="range-picker">
            <ElDatePicker
              v-model="range"
              :clearable="false"
              :disabled-date="disabledDate"
              :fallback-placements="['bottom-end']"
              :shortcuts="shortcuts"
              placement="bottom-end"
              popper-class="report-range-popper"
              type="daterange"
              value-format="YYYY-MM-DD"
            />
          </div>
        </div>
      </div>
    </header>

    <div class="trend-total">
      <span class="total-label">总会话数</span>
      <div class="total-line">
        <strong class="total-value" :class="{ 'is-empty': totalText === '—' }">{{ totalText }}</strong>
        <span v-if="result?.unavailable" class="total-hint">所选时间范围内部分数据不可用</span>
      </div>
    </div>

    <div class="trend-chart">
      <EchartsUI ref="chartRef" height="280px" />
      <div v-if="allUnavailable" class="chart-unavailable">数据不可用</div>
    </div>
  </section>
</template>

<style scoped>
.trend-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
  justify-content: space-between;
}

.trend-title {
  white-space: nowrap;
}

.trend-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  justify-content: flex-end;
  margin-left: auto;
}

.filter-select {
  width: 140px;
}

/* 与其他页面筛选控件一致：跟随 Element Plus 默认灰底 + 1px 内描边，不再单独覆写 */

.range-field {
  position: relative;
  display: inline-flex;
  gap: 6px;
  align-items: center;
  height: 32px;
  padding: 0 12px;
  font-size: 14px;
  color: var(--ui-ink);
  white-space: nowrap;
  cursor: pointer;
  background: var(--el-fill-color-lighter);
  border: 0;
  border-radius: var(--ui-radius-control);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  overflow: hidden;
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

.range-icon {
  flex: none;
  color: var(--ui-ink-muted);
}

.range-label {
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

.trend-total {
  margin-top: 20px;
}

.total-label {
  display: block;
  font-size: 12px;
  color: var(--ui-ink-muted);
}

.total-line {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-top: 8px;
}

.total-value {
  font-size: 30px;
  font-weight: 600;
  line-height: 1;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.total-value.is-empty {
  font-size: 22px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--ui-ink-placeholder);
}

.total-hint {
  font-size: 12px;
  color: var(--ui-amber);
}

.trend-chart {
  position: relative;
  margin-top: 16px;
}

.chart-unavailable {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  line-height: 20px;
  color: var(--ui-ink-muted);
  pointer-events: none;
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
