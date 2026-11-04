<script setup lang="ts">
import type { BooleanPermission, DataScope, RoleRecord } from '#/features/team/role-catalog';
import { computed, ref, toRaw, watch } from 'vue';
import { ElButton, ElCheckbox, ElDivider, ElDrawer, ElForm, ElFormItem, ElInput, ElMessage, ElMessageBox, ElOption, ElSelect, ElTable, ElTableColumn, ElTag } from 'element-plus';
import { QiCharPlus } from 'qingicon-vue';
import { usePrototypeAccess } from '#/features/team/access-store';
import { changePermission, emptyPermissions, permissionLabels, scopeRank } from '#/features/team/role-catalog';
import { useRoleStore } from '#/features/team/role-store';

const access = usePrototypeAccess();
const roles = useRoleStore();
const keyword = ref('');
const kind = ref('');
const drawer = ref(false);
const readonly = ref(false);
const draft = ref<RoleRecord>();
const baseline = ref('');
const rows = computed(() => roles.visible.filter((role) => role.name.toLowerCase().includes(keyword.value.trim().toLowerCase()) && (!kind.value || role.kind === kind.value)));
const scopeOptions: { label: string; value: DataScope }[] = [{ label: '不授予', value: 'none' }, { label: '本人数据', value: 'self' }, { label: '所属团队数据', value: 'team' }, { label: '全部数据', value: 'all' }];
const groups: { title: string; keys: BooleanPermission[] }[] = [
  { title: '聊天操作', keys: ['pending', 'takeover', 'transfer', 'end'] },
  { title: '客户操作', keys: ['recall'] },
  { title: '团队', keys: ['teams', 'humans', 'ai'] },
  { title: '渠道与设置', keys: ['channels', 'settings'] },
];
function open(role?: RoleRecord, view = false) {
  draft.value = role ? structuredClone(toRaw(role)) : { id: `role-${crypto.randomUUID()}`, name: '', kind: 'member', description: '', system: false, createdAt: '', version: 0, permissions: emptyPermissions() };
  readonly.value = view || Boolean(role?.system);
  baseline.value = JSON.stringify(draft.value);
  drawer.value = true;
}
function save() {
  if (!draft.value) return;
  const error = roles.save(draft.value);
  if (error) return ElMessage.error(error);
  drawer.value = false;
  ElMessage.success('角色已保存，关联成员权限已更新');
}
async function remove(role: RoleRecord) {
  if (roles.count(role.id)) return ElMessage.warning('该角色仍有关联成员，请先调整成员角色。');
  try { await ElMessageBox.confirm(`确认删除「${role.name}」？`, '删除角色', { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }); } catch { return; }
  const error = roles.remove(role.id);
  if (error) ElMessage.error(error); else ElMessage.success('角色已删除');
}
async function close(done?: () => void) {
  if (!readonly.value && JSON.stringify(draft.value) !== baseline.value) {
    try { await ElMessageBox.confirm('有尚未保存的角色配置，是否放弃？', '离开编辑', { confirmButtonText: '放弃', cancelButtonText: '继续编辑' }); } catch { return; }
  }
  drawer.value = false;
  done?.();
}
watch(() => access.canManageRoles, (allowed) => { if (!allowed) drawer.value = false; });
</script>

