<script setup lang="ts">
import type { BooleanPermission, DataScope, RoleKind, RoleRecord } from '#/features/team/role-catalog';
import { computed, nextTick, reactive, ref, toRaw, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElButton, ElCheckbox, ElDrawer, ElForm, ElFormItem, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTable, ElTableColumn } from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import { usePrototypeAccess } from '#/features/team/access-store';
import { changePermission, emptyPermissions, permissionLabels, roleRecords, scopeRank } from '#/features/team/role-catalog';
import { useRoleStore } from '#/features/team/role-store';
import { formatChatTime } from '#/utils/chat-time';

type RoleDraft = Omit<RoleRecord, 'kind'> & { kind: RoleKind | '' };
type MatrixKey = BooleanPermission | 'assigned' | 'customers' | 'teamScope';
interface MatrixItem { hint?: string; key: MatrixKey; label: string; scope?: 'assigned' | 'customers' | 'teamScope' }
interface MatrixGroup { items: MatrixItem[]; module: string }

const router = useRouter();
const access = usePrototypeAccess();
const roles = useRoleStore();
const keyword = ref('');
const kind = ref('');
const drawer = ref(false);
const readonly = ref(false);
const draft = ref<RoleDraft>();
const baseline = ref('');
const conflict = ref(false);
const errors = reactive({ name: '', kind: '', pages: '', permission: '' });

const rows = computed(() => roles.visible.filter((role) => role.name.toLowerCase().includes(keyword.value.trim().toLowerCase()) && (!kind.value || role.kind === kind.value)));

const scopeLabels: Record<DataScope, string> = { none: '不授予', self: '本人数据', team: '所属团队数据', all: '全部数据' };
const rangeOptions: DataScope[] = ['self', 'team', 'all'];
const teamScopeOptions: DataScope[] = ['team', 'all'];
const matrix: MatrixGroup[] = [
  {
    module: '聊天',
    items: [
      { key: 'assigned', label: '已分配会话列表', scope: 'assigned' },
      { key: 'pending', label: '待分配' },
      { key: 'takeover', label: '接管会话' },
      { key: 'transfer', label: '转接会话' },
      { key: 'end', label: '结束会话' },
    ],
  },
  {
    module: '客户',
    items: [
      { key: 'customers', label: '客户列表', scope: 'customers' },
      { key: 'recall', label: '回聊' },
    ],
  },
  {
    module: '团队',
    items: [
      { key: 'teams', label: '团队管理' },
      { key: 'humans', label: '人类成员' },
      { key: 'ai', label: 'AI 成员' },
      { key: 'teamScope', label: '三项共用数据范围', scope: 'teamScope' },
    ],
  },
  { module: '渠道', items: [{ key: 'channels', label: '渠道' }] },
  { module: '设置', items: [{ key: 'settings', label: '聊天与接待' }] },
];

function open(role?: RoleRecord, view = false) {
  conflict.value = false;
  Object.assign(errors, { name: '', kind: '', pages: '', permission: '' });
  draft.value = role
    ? structuredClone(toRaw(role)) as RoleDraft
    : { id: `role-${crypto.randomUUID()}`, name: '', kind: access.isOwner ? '' : 'member', description: '', system: false, createdAt: '', version: 0, permissions: emptyPermissions() };
  readonly.value = view || Boolean(role?.system);
  baseline.value = JSON.stringify(draft.value);
  drawer.value = true;
  void nextTick(() => requestAnimationFrame(() => document.querySelector('.role-drawer .el-drawer__body')?.scrollTo({ top: 0 })));
}

function checked(item: MatrixItem) {
  const p = draft.value?.permissions;
  if (!p || item.key === 'teamScope') return false;
  if (item.key === 'assigned' || item.key === 'customers') return p[item.key] !== 'none';
  return p[item.key];
}

function scopeOf(item: MatrixItem): DataScope {
  const p = draft.value?.permissions;
  if (!p) return 'none';
  if (item.scope === 'teamScope') return p.teamScope;
  return item.scope ? p[item.scope] : 'none';
}

function scopeChoices(item: MatrixItem) {
  return item.scope === 'teamScope' ? teamScopeOptions : rangeOptions;
}

function itemDisabled(item: MatrixItem) {
  if (readonly.value || item.key === 'teamScope') return true;
  const c = access.permissions;
  if (item.key === 'assigned' || item.key === 'customers') return c[item.key] === 'none';
  if (item.key === 'takeover') return !c.takeover || c.assigned === 'none';
  if (item.key === 'recall') return !c.recall || c.assigned === 'none' || c.customers === 'none';
  return !c[item.key];
}

