<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { ElButton } from 'element-plus';

import { useRouter } from 'vue-router';

import QIcon from '#/components/q-icon/QIcon.vue';
import { buildRealtimeSnapshot } from '#/features/reports/report-metrics';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useTeamStore } from '#/features/team/team-store';
import { formatZonedDate, formatZonedTime, timezoneOffsetMinutes } from '#/utils/report-time';

import ReportTrend from './ReportTrend.vue';

const router = useRouter();
const store = useDemoServiceStore();
const teamStore = useTeamStore();
const access = usePrototypeAccess();

const offset = computed(() => timezoneOffsetMinutes(access.current?.timezone));
const formatCount = (value: number) => value.toLocaleString('en-US');
const snapshot = computed(() => buildRealtimeSnapshot(store.sessions, teamStore.members));

const sessionMetrics = computed(() => ({
  pending: formatCount(snapshot.value.pending),
  processing: formatCount(snapshot.value.aiActive + snapshot.value.humanActive),
  processingAi: formatCount(snapshot.value.aiActive),
  processingHuman: formatCount(snapshot.value.humanActive),
}));

const memberMetrics = computed(() => [
  { label: '在线', value: formatCount(snapshot.value.online) },
  { label: '离线', value: formatCount(snapshot.value.offline) },
]);

const now = ref(Date.now());
const refreshing = ref(false);
const trendToken = ref(0);
const updatedAt = computed(() => formatZonedTime(now.value, offset.value));

let timer: ReturnType<typeof setInterval> | undefined;
/** 最近一次趋势查询所在的自然日，用于标签页恢复时判断是否需要按新日期重新查询 */
let trendDay = formatZonedDate(Date.now(), offset.value);

function touchRealtime() {
  now.value = Date.now();
}

async function refreshAll() {
  if (refreshing.value) return;
  refreshing.value = true;
  // 演示环境用短暂延迟模拟请求过程，避免重复点击造成结果闪动
  await new Promise((resolve) => setTimeout(resolve, 300));
  touchRealtime();
  trendDay = formatZonedDate(Date.now(), offset.value);
  trendToken.value += 1;
  refreshing.value = false;
}

function startTimer() {
  stopTimer();
  timer = setInterval(touchRealtime, 60_000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = undefined;
  }
}

function handleVisibility() {
  if (document.visibilityState !== 'visible') {
    stopTimer();
    return;
  }
  startTimer();
  touchRealtime();
  const currentDay = formatZonedDate(Date.now(), offset.value);
  if (currentDay !== trendDay) {
    trendDay = currentDay;
    trendToken.value += 1;
  }
}

watch(
  () => access.permissions.reports,
  (allowed) => {
    if (!allowed) void router.replace(access.home);
  },
);

onMounted(() => {
  startTimer();
  document.addEventListener('visibilitychange', handleVisibility);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
  document.removeEventListener('visibilitychange', handleVisibility);
});
</script>

<template>
  <div class="team-page report-page">
    <header class="team-page-header">
      <h1>概览</h1>
      <div class="report-actions">
        <span class="report-updated">数据更新于 {{ updatedAt }}</span>
        <ElButton class="ui-btn-outline" :loading="refreshing" @click="refreshAll">
          <QIcon name="refresh" :size="15" />刷新
        </ElButton>
      </div>
    </header>

    <section class="team-content report-content">
      <div class="realtime-grid">
        <article class="ui-card stat-card">
          <header class="stat-card-head">
            <h2 class="ui-card-title">会话状态</h2>
            <span class="ui-tag is-sm is-soft is-success"><i class="ui-tag__dot is-success"></i>实时</span>
          </header>
          <div class="stat-metrics">
            <div class="stat-metric">
              <span class="stat-label">处理中</span>
              <strong class="stat-value">{{ sessionMetrics.processing }}</strong>
              <span class="stat-breakdown">AI 接待中 {{ sessionMetrics.processingAi }} · 人工接待中 {{ sessionMetrics.processingHuman }}</span>
            </div>
            <div class="stat-metric">
              <span class="stat-label">待分配</span>
              <strong class="stat-value">{{ sessionMetrics.pending }}</strong>
            </div>
          </div>
        </article>

        <article class="ui-card stat-card">
          <header class="stat-card-head">
            <h2 class="ui-card-title">成员状态</h2>
            <span class="ui-tag is-sm is-soft is-success"><i class="ui-tag__dot is-success"></i>实时</span>
          </header>
          <div class="stat-metrics">
            <div v-for="metric in memberMetrics" :key="metric.label" class="stat-metric">
              <span class="stat-label">{{ metric.label }}</span>
              <strong class="stat-value">{{ metric.value }}</strong>
            </div>
          </div>
        </article>
      </div>

      <ReportTrend :offset="offset" :refresh-token="trendToken" :sessions="store.sessions" />
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

.report-content {
  gap: 16px;
  overflow-y: auto;
}

.realtime-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.stat-card-head {
  display: flex;
  gap: 8px;
  align-items: center;
}

.stat-metrics {
  display: flex;
  margin-top: 20px;
}

.stat-metric {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.stat-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-ink-muted);
}

.stat-value {
  font-size: 30px;
  font-weight: 600;
  line-height: 1;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.stat-breakdown {
  font-size: 12px;
  line-height: 16px;
  color: var(--ui-ink-muted);
}

@media (max-width: 1100px) {
  .realtime-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
