<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  ElButton,
  ElDatePicker,
  ElInput,
  ElMessage,
  ElOption,
  ElPagination,
  ElPopover,
  ElSelect,
  ElTable,
  ElTableColumn,
} from 'element-plus';

import type { ChannelType } from '#/features/channels/channel-data';
import type { DemoCustomer, DemoSession } from '#/features/service/demo-store';

import { channelMeta } from '#/features/channels/channel-data';
import { useChannelStore } from '#/features/channels/channel-store';
import CustomerDetail from '#/features/customer-detail/CustomerDetail.vue';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import { formatChatTime } from '#/utils/chat-time';
import type { ProfileIdentity } from '../personal/profile-identity';
import { resolveProfileIdentity } from '../personal/profile-identity';

const access = usePrototypeAccess();
const store = useDemoServiceStore();
const channels = useChannelStore();
const router = useRouter();

const keyword = ref('');
const channelType = ref<ChannelType | ''>('');
/** 渠道筛选顺序按 PRD 列举：网站小部件 → 聊天页面 → Telegram（「全部渠道」在最前） */
const filterChannelTypes: ChannelType[] = ['web-widget', 'chat-page', 'telegram'];
const teamIds = ref<string[]>(access.visibleTeams.map((item) => item.id));
const dateRange = ref<[string, string] | null>(null);
const page = ref(1);
const pageSize = ref(20);
const loading = ref(true);
const tableArea = ref<HTMLElement>();
const tableHeight = ref(0);
let loadingTimer: ReturnType<typeof setTimeout> | undefined;
let areaObserver: ResizeObserver | undefined;

const activeId = ref('');
const detailOpen = ref(true);
const detailCollapsed = ref(false);
const recallError = ref('');

function customerIdentity(customer: Pick<DemoCustomer, 'avatar' | 'id' | 'name'>) {
  return resolveProfileIdentity({ avatar: customer.avatar, id: customer.id, name: customer.name });
}
function avatarStyle(identity: ProfileIdentity) {
  return { backgroundColor: identity.avatarColor, color: '#fff' };
}

// 仅管理员且拥有客户权限时可原位编辑（校验与保存由共享组件统一处理）
const canEdit = computed(() => access.isAdmin && access.permissions.customers !== 'none');

onMounted(() => {
  loadingTimer = setTimeout(() => {
    loading.value = false;
  }, 350);
  // 列表区固定高度：表内滚动，分页始终留在视口内
  const area = tableArea.value;
  if (area && typeof ResizeObserver !== 'undefined') {
    const sync = () => {
      tableHeight.value = Math.max(0, Math.floor(area.clientHeight));
    };
    areaObserver = new ResizeObserver(sync);
    areaObserver.observe(area);
    sync();
  }
});
onBeforeUnmount(() => {
  if (loadingTimer) clearTimeout(loadingTimer);
  areaObserver?.disconnect();
});

watch(access.visibleTeams, (teams) => {
  const ids = teams.map((item) => item.id);
  const kept = teamIds.value.filter((id) => ids.includes(id));
  teamIds.value = kept.length ? kept : ids;
}, { deep: true });
watch([keyword, channelType, teamIds, dateRange], () => {
  page.value = 1;
});
watch(pageSize, () => {
  page.value = 1;
});

const allSessionsOf = (customerId: string) => store.sessions.filter((session) => session.customerId === customerId);

function inAssignedScope(session: DemoSession) {
  const scope = access.permissions.assigned;
  if (scope === 'all') return true;
  if (scope === 'team') return Boolean(access.current?.teamIds.includes(session.teamId));
  if (scope === 'self') return session.assigneeId === access.currentId || session.participants.includes(access.currentId);
  return false;
}
function canViewSession(session: DemoSession) {
  if (session.status === 'pending') return access.permissions.pending;
  if (session.status === 'ended' && !session.everAssigned) return access.permissions.pending;
  return access.permissions.assigned !== 'none' && inAssignedScope(session);
}
function customerInScope(customer: DemoCustomer) {
  const scope = access.permissions.customers;
  if (scope === 'all') return true;
  if (scope === 'none') return false;
  const sessions = allSessionsOf(customer.id);
  if (scope === 'self') return sessions.some((session) => session.assigneeId === access.currentId || session.participants.includes(access.currentId));
  return sessions.some((session) => access.current?.teamIds.includes(session.teamId));
}