function scopeDisabled(item: MatrixItem) {
  if (readonly.value) return true;
  if (item.scope === 'teamScope') return !(draft.value?.permissions.teams || draft.value?.permissions.humans || draft.value?.permissions.ai);
  return false;
}

function scopeOptionDisabled(item: MatrixItem, scope: DataScope) {
  if (item.scope === 'teamScope') return scope === 'all' && access.permissions.teamScope !== 'all';
  const key = item.scope as 'assigned' | 'customers';
  return scopeRank(scope) > scopeRank(access.permissions[key]);
}

function clearPermissionErrors() {
  errors.pages = '';
  errors.permission = '';
}

function toggleItem(item: MatrixItem, value: boolean | number | string) {
  if (!draft.value || readonly.value || item.key === 'teamScope') return;
  const p = draft.value.permissions;
  const on = Boolean(value);
  if (item.key === 'assigned' || item.key === 'customers') changePermission(p, item.key, on ? (p[item.key] === 'none' ? 'self' : p[item.key]) : 'none');
  else changePermission(p, item.key, on);
  clearPermissionErrors();
}

function changeScope(key: 'assigned' | 'customers' | 'teamScope', value: string) {
  if (!draft.value || readonly.value) return;
  if (key === 'teamScope') draft.value.permissions.teamScope = value as 'all' | 'team';
  else changePermission(draft.value.permissions, key, value as DataScope);
  clearPermissionErrors();
}

function changeItemScope(item: MatrixItem, value: string) {
  if (item.scope) changeScope(item.scope, value);
}

function validate() {
  Object.assign(errors, { name: '', kind: '', pages: '', permission: '' });
  conflict.value = false;
  const d = draft.value;
  if (!d) return false;
  const name = d.name.trim();
  if (!name) errors.name = '请输入角色名称';
  else if (name === 'Owner') errors.name = '角色名称不可使用 Owner';
  else if (roleRecords.value.some((role) => role.id !== d.id && role.name.trim().toLowerCase() === name.toLowerCase())) errors.name = '角色名称已存在，请更换';
  if (!d.kind) errors.kind = '请选择角色类型';

  const p = d.permissions;
  const hasPage = p.assigned !== 'none' || p.pending || p.customers !== 'none' || p.teams || p.humans || p.ai || p.channels || p.settings;
  if (!hasPage) errors.pages = '请至少配置一项业务页面权限';
  if ((p.takeover && p.assigned === 'none') || (p.recall && (p.assigned === 'none' || p.customers === 'none'))) errors.permission = '权限依赖不完整，请重新配置';

  if (!errors.permission) {
    const c = access.permissions;
    if (scopeRank(p.assigned) > scopeRank(c.assigned) || scopeRank(p.customers) > scopeRank(c.customers)) errors.permission = '无权授予超出自身范围的权限';
    else if ((p.teams || p.humans || p.ai) && scopeRank(p.teamScope) > scopeRank(c.teamScope)) errors.permission = '无权授予超出自身范围的权限';
    else if ((Object.keys(permissionLabels) as BooleanPermission[]).some((key) => p[key] && !c[key])) errors.permission = '无权授予超出自身范围的权限';
  }

  if (d.version) {
    const latest = roleRecords.value.find((role) => role.id === d.id);
    if (!latest) { ElMessage.warning('角色不存在或已被删除'); drawer.value = false; return false; }
    if (latest.version !== d.version) { conflict.value = true; return false; }
  }
  return !errors.name && !errors.kind && !errors.pages && !errors.permission;
}

function storeError(message: string) {
  if (message.includes('已变化') || message.includes('刷新')) conflict.value = true;
  else if (message.includes('管理此类型')) errors.permission = message;
  else if (message.includes('名称')) errors.name = message;
  else if (message.includes('类型')) errors.kind = message;
  else if (message.includes('页面')) errors.pages = message;
  else if (message.includes('超过') || message.includes('未拥有')) errors.permission = '无权授予超出自身范围的权限';
  else errors.permission = message;
}

function save() {
  const d = draft.value;
  if (!d || readonly.value) return;
  if (!validate()) return;
  const existing = Boolean(d.version);
  const affected = roles.count(d.id);
  const error = roles.save({ ...d, kind: d.kind as RoleKind });
  if (error) return storeError(error);
  drawer.value = false;
  ElMessage.success(existing ? (affected ? `角色已保存，${affected} 名关联成员的权限已即时生效` : '角色已保存') : '角色已创建，可在成员编辑时选择');
}

