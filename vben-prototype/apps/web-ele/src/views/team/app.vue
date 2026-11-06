<script lang="ts" setup>
import type { UploadFile } from 'element-plus';

import type { MemberDraft, TeamMember, TeamRecord } from '#/features/team/team-store';

import { computed, onBeforeUnmount, reactive, ref, toRaw, watch } from 'vue';
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router';

import {
  ElButton,
  ElDialog,
  ElDrawer,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElForm,
  ElFormItem,
  ElInput,
  ElMessage,
  ElMessageBox,
  ElOption,
  ElPagination,
  ElPopover,
  ElSelect,
  ElSwitch,
  ElTable,
  ElTableColumn,
  ElTooltip,
  ElUpload,
} from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import { useChannelStore } from '#/features/channels/channel-store';
import { avatarColor, avatarText, DEFAULT_TEAM_ID } from '#/features/team/team-constants';
import { useTeamStore } from '#/features/team/team-store';
import { resolveProfileIdentity } from '../personal/profile-identity';

import MemberSelectionPanel from './MemberSelectionPanel.vue';
import TeamMultiSelect from './TeamMultiSelect.vue';
import RoleConfiguration from './RoleConfiguration.vue';
import { usePrototypeAccess } from '#/features/team/access-store';
import { findRole, normalizeRoleId, permissionsError, roleName, roleRecords } from '#/features/team/role-catalog';
import { useRoleStore } from '#/features/team/role-store';

type ViewKey = 'ai' | 'all' | 'human' | 'roles' | 'teams';

const route = useRoute();
const router = useRouter();
const store = useTeamStore();
const access = usePrototypeAccess();
const roles = useRoleStore();
const filterRoles = computed(() => roleRecords.value.filter((role) => access.isOwner || role.kind === 'member'));
const manageableTeams = computed(() => access.visibleTeams);
const canEditDetail = computed(() => access.isAdmin && access.permissions.teams && Boolean(detailTeam.value));
const cloneValue = <T,>(value: T): T => structuredClone(toRaw(value));
const channels = useChannelStore();

const keyword = ref('');
const page = ref(1);
const pageSize = ref(10);
const memberDrawer = ref(false);
const teamDrawer = ref(false);
const methodDialog = ref(false);
const authorizationDialog = ref(false);
const authorizationFrameKey = ref(0);
const authorizationFrameLoaded = ref(false);
const authorizationFrameFailed = ref(false);
const resetDialog = ref(false);
const memberPickerDialog = ref(false);
const editing = ref<MemberDraft>();
const editingOriginal = ref<TeamMember>();
const editingTeam = ref<TeamRecord>();
const teamMemberIds = ref<string[]>([]);
const detailName = ref('');
const detailMemberIds = ref<string[]>([]);
const detailBaseline = ref('');
const pickerMemberIds = ref<string[]>([]);
const resetTarget = ref<TeamMember>();
const resetForm = reactive({ confirmPassword: '', password: '' });
const authorizationPurpose = ref<'create' | 'reauthorize'>('create');
const memberNameTouched = ref(false);
const memberAvatarTouched = ref(false);
const memberNavExpanded = ref(localStorage.getItem('im-support-vben:team-member-nav-expanded') !== 'false');
const ADAM_BOT_LOGIN_URL = 'https://lukewen111.github.io/Lingxi-Agent_demo/#/login';
let authorizationLoadTimer: number | undefined;

const humanFilters = reactive({ enabled: '', online: '', role: '', teamId: '' });
const aiFilters = reactive({ online: '', teamId: '' });
const allFilters = reactive({ kind: '', online: '', role: '', teamId: '' });

const currentView = computed<ViewKey>(() => {
  if (route.path.includes('/roles')) return 'roles';
  if (route.path.includes('/members/ai')) return 'ai';
  if (route.path.includes('/members/human')) return 'human';
  if (route.path.includes('/teams')) return 'teams';
  return 'all';
});
const pageTitle = computed(() => ({ ai: 'AI 成员', all: '全部人员', human: '人类成员', roles: '角色配置', teams: '团队' })[currentView.value]);
const detailTeam = computed(() => currentView.value === 'teams' && typeof route.query.detail === 'string' ? access.visibleTeams.find((team) => team.id === route.query.detail) : undefined);
const detailMembers = computed(() => store.members.filter((member) => detailMemberIds.value.includes(member.id)));
const detailDirty = computed(() => detailTeam.value ? JSON.stringify({ memberIds: detailMemberIds.value.toSorted(), name: detailName.value.trim() }) !== detailBaseline.value : false);
const memberIdentity = (member: Pick<TeamMember, 'avatar' | 'id' | 'name'>) => resolveProfileIdentity({ avatar: member.avatar, id: member.id, name: member.name });
const memberAvatarText = (member: Pick<TeamMember, 'avatar' | 'id' | 'name'>) => memberIdentity(member).initial || '—';
const memberAvatarStyle = (member: Pick<TeamMember, 'avatar' | 'id' | 'name'>) => ({ backgroundColor: memberIdentity(member).avatarColor, color: '#fff' });
const teamAvatarText = (team: Pick<TeamRecord, 'name'>) => avatarText(team.name);
const teamAvatarStyle = (team: Pick<TeamRecord, 'id'> & { color?: string }) => ({ backgroundColor: team.color || avatarColor(team.id), color: '#fff' });
const teamNames = (ids: string[]) => ids.map((id) => store.teamById(id)?.name).filter(Boolean).join('、');

const filteredRows = computed<Array<TeamMember | TeamRecord>>(() => {
  const query = keyword.value.trim().toLowerCase();
  if (currentView.value === 'teams') {
    return access.visibleTeams.filter((team) => !query || `${team.name}${team.id}`.toLowerCase().includes(query));
  }
  let source = store.members;
  if (currentView.value === 'human') source = store.humans;
  if (currentView.value === 'ai') source = store.aiMembers;
  return source.filter((member) => {
    if (!access.visibleMembers.some((item) => item.id === member.id)) return false;
    const matchesQuery = !query || `${member.name}${member.account || ''}${member.id}`.toLowerCase().includes(query);
    let filters = !allFilters.teamId || member.teamIds.includes(allFilters.teamId);
    filters &&= !allFilters.kind || member.kind === allFilters.kind;
    filters &&= !allFilters.role || normalizeRoleId(member.role) === allFilters.role;
    filters &&= !allFilters.online || String(member.online) === allFilters.online;
    if (currentView.value === 'human') {
      filters = (!humanFilters.teamId || member.teamIds.includes(humanFilters.teamId))
        && (!humanFilters.role || normalizeRoleId(member.role) === humanFilters.role)
        && (!humanFilters.online || String(member.online) === humanFilters.online)
        && (!humanFilters.enabled || String(Boolean(member.enabled)) === humanFilters.enabled);
    }
    if (currentView.value === 'ai') {
      filters = (!aiFilters.teamId || member.teamIds.includes(aiFilters.teamId))
        && (!aiFilters.online || String(member.online) === aiFilters.online);
    }
    return matchesQuery && filters;
  });
});

