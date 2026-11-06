<script setup lang="ts">
import type { BooleanPermission, DataScope, RoleKind, RoleRecord } from '#/features/team/role-catalog';
import { computed, ref, reactive, toRaw, watch } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import { ElButton, ElCheckbox, ElForm, ElFormItem, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTooltip } from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import { usePrototypeAccess } from '#/features/team/access-store';
import { changePermission, emptyPermissions, legalizePermissions, permissionLabels, roleRecords, scopeRank } from '#/features/team/role-catalog';
import { useRoleStore } from '#/features/team/role-store';

interface RoleDraft extends Omit<RoleRecord, 'kind'> {
  kind: RoleKind | '';
}
type PermKey = BooleanPermission | 'assigned' | 'customers';
interface PermItem {
  key: PermKey;
  label: string;
  hint: string;
  scope?: 'assigned' | 'customers' | 'teamScope';
}
interface PermGroup {
  module: string;
  items: PermItem[];
}

const props = defineProps<{ roleId?: string; readonly?: boolean }>();
const router = useRouter();
const access = usePrototypeAccess();
const roles = useRoleStore();

const draft = ref<RoleDraft>();
const baseline = ref('');
const conflict = ref(false);
const saving = ref(false);
const errors = reactive({ name: '', kind: '', pages: '', permission: '' });

const scopeLabels: Record<DataScope, string> = { none: '不授予', self: '本人数据', team: '所属团队数据', all: '全部数据' };
const rangeOptions: DataScope[] = ['self', 'team', 'all'];
const teamScopeOptions: DataScope[] = ['team', 'all'];

// 权限项与数据范围严格对应 PRD §6.7，未在 PRD 中定义的权限一律不出现
const matrix: PermGroup[] = [
  {
    module: '聊天',
    items: [
      { key: 'assigned', label: '已分配会话列表', scope: 'assigned', hint: '控制曾被分配给人类或 AI 的会话访问权，包含已结束的历史会话。' },
      { key: 'pending', label: '待分配', hint: '可查看当前租户所有团队的待分配会话，不受已分配会话范围影响。' },
      { key: 'takeover', label: '接管会话', hint: '将有权查看的未结束会话接管为本人接待，跨团队接管不改变会话所属团队。' },
      { key: 'transfer', label: '转接会话', hint: '可转接给会话所属团队内其他可接待的人类成员，不支持普通跨团队转接。' },
      { key: 'end', label: '结束会话', hint: '可手动结束有权查看的未结束会话。' },
    ],
  },
  {
    module: '客户',
    items: [
      { key: 'customers', label: '客户列表', scope: 'customers', hint: '控制可进入客户模块及可查询的客户数据范围。' },
      { key: 'recall', label: '回聊', hint: '要求客户关联的全部会话已结束；发起后立即创建新的正式人工会话。' },
    ],
  },
  {
    module: '团队',
    items: [
      { key: 'teams', label: '团队管理', scope: 'teamScope', hint: '可查看与管理授权范围内的团队，与人类成员、AI 成员共用团队数据范围。' },
      { key: 'humans', label: '人类成员', scope: 'teamScope', hint: '可查看与管理授权范围内的人类成员，与团队管理、AI 成员共用团队数据范围。' },
      { key: 'ai', label: 'AI 成员', scope: 'teamScope', hint: '可查看与管理授权范围内的 AI 成员，与团队管理、人类成员共用团队数据范围。' },
    ],
  },
  {
    module: '渠道管理',
    items: [{ key: 'channels', label: '渠道管理', hint: '可访问当前租户全部渠道并执行全部渠道操作，无数据范围。' }],
  },
  {
    module: '设置',
    items: [{ key: 'settings', label: '聊天与接待', hint: '可访问会话设置、消息通知、聊天工具全部功能，无数据范围。' }],
  },
];

const readonly = computed(() => Boolean(props.readonly || draft.value?.system));
const pageTitle = computed(() => (readonly.value ? '角色详情' : draft.value?.version ? '编辑角色' : '角色创建'));
const dirty = computed(() => Boolean(draft.value) && JSON.stringify(draft.value) !== baseline.value);
const isMemberKind = computed(() => draft.value?.kind === 'member');

