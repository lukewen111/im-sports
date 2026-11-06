<script setup lang="ts">
import type { RoleRecord } from '#/features/team/role-catalog';
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useRoleStore } from '#/features/team/role-store';
import { formatChatTime } from '#/utils/chat-time';
import RoleEditor from './RoleEditor.vue';

const route = useRoute();
const router = useRouter();
const access = usePrototypeAccess();
const roles = useRoleStore();
const keyword = ref('');
const kind = ref('');

const editorActive = computed(() => route.name === 'TeamRoleCreate' || route.name === 'TeamRoleEditor');
const editorRoleId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''));
const editorReadonly = computed(() => route.query.mode === 'view');

const rows = computed(() => roles.visible.filter((role) => role.name.toLowerCase().includes(keyword.value.trim().toLowerCase()) && (!kind.value || role.kind === kind.value)));

function createRole() {
  void router.push({ name: 'TeamRoleCreate' });
}

function openRole(role: RoleRecord, mode: 'edit' | 'view' = 'edit') {
  void router.push({ name: 'TeamRoleEditor', params: { id: role.id }, query: mode === 'view' ? { mode: 'view' } : {} });
}

async function remove(role: RoleRecord) {
  if (role.system) return ElMessage.warning('系统默认角色不可删除');
  if (roles.count(role.id)) return ElMessage.warning('该角色正在被成员使用，请先调整成员角色');
  try {
    await ElMessageBox.confirm(`确认删除「${role.name}」？删除后角色将从成员可选列表中移除，不影响成员历史与会话记录。`, '删除角色', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' });
  } catch { return; }
  const error = roles.remove(role.id);
  if (error) ElMessage.error(error); else ElMessage.success('角色已删除');
}

function clearFilters() {
  keyword.value = '';
  kind.value = '';
}

function goAccessible() {
  void router.push(access.home || '/personal');
}
</script>

<template>
  <section v-if="!access.canManageRoles" class="role-configuration role-no-access">
    <div class="ui-empty">
      <strong>暂无权限访问该页面</strong>
      <span>角色配置仅向 Owner 与管理员类型角色开放。</span>
      <ElButton class="ui-btn-outline" @click="goAccessible">返回可访问页面</ElButton>
    </div>
  </section>

  <RoleEditor v-else-if="editorActive" :role-id="editorRoleId" :readonly="editorReadonly" />

  <section v-else class="role-configuration">
    <header class="team-page-header">
      <h1>角色配置</h1>
      <ElButton class="ui-btn-primary" type="primary" @click="createRole"><QIcon name="plus" :size="16" />创建角色</ElButton>
    </header>
    <div class="team-content">
      <div class="toolbar">
        <ElInput v-model="keyword" class="team-search" placeholder="搜索角色名称" clearable />
        <ElSelect v-model="kind" placeholder="角色类型" clearable>
          <ElOption v-if="access.isOwner" value="admin" label="管理员" />
          <ElOption value="member" label="普通成员" />
        </ElSelect>
        <ElButton v-if="keyword || kind" class="ui-btn-outline" @click="clearFilters">清除筛选</ElButton>
      </div>

      <div class="team-table-viewport"><ElTable height="100%" class="ui-table role-table" :data="rows" row-key="id">
        <ElTableColumn label="角色名称" min-width="140">
          <template #default="{ row }">
            <span class="role-name-cell"><span>{{ row.name }}</span><span v-if="row.system" class="ui-tag is-soft">系统默认</span></span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="92"><template #default="{ row }"><span class="ui-tag" :class="row.kind === 'admin' ? 'is-outline' : 'is-neutral'">{{ row.kind === 'admin' ? '管理员' : '普通成员' }}</span></template></ElTableColumn>
        <ElTableColumn label="角色描述" min-width="140" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'is-muted': !row.description }">{{ row.description || '—' }}</span></template>
        </ElTableColumn>
        <ElTableColumn label="关联成员数" width="96">
          <template #default="{ row }"><span class="role-count">{{ roles.count(row.id) }}</span></template>
        </ElTableColumn>
        <ElTableColumn label="创建时间" min-width="132">
          <template #default="{ row }"><span :class="{ 'is-muted': !row.createdAt }">{{ row.createdAt ? formatChatTime(row.createdAt) : '—' }}</span></template>
        </ElTableColumn>
        <ElTableColumn label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <ElButton class="ui-btn-outline" @click="openRole(row, 'view')">查看</ElButton>
            <template v-if="!row.system">
              <ElButton class="ui-btn-outline" @click="openRole(row)">编辑</ElButton>
              <ElButton link type="danger" @click="remove(row)">删除</ElButton>
            </template>
          </template>
        </ElTableColumn>
        <template #empty>
          <div class="ui-empty">
            <strong>{{ keyword || kind ? '未找到符合条件的角色' : '暂无角色' }}</strong>
            <span v-if="keyword || kind">试试更换角色名称，或清除筛选条件</span>
            <ElButton v-if="keyword || kind" class="ui-btn-outline" @click="clearFilters">清除筛选</ElButton>
          </div>
        </template>
      </ElTable></div>
    </div>
  </section>
</template>

<style scoped>
.role-configuration { display: flex; width: 100%; min-width: 0; height: 100%; min-height: 0; flex-direction: column; }
.role-table { width: 100%; }
.role-name-cell { display: flex; align-items: center; gap: 8px; min-width: 0; }
.role-name-cell > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.role-name-cell > .ui-tag { flex: 0 0 auto; }

/* 固定操作列：补不透明底色，横向滚动时不透出下层文字 */
.role-table :deep(.el-table__header-wrapper tr th.el-table-fixed-column--right),
.role-table :deep(.el-table__body-wrapper tr td.el-table-fixed-column--right) { background: var(--ui-surface); }
.role-table :deep(.el-table__body-wrapper tr.hover-row td.el-table-fixed-column--right) { background-color: var(--ui-canvas); }
/* 仅在出现横向滚动时显示固定列左侧分隔线 */
.role-table.el-table--scrollable-x :deep(.el-table__header-wrapper tr th.el-table-fixed-column--right),
.role-table.el-table--scrollable-x :deep(.el-table__body-wrapper tr td.el-table-fixed-column--right) { box-shadow: inset 1px 0 0 var(--ui-line); }
.is-muted { color: var(--ui-ink-muted); }
.role-count { font-variant-numeric: tabular-nums; }

.role-no-access { display: grid; min-height: 0; place-items: center; }
</style>
