<script lang="ts" setup>
import type { ServiceReportResult } from '#/features/reports/service-report-metrics';

import { computed } from 'vue';

import { ElTooltip } from 'element-plus';

import { formatCount, formatDuration, formatEfficiency, summarizeChange } from '#/features/reports/service-report-format';

const props = defineProps<{ report?: ServiceReportResult }>();

const cards = computed(() => {
  const current = props.report?.totals.current;
  const previous = props.report?.totals.previous;
  const unavailable = props.report?.memberHistoryIncomplete;

  return [
    {
      change: summarizeChange(current?.sessions ?? null, previous?.sessions ?? null),
      hint: '',
      key: 'sessions',
      label: '会话总数',
      previous: unavailable ? '数据不可用' : previous?.sessions === null || previous?.sessions === undefined ? '—' : formatCount(previous.sessions),
      unit: '',
      value: unavailable ? '数据不可用' : current?.sessions === null || current?.sessions === undefined ? '—' : formatCount(current.sessions),
    },
    {
      change: summarizeChange(current?.firstResponseSeconds ?? null, previous?.firstResponseSeconds ?? null),
      hint: '',
      key: 'first-response',
      label: '平均首次响应时间',
      previous: unavailable ? '数据不可用' : formatDuration(previous?.firstResponseSeconds ?? null),
      unit: '',
      value: unavailable ? '数据不可用' : formatDuration(current?.firstResponseSeconds ?? null),
    },
    {
      change: summarizeChange(current?.efficiency ?? null, previous?.efficiency ?? null),
      hint: '每个客服平均每小时回复的会话数，仅统计客服处于可接待聊天状态的时间。',
      key: 'efficiency',
      label: '平均效率',
      previous: unavailable ? '数据不可用' : formatEfficiency(previous?.efficiency ?? null),
      unit: '',
      value: unavailable ? '数据不可用' : formatEfficiency(current?.efficiency ?? null),
    },
  ];
});
</script>

<template>
  <div class="metric-grid">
    <article v-for="card in cards" :key="card.key" class="ui-card metric-card">
      <header class="metric-head">
        <h2 class="ui-card-title">{{ card.label }}</h2>
        <ElTooltip v-if="card.hint" :content="card.hint" placement="top">
          <button type="button" class="metric-help" :aria-label="`${card.label}指标说明`">?</button>
        </ElTooltip>
      </header>
      <div class="metric-body">
        <div class="metric-value-line">
          <strong class="metric-value" :class="{ 'is-unavailable': card.value === '数据不可用' }">{{ card.value }}</strong>
          <span
            v-if="card.change.direction !== 'none'"
            class="metric-change ui-tag is-sm is-soft"
            :class="card.change.direction === 'up' ? 'is-success' : card.change.direction === 'down' ? 'is-danger' : 'is-neutral'"
          >
            {{ card.change.text }}
          </span>
          <span v-if="card.unit && card.value !== '数据不可用' && card.value !== '—'" class="metric-unit">{{ card.unit }}</span>
        </div>
        <div class="metric-compare">
          <span class="metric-previous">对比上期 {{ card.previous }}</span>
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.metric-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.metric-head {
  display: flex;
  gap: 6px;
  align-items: center;
}

.metric-help {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  font-size: 11px;
  line-height: 1;
  color: var(--ui-ink-muted);
  cursor: help;
  background: var(--ui-surface-muted);
  border: 0;
  border-radius: 50%;
}

.metric-help:hover {
  color: var(--ui-ink);
}

.metric-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

.metric-value-line {
  display: flex;
  gap: 6px;
  align-items: baseline;
  min-height: 30px;
}

.metric-value {
  overflow: hidden;
  font-size: 30px;
  font-weight: 600;
  line-height: 1;
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.metric-value.is-unavailable {
  font-size: 22px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--ui-ink-placeholder);
}

.metric-unit {
  font-size: 12px;
  color: var(--ui-ink-muted);
  white-space: nowrap;
}

.metric-compare {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-ink-muted);
  font-variant-numeric: tabular-nums;
}

.metric-change {
  flex: none;
  align-self: center;
}

.metric-previous {
  color: var(--ui-ink-muted);
}

@media (max-width: 1100px) {
  .metric-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