function resolveChannelType(channelId?: string): ChannelType | undefined {
  if (!channelId) return undefined;
  return channels.channels.find((item) => item.id === channelId)?.type
    || channels.deletedChannelSnapshots.find((item) => item.id === channelId)?.type;
}
/** 渠道筛选按关联会话聚合：该客户任意一条会话（channelId / originChannelId）命中即算匹配 */
function customerChannelTypes(customer: DemoCustomer) {
  const types = new Set<ChannelType>();
  for (const session of allSessionsOf(customer.id)) {
    const type = store.sessionChannelType(session) || resolveChannelType(session.originChannelId);
    if (type) types.add(type);
  }
  return types;
}

const scopedCustomers = computed(() => store.customers.filter(customerInScope));
const hasFilters = computed(() => Boolean(keyword.value.trim() || channelType.value || teamIds.value.length !== access.visibleTeams.length || dateRange.value?.length));
/** 筛选按钮角标：按已生效的条件组计数（团队 / 渠道类型 / 最近活跃） */
const activeFilterCount = computed(() => {
  let count = 0;
  if (teamIds.value.length && teamIds.value.length !== access.visibleTeams.length) count += 1;
  if (channelType.value) count += 1;
  if (dateRange.value?.length) count += 1;
  return count;
});
const rows = computed(() => scopedCustomers.value
  .filter((customer) => {
    const text = keyword.value.trim().toLowerCase();
    if (!text) return true;
    return `${customer.name}${customer.id}${customer.email}${customer.phone}`.toLowerCase().includes(text);
  })
  .filter((customer) => (channelType.value ? customerChannelTypes(customer).has(channelType.value) : true))
  .filter((customer) => (teamIds.value.length
    ? allSessionsOf(customer.id).some((session) => teamIds.value.includes(session.teamId))
    : true))
  .filter((customer) => {
    if (!dateRange.value?.length) return true;
    const start = new Date(`${dateRange.value[0]}T00:00:00`).getTime();
    const end = new Date(`${dateRange.value[1]}T23:59:59`).getTime();
    const active = new Date(customer.lastActive).getTime();
    return active >= start && active <= end;
  })
  .sort((left, right) => +new Date(right.lastActive) - +new Date(left.lastActive)));