// 角色类型即权限上限：普通成员不可持有团队三项、渠道管理、聊天与接待
const ADMIN_ONLY_KEYS: PermKey[] = ['teams', 'humans', 'ai', 'channels', 'settings'];
function blockedByKind(item: PermItem) {
  return isMemberKind.value && ADMIN_ONLY_KEYS.includes(item.key);
}

function resetErrors() {
  Object.assign(errors, { name: '', kind: '', pages: '', permission: '' });
}

function load() {
  conflict.value = false;
  resetErrors();
  if (props.roleId) {
    const role = roleRecords.value.find((item) => item.id === props.roleId);
    if (!role) {
      ElMessage.warning('角色不存在或已被删除');
      void router.replace({ name: 'TeamRoles' });
      return;
    }
    draft.value = structuredClone(toRaw(role)) as RoleDraft;
    draft.value.permissions = legalizePermissions(draft.value.permissions, role.kind);
  } else {
    draft.value = {
      id: `role-${crypto.randomUUID()}`,
      name: '',
      kind: access.isOwner ? '' : 'member',
      description: '',
      system: false,
      createdAt: '',
      version: 0,
      permissions: emptyPermissions(),
    };
  }
  baseline.value = JSON.stringify(draft.value);
  document.querySelector('.role-editor-body')?.scrollTo({ top: 0 });
}

watch(() => props.roleId, load, { immediate: true });

// 切换为普通成员时，同步清掉管理员专属权限，避免保存出非法组合
watch(() => draft.value?.kind, (kind) => {
  const p = draft.value?.permissions;
  if (!p || kind !== 'member' || readonly.value) return;
  Object.assign(p, legalizePermissions(p, 'member'));
});

watch(roleRecords, (list) => {
  const d = draft.value;
  if (!d?.version) return;
  if (!list.some((role) => role.id === d.id)) {
    ElMessage.warning('角色不存在或已被删除');
    void router.replace({ name: 'TeamRoles' });
  }
});

function checked(item: PermItem) {
  const p = draft.value?.permissions;
  if (!p) return false;
  if (item.key === 'assigned' || item.key === 'customers') return p[item.key] !== 'none';
  return p[item.key];
}

function itemDisabled(item: PermItem) {
  if (readonly.value || blockedByKind(item)) return true;
  const c = access.permissions;
  if (item.key === 'assigned' || item.key === 'customers') return c[item.key] === 'none';
  if (item.key === 'takeover') return !c.takeover || c.assigned === 'none';
  if (item.key === 'recall') return !c.recall || c.assigned === 'none' || c.customers === 'none';
  return !c[item.key];
}

function moduleChecked(group: PermGroup) {
  return group.items.every((item) => checked(item));
}

function moduleIndeterminate(group: PermGroup) {
  const on = group.items.filter((item) => checked(item)).length;
  return on > 0 && on < group.items.length;
}

function moduleDisabled(group: PermGroup) {
  return readonly.value || group.items.every((item) => itemDisabled(item));
}

function toggleItem(item: PermItem, value: boolean | number | string) {
  const p = draft.value?.permissions;
  if (!p || readonly.value || blockedByKind(item)) return;
  const on = Boolean(value);
  if (item.key === 'assigned' || item.key === 'customers') changePermission(p, item.key, on ? (p[item.key] === 'none' ? 'self' : p[item.key]) : 'none');
  else changePermission(p, item.key, on);
  resetPermissionErrors();
}

function toggleModule(group: PermGroup, value: boolean | number | string) {
  const p = draft.value?.permissions;
  if (!p || readonly.value) return;
  const on = Boolean(value);
  for (const item of group.items) {
    const current = checked(item);
    if (on && current) continue;
    if (!on && !current) continue;
    if (on && itemDisabled(item)) continue;
    if (item.key === 'assigned' || item.key === 'customers') changePermission(p, item.key, on ? (p[item.key] === 'none' ? 'self' : p[item.key]) : 'none');
    else changePermission(p, item.key, on);
  }
  resetPermissionErrors();
}