function reloadLatest() {
  const d = draft.value;
  if (!d) return;
  const latest = roleRecords.value.find((role) => role.id === d.id);
  if (!latest) { ElMessage.warning('角色不存在或已被删除'); drawer.value = false; return; }
  draft.value = structuredClone(toRaw(latest)) as RoleDraft;
  baseline.value = JSON.stringify(draft.value);
  conflict.value = false;
  Object.assign(errors, { name: '', kind: '', pages: '', permission: '' });
  ElMessage.success('已加载最新角色信息');
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

async function close(done?: () => void) {
  if (!readonly.value && draft.value && JSON.stringify(draft.value) !== baseline.value) {
    try { await ElMessageBox.confirm('有尚未保存的角色配置，是否放弃？', '离开编辑', { confirmButtonText: '放弃', cancelButtonText: '继续编辑' }); } catch { return; }
  }
  drawer.value = false;
  done?.();
}

function clearFilters() {
  keyword.value = '';
  kind.value = '';
}

function goAccessible() {
  void router.push(access.home || '/personal');
}

watch(() => access.canManageRoles, (allowed) => { if (!allowed) drawer.value = false; });
watch(roleRecords, (list) => {
  const d = draft.value;
  if (!drawer.value || !d || !d.version) return;
  if (!list.some((role) => role.id === d.id)) { ElMessage.warning('角色不存在或已被删除'); drawer.value = false; }
});
</script>

<template>
  <section v-if="access.canManageRoles" class="role-configuration">
    <header class="team-page-header">
      <h1>角色配置</h1>
      <ElButton class="ui-btn-primary" type="primary" @click="open()"><QIcon name="plus" :size="16" />创建角色</ElButton>
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
            <ElButton class="ui-btn-outline" @click="open(row, true)">查看</ElButton>
            <template v-if="!row.system">
              <ElButton class="ui-btn-outline" @click="open(row)">编辑</ElButton>
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
      <footer v-if="rows.length" class="ui-table-footer"><span>共 {{ rows.length }} 个角色</span></footer>
    </div>

    <ElDrawer v-model="drawer" class="ui-drawer role-drawer" :title="readonly ? '角色详情' : draft?.version ? '编辑角色' : '创建角色'" size="640px" :before-close="close" append-to-body>
      <ElForm v-if="draft" class="ui-form role-form" label-position="top" @submit.prevent>
        <div class="role-form-grid">
          <ElFormItem label="角色名称" required :error="errors.name">
            <ElInput v-model="draft.name" maxlength="32" show-word-limit placeholder="请输入角色名称" :disabled="readonly" />
          </ElFormItem>
          <ElFormItem label="角色类型" required :error="errors.kind">
            <ElSelect v-model="draft.kind" placeholder="请选择角色类型" :disabled="readonly || Boolean(draft.version)">
              <ElOption v-if="access.isOwner" value="admin" label="管理员" />
              <ElOption value="member" label="普通成员" />
            </ElSelect>
          </ElFormItem>
        </div>
        <ElFormItem label="角色描述">
          <ElInput v-model="draft.description" type="textarea" :rows="2" maxlength="80" show-word-limit placeholder="可选，用于说明角色用途" :disabled="readonly" />
        </ElFormItem>
        <div class="role-meta-line">
          <span class="ui-tag" :class="draft.system ? 'is-solid' : 'is-neutral'">{{ draft.system ? '系统默认角色' : '自定义角色' }}</span>
          <span v-if="draft.version" class="ui-meta">{{ roles.count(draft.id) }} 名关联成员</span>
          <span v-if="draft.system" class="ui-meta">预置配置固定，不可编辑或删除</span>
        </div>

        <div class="matrix-head">
          <h3>功能权限与数据范围</h3>
          <span v-if="!readonly" class="ui-meta">未勾选的权限不会开放</span>
        </div>
        <table class="permission-matrix">
          <thead>
            <tr><th class="col-module">模块</th><th class="col-permission">权限项</th><th class="col-scope">数据范围</th></tr>
          </thead>
          <tbody v-for="group in matrix" :key="group.module">
            <tr v-for="(item, index) in group.items" :key="item.key">
              <td v-if="index === 0" class="matrix-module" :rowspan="group.items.length">{{ group.module }}</td>
              <td class="matrix-permission">
                <span v-if="item.key === 'teamScope'" class="matrix-scope-label">{{ item.label }}</span>
                <ElCheckbox v-else :model-value="checked(item)" :disabled="itemDisabled(item)" @change="(value) => toggleItem(item, value)">{{ item.label }}</ElCheckbox>
              </td>
              <td class="matrix-scope">
                <ElSelect
                  v-if="item.scope && (item.scope === 'teamScope' || scopeOf(item) !== 'none')"
                  :model-value="scopeOf(item)" :disabled="scopeDisabled(item)" @change="(value: string) => changeItemScope(item, value)"
                >
                  <ElOption v-for="scope in scopeChoices(item)" :key="scope" :value="scope" :label="scopeLabels[scope]" :disabled="scopeOptionDisabled(item, scope)" />
                </ElSelect>
                <span v-else class="is-muted">—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <p v-if="errors.pages" class="ui-form-error">{{ errors.pages }}</p>
        <p v-if="errors.permission" class="ui-form-error">{{ errors.permission }}</p>
        <p v-if="!readonly && !access.isOwner" class="ui-form-help">灰显权限表示超出您当前可转授的范围，无法勾选。</p>
        <div v-if="conflict" class="conflict-notice" role="alert">
          <span>角色信息已更新，请刷新后重试</span>
          <ElButton class="ui-btn-outline" @click="reloadLatest">刷新角色信息</ElButton>
        </div>
      </ElForm>
      <template #footer>
        <ElButton class="ui-btn-outline" @click="close()">{{ readonly ? '关闭' : '取消' }}</ElButton>
        <ElButton v-if="!readonly" type="primary" class="ui-btn-primary" @click="save">保存</ElButton>
      </template>
    </ElDrawer>
  </section>

  <section v-else class="role-configuration role-no-access">
    <div class="ui-empty">
      <strong>暂无权限访问该页面</strong>
      <span>角色配置仅向 Owner 与管理员类型角色开放。</span>
      <ElButton class="ui-btn-outline" @click="goAccessible">返回可访问页面</ElButton>
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

.role-form-grid { display: grid; grid-template-columns: minmax(0, 1fr) 200px; gap: 16px; }
.role-form-grid :deep(.el-form-item) { margin-bottom: 20px; }
.role-meta-line { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 2px 0 4px; }

.matrix-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 20px 0 8px; }
.matrix-head h3 { margin: 0; color: var(--ui-ink); font-size: 14px; font-weight: 600; }