const pagedRows = computed(() => rows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch(rows, (list) => {
  const maximum = Math.max(1, Math.ceil(list.length / pageSize.value));
  if (page.value > maximum) page.value = maximum;
});
const emptyText = computed(() => {
  if (!store.customers.length) return '暂无客户';
  if (!scopedCustomers.value.length) return '当前数据范围内暂无客户';
  return '未找到符合条件的客户';
});

const current = computed(() => store.customerById(activeId.value));
const visit = computed(() => (current.value ? store.visitSummary(current.value.id) : undefined));
const accepting = computed(() => Boolean(access.current?.online && store.settingsFor(access.currentId).accepting));

function sessionCount(customerId: string) {
  return store.sessions.filter((session) => session.customerId === customerId).length;
}
function unfinishedOf(customerId: string) {
  return store.sessions.find((session) => session.customerId === customerId && session.status !== 'ended');
}

function open(id: string) {
  if (activeId.value === id && current.value) return;
  const customer = store.customerById(id);
  if (!customer) return ElMessage.warning('客户不存在或已不可访问');
  activeId.value = id;
  detailOpen.value = true;
  recallError.value = '';
}
function openRow(row: DemoCustomer) {
  open(row.id);
}

function goChat(session: DemoSession) {
  if (!canViewSession(session)) return ElMessage.warning('暂无权限查看该会话');
  void router.push(`/inbox?session=${session.id}`);
}
function recallCustomer(customer: DemoCustomer) {
  recallError.value = '';
  if (!access.permissions.recall) {
    recallError.value = '暂无权限发起回聊';
    return ElMessage.warning(recallError.value);
  }
  if (!accepting.value) {
    recallError.value = '请先开启接受聊天';
    return ElMessage.warning(recallError.value);
  }
  const sourceChannelId = visit.value?.sourceChannelId || customer.sourceChannelId;
  if (!sourceChannelId) {
    recallError.value = '客户缺少原咨询渠道信息，无法回聊，也不会改用其他渠道。';
    return ElMessage.error(recallError.value);
  }
  const result = store.recall(customer.id, sourceChannelId, access.currentId);
  if (result.code === 'channel-deleted') {
    recallError.value = `${result.error || '客户原咨询渠道已删除。'} 不会改用其他渠道创建会话。`;
    return ElMessage.error(recallError.value);
  }
  if (result.error) {
    recallError.value = result.error;
    return ElMessage.error(result.error);
  }
  if (result.session) {
    ElMessage.success('已按客户原渠道发起回聊');
    void router.push(`/inbox?session=${result.session.id}`);
  }
}
function primaryAction(customer: DemoCustomer) {
  const unfinishedSession = unfinishedOf(customer.id);
  if (unfinishedSession) return goChat(unfinishedSession);
  recallCustomer(customer);
}

function openSession(session: DemoSession) {
  // 无权条目按 PRD 只做灰显占位，不可点击
  if (!canViewSession(session)) return;
  void router.push(`/inbox?session=${session.id}`);
}
function resetFilters() {
  keyword.value = '';
  channelType.value = '';
  teamIds.value = access.visibleTeams.map((item) => item.id);
  dateRange.value = null;
  page.value = 1;
}
function rowClassName({ row }: { row: DemoCustomer }) {
  return row.id === activeId.value ? 'is-active' : '';
}
</script>

<template>
  <main class="customer-page">
    <div class="customer-layout" :class="{ 'has-detail': Boolean(current), 'is-collapsed': detailCollapsed }">
      <section class="list-card">
        <header class="card-head">
          <h1>客户</h1>
        </header>

        <div class="toolbar">
          <ElInput v-model="keyword" clearable placeholder="搜索客户名称、客户 ID、邮箱或手机号" class="search-input">
            <template #prefix>
              <svg class="search-icon" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="6.8" cy="6.8" r="4.6" />
                <path d="M10.3 10.3 14 14" />
              </svg>
            </template>
          </ElInput>
          <ElPopover
            placement="bottom-end"
            trigger="click"
            :width="340"
            :offset="8"
            :show-arrow="false"
            popper-class="customer-filter-popper"
          >
            <template #reference>
              <ElButton class="filter-trigger">
                <svg class="filter-icon" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M1.4 2h9.2l-3.5 4.2v3.9l-2.2-1.2V6.2L1.4 2Z" />
                </svg>
                <span>筛选</span>
                <span v-if="activeFilterCount" class="filter-count">{{ activeFilterCount }}</span>
              </ElButton>
            </template>
            <div class="filter-panel">
              <div class="filter-row">
                <span class="filter-label">团队</span>
                <ElSelect
                  v-model="teamIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  clearable
                  placeholder="全部团队"
                  class="filter-control"
                  :teleported="false"
                >
                  <ElOption v-for="item in access.visibleTeams" :key="item.id" :label="item.name" :value="item.id" />
                </ElSelect>
              </div>
              <div class="filter-row">
                <span class="filter-label">渠道类型</span>
                <ElSelect v-model="channelType" placeholder="全部渠道" class="filter-control" :teleported="false">
                  <ElOption label="全部渠道" value="" />
                  <ElOption v-for="type in filterChannelTypes" :key="type" :label="channelMeta[type].label" :value="type" />
                </ElSelect>
              </div>
              <div class="filter-row">
                <span class="filter-label">最近活跃</span>
                <ElDatePicker
                  v-model="dateRange"
                  type="daterange"
                  value-format="YYYY-MM-DD"
                  range-separator="至"
                  start-placeholder="起"
                  end-placeholder="止"
                  class="filter-control filter-date"
                  placement="bottom-start"
                  :teleported="false"
                  :popper-options="{ strategy: 'fixed', modifiers: [{ name: 'flip', enabled: false }] }"
                />
              </div>
            </div>
          </ElPopover>
          <ElButton text class="clear-button" @click="resetFilters">清除筛选</ElButton>
        </div>

        <div ref="tableArea" class="table-area">
        <ElTable
          v-loading="loading"
          :data="pagedRows"
          :height="tableHeight || undefined"
          :row-class-name="rowClassName"
          show-header
          @row-click="openRow"
        >
          <ElTableColumn label="客户" width="200">
            <template #default="{ row }">
              <div class="customer-cell">
                <i class="avatar" :style="avatarStyle(customerIdentity(row))"><img v-if="customerIdentity(row).avatarUrl" :src="customerIdentity(row).avatarUrl" alt="" /><template v-else>{{ customerIdentity(row).initial }}</template></i>
                <div class="customer-text">
                  <b>{{ row.name }}</b>
                  <small>{{ row.id }}</small>
                </div>
              </div>
            </template>
          </ElTableColumn>
          <ElTableColumn label="邮箱" min-width="110">
            <template #default="{ row }"><span class="cell-text" :class="{ 'is-empty': !row.email }">{{ row.email || '—' }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="手机号" min-width="98">
            <template #default="{ row }"><span class="cell-text" :class="{ 'is-empty': !row.phone }">{{ row.phone || '—' }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="最近活跃" min-width="94">
            <template #default="{ row }"><span class="cell-text">{{ formatChatTime(row.lastActive) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="会话数" width="64" align="right">
            <template #default="{ row }"><span class="cell-text">{{ sessionCount(row.id) }}</span></template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="88" fixed="right">
            <template #default="{ row }">
              <div class="row-actions" @click.stop>
                <ElButton class="ui-btn-outline row-action-btn" @click="primaryAction(row)">
                  {{ unfinishedOf(row.id) ? '去聊天' : '回聊' }}
                </ElButton>
              </div>
            </template>
          </ElTableColumn>
          <template #empty>
            <div class="empty-state">
              <p>{{ emptyText }}</p>
              <ElButton v-if="hasFilters" text @click="resetFilters">清空筛选条件</ElButton>
            </div>
          </template>
        </ElTable>
        </div>

        <div v-if="rows.length" class="table-foot">
          <ElPagination
            v-model:current-page="page"
            v-model:page-size="pageSize"
            :page-sizes="[10, 20, 50]"
            :total="rows.length"
            layout="total, sizes, prev, pager, next"
          />
        </div>
      </section>

      <CustomerDetail
        v-if="current"
        v-model:open="detailOpen"
        v-model:collapsed="detailCollapsed"
        class="detail-card"
        :customer="current"
        :editable="canEdit"
        @select="openSession"
      />
    </div>
  </main>
</template>

<style scoped>
.customer-page {
  --ink: #131317;
  --ink-2: #62626d;
  --ink-3: #8c8c8e;
  --line: #ececed;
  --canvas: #f5f5f5;
  --control-line: #c9c9cd;
  box-sizing: border-box;
  display: flex;
  height: calc(100vh - var(--ui-header-height, 48px));
  min-height: 0;
  padding: 0;
  color: var(--ink);
  background: var(--canvas);
  font-size: 14px;
}
.customer-layout { display: grid; flex: 1; min-height: 0; gap: 12px; align-items: stretch; --detail-width: 380px; transition: grid-template-columns 0.24s ease; }
.customer-layout.has-detail { grid-template-columns: minmax(0, 1fr) var(--detail-width); }
.customer-layout.is-collapsed { --detail-width: 32px; }
.list-card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  margin: 12px 0 12px 12px;
  overflow: hidden;
  background: #fff;
  border: 0;
  border-radius: 16px;
}
.customer-layout:not(.has-detail) .list-card { margin-right: 12px; }
.detail-card {
  position: sticky;
  top: 12px;
  align-self: start;
  height: calc(100vh - var(--ui-header-height, 48px) - 24px);
  max-height: calc(100vh - var(--ui-header-height, 48px) - 24px);
  margin: 12px 12px 12px 0;
  border: 0 !important;
}
.customer-layout.is-collapsed .detail-card { margin-right: 0; }