function showScope(item: PermItem) {
  if (!item.scope) return false;
  if (item.scope === 'teamScope') return checked(item);
  return draft.value?.permissions[item.scope] !== 'none';
}

function scopeOf(item: PermItem): DataScope {
  const p = draft.value?.permissions;
  if (!p || !item.scope) return 'none';
  if (item.scope === 'teamScope') return p.teamScope;
  return p[item.scope];
}

function scopeChoices(item: PermItem) {
  return item.scope === 'teamScope' ? teamScopeOptions : rangeOptions;
}

function scopeDisabled() {
  return readonly.value;
}

function scopeOptionDisabled(item: PermItem, scope: DataScope) {
  if (item.scope === 'teamScope') return scope === 'all' && access.permissions.teamScope !== 'all';
  if (!item.scope) return true;
  return scopeRank(scope) > scopeRank(access.permissions[item.scope]);
}

function changeItemScope(item: PermItem, value: string) {
  const p = draft.value?.permissions;
  if (!p || !item.scope || readonly.value) return;
  if (item.scope === 'teamScope') p.teamScope = value as 'all' | 'team';
  else changePermission(p, item.scope, value as DataScope);
  resetPermissionErrors();
}

function resetPermissionErrors() {
  errors.pages = '';
  errors.permission = '';
}

