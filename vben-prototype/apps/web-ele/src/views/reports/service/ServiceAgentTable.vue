<script lang="ts" setup>
import type { ServiceReportResult, ServiceRow } from '#/features/reports/service-report-metrics';

import { computed, ref } from 'vue';

import { ElTable, ElTableColumn } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import {
  formatCount,
  formatDuration,
  formatEfficiency,
} from '#/features/reports/service-report-format';
import { resolveProfileIdentity } from '#/views/personal/profile-identity';

type SortKey = 'accepted' | 'chat' | 'efficiency' | 'firstResponse' | 'received' | 'replied';

const props = defineProps<{ report?: ServiceReportResult }>();

const sortKey = ref<SortKey>('received');
const sortOrder = ref<'asc' | 'desc'>('desc');

const rows = computed(() => props.report?.rows ?? []);

function valueOf(row: ServiceRow, key: SortKey): null | number {
  if (row.unavailable) return null;
  if (key === 'received') return row.current.receivedSessions;
  if (key === 'replied') return row.current.repliedSessions;
  if (key === 'firstResponse') return row.current.firstResponseSeconds;
  if (key === 'chat') return row.current.chatSeconds;
  if (key === 'accepted') return row.current.acceptedSeconds;
  return row.current.efficiency;
}

const sortedRows = computed(() => {
  const key = sortKey.value;
  const direction = sortOrder.value === 'asc' ? 1 : -1;
  return [...rows.value].sort((left, right) => {
    const a = valueOf(left, key);
    const b = valueOf(right, key);
    if (a === null && b === null) return left.member.name.localeCompare(right.member.name, 'zh-CN');
    if (a === null) return 1;
    if (b === null) return -1;
    if (a !== b) return (a - b) * direction;
    return left.member.name.localeCompare(right.member.name, 'zh-CN');
  });
});

function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
    return;
  }
  sortKey.value = key;
  sortOrder.value = 'desc';
}

function iconOf(key: SortKey) {
  return sortKey.value === key && sortOrder.value === 'asc' ? 'chevron-up' : 'chevron-down';
}

function identityOf(row: ServiceRow) {
  return resolveProfileIdentity({
    avatar: row.member.avatar,
    id: row.member.id,
    name: row.member.name,
  });
}

const emptyText = computed(() => props.report ? '暂无客服数据' : '请选择有效的时间范围');
</script>