<template>
  <section v-if="access.canManageRoles" class="role-configuration">
    <header class="team-page-header"><h1>角色配置</h1><ElButton type="primary" @click="open()"><QiCharPlus :size="16" />创建角色</ElButton></header>
    <div class="team-content">
      <div class="toolbar"><ElInput v-model="keyword" class="team-search" placeholder="搜索角色名称" clearable /><ElSelect v-model="kind" placeholder="角色类型" clearable><ElOption v-if="access.isOwner" value="admin" label="管理员" /><ElOption value="member" label="普通成员" /></ElSelect><ElButton text @click="keyword = ''; kind = ''">清除筛选</ElButton></div>
      <ElTable :data="rows" empty-text="未找到符合条件的角色">
        <ElTableColumn label="角色名称" min-width="170"><template #default="{ row }">{{ row.name }} <ElTag v-if="row.system" size="small" type="info">系统默认</ElTag></template></ElTableColumn>
        <ElTableColumn label="类型" width="120"><template #default="{ row }">{{ row.kind === 'admin' ? '管理员' : '普通成员' }}</template></ElTableColumn>
        <ElTableColumn label="角色描述" min-width="240"><template #default="{ row }">{{ row.description || '—' }}</template></ElTableColumn>
        <ElTableColumn label="关联成员数" width="120"><template #default="{ row }">{{ roles.count(row.id) }}</template></ElTableColumn>
        <ElTableColumn label="创建时间" min-width="170"><template #default="{ row }">{{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }) : '—' }}</template></ElTableColumn>
        <ElTableColumn label="操作" width="190"><template #default="{ row }"><ElButton link type="primary" @click="open(row, true)">查看</ElButton><template v-if="!row.system"><ElButton link type="primary" @click="open(row)">编辑</ElButton><ElButton link type="danger" @click="remove(row)">删除</ElButton></template></template></ElTableColumn>
      </ElTable>
    </div>
    <ElDrawer v-model="drawer" :title="readonly ? '角色详情' : draft?.version ? '编辑角色' : '创建角色'" size="600px" :before-close="close" append-to-body>
      <ElForm v-if="draft" label-position="top" :disabled="readonly" class="role-form">
        <ElFormItem label="角色名称" required><ElInput v-model="draft.name" /></ElFormItem>
        <ElFormItem label="角色类型" required><ElSelect v-model="draft.kind" :disabled="Boolean(draft.version)"><ElOption v-if="access.isOwner" value="admin" label="管理员" /><ElOption value="member" label="普通成员" /></ElSelect></ElFormItem>
        <ElFormItem label="角色描述"><ElInput v-model="draft.description" type="textarea" :rows="2" /></ElFormItem>
        <p v-if="draft.version">{{ draft.system ? '系统默认' : '自定义角色' }} · {{ roles.count(draft.id) }} 名关联成员</p>
        <ElDivider content-position="left">数据权限</ElDivider>
        <ElFormItem v-for="field in (['assigned', 'customers'] as const)" :key="field" :label="field === 'assigned' ? '已分配会话列表' : '客户列表'">
          <ElSelect :model-value="draft.permissions[field]" @change="(value: DataScope) => draft && changePermission(draft.permissions, field, value)"><ElOption v-for="option in scopeOptions" :key="option.value" :value="option.value" :label="option.label" :disabled="scopeRank(option.value) > scopeRank(access.permissions[field])" /></ElSelect>
        </ElFormItem>
        <template v-for="group in groups" :key="group.title"><ElDivider content-position="left">{{ group.title }}</ElDivider><div class="permission-grid"><ElCheckbox v-for="key in group.keys" :key="key" :model-value="draft.permissions[key]" :disabled="!access.permissions[key] || ((key === 'takeover' || key === 'recall') && access.permissions.assigned === 'none') || (key === 'recall' && access.permissions.customers === 'none')" @change="(value) => draft && changePermission(draft.permissions, key, Boolean(value))">{{ permissionLabels[key] }}</ElCheckbox></div>
          <ElFormItem v-if="group.title === '团队' && (draft.permissions.teams || draft.permissions.humans || draft.permissions.ai)" label="团队与成员数据范围"><ElSelect v-model="draft.permissions.teamScope"><ElOption label="所属团队数据" value="team" /><ElOption label="全部数据" value="all" :disabled="access.permissions.teamScope !== 'all'" /></ElSelect></ElFormItem>
        </template>
      </ElForm>
      <template #footer><ElButton @click="close()">{{ readonly ? '关闭' : '取消' }}</ElButton><ElButton v-if="!readonly" type="primary" @click="save">保存</ElButton></template>
    </ElDrawer>
  </section>
</template>

<style scoped>
.role-configuration { min-width: 0; width: 100%; }
.permission-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
.role-form :deep(.el-select) { width: 100%; }
</style>