const pagedRows = computed(() => filteredRows.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));
watch(() => route.fullPath, () => {
  keyword.value = '';
  page.value = 1;
});
watch([keyword, () => humanFilters.teamId, () => humanFilters.role, () => humanFilters.online, () => humanFilters.enabled, () => aiFilters.teamId, () => aiFilters.online, () => allFilters.teamId, () => allFilters.kind, () => allFilters.role, () => allFilters.online], () => { page.value = 1; });
watch(detailTeam, (team) => {
  if (!team) return;
  detailName.value = team.name;
  detailMemberIds.value = store.membersOf(team.id).map((member) => member.id);
  detailBaseline.value = JSON.stringify({ memberIds: detailMemberIds.value.toSorted(), name: detailName.value });
}, { immediate: true });

function createHumanDraft(): MemberDraft {
  return { account: '', confirmPassword: '', enabled: true, id: `member-human-${Date.now()}`, kind: 'human', name: '', online: false, password: '', role: '', teamIds: [DEFAULT_TEAM_ID], timezone: 'UTC+08:00', version: 0 };
}

function createAiDraft(): MemberDraft {
  const id = `member-ai-${Date.now()}`;
  return { aiSource: 'adam', id, kind: 'ai', name: '', online: false, role: 'AI 成员', teamIds: [], version: 0 };
}

function openMember(member?: TeamMember, kind: 'ai' | 'human' = 'human') {
  if (!access.canManageMember(member, kind)) return ElMessage.warning('您没有此成员的管理权限。');
  editingOriginal.value = member ? cloneValue(member) : undefined;
  editing.value = member ? cloneValue(member) : (kind === 'ai' ? createAiDraft() : createHumanDraft());
  if (editing.value.kind === 'human') {
    editing.value.role = normalizeRoleId(editing.value.role);
    if (!member) editing.value.teamIds = access.visibleTeams.some((team) => team.id === DEFAULT_TEAM_ID) ? [DEFAULT_TEAM_ID] : [];
  }
  memberNameTouched.value = Boolean(member);
  memberAvatarTouched.value = Boolean(member);
  memberDrawer.value = true;
}

function chooseAgent(agentId: string) {
  if (!editing.value || editing.value.kind !== 'ai') return;
  const agent = store.agentById(agentId);
  if (!agent) return;
  editing.value.agentId = agent.id;
  editing.value.agentName = agent.name;
  if (!memberNameTouched.value) editing.value.name = agent.name;
  if (!memberAvatarTouched.value) editing.value.avatar = agent.avatar;
}

async function saveMember() {
  if (!editing.value) return;
  if (!access.canManageMember(editingOriginal.value, editing.value.kind)) return ElMessage.error('当前权限已变化，无法保存。');
  if (editing.value.teamIds.some((id) => !access.visibleTeams.some((team) => team.id === id))) return ElMessage.error('不能选择无权管理的团队。');
  const roleChanged = editing.value.kind === 'human' && normalizeRoleId(editing.value.role) !== normalizeRoleId(editingOriginal.value?.role || '');
  if (roleChanged && editing.value.role !== 'Owner') {
    if (!roles.assignable.some((role) => role.id === normalizeRoleId(editing.value?.role || ''))) return ElMessage.error('不能分配此角色。');
    const role = findRole(editing.value.role);
    const error = role ? permissionsError(role.permissions, access.permissions) : undefined;
    if (error) return ElMessage.error('无权授予超出自身范围的权限');
  }
  if (!access.isOwner && editing.value.id === access.currentId && (normalizeRoleId(editing.value.role) !== normalizeRoleId(access.current?.role || '') || JSON.stringify(editing.value.teamIds.toSorted()) !== JSON.stringify(access.current?.teamIds.toSorted()))) return ElMessage.error('不能修改自己的角色或团队归属。');
  if (editingOriginal.value?.kind === 'ai' && editingOriginal.value.online && !editing.value.online) {
    try {
      await ElMessageBox.confirm('下线后，该员工不再接待新会话，正在处理的会话将按团队规则重新分配。', '确认下线该 AI 员工？', { cancelButtonText: '取消', confirmButtonText: '确认下线', type: 'warning' });
    } catch { return; }
  }
  const result = store.saveMember(editing.value);
  if (result.error) return ElMessage.error(result.error);
  memberDrawer.value = false;
  ElMessage.success(editingOriginal.value ? '成员信息已保存' : (editing.value.kind === 'ai' ? 'AI 员工添加成功' : '人类成员添加成功'));
}

function closeMemberDrawer() {
  editing.value = undefined;
  editingOriginal.value = undefined;
}

function startAddAi() {
  if (!access.canManageMember(undefined, 'ai')) return ElMessage.warning('您没有创建 AI 成员的权限。');
  methodDialog.value = true;
}

function addMember(kind: 'ai' | 'human') {
  if (kind === 'ai') startAddAi();
  else openMember(undefined, 'human');
}

function toggleMemberNav() {
  memberNavExpanded.value = !memberNavExpanded.value;
  localStorage.setItem('im-support-vben:team-member-nav-expanded', String(memberNavExpanded.value));
}

function navigateTo(path: string) {
  void router.push(path);
}

async function confirmLeaveDetail() {
  if (!detailDirty.value) return true;
  try {
    await ElMessageBox.confirm('当前修改尚未保存，离开后将丢失。', '放弃更改？', { confirmButtonText: '放弃更改', cancelButtonText: '继续编辑', type: 'warning' });
    return true;
  } catch { return false; }
}
onBeforeRouteLeave(confirmLeaveDetail);
onBeforeRouteUpdate((to, from) => to.fullPath === from.fullPath || confirmLeaveDetail());

