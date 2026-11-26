<script setup lang="ts">
import type { CampaignRun, CampaignType } from '#/features/campaigns/campaign-data';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElButton, ElInput, ElPagination, ElTable, ElTableColumn } from 'element-plus';
import { useCampaignStore } from '#/features/campaigns/campaign-store';
import { countText, formatCount, runDurationText, runStatusText, runTimeText, sortRuns } from '#/features/campaigns/campaign-rules';
import { usePrototypeAccess } from '#/features/team/access-store';

const props = defineProps<{ type: CampaignType }>();
const store = useCampaignStore();
const access = usePrototypeAccess();
const route = useRoute();
const accountTimezone = computed(() => access.current?.timezone || 'UTC+08:00');
/** 网页渠道展示聊天消息与浏览器推送两类统计，Telegram 只展示消息结果 */
const isWeb = computed(() => props.type !== 'telegram');

const filter = ref<'all' | CampaignRun['status']>('all');
const query = ref('');
const page = ref(1);
const pageSize = ref(20);
const historyFailed = ref(route.query.historyError === '1');

const runs = computed(() => sortRuns(store.runsOf(props.type)));
const counts = computed(() => {
  const result: Record<'all' | CampaignRun['status'], number> = { all: runs.value.length, running: 0, success: 0, failed: 0 };
  for (const run of runs.value) result[run.status] += 1;
  return result;
});
const filters = computed(() => [
  { key: 'all' as const, label: '全部' },
  { key: 'running' as const, label: '运行中' },
  { key: 'success' as const, label: '成功' },
  { key: 'failed' as const, label: '失败' },
]);
const filtered = computed(() => {
  const keyword = query.value.trim();
  return runs.value.filter((run) => (filter.value === 'all' || run.status === filter.value) && (!keyword || run.snapshotName.includes(keyword)));
});
const paged = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

watch([filter, query, pageSize], () => {
  page.value = 1;
});
</script>

<template>
  <div class="campaigns-pane">
    <div v-if="historyFailed" class="campaigns-banner">
      <span>运行历史加载失败，已保留当前筛选条件与已有数据。</span>
      <ElButton class="ui-btn-outline" @click="historyFailed = false">重试</ElButton>
    </div>

    <div class="campaign-history-toolbar">
      <button
        v-for="item in filters"
        :key="item.key"
        type="button"
        class="campaign-filter"
        :class="{ 'is-active': filter === item.key }"
        @click="filter = item.key"
      >
        {{ item.label }}
        <span class="campaign-filter-count">{{ counts[item.key] }}</span>
      </button>
      <ElInput v-model="query" class="campaign-history-search" clearable placeholder="搜索活动名称" />
    </div>

    <div class="campaign-history-table">
      <div class="ui-table-viewport">
        <ElTable height="100%" :data="paged" class="ui-table campaign-table" empty-text="暂无运行记录">
          <ElTableColumn label="活动名称" min-width="220">
            <template #default="scope">
              <span class="campaign-run-name">{{ scope.row.snapshotName }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="状态" width="100">
            <template #default="scope">
              <span class="campaign-run-status" :class="`is-${scope.row.status}`">{{ runStatusText(scope.row.status) }}</span>
            </template>
          </ElTableColumn>

          <template v-if="isWeb">
            <ElTableColumn label="目标客户数" width="130">
              <template #default="scope">
                <div class="campaign-run-count">
                  <span>{{ countText(scope.row.targetCustomers) }}</span>
                  <span class="is-sub">浏览器：{{ countText(scope.row.browserTargetCustomers) }}</span>
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="发送客户数" width="110">
              <template #default="scope">{{ formatCount(scope.row.sentCustomers) }}</template>
            </ElTableColumn>
            <ElTableColumn label="聊天消息" min-width="150">
              <template #default="scope">
                <span class="campaign-run-muted">成功</span>
                {{ formatCount(scope.row.successMessages) }}
                <span class="campaign-run-muted">/</span>
                <span class="campaign-run-muted">失败</span>
                <span :class="{ 'campaign-run-failed': scope.row.failedMessages > 0 }">{{ formatCount(scope.row.failedMessages) }}</span>
              </template>
            </ElTableColumn>
            <ElTableColumn label="浏览器推送" min-width="150">
              <template #default="scope">
                <span class="campaign-run-muted">成功</span>
                {{ countText(scope.row.browserSuccess) }}
                <span class="campaign-run-muted">/</span>
                <span class="campaign-run-muted">失败</span>
                <span :class="{ 'campaign-run-failed': (scope.row.browserFailed ?? 0) > 0 }">{{ countText(scope.row.browserFailed) }}</span>
              </template>
            </ElTableColumn>
          </template>

          <template v-else>
            <ElTableColumn label="目标客户数" width="120">
              <template #default="scope">{{ countText(scope.row.targetCustomers) }}</template>
            </ElTableColumn>
            <ElTableColumn label="发送客户数" width="120">
              <template #default="scope">{{ formatCount(scope.row.sentCustomers) }}</template>
            </ElTableColumn>
            <ElTableColumn label="发送结果" min-width="170">
              <template #default="scope">
                <span class="campaign-run-muted">成功</span>
                {{ formatCount(scope.row.successMessages) }}
                <span class="campaign-run-muted">/</span>
                <span class="campaign-run-muted">失败</span>
                <span :class="{ 'campaign-run-failed': scope.row.failedMessages > 0 }">{{ formatCount(scope.row.failedMessages) }}</span>
              </template>
            </ElTableColumn>
          </template>

          <ElTableColumn label="运行时间" width="180">
            <template #default="scope">
              <span :class="{ 'campaign-run-muted': !scope.row.startedAt }">{{ runTimeText(scope.row, accountTimezone) }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="耗时" width="110">
            <template #default="scope">
              <span :class="{ 'campaign-run-muted': !scope.row.startedAt }">{{ runDurationText(scope.row, store.runningTick) }}</span>
            </template>
          </ElTableColumn>
          <template #empty>
            <div class="ui-empty">
              <strong>{{ query || filter !== 'all' ? '未找到匹配的运行记录' : '暂无运行记录' }}</strong>
              <span>{{ query || filter !== 'all' ? '请修改或清空筛选条件。' : '活动触发运行后，将在这里展示每次运行结果。' }}</span>
            </div>
          </template>
        </ElTable>
      </div>
    </div>

    <div v-if="filtered.length" class="campaign-history-footer table-footer">
      <span>共 {{ filtered.length }} 条</span>
      <ElPagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" :total="filtered.length" />
    </div>
  </div>
</template>