<template>
  <section class="ui-card service-table-card">
    <header class="service-table-head">
      <div class="service-table-heading">
        <h2 class="ui-card-title">客服明细</h2>
        <span class="service-table-count">{{ sortedRows.length }} 位成员</span>
      </div>
      <span v-if="report?.memberHistoryIncomplete" class="service-table-note is-warning">
        所选时间超过 180 天，成员维度数据不可用
      </span>
      <span v-else-if="report?.teamHistoryIncomplete" class="service-table-note">
        团队归属历史超过 300 天，已按当前成员统计
      </span>
    </header>

    <ElTable
      :data="sortedRows"
      :empty-text="emptyText"
      :row-key="(row: ServiceRow) => row.member.id"
      class="service-table"
    >
      <ElTableColumn label="客服" min-width="180">
        <template #default="{ row }: { row: ServiceRow }">
          <span class="member-name">
            <i class="member-avatar" :style="{ backgroundColor: identityOf(row).avatarColor }">
              <img v-if="identityOf(row).avatarUrl" :src="identityOf(row).avatarUrl" alt="" />
              <template v-else>{{ identityOf(row).initial }}</template>
            </i>
            <span class="member-text">
              <b>{{ row.member.name }}<template v-if="row.member.deleted">（已删除）</template></b>
              <small>{{ row.member.kind === 'ai' ? 'AI 成员' : row.member.account || '—' }}</small>
            </span>
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn min-width="120" align="right">
        <template #header>
          <button type="button" class="sort-button" :class="{ 'is-active': sortKey === 'received' }" @click="toggleSort('received')">
            接待会话数
            <QIcon :name="iconOf('received')" :size="12" />
          </button>
        </template>
        <template #default="{ row }: { row: ServiceRow }">
          <span class="cell-value" :class="{ 'is-unavailable': row.unavailable }">
            {{ row.unavailable ? '数据不可用' : formatCount(row.current.receivedSessions) }}
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn min-width="120" align="right">
        <template #header>
          <button type="button" class="sort-button" :class="{ 'is-active': sortKey === 'replied' }" @click="toggleSort('replied')">
            已回复会话数
            <QIcon :name="iconOf('replied')" :size="12" />
          </button>
        </template>
        <template #default="{ row }: { row: ServiceRow }">
          <span class="cell-value" :class="{ 'is-unavailable': row.unavailable }">
            {{ row.unavailable ? '数据不可用' : formatCount(row.current.repliedSessions) }}
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn min-width="130" align="right">
        <template #header>
          <button type="button" class="sort-button" :class="{ 'is-active': sortKey === 'firstResponse' }" @click="toggleSort('firstResponse')">
            平均首响
            <QIcon :name="iconOf('firstResponse')" :size="12" />
          </button>
        </template>
        <template #default="{ row }: { row: ServiceRow }">
          <span class="cell-value" :class="{ 'is-unavailable': row.unavailable }">
            {{ row.unavailable ? '数据不可用' : formatDuration(row.current.firstResponseSeconds) }}
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn min-width="130" align="right">
        <template #header>
          <button type="button" class="sort-button" :class="{ 'is-active': sortKey === 'chat' }" @click="toggleSort('chat')">
            聊天时间
            <QIcon :name="iconOf('chat')" :size="12" />
          </button>
        </template>
        <template #default="{ row }: { row: ServiceRow }">
          <span class="cell-value" :class="{ 'is-unavailable': row.unavailable }">
            {{ row.unavailable ? '数据不可用' : formatDuration(row.current.chatSeconds) }}
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn min-width="140" align="right">
        <template #header>
          <button type="button" class="sort-button" :class="{ 'is-active': sortKey === 'accepted' }" @click="toggleSort('accepted')">
            接受聊天时长
            <QIcon :name="iconOf('accepted')" :size="12" />
          </button>
        </template>
        <template #default="{ row }: { row: ServiceRow }">
          <span class="cell-value" :class="{ 'is-unavailable': row.unavailable }">
            {{ row.unavailable ? '数据不可用' : formatDuration(row.current.acceptedSeconds) }}
          </span>
        </template>
      </ElTableColumn>

      <ElTableColumn min-width="120" align="right">
        <template #header>
          <button type="button" class="sort-button" :class="{ 'is-active': sortKey === 'efficiency' }" @click="toggleSort('efficiency')">
            平均效率
            <QIcon :name="iconOf('efficiency')" :size="12" />
          </button>
        </template>
        <template #default="{ row }: { row: ServiceRow }">
          <span class="cell-value" :class="{ 'is-unavailable': row.unavailable }">
            {{ row.unavailable ? '数据不可用' : formatEfficiency(row.current.efficiency) }}
          </span>
        </template>
      </ElTableColumn>
    </ElTable>
  </section>
</template>

<style scoped>
.service-table-head {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: baseline;
  margin-bottom: 16px;
}

.service-table-heading {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.service-table-count {
  font-size: 12px;
  color: var(--ui-ink-muted);
}

.service-table-note {
  margin-left: auto;
  font-size: 12px;
  color: var(--ui-ink-muted);
}

.service-table-note.is-warning {
  color: var(--ui-amber);
}

.sort-button {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  padding: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--ui-ink-secondary);
  cursor: pointer;
  background: none;
  border: 0;
}

.sort-button:hover,
.sort-button.is-active {
  color: var(--ui-ink);
}

.sort-button :deep(svg) {
  opacity: 0.4;
}

.sort-button.is-active :deep(svg) {
  opacity: 1;
}

.cell-value {
  display: inline-block;
  font-size: 13px;
  color: var(--ui-ink);
  font-variant-numeric: tabular-nums;
}

.cell-value.is-unavailable {
  font-size: 12px;
  color: var(--ui-ink-placeholder);
}

.member-name {
  display: flex;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.member-avatar {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  overflow: hidden;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  color: #fff;
  border-radius: 50%;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.member-text b {
  overflow: hidden;
  line-height: 20px;
  color: var(--ui-ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-text small {
  overflow: hidden;
  line-height: 16px;
  color: var(--ui-ink-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