function chooseAdamBot() {
  methodDialog.value = false;
  if (store.authorized) openMember(undefined, 'ai');
  else openAuthorization(store.authorization.status === 'expired' ? 'reauthorize' : 'create');
}

function chooseWebhook() {
  methodDialog.value = false;
  const draft = createAiDraft();
  draft.aiSource = 'webhook';
  draft.webhookToken = crypto.randomUUID();
  editingOriginal.value = undefined;
  editing.value = draft;
  memberNameTouched.value = false;
  memberDrawer.value = true;
}

function webhookReplyUrl(memberId: string) {
  return `${window.location.origin}/api/mock/ai-members/${memberId}/reply`;
}

async function copyWebhookReplyUrl(memberId: string) {
  try {
    await navigator.clipboard.writeText(webhookReplyUrl(memberId));
    ElMessage.success('消息回复地址已复制');
  } catch {
    ElMessage.error('复制失败，请手动复制');
  }
}

function openAuthorization(purpose: 'create' | 'reauthorize') {
  if (!access.isOwner) return ElMessage.warning('请联系 Owner 完成 Adam Bot 授权。');
  authorizationPurpose.value = purpose;
  authorizationFrameLoaded.value = false;
  authorizationFrameFailed.value = false;
  authorizationFrameKey.value += 1;
  authorizationDialog.value = true;
  startAuthorizationLoadTimer();
}

function startAuthorizationLoadTimer() {
  if (authorizationLoadTimer) window.clearTimeout(authorizationLoadTimer);
  authorizationLoadTimer = window.setTimeout(() => {
    if (!authorizationFrameLoaded.value) authorizationFrameFailed.value = true;
  }, 10_000);
}

function completeAuthorizationFromLogin() {
  if (!access.isOwner) return;
  if (authorizationFrameLoaded.value) return;
  if (authorizationLoadTimer) window.clearTimeout(authorizationLoadTimer);
  const tenantId = authorizationPurpose.value === 'reauthorize' && store.authorization.tenantId
    ? store.authorization.tenantId
    : 'adam-tenant-main';
  const tenantName = authorizationPurpose.value === 'reauthorize' && store.authorization.tenantName
    ? store.authorization.tenantName
    : 'Adam Bot · IM Sports';
  const result = store.completeAuthorization(tenantId, tenantName, '卢森堡');
  if (result.error) {
    authorizationFrameFailed.value = true;
    return ElMessage.error(result.error);
  }
  authorizationFrameLoaded.value = true;
  authorizationFrameFailed.value = false;
  ElMessage.success('Adam Bot 授权成功');
}

function retryAuthorizationLogin() {
  authorizationFrameLoaded.value = false;
  authorizationFrameFailed.value = false;
  authorizationFrameKey.value += 1;
  startAuthorizationLoadTimer();
}

function finishAuthorizationFlow() {
  if (authorizationLoadTimer) window.clearTimeout(authorizationLoadTimer);
  if (authorizationFrameLoaded.value) methodDialog.value = true;
}

onBeforeUnmount(() => {
  if (authorizationLoadTimer) window.clearTimeout(authorizationLoadTimer);
});

async function unbindAdamBot() {
  if (!access.isOwner) return ElMessage.warning('仅 Owner 可以解除绑定。');
  const affected = store.aiMembers.filter((member) => member.aiSource !== 'webhook' && member.agentId).length;
  try {
    await ElMessageBox.confirm(
      `解绑后，${affected} 名由 Adam Bot 创建的 AI 成员将保留资料、团队归属和在线状态，但 AI Agent 会清空。`,
      '确认解除 Adam Bot 绑定？',
      { cancelButtonText: '取消', confirmButtonText: '确认解绑', type: 'warning' },
    );
    store.unbindAuthorization();
    ElMessage.success('Adam Bot 已解绑');
  } catch { /* User cancelled. */ }
}

function openTeam() {
  if (!access.isAdmin || !access.permissions.teams || access.permissions.teamScope !== 'all') return ElMessage.warning('您没有创建团队的权限。');
  const id = store.allocateTeamId();
  editingTeam.value = { color: avatarColor(id), id, name: '', updatedAt: '', version: 0 };
  teamMemberIds.value = [];
  teamDrawer.value = true;
}

function saveTeam() {
  if (!access.isAdmin || !access.permissions.teams || access.permissions.teamScope !== 'all') return ElMessage.error('当前权限已变化，无法创建团队。');
  if (!editingTeam.value) return;
  const result = store.saveTeam(editingTeam.value, teamMemberIds.value);
  if (result.error) return ElMessage.error(result.error);
  teamDrawer.value = false;
  ElMessage.success(editingTeam.value.version ? '团队信息已保存' : '团队创建成功');
}

function openTeamDetail(team: TeamRecord) {
  void router.replace({ path: '/team/teams', query: { detail: team.id } });
}

function closeTeamDetail() {
  void router.replace('/team/teams');
}

function openMemberPicker(team: TeamRecord) {
  if (!access.isAdmin || !access.permissions.teams) return;
  editingTeam.value = cloneValue(team);
  pickerMemberIds.value = [...detailMemberIds.value];
  memberPickerDialog.value = true;
}

function savePickedMembers() {
  detailMemberIds.value = [...pickerMemberIds.value];
  memberPickerDialog.value = false;
}

async function removeFromTeam(member: TeamMember) {
  if (!access.isAdmin || !access.permissions.teams) return;
  const nextMemberIds = detailMemberIds.value.filter((id) => id !== member.id);
  if (!detailTeam.value) return;
  if (detailMemberIds.value.length === 1) return ElMessage.error(`无法完成操作。「${detailTeam.value.name}」团队至少需要保留一名成员。`);
  if (member.teamIds.length === 1) return ElMessage.error('成员至少需要保留一个所属团队。');
  try {
    await ElMessageBox.confirm(`移除后，「${member.name}」将不再属于当前团队。`, `移除「${member.name}」？`, { cancelButtonText: '取消', confirmButtonText: '确认移除', type: 'warning' });
  } catch { return; }
  detailMemberIds.value = nextMemberIds;
}