.card-head {
  display: flex;
  flex: 0 0 48px;
  height: 48px;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  border-radius: 16px 16px 0 0;
}
.card-head h1 { margin: 0; color: var(--ink); font-size: 16px; font-weight: 500; line-height: 24px; }

.toolbar { display: flex; flex: 0 0 auto; gap: 10px; align-items: center; padding: 12px 16px; }
.search-input { flex: 0 0 140px; width: 140px; min-width: 0; }
@media (max-width: 1366px) {
  .search-input { flex-basis: 128px; width: 128px; }
}
.filter-trigger.el-button {
  flex: 0 0 auto;
  height: 32px;
  margin-left: 0;
  padding: 0 12px;
  gap: 6px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 500;
  background: #fff;
  border: 1px solid var(--control-line);
  border-radius: 8px;
}
.filter-trigger.el-button:not(.is-disabled):hover,
.filter-trigger.el-button:not(.is-disabled):focus {
  color: var(--ink);
  background: #f5f5f5;
  border-color: var(--control-line);
}
.filter-icon { width: 12px; height: 12px; }
.filter-icon path { fill: currentcolor; }
.filter-count {
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  margin-left: 4px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  background: var(--ink);
  border-radius: 8px;
}
.clear-button { margin-left: 0; color: var(--ink-2); font-size: 12px; }