.permission-matrix { width: 100%; table-layout: fixed; border-collapse: collapse; }
.permission-matrix th { height: 44px; padding: 0 12px; color: var(--ui-ink-secondary); background: transparent; border-bottom: 1px solid var(--ui-line); font-size: 12px; font-weight: 500; text-align: left; }
.permission-matrix td { height: 52px; padding: 0 12px; border-bottom: 1px solid var(--ui-line); vertical-align: middle; }
.permission-matrix tbody tr:hover td { background: var(--ui-canvas); }
.permission-matrix .col-module { width: 88px; }
.permission-matrix .col-scope { width: 168px; }
.permission-matrix .matrix-module { color: var(--ui-ink); font-size: 13px; font-weight: 500; }
.permission-matrix .matrix-scope-label { color: var(--ui-ink-secondary); font-size: 13px; }
.permission-matrix :deep(.el-checkbox) { height: 36px; margin-right: 0; }
.permission-matrix :deep(.el-checkbox__inner) { width: 16px; height: 16px; background: var(--ui-surface); border: 1px solid var(--ui-control-line); border-radius: 4px; }
.permission-matrix :deep(.el-checkbox:hover .el-checkbox__inner) { border-color: var(--ui-ink-muted); }
.permission-matrix :deep(.el-checkbox__input.is-checked .el-checkbox__inner) { background: var(--ui-ink); border-color: var(--ui-ink); }
.permission-matrix :deep(.el-checkbox__input.is-disabled .el-checkbox__inner) { background: var(--ui-surface-muted); border-color: var(--ui-line); }
.permission-matrix :deep(.el-checkbox__label) { color: var(--ui-ink); font-size: 13px; }
.permission-matrix :deep(.el-select) { width: 100%; }

.conflict-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 8px 12px; color: var(--ui-danger); background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-control); font-size: 12px; }

.role-no-access { display: grid; min-height: 0; place-items: center; }
</style>