function resetDetailDraft() {
  if (!detailTeam.value) return;
  detailName.value = detailTeam.value.name;
  detailMemberIds.value = store.membersOf(detailTeam.value.id).map((member) => member.id);
}

function saveTeamDetail() {
  if (!detailTeam.value) return;
  if (!access.isAdmin || !access.permissions.teams || !access.visibleTeams.some((team) => team.id === detailTeam.value?.id)) return ElMessage.error('您没有此团队的管理权限。');
  const result = store.saveTeam({ ...cloneValue(detailTeam.value), name: detailName.value }, detailMemberIds.value);
  if (result.error) return ElMessage.error(result.error);
  detailBaseline.value = JSON.stringify({ memberIds: detailMemberIds.value.toSorted(), name: detailName.value.trim() });
  ElMessage.success('团队信息已保存');
}

async function deleteMember(member: TeamMember) {
  if (!access.canManageMember(member)) return ElMessage.warning('您没有此成员的管理权限。');
  try {
    await ElMessageBox.confirm('删除后该成员将停止接待，历史会话和原接待记录仍会保留。', `确认删除「${member.name}」？`, { cancelButtonText: '取消', confirmButtonText: '确认删除', type: 'warning' });
    const result = store.removeMember(member.id);
    if (result.error) return ElMessage.error(result.error);
    ElMessage.success('成员已删除');
  } catch { /* User cancelled. */ }
}

async function toggleHuman(member: TeamMember, enabled: boolean) {
  if (!access.canManageMember(member)) return ElMessage.warning('您没有此成员的管理权限。');
  const result = store.toggleHumanEnabled(member.id, enabled);
  if (result.error) return ElMessage.error(result.error);
  ElMessage.success(enabled ? '账号已启用，不会自动上线' : '账号已停用并退出登录');
}

async function toggleAi(member: TeamMember) {
  if (!access.canManageMember(member)) return ElMessage.warning('您没有此成员的管理权限。');
  if (member.online) {
    try {
      await ElMessageBox.confirm('下线后，该员工不再接待新会话，正在处理的会话将按团队规则重新分配。', '确认下线该 AI 员工？', { cancelButtonText: '取消', confirmButtonText: '确认下线', type: 'warning' });
    } catch { return; }
  }
  const result = store.setAiOnline(member.id, !member.online);
  if (result.error) return ElMessage.error(result.error);
  ElMessage.success(member.online ? 'AI 员工已上线' : 'AI 员工已下线');
}

function openReset(member: TeamMember) {
  if (!access.isOwner) return ElMessage.warning('仅 Owner 可以重置成员密码。');
  resetTarget.value = member;
  resetForm.password = '';
  resetForm.confirmPassword = '';
  resetDialog.value = true;
}

function resetPassword() {
  if (!access.isOwner) return ElMessage.error('当前权限已变化。');
  if (!resetTarget.value) return;
  const result = store.resetPassword(resetTarget.value.id, resetForm.password, resetForm.confirmPassword);
  if (result.error) return ElMessage.error(result.error);
  resetDialog.value = false;
  ElMessage.success('密码已重置，该成员已在全部设备退出登录');
}

async function deleteTeam(team: TeamRecord) {
  if (!access.isAdmin || !access.permissions.teams || !access.visibleTeams.some((item) => item.id === team.id)) return ElMessage.warning('您没有此团队的管理权限。');
  const check = store.canRemoveTeam(team.id);
  if (check.error) return ElMessage.error(check.error);
  try {
    await ElMessageBox.confirm('删除后，网站小部件和 TG 渠道将改绑通用团队；聊天页面渠道将被删除并停止服务，其未结束会话将自动结束；相关历史记录保留。', `确认删除「${team.name}」团队？`, { cancelButtonText: '取消', confirmButtonText: '确认删除', type: 'warning' });
    const migration = channels.deleteTeamBindings(team.id);
    const result = store.removeTeam(team.id);
    if (result.error) return ElMessage.error(result.error);
    closeTeamDetail();
    ElMessage.success(`团队已删除，迁移 ${migration.migratedChannels} 个渠道，关闭 ${migration.endedChatPages} 个聊天页面`);
  } catch { /* User cancelled. */ }
}

function uploadAvatar(uploadFile: UploadFile) {
  const file = uploadFile.raw;
  if (!file || !editing.value) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) return ElMessage.error('头像仅支持 JPG、PNG、WebP，且不超过 2 MB。');
  const reader = new FileReader();
  const draft = editing.value;
  reader.addEventListener('load', () => {
    if (editing.value === draft) {
      editing.value.avatar = String(reader.result || '');
      memberAvatarTouched.value = true;
    }
  });
  reader.readAsDataURL(file);
}

function clearFilters() {
  Object.assign(humanFilters, { enabled: '', online: '', role: '', teamId: '' });
  Object.assign(aiFilters, { online: '', teamId: '' });
  Object.assign(allFilters, { kind: '', online: '', role: '', teamId: '' });
}

const disabledTeamIdsForMember = computed(() => editing.value?.kind === 'ai'
  ? store.teams.filter((team) => Boolean(store.aiInTeam(team.id, editing.value?.id))).map((team) => team.id)
  : []);
</script>