:global(.customer-filter-popper.el-popover) {
  padding: 4px 12px;
  border: 1px solid #ececed;
  border-radius: 12px;
  box-shadow: 0 12px 28px rgb(19 19 23 / 12%);
}
:global(.customer-filter-popper .el-popper__arrow) { display: none; }
:global(.customer-filter-popper .filter-panel) { display: grid; }
:global(.customer-filter-popper .filter-row) {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f1;
}
:global(.customer-filter-popper .filter-row:last-child) { border-bottom: 0; }
:global(.customer-filter-popper .filter-label) {
  flex: 0 0 60px;
  color: #62626d;
  font-size: 12px;
  line-height: 18px;
}
:global(.customer-filter-popper .filter-control) { flex: 1 1 auto; width: auto; min-width: 0; }
:global(.customer-filter-popper .filter-date) { flex: 1 1 auto; width: 100%; }
:global(.customer-filter-popper .filter-control .el-input__wrapper),
:global(.customer-filter-popper .filter-control .el-select__wrapper) {
  min-height: 30px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px #c9c9cd inset;
}
:global(.customer-filter-popper .filter-control .el-input__inner),
:global(.customer-filter-popper .filter-control .el-range-input),
:global(.customer-filter-popper .filter-control .el-range-separator) { font-size: 12px; }

.toolbar :deep(.el-input__wrapper) {
  min-height: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 0 0 1px var(--control-line) inset;
}
.toolbar :deep(.el-input__wrapper.is-focus) { box-shadow: 0 0 0 1px var(--ink) inset; }
.toolbar :deep(.el-input__inner) { font-size: 13px; }
/* 搜索框：左内距 10、图标 14、图标与文字间距 6 */
.search-input :deep(.el-input__wrapper) { padding: 0 10px; }
.search-input :deep(.el-input__prefix) { color: var(--ink-3); }
.search-input :deep(.el-input__prefix-inner > :last-child) { margin-right: 6px; }
.search-icon { width: 14px; height: 14px; fill: none; stroke: currentcolor; stroke-width: 1.3; }

.table-area { flex: 1; min-height: 0; min-width: 0; padding: 0 4px; }