function validate() {
  resetErrors();
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

  if (d.kind === 'member' && (p.teams || p.humans || p.ai || p.channels || p.settings)) errors.permission = '普通成员类型不可授予团队、渠道管理、聊天与接待权限';

  if (!errors.permission) {
    const c = access.permissions;
    if (scopeRank(p.assigned) > scopeRank(c.assigned) || scopeRank(p.customers) > scopeRank(c.customers)) errors.permission = '无权授予超出自身范围的权限';
    else if ((p.teams || p.humans || p.ai) && scopeRank(p.teamScope) > scopeRank(c.teamScope)) errors.permission = '无权授予超出自身范围的权限';
    else if ((Object.keys(permissionLabels) as BooleanPermission[]).some((key) => p[key] && !c[key])) errors.permission = '无权授予超出自身范围的权限';
  }

  if (d.version) {
    const latest = roleRecords.value.find((role) => role.id === d.id);
    if (!latest) {
      ElMessage.warning('角色不存在或已被删除');
      void router.replace({ name: 'TeamRoles' });
      return false;
    }
    if (latest.version !== d.version) {
      conflict.value = true;
      return false;
    }
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
  saving.value = true;
  try {
    const existing = Boolean(d.version);
    const affected = roles.count(d.id);
    const error = roles.save({ ...d, kind: d.kind as RoleKind });
    if (error) {
      storeError(error);
      return;
    }
    const latest = roleRecords.value.find((role) => role.id === d.id);
    if (latest) {
      draft.value = structuredClone(toRaw(latest)) as RoleDraft;
      baseline.value = JSON.stringify(draft.value);
    }
    ElMessage.success(existing ? (affected ? `角色已保存，${affected} 名关联成员的权限已即时生效` : '角色已保存') : '角色已创建，可在成员编辑时选择');
    void router.push({ name: 'TeamRoles' });
  } finally {
    saving.value = false;
  }
}

function reloadLatest() {
  const d = draft.value;
  if (!d) return;
  const latest = roleRecords.value.find((role) => role.id === d.id);
  if (!latest) {
    ElMessage.warning('角色不存在或已被删除');
    void router.replace({ name: 'TeamRoles' });
    return;
  }
  draft.value = structuredClone(toRaw(latest)) as RoleDraft;
  baseline.value = JSON.stringify(draft.value);
  conflict.value = false;
  resetErrors();
  ElMessage.success('已加载最新角色信息');
}

function leave() {
  void router.push({ name: 'TeamRoles' });
}

onBeforeRouteLeave(async () => {
  if (readonly.value || !dirty.value || saving.value) return true;
  try {
    await ElMessageBox.confirm('有尚未保存的角色配置，是否放弃？', '离开编辑', { confirmButtonText: '放弃', cancelButtonText: '继续编辑' });
    return true;
  } catch {
    return false;
  }
});
</script>

<template>
  <section class="role-editor">
    <header class="team-page-header role-editor-header">
      <div class="role-editor-heading">
        <button class="icon-button back-button" type="button" aria-label="返回角色配置" @click="leave"><QIcon name="arrow-left" :size="20" /></button>
        <h1>{{ pageTitle }}</h1>
      </div>
    </header>

    <div class="team-content role-editor-body">
      <section class="basic-card">
        <h2 class="section-label">基础信息</h2>
        <ElForm v-if="draft" class="role-form ui-form" label-position="top" @submit.prevent>
          <ElFormItem label="角色名称" required :error="errors.name">
            <ElInput v-model="draft.name" maxlength="32" show-word-limit placeholder="请输入角色名称" :disabled="readonly" />
          </ElFormItem>
          <ElFormItem label="角色类型" required :error="errors.kind">
            <ElSelect v-model="draft.kind" placeholder="请选择角色类型" :disabled="readonly || Boolean(draft.version)">
              <ElOption v-if="access.isOwner" value="admin" label="管理员" />
              <ElOption value="member" label="普通成员" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="角色描述">
            <ElInput v-model="draft.description" type="textarea" :rows="2" maxlength="80" show-word-limit placeholder="可选，用于说明角色用途" :disabled="readonly" />
          </ElFormItem>
        </ElForm>
      </section>

      <section class="perm-section">
        <h2 class="section-label">权限范围</h2>
        <div v-for="group in matrix" :key="group.module" class="perm-group">
          <div class="module-bar">
            <ElCheckbox :model-value="moduleChecked(group)" :indeterminate="moduleIndeterminate(group)" :disabled="moduleDisabled(group)" @change="(value) => toggleModule(group, value)">
              <span class="module-name">{{ group.module }}</span>
            </ElCheckbox>
          </div>
          <div class="perm-grid">
            <div v-for="item in group.items" :key="item.key" class="perm-card">
              <div class="perm-row">
                <ElCheckbox :model-value="checked(item)" :disabled="itemDisabled(item)" @change="(value) => toggleItem(item, value)">
                  <span class="perm-name">{{ item.label }}</span>
                </ElCheckbox>
                <ElTooltip :content="item.hint" placement="top" :show-after="120">
                  <svg class="info-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <circle cx="8" cy="8" r="6.6" />
                    <path d="M8 7.4v3.2" />
                    <circle class="info-dot" cx="8" cy="5" r="1" />
                  </svg>
                </ElTooltip>
              </div>
              <ElSelect
                v-if="showScope(item)"
                class="perm-scope"
                size="small"
                :model-value="scopeOf(item)"
                :disabled="scopeDisabled()"
                @change="(value: string) => changeItemScope(item, value)"
              >
                <ElOption v-for="scope in scopeChoices(item)" :key="scope" :value="scope" :label="scopeLabels[scope]" :disabled="scopeOptionDisabled(item, scope)" />
              </ElSelect>
            </div>
          </div>
        </div>

        <p v-if="errors.pages" class="ui-form-error">{{ errors.pages }}</p>
        <p v-if="errors.permission" class="ui-form-error">{{ errors.permission }}</p>
        <p v-if="!readonly && isMemberKind" class="ui-form-help">普通成员类型仅可配置聊天与客户权限；团队管理、人类成员、AI 成员、渠道管理、聊天与接待由管理员类型角色持有，无法勾选。</p>
        <p v-if="!readonly && !access.isOwner" class="ui-form-help">灰显权限表示超出您当前可转授的范围，无法勾选。</p>

        <div v-if="conflict" class="conflict-notice" role="alert">
          <span>角色信息已更新，请刷新后重试</span>
          <ElButton class="ui-btn-outline" @click="reloadLatest">刷新角色信息</ElButton>
        </div>
      </section>
    </div>

    <footer v-if="!readonly && dirty" class="role-action-bar">
      <ElButton class="ui-btn-outline" @click="leave">取消</ElButton>
      <ElButton type="primary" class="ui-btn-primary" :loading="saving" @click="save">保存</ElButton>
    </footer>
  </section>
</template>

<style scoped>
.role-editor { display: flex; width: 100%; min-width: 0; height: 100%; min-height: 0; flex-direction: column; }
.role-editor-header { justify-content: space-between; }
.role-editor-heading { display: flex; min-width: 0; align-items: center; gap: 10px; }
.role-editor-heading h1 { overflow: hidden; margin: 0; color: var(--ui-ink); font-size: 17px; line-height: 24px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.icon-button { display: grid; width: 32px; height: 32px; padding: 0; place-items: center; color: var(--ui-ink); background: none; border: 0; border-radius: var(--ui-radius-control); cursor: pointer; }
.icon-button:hover { background: var(--ui-surface-control); }
.icon-button svg { width: 20px; height: 20px; }

.role-editor-body { overflow-x: hidden; overflow-y: auto; }
.role-action-bar { display: flex; flex: 0 0 auto; justify-content: flex-end; gap: 8px; padding: 12px 24px; background: var(--ui-surface); border-top: 1px solid var(--ui-line); }

.basic-card { padding: 16px 20px 4px; border: 1px solid var(--ui-line); border-radius: var(--ui-radius-card, 8px); }
.section-label { margin: 0 0 14px; color: var(--ui-ink); font-size: 14px; font-weight: 600; }
.role-form :deep(.el-form-item) { max-width: 440px; margin-bottom: 18px; }
.role-form :deep(.el-form-item:last-child) { margin-bottom: 16px; }

.perm-section { padding-top: 24px; }
.perm-group + .perm-group { margin-top: 16px; }
.module-bar { display: flex; min-height: 44px; align-items: center; padding: 0 14px; background: var(--ui-canvas); border-radius: 6px; }
.module-bar :deep(.el-checkbox) { height: 24px; margin-right: 0; }
.module-name { color: var(--ui-ink); font-size: 13px; font-weight: 600; }

.perm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-top: 12px; }
.perm-card { display: flex; min-width: 0; flex-direction: column; gap: 8px; padding: 10px 12px; background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: 8px; }
.perm-row { display: flex; min-width: 0; align-items: center; gap: 4px; }
.perm-row :deep(.el-checkbox) { height: 24px; min-width: 0; margin-right: 0; }
.perm-name { color: var(--ui-ink); font-size: 13px; line-height: 20px; white-space: nowrap; }
.perm-scope { width: 100%; }
.info-icon { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: var(--ui-ink-muted); stroke-linecap: round; stroke-width: 1.2; cursor: help; }
.info-icon .info-dot { fill: var(--ui-ink-muted); stroke: none; }

.module-bar :deep(.el-checkbox__inner), .perm-card :deep(.el-checkbox__inner) { width: 16px; height: 16px; background: var(--ui-surface); border: 1px solid var(--ui-control-line); border-radius: 4px; }
.module-bar :deep(.el-checkbox:hover .el-checkbox__inner), .perm-card :deep(.el-checkbox:hover .el-checkbox__inner) { border-color: var(--ui-ink-muted); }
.module-bar :deep(.el-checkbox__input.is-checked .el-checkbox__inner), .perm-card :deep(.el-checkbox__input.is-checked .el-checkbox__inner) { background: var(--ui-ink); border-color: var(--ui-ink); }
.module-bar :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner), .perm-card :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) { background: var(--ui-ink); border-color: var(--ui-ink); }
.module-bar :deep(.el-checkbox__input.is-disabled .el-checkbox__inner), .perm-card :deep(.el-checkbox__input.is-disabled .el-checkbox__inner) { background: var(--ui-surface-muted); border-color: var(--ui-line); }

.conflict-notice { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; padding: 8px 12px; color: var(--ui-danger); background: var(--ui-surface); border: 1px solid var(--ui-line); border-radius: var(--ui-radius-control); font-size: 12px; }
</style>