<template>
  <div class="team-workspace">
    <aside class="team-secondary-nav" aria-label="团队功能导航">
      <h2>团队</h2>
      <button v-if="access.permissions.humans || access.permissions.ai" type="button" class="secondary-nav-group" :aria-expanded="memberNavExpanded" @click="toggleMemberNav">
        <span>成员</span><QIcon v-if="memberNavExpanded" class="secondary-nav-chevron" name="chevron-up" :size="16" aria-hidden="true" /><QIcon v-else class="secondary-nav-chevron" name="chevron-down" :size="16" aria-hidden="true" />
      </button>
      <div v-show="memberNavExpanded" class="secondary-nav-children">
        <button v-if="access.permissions.humans || access.permissions.ai" type="button" :class="{ active: currentView === 'all' }" @click="navigateTo('/team/members/all')"><span>全部人员</span><small>{{ access.visibleMembers.length }}</small></button>
        <button v-if="access.permissions.ai" type="button" :class="{ active: currentView === 'ai' }" @click="navigateTo('/team/members/ai')"><span>AI 成员</span><small>{{ access.visibleMembers.filter((member) => member.kind === 'ai').length }}</small></button>
        <button v-if="access.permissions.humans" type="button" :class="{ active: currentView === 'human' }" @click="navigateTo('/team/members/human')"><span>人类成员</span><small>{{ access.visibleMembers.filter((member) => member.kind === 'human').length }}</small></button>
      </div>
      <button v-if="access.permissions.teams" type="button" class="secondary-nav-item" :class="{ active: currentView === 'teams' }" @click="navigateTo('/team/teams')"><span>团队</span><small>{{ access.visibleTeams.length }}</small></button>
      <button v-if="access.canManageRoles" type="button" class="secondary-nav-item" :class="{ active: currentView === 'roles' }" @click="navigateTo('/team/roles')"><span>角色配置</span></button>
    </aside>
    <main class="team-page">
    <RoleConfiguration v-if="currentView === 'roles'" />
    <template v-else-if="detailTeam">
      <header class="team-page-header detail-header">
        <div class="detail-heading">
          <button class="back-button" aria-label="返回" @click="closeTeamDetail"><QIcon name="arrow-left" :size="20" /></button>
          <h1>团队</h1>
        </div>
      </header>
      <section class="team-detail">
        <div class="team-identity">
          <span class="team-square large" :style="teamAvatarStyle(detailTeam)">{{ teamAvatarText(detailTeam) }}</span>
          <label><span>团队名称</span><ElInput v-model="detailName" maxlength="32" show-word-limit :disabled="detailTeam.system || !canEditDetail" /></label>
        </div>
        <div class="section-heading">
          <h2>{{ detailMembers.length }} 名成员</h2>
          <ElButton v-if="canEditDetail" type="primary" @click="openMemberPicker(detailTeam)"><QIcon name="plus" :size="16" />添加成员</ElButton>
        </div>
        <ElInput v-model="keyword" clearable placeholder="搜索团队成员" class="team-search">
          <template #prefix>
            <svg class="team-search-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="6.8" cy="6.8" r="4.6" />
              <path d="M10.3 10.3 14 14" />
            </svg>
          </template>
        </ElInput>
        <div class="team-table-viewport"><ElTable height="100%" :data="detailMembers.filter((member) => `${member.name}${member.account || member.id}`.toLowerCase().includes(keyword.toLowerCase()))" class="ui-table" empty-text="未找到符合条件的成员">
          <ElTableColumn label="成员" min-width="300">
            <template #default="scope"><span class="member-name"><i :style="memberAvatarStyle(scope.row)"><img v-if="scope.row.avatar" :src="scope.row.avatar" alt="" /><span v-else>{{ memberAvatarText(scope.row) }}</span></i><span><b>{{ scope.row.name }}</b><small>{{ scope.row.account || scope.row.id }}</small></span></span></template>
          </ElTableColumn>
          <ElTableColumn label="类型" min-width="130"><template #default="scope"><span class="ui-tag" :class="scope.row.kind === 'ai' ? 'is-outline is-ai' : 'is-neutral'">{{ scope.row.kind === 'ai' ? 'AI 成员' : '人类成员' }}</span></template></ElTableColumn>
          <ElTableColumn label="在线状态" min-width="130"><template #default="scope"><span class="online" :class="{ off: !scope.row.online }"><i class="status-dot" aria-hidden="true" />{{ scope.row.online ? '在线' : '离线' }}</span></template></ElTableColumn>
          <ElTableColumn v-if="canEditDetail" label="操作" width="100"><template #default="scope"><ElTooltip content="移除成员" placement="top"><ElButton text type="danger" class="member-remove-button" :aria-label="`移除 ${scope.row.name}`" @click="removeFromTeam(scope.row)"><QIcon name="trash" :size="17" /></ElButton></ElTooltip></template></ElTableColumn>
        </ElTable></div>
        <footer v-if="detailDirty" class="detail-action-bar"><ElButton class="ui-btn-outline" @click="resetDetailDraft">取消</ElButton><ElButton type="primary" @click="saveTeamDetail">保存</ElButton></footer>
      </section>
    </template>

    <template v-else>
      <header class="team-page-header">
        <h1>{{ pageTitle }}</h1>
        <ElDropdown v-if="currentView !== 'teams' && access.isAdmin && (access.permissions.humans || access.permissions.ai)" trigger="click" @command="addMember">
          <ElButton type="primary"><QIcon name="plus" :size="16" />添加成员<QIcon name="chevron-down" :size="14" /></ElButton>
          <template #dropdown><ElDropdownMenu><ElDropdownItem v-if="access.permissions.humans" command="human">人类成员</ElDropdownItem><ElDropdownItem v-if="access.permissions.ai" command="ai">AI 成员</ElDropdownItem></ElDropdownMenu></template>
        </ElDropdown>
        <ElButton v-else-if="currentView === 'teams' && access.isAdmin && access.permissions.teams && access.permissions.teamScope === 'all'" type="primary" @click="openTeam()"><QIcon name="plus" :size="16" />新建团队</ElButton>
      </header>

      <section class="team-content">
        <div class="toolbar">
          <ElInput v-model="keyword" clearable :placeholder="currentView === 'teams' ? '搜索团队' : '搜索成员名称、账号或 ID'" class="team-search" />
          <template v-if="currentView === 'human'">
            <ElSelect v-model="humanFilters.teamId" clearable placeholder="团队"><ElOption v-for="team in store.teams" :key="team.id" :label="team.name" :value="team.id" /></ElSelect>
            <ElSelect v-model="humanFilters.role" clearable placeholder="角色"><ElOption v-if="access.isOwner" label="Owner" value="Owner" /><ElOption v-for="role in filterRoles" :key="role.id" :label="role.name" :value="role.id" /></ElSelect>
            <ElSelect v-model="humanFilters.online" clearable placeholder="在线状态"><ElOption label="在线" value="true" /><ElOption label="离线" value="false" /></ElSelect>
            <ElSelect v-model="humanFilters.enabled" clearable placeholder="启用状态"><ElOption label="启用" value="true" /><ElOption label="停用" value="false" /></ElSelect>
          </template>
          <template v-else-if="currentView === 'ai'">
            <ElSelect v-model="aiFilters.teamId" clearable placeholder="所属团队"><ElOption v-for="team in store.teams" :key="team.id" :label="team.name" :value="team.id" /></ElSelect>
            <ElSelect v-model="aiFilters.online" clearable placeholder="在线状态"><ElOption label="在线" value="true" /><ElOption label="离线" value="false" /></ElSelect>
          </template>
          <template v-else-if="currentView === 'all'">
            <ElSelect v-model="allFilters.teamId" clearable placeholder="所属团队"><ElOption v-for="team in store.teams" :key="team.id" :label="team.name" :value="team.id" /></ElSelect>
            <ElSelect v-model="allFilters.kind" clearable placeholder="成员类型"><ElOption label="人类成员" value="human" /><ElOption label="AI 成员" value="ai" /></ElSelect>
            <ElSelect v-model="allFilters.role" clearable placeholder="角色"><ElOption v-if="access.isOwner" label="Owner" value="Owner" /><ElOption label="AI 成员" value="AI 成员" /><ElOption v-for="role in filterRoles" :key="role.id" :label="role.name" :value="role.id" /></ElSelect>
            <ElSelect v-model="allFilters.online" clearable placeholder="在线状态"><ElOption label="在线" value="true" /><ElOption label="离线" value="false" /></ElSelect>
          </template>
          <ElButton v-if="currentView !== 'teams'" class="ui-btn-outline" @click="clearFilters">清除筛选</ElButton>
        </div>

        <div class="team-table-viewport"><ElTable v-if="currentView !== 'teams'" height="100%" class="ui-table" :data="pagedRows" :empty-text="keyword ? '未找到符合条件的成员' : (currentView === 'ai' ? '暂无 AI 成员' : (currentView === 'human' ? '暂无人类成员' : '暂无成员'))">
          <ElTableColumn label="昵称" min-width="260"><template #default="scope"><span class="member-name"><i :style="memberAvatarStyle(scope.row)"><img v-if="scope.row.avatar" :src="scope.row.avatar" alt="" /><span v-else>{{ memberAvatarText(scope.row) }}</span></i><span><b>{{ scope.row.name }}</b><small>{{ scope.row.id }}</small></span></span></template></ElTableColumn>
          <ElTableColumn label="角色" min-width="120"><template #default="scope"><span class="ui-tag" :class="scope.row.role === 'Owner' ? 'is-solid' : 'is-neutral'">{{ roleName(scope.row.role) }}</span></template></ElTableColumn>
          <ElTableColumn label="类型" min-width="130"><template #default="scope"><span class="ui-tag" :class="scope.row.kind === 'ai' ? 'is-outline is-ai' : 'is-neutral'">{{ scope.row.kind === 'ai' ? 'AI 成员' : '人类成员' }}</span></template></ElTableColumn>
          <ElTableColumn label="团队" min-width="220"><template #default="scope">{{ teamNames(scope.row.teamIds) }}</template></ElTableColumn>
          <ElTableColumn label="在线状态" min-width="190">
            <template #default="scope">
              <span class="online" :class="{ off: !scope.row.online }"><i class="status-dot" aria-hidden="true" />{{ scope.row.online ? '在线' : '离线' }}</span>
              <button v-if="scope.row.kind === 'ai' && access.canManageMember(scope.row)" type="button" class="status-action" :aria-label="scope.row.online ? `下线 ${scope.row.name}` : `上线 ${scope.row.name}`" :disabled="scope.row.exception === 'agent'" @click="toggleAi(scope.row)"><QIcon name="power" :size="15" /></button>
              <span v-if="scope.row.exception" class="exception"><QIcon name="exclamation" :size="13" style="margin-right: 4px" />{{ scope.row.exception === 'connection' ? '连接异常' : scope.row.exception === 'authorization' ? '授权异常' : 'Agent 已失效' }}</span>
            </template>
          </ElTableColumn>
          <ElTableColumn label="启用" width="100"><template #default="scope"><ElSwitch v-if="scope.row.kind === 'human'" :model-value="scope.row.enabled" :disabled="!access.canManageMember(scope.row)" @change="(value) => toggleHuman(scope.row, Boolean(value))" /><span v-else>—</span></template></ElTableColumn>
          <ElTableColumn label="操作" width="100">
            <template #default="scope">
              <ElDropdown v-if="access.canManageMember(scope.row)" trigger="click">
                <ElButton text type="primary" :aria-label="`${scope.row.name} 的更多操作`"><QIcon name="more" :size="20" /></ElButton>
                <template #dropdown><ElDropdownMenu><ElDropdownItem @click="openMember(scope.row, scope.row.kind)">编辑</ElDropdownItem><ElDropdownItem v-if="scope.row.kind === 'human' && access.isOwner" @click="openReset(scope.row)">重置密码</ElDropdownItem><ElDropdownItem v-if="!scope.row.protected" divided @click="deleteMember(scope.row)">删除</ElDropdownItem></ElDropdownMenu></template>
              </ElDropdown>
            </template>
          </ElTableColumn>
        </ElTable>

        <ElTable v-else height="100%" :data="pagedRows" empty-text="暂无团队" class="team-list-table" @row-click="openTeamDetail">
          <ElTableColumn label="名称" min-width="300"><template #default="scope"><button type="button" class="team-row" :aria-label="`编辑 ${scope.row.name}`" @click="openTeamDetail(scope.row)"><i :style="teamAvatarStyle(scope.row)">{{ teamAvatarText(scope.row) }}</i><span><b>{{ scope.row.name }}</b><small>{{ store.membersOf(scope.row.id).length }} 名成员</small></span></button></template></ElTableColumn>
          <ElTableColumn label="ID" prop="id" min-width="160" />
          <ElTableColumn label="在线成员" min-width="130"><template #default="scope"><span class="metric">{{ store.membersOf(scope.row.id).filter((member) => member.online).length }}/{{ store.membersOf(scope.row.id).length }}</span></template></ElTableColumn>
          <ElTableColumn label="团队成员" min-width="240">
            <template #default="scope">
              <ElPopover placement="bottom-start" :width="300" trigger="click" popper-class="member-stack-popper">
                <template #reference><button type="button" class="avatars" :aria-label="`查看 ${scope.row.name} 的全部成员`" @click.stop><i v-for="member in store.membersOf(scope.row.id).slice(0, 4)" :key="member.id" :style="memberAvatarStyle(member)"><img v-if="member.avatar" :src="member.avatar" alt="" /><span v-else>{{ memberAvatarText(member) }}</span></i><em v-if="store.membersOf(scope.row.id).length > 4">+{{ store.membersOf(scope.row.id).length - 4 }}</em></button></template>
                <div class="member-stack-list"><span v-for="member in store.membersOf(scope.row.id)" :key="member.id" class="member-name"><i :style="memberAvatarStyle(member)"><img v-if="member.avatar" :src="member.avatar" alt="" /><span v-else>{{ memberAvatarText(member) }}</span></i><b>{{ member.name }}</b></span></div>
              </ElPopover>
            </template>
          </ElTableColumn>
          <ElTableColumn label="操作" width="96"><template #default="scope"><ElDropdown trigger="click" @click.stop><ElButton text type="primary" class="team-more-button" :aria-label="`${scope.row.name} 的更多操作`" @click.stop><QIcon name="more" :size="20" /></ElButton><template #dropdown><ElDropdownMenu><ElDropdownItem @click="openTeamDetail(scope.row)">编辑</ElDropdownItem><ElDropdownItem v-if="!scope.row.system" divided class="team-delete-menu" @click="deleteTeam(scope.row)">删除</ElDropdownItem></ElDropdownMenu></template></ElDropdown></template></ElTableColumn>
        </ElTable></div>

        <footer v-if="filteredRows.length > 0" class="table-footer"><span>共 {{ filteredRows.length }} 条</span><ElPagination v-model:current-page="page" v-model:page-size="pageSize" :page-sizes="[10, 20, 50]" layout="sizes, prev, pager, next" :total="filteredRows.length" /></footer>
      </section>
    </template>

    <ElDialog v-model="methodDialog" title="添加 AI 员工" width="1080px" class="adam-method-dialog">
      <div class="ai-method-grid">
      <section class="adam-card ui-card">
        <div class="adam-card-heading"><span class="adam-mark"><img src="/adam-bot-icon.svg" alt="Adam Bot" /></span><div><div class="adam-title-row"><h2>Adam Bot 官方接入</h2><span class="ui-tag is-soft is-info">官方推荐</span></div><p>绑定 Adam Bot 账号后，即可使用已发布的 AI Agent 创建 AI 员工，加入团队参与客户接待。</p></div></div>
        <div class="adam-benefits">
          <article><span><QIcon name="ai-head" :size="21" /></span><div><b>复用 AI Agent 能力</b><small>直接选择已发布的 AI Agent</small></div></article>
          <article><span><QIcon name="workflow" :size="21" /></span><div><b>继承知识与工作流</b><small>沿用 Agent 已配置的能力体系</small></div></article>
          <article><span><QIcon name="team" :size="21" /></span><div><b>人机协同接待</b><small>与团队成员共同参与服务</small></div></article>
          <article><span><QIcon name="shield" :size="21" /></span><div><b>官方授权接入</b><small>通过 Adam Bot 完成安全连接</small></div></article>
        </div>
        <footer class="adam-card-footer">
          <template v-if="store.authorized"><span class="adam-bound"><span class="adam-account-avatar">{{ avatarText(store.authorization.accountName || store.authorization.tenantName) }}</span><span><small>已绑定 Adam Bot 账号</small><b>{{ store.authorization.accountName || store.authorization.tenantName }}</b></span></span><div><ElButton class="ui-btn-outline" @click="unbindAdamBot">解绑</ElButton><ElButton type="primary" @click="chooseAdamBot">使用此方式</ElButton></div></template>
          <template v-else-if="store.authorization.status === 'expired'"><span class="adam-bound"><span class="adam-account-avatar">{{ avatarText(store.authorization.accountName) }}</span><span><small>授权已过期</small><b>{{ store.authorization.accountName }}</b></span></span><div><ElButton class="ui-btn-outline" @click="unbindAdamBot">解绑</ElButton><ElButton type="primary" @click="chooseAdamBot">重新授权</ElButton></div></template>
          <template v-else><span class="adam-unbound">尚未绑定 Adam Bot 账号</span><ElButton type="primary" @click="chooseAdamBot">使用此方式</ElButton></template>
        </footer>
      </section>
      <section class="webhook-method-card ui-card">
        <span class="webhook-method-icon"><QIcon name="code" :size="30" /></span>
        <div><h2>自定义 Webhook 接入</h2><p>连接自建或第三方 AI 服务，将客户消息推送至你的接收地址。</p></div>
        <ElButton type="primary" plain @click="chooseWebhook">使用此方式</ElButton>
      </section>
      </div>
    </ElDialog>

    <ElDialog v-model="authorizationDialog" title="登录 Adam Bot 完成授权" width="900px" class="adam-auth-dialog" destroy-on-close @closed="finishAuthorizationFlow">
      <div class="adam-login-window">
        <iframe :key="authorizationFrameKey" :src="ADAM_BOT_LOGIN_URL" title="Adam Bot 登录" allow="clipboard-read; clipboard-write" @load="completeAuthorizationFromLogin"></iframe>
        <div v-if="!authorizationFrameLoaded && !authorizationFrameFailed" class="adam-login-state"><span class="adam-login-spinner"></span>正在加载 Adam Bot 登录页面…</div>
        <div v-if="authorizationFrameFailed" class="adam-login-state error"><strong>登录页面加载失败</strong><span>请检查网络后重新加载。</span><ElButton type="primary" @click="retryAuthorizationLogin">重新加载</ElButton></div>
      </div>
      <template #footer><span class="adam-auth-status">{{ authorizationFrameLoaded ? '已完成模拟授权，可关闭窗口继续。' : '打开登录页面后即视为授权成功。' }}</span><ElButton @click="authorizationDialog = false">关闭</ElButton></template>
    </ElDialog>

    <ElDrawer v-model="memberDrawer" :title="editingOriginal ? `编辑${editing?.kind === 'ai' ? ' AI 成员' : '人类成员'}` : `添加${editing?.kind === 'ai' ? ' AI 员工' : '人类成员'}`" size="560px" @closed="closeMemberDrawer">
      <ElForm v-if="editing" label-position="top" class="drawer-form">
        <ElFormItem label="头像"><div class="avatar-uploader"><ElUpload :show-file-list="false" :auto-upload="false" accept="image/jpeg,image/png,image/webp" :on-change="uploadAvatar"><span class="avatar-upload-trigger" :class="{ uploaded: editing.avatar }"><img v-if="editing.avatar" :src="editing.avatar" alt="成员头像" /><QIcon v-else name="arrow-up-bracket" :size="30" /></span></ElUpload><small>{{ editing.avatar ? '点击头像可更换' : '点击上传头像' }}</small></div></ElFormItem>
        <template v-if="editing.kind === 'human'">
          <ElFormItem label="账号" required><ElInput v-model="editing.account" :disabled="Boolean(editingOriginal)" placeholder="请输入登录账号" /></ElFormItem>
          <ElFormItem label="昵称" required><ElInput v-model="editing.name" maxlength="32" show-word-limit @input="memberNameTouched = true" /></ElFormItem>
          <template v-if="!editingOriginal"><ElFormItem label="初始密码" required><ElInput v-model="editing.password" type="password" show-password placeholder="至少 8 位，包含字母和数字" /></ElFormItem><ElFormItem label="确认初始密码" required><ElInput v-model="editing.confirmPassword" type="password" show-password /></ElFormItem></template>
          <ElFormItem label="角色" required><ElSelect v-model="editing.role" placeholder="请选择角色" :disabled="editing.role === 'Owner' || (!access.isOwner && editing.id === access.currentId)"><ElOption v-if="editing.role === 'Owner'" label="Owner" value="Owner" /><ElOption v-for="role in roles.assignable" :key="role.id" :label="role.name" :value="role.id" /></ElSelect></ElFormItem>
          <ElFormItem label="团队" required><TeamMultiSelect v-model="editing.teamIds" :teams="manageableTeams" /></ElFormItem>
          <ElFormItem label="时区"><ElSelect v-model="editing.timezone"><ElOption label="UTC+08:00 北京时间" value="UTC+08:00" /><ElOption label="UTC+00:00 协调世界时" value="UTC+00:00" /><ElOption label="UTC-05:00 北美东部时间" value="UTC-05:00" /></ElSelect></ElFormItem>
          <ElFormItem label="用户状态"><ElSwitch v-model="editing.enabled" active-text="启用" inactive-text="停用" /></ElFormItem>
        </template>
        <template v-else>
          <template v-if="editing.aiSource !== 'webhook'"><ElFormItem label="AI Agent" required><div class="agent-field"><ElSelect :model-value="editing.agentId" :disabled="!store.canUseAgentCatalog || store.agentListState !== 'ready'" placeholder="选择已发布 AI Agent" @change="chooseAgent"><ElOption v-for="agent in store.publishedAgents" :key="agent.id" :label="agent.name" :value="agent.id" /></ElSelect><ElButton v-if="store.agentListState === 'error'" class="ui-btn-outline" @click="store.agentListState = 'ready'">AI Agent 列表加载失败，请重试</ElButton><span v-else-if="store.publishedAgents.length === 0" class="field-error">暂无已发布的 AI Agent，请先在 Adam Bot 发布。</span><span v-else-if="!store.canUseAgentCatalog" class="form-help">未绑定 Adam Bot，原 AI Agent 保持为空。</span></div></ElFormItem></template>
          <ElFormItem label="昵称" required><ElInput v-model="editing.name" maxlength="32" show-word-limit @input="memberNameTouched = true" /></ElFormItem>
          <ElFormItem label="团队" required><TeamMultiSelect v-model="editing.teamIds" :disabled-ids="disabledTeamIdsForMember" :teams="manageableTeams" /></ElFormItem>
          <ElFormItem label="在线状态"><ElSwitch v-model="editing.online" active-text="在线" inactive-text="离线" /></ElFormItem>
          <template v-if="editing.aiSource === 'webhook'"><ElFormItem label="消息接收地址" required><ElInput v-model="editing.webhookUrl" placeholder="https://example.com/webhook/messages" /><span class="form-help">客户发送给该 AI 员工的消息将推送至此地址。</span></ElFormItem><ElFormItem label="消息回复地址"><div class="readonly-copy-field"><ElInput :model-value="webhookReplyUrl(editing.id)" disabled /><ElTooltip content="复制消息回复地址" placement="top"><ElButton text aria-label="复制消息回复地址" class="copy-field-button" @click="copyWebhookReplyUrl(editing.id)"><QIcon name="copy" :size="18" /></ElButton></ElTooltip></div></ElFormItem><ElFormItem label="AccessToken"><ElInput :model-value="editing.webhookToken" readonly /></ElFormItem></template>
        </template>
      </ElForm>
      <template #footer><ElButton class="ui-btn-outline" @click="memberDrawer = false">取消</ElButton><ElButton type="primary" @click="saveMember">保存</ElButton></template>
    </ElDrawer>

    <ElDialog v-model="teamDrawer" title="新建团队" width="760px" class="create-team-dialog">
      <ElForm v-if="editingTeam" label-position="top" class="drawer-form">
        <ElFormItem label="团队名称" required><ElInput v-model="editingTeam.name" maxlength="32" show-word-limit placeholder="请输入团队名称" /></ElFormItem>
        <ElFormItem label="选择成员" required><MemberSelectionPanel v-model="teamMemberIds" :members="store.members" /></ElFormItem>
      </ElForm>
      <template #footer><ElButton class="ui-btn-outline" @click="teamDrawer = false">取消</ElButton><ElButton type="primary" @click="saveTeam">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="memberPickerDialog" title="添加成员" width="640px">
      <MemberSelectionPanel v-model="pickerMemberIds" :members="store.members" :locked-ids="detailMemberIds" />
      <template #footer><ElButton @click="memberPickerDialog = false">取消</ElButton><ElButton type="primary" @click="savePickedMembers">保存</ElButton></template>
    </ElDialog>

    <ElDialog v-model="resetDialog" title="重置密码" width="480px"><ElForm label-position="top"><ElFormItem label="新密码" required><ElInput v-model="resetForm.password" type="password" show-password placeholder="至少 8 位，包含字母和数字" /></ElFormItem><ElFormItem label="确认新密码" required><ElInput v-model="resetForm.confirmPassword" type="password" show-password /></ElFormItem></ElForm><template #footer><ElButton @click="resetDialog = false">取消</ElButton><ElButton type="primary" @click="resetPassword">确认</ElButton></template></ElDialog>
    </main>
  </div>
</template>