.list-card :deep(.el-table) {
  --el-table-border-color: var(--line);
  --el-table-bg-color: #fff;
  --el-table-tr-bg-color: #fff;
  --el-table-header-bg-color: #fff;
  --el-table-header-text-color: var(--ink-2);
  --el-table-row-hover-bg-color: transparent;
  --el-table-text-color: var(--ink);
  font-size: 13px;
}
.list-card :deep(.el-table__inner-wrapper::before) { display: none; }
.list-card :deep(.el-table th.el-table__cell) {
  height: 42px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-2);
  background: #fff;
  border-bottom: 1px solid var(--line);
}
.list-card :deep(.el-table td.el-table__cell) {
  height: 56px;
  padding: 0;
  border-bottom: 1px solid #f2f2f3;
}
.list-card :deep(.el-table__row) { cursor: pointer; }
.list-card :deep(.el-table .cell) { position: relative; z-index: 0; padding: 0 12px; }
/* 行 hover 用内缩圆角底色（左右 inset 6px），文字与头像不位移 */
.list-card :deep(.el-table__body .cell::before) {
  content: "";
  position: absolute;
  top: 50%;
  right: -6px;
  left: -6px;
  height: 48px;
  z-index: -1;
  background: transparent;
  border-radius: 8px;
  transform: translateY(-50%);
  transition: background-color 0.15s ease;
}
.list-card :deep(.el-table__row:hover .cell::before) { background: #f5f5f6; }
.list-card :deep(.el-table__body td:first-child .cell::before) { left: 6px; }
.list-card :deep(.el-table__body td:last-child .cell::before) { right: 6px; }
.cell-text { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.cell-text.is-empty { color: var(--ink-3); }
/* 操作列固定右侧：三档表格均无横向滚动，底色透明以承接整行 hover 圆角 */
.list-card :deep(.el-table-fixed-column--right) { background: transparent !important; }

.customer-cell { display: flex; gap: 10px; align-items: center; min-width: 0; }
.customer-text { display: block; min-width: 0; }
.customer-cell b { display: block; overflow: hidden; color: var(--ink); font-size: 14px; font-weight: 500; line-height: 20px; white-space: nowrap; text-overflow: ellipsis; }
.customer-cell small { display: block; margin-top: 2px; overflow: hidden; color: var(--ink-3); font-size: 12px; line-height: 16px; white-space: nowrap; text-overflow: ellipsis; }
.avatar {
  display: grid;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  place-items: center;
  font-style: normal;
  font-weight: 600;
  border-radius: 50%;
  overflow: hidden;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.avatar.is-large { width: 40px; height: 40px; font-size: 15px; }
.glyph-mini { display: inline-flex; flex: 0 0 auto; width: 24px; height: 24px; overflow: hidden; border-radius: 7px; }
.glyph-mini :deep(.channel-glyph) { width: 24px; height: 24px; border: 0; background: #f5f5f5; transform: scale(0.8); transform-origin: center; }
.glyph-mini :deep(.channel-glyph svg) { width: 16px; height: 16px; }

.row-actions { display: flex; justify-content: flex-end; align-items: center; }
.row-actions .row-action-btn {
  width: 64px;
  height: 28px;
  padding: 0;
  font-size: 12px;
  border-color: var(--ui-accent);
  border-radius: 8px;
  background: #fff;
}
.row-actions .row-action-btn:not(.is-disabled):hover { background: var(--ui-accent-soft); }
.row-actions .row-action-btn:not(.is-disabled):active { background: var(--ui-accent-soft-strong); }

.table-foot { display: flex; flex: 0 0 auto; justify-content: flex-end; gap: 8px; padding: 12px 16px 16px; }
.table-foot :deep(.el-pagination) { --el-pagination-font-size: 12px; --el-pagination-button-height: 28px; }
.empty-state { padding: 36px 0 28px; color: var(--ink-3); font-size: 12px; }
.empty-state p { margin: 0 0 6px; }
.empty-state :deep(.el-button) { color: var(--ink); font-size: 12px; }

.profile-grid { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 10px 12px; margin: 0; font-size: 12px; }
.profile-grid dt { color: var(--ink-3); }
.profile-grid dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.field-grid { display: grid; gap: 12px; }
.field-grid label { display: grid; gap: 6px; color: var(--ink-2); font-size: 12px; }
.field-grid :deep(.el-input__wrapper),
.field-grid :deep(.el-textarea__inner) { border-radius: 8px; box-shadow: 0 0 0 1px var(--control-line) inset; }
.field-grid :deep(.el-input.is-error .el-input__wrapper) { box-shadow: 0 0 0 1px #ca0005 inset; }
.field-error { margin: 0; color: #ca0005; font-size: 11px; line-height: 1.4; }
.edit-actions { display: flex; justify-content: flex-end; gap: 8px; }
.edit-actions :deep(.el-button) { height: 34px; border-radius: 8px; }
.edit-actions :deep(.el-button--primary) { background: var(--ink); border-color: var(--ink); }

.recent-list { display: grid; }
.recent-item {
  display: flex;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 0;
  font: inherit;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--line);
}
.recent-item:last-child { border-bottom: 0; }
.recent-main { display: grid; gap: 3px; min-width: 0; }
.recent-main b { overflow: hidden; font-size: 12px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.recent-main b.expired { color: var(--ink-2); font-weight: 400; }
.recent-main small { overflow: hidden; color: var(--ink-3); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
.recent-item.is-locked { cursor: not-allowed; }
.locked-text { color: var(--ink-3); font-size: 12px; }
.load-more { justify-self: start; margin-top: 8px; color: var(--ink-2); font-size: 12px; }

.visit-grid { display: grid; grid-template-columns: 82px minmax(0, 1fr); gap: 9px 12px; margin: 0; padding: 12px 14px; font-size: 12px; background: #f7f7f8; border-radius: 12px; }
.visit-grid dt { color: var(--ink-3); }
.visit-grid dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.visit-grid dd.break { line-height: 1.45; word-break: break-all; }
.visit-grid dd.mono { font-family: ui-monospace, 'SF Mono', Consolas, monospace; font-size: 11px; }
.muted { color: var(--ink-3); font-size: 11px; }

@media (max-width: 1180px) {
  .customer-layout.has-detail { grid-template-columns: minmax(0, 1fr) 340px; }
}
@media (max-width: 960px) {
  .customer-layout.has-detail { grid-template-columns: minmax(0, 1fr); }
  .detail-card { position: static; height: auto; max-height: none; margin: 0 12px 12px; }
  .customer-layout.has-detail .list-card { margin-right: 12px; }
}
</style>
