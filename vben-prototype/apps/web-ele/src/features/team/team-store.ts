import { computed, ref, toRaw, watch } from 'vue';

import { defineStore } from 'pinia';

import { avatarColor, DEFAULT_TEAM_ID, nextTeamId, normalizeTeamId } from './team-constants';

export type AgentHealth = 'available' | 'deleted' | 'unavailable';
export type AuthorizationStatus = 'expired' | 'none' | 'valid';
export type MemberKind = 'ai' | 'human';
export type MemberRole = '' | 'AI 成员' | 'Owner' | '客服' | '管理员';

export interface AgentOption {
  avatar?: string;
  health: AgentHealth;
  id: string;
  name: string;
  published: boolean;
}

export interface AuthorizationState {
  accountName?: string;
  fixed: boolean;
  status: AuthorizationStatus;
  tenantId?: string;
  tenantName?: string;
}

export interface TeamMember {
  account?: string;
  agentId?: string;
  agentName?: string;
  aiSource?: 'adam' | 'webhook';
  avatar?: string;
  enabled?: boolean;
  exception?: 'agent' | 'authorization' | 'connection';
  exceptionBeforeAuthorization?: 'agent' | 'connection';
  id: string;
  kind: MemberKind;
  name: string;
  online: boolean;
  protected?: boolean;
  role: MemberRole;
  teamIds: string[];
  timezone?: string;
  version: number;
  webhookToken?: string;
  webhookUrl?: string;
}

export interface MemberDraft extends TeamMember {
  confirmPassword?: string;
  password?: string;
}

export interface TeamRecord {
  color: string;
  id: string;
  name: string;
  system?: boolean;
  updatedAt: string;
  version: number;
}

interface PersistedState {
  authorization: AuthorizationState;
  members: TeamMember[];
  teams: TeamRecord[];
}

interface Result<T = undefined> {
  data?: T;
  error?: string;
}

const KEY = 'im-support-vben:team-module-v3';
const LEGACY_KEY = 'im-support-vben:team-module-v2';
const TEAM_ID_KEY = 'im-support-vben:team-id-high-water';
const now = () => new Date().toISOString();
const clone = <T>(value: T): T => structuredClone(toRaw(value));

const seedTeams: TeamRecord[] = [
  { color: '#1677ff', id: DEFAULT_TEAM_ID, name: '通用团队', system: true, updatedAt: now(), version: 1 },
  { color: '#7a2cff', id: '100002', name: '售前服务团队', updatedAt: now(), version: 1 },
  { color: '#ff6a00', id: '100003', name: '售后服务团队', updatedAt: now(), version: 1 },
];

const seedMembers: TeamMember[] = [
  { account: 'admin@imsports.com', enabled: true, id: 'member-owner', kind: 'human', name: '卢森堡', online: true, protected: true, role: 'Owner', teamIds: [DEFAULT_TEAM_ID], timezone: 'UTC+08:00', version: 1 },
  { account: 'sophie', enabled: true, id: 'member-sophie', kind: 'human', name: '苏菲', online: true, role: '管理员', teamIds: ['100002', DEFAULT_TEAM_ID], timezone: 'UTC+08:00', version: 1 },
  { account: 'mika', enabled: true, id: 'member-mika', kind: 'human', name: '米卡', online: false, role: '客服', teamIds: ['100003'], timezone: 'UTC+08:00', version: 1 },
  { account: 'chenyi', enabled: true, id: 'member-chenyi', kind: 'human', name: '陈一', online: true, role: '客服', teamIds: ['100002'], timezone: 'UTC+08:00', version: 1 },
  { agentId: 'agent-sales', agentName: '售前助手', aiSource: 'adam', id: 'member-ai-sales', kind: 'ai', name: '小麦', online: true, role: 'AI 成员', teamIds: ['100002'], version: 1 },
  { agentId: 'agent-after-sales', agentName: '售后助手', aiSource: 'adam', exception: 'connection', id: 'member-ai-after-sales', kind: 'ai', name: '小橙', online: true, role: 'AI 成员', teamIds: ['100003'], version: 1 },
];

const agents: AgentOption[] = [
  { health: 'available', id: 'agent-sales', name: '售前助手', published: true },
  { health: 'unavailable', id: 'agent-after-sales', name: '售后助手', published: true },
  { health: 'available', id: 'agent-order', name: '订单查询助手', published: true },
  { health: 'available', id: 'agent-draft', name: '未发布草稿助手', published: false },
  { health: 'deleted', id: 'agent-deleted', name: '已删除助手', published: true },
];

const seedAuthorization: AuthorizationState = {
  accountName: '卢森堡',
  fixed: true,
  status: 'valid',
  tenantId: 'adam-tenant-main',
  tenantName: 'Adam Bot · IM Sports',
};

function load(): PersistedState {
  try {
    const saved = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as PersistedState;
      parsed.teams = parsed.teams.map((team) => {
        const id = normalizeTeamId(team.id);
        const { avatar: _legacyAvatar, ...teamWithoutAvatar } = team as TeamRecord & { avatar?: string };
        return { ...teamWithoutAvatar, color: team.color || avatarColor(id), id };
      });
      parsed.members = parsed.members.map((member) => {
        const aiSource = member.kind === 'ai' ? (member.aiSource || 'adam') : undefined;
        const official = member.kind === 'ai' && aiSource !== 'webhook';
        const authorizationCleared = official && parsed.authorization.status === 'none';
        return {
          ...member,
          agentId: authorizationCleared ? undefined : member.agentId,
          agentName: authorizationCleared ? undefined : member.agentName,
          aiSource,
          exception: authorizationCleared ? undefined : (official && member.agentId && parsed.authorization.status === 'expired' ? 'authorization' : member.exception),
          exceptionBeforeAuthorization: authorizationCleared ? undefined : (official && member.agentId && parsed.authorization.status === 'expired' && member.exception !== 'authorization' ? member.exception : member.exceptionBeforeAuthorization),
          teamIds: [...new Set(member.teamIds.map((teamId) => normalizeTeamId(teamId)))],
        };
      });
      if ((parsed.authorization.status as string) === 'temporary') {
        parsed.authorization = { ...parsed.authorization, fixed: true, status: 'valid' };
      }
      localStorage.setItem(KEY, JSON.stringify(parsed));
      return parsed;
    }
  } catch {
    // Use deterministic Mock data.
  }
  return {
    authorization: clone(seedAuthorization),
    members: clone(seedMembers),
    teams: clone(seedTeams),
  };
}

function passwordError(password = '', confirmPassword = '') {
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码至少 8 位，并同时包含字母和数字。';
  if (password !== confirmPassword) return '两次输入的密码不一致。';
  return undefined;
}

export const useTeamStore = defineStore('im-support-team', () => {
  const initial = load();
  const authorization = ref(initial.authorization);
  const members = ref(initial.members);
  const teams = ref(initial.teams);
  function rememberTeamId(id: string) {
    const maximum = Number(nextTeamId([localStorage.getItem(TEAM_ID_KEY) || '', id, ...teams.value.map((team) => team.id)])) - 1;
    localStorage.setItem(TEAM_ID_KEY, String(maximum));
  }
  rememberTeamId('');
  const agentListState = ref<'error' | 'loading' | 'ready'>('ready');

  watch([teams, members, authorization], () => {
    localStorage.setItem(KEY, JSON.stringify({ authorization: authorization.value, members: members.value, teams: teams.value }));
  }, { deep: true });

  const authorized = computed(() => authorization.value.status === 'valid');
  const canUseAgentCatalog = computed(() => authorization.value.status === 'valid');
  const humans = computed(() => members.value.filter((member) => member.kind === 'human'));
  const aiMembers = computed(() => members.value.filter((member) => member.kind === 'ai'));
  const publishedAgents = computed(() => agents.filter((agent) => agent.published && agent.health !== 'deleted'));
  const teamById = (id?: string) => teams.value.find((team) => team.id === id);
  const memberById = (id?: string) => members.value.find((member) => member.id === id);
  const membersOf = (teamId: string) => members.value.filter((member) => member.teamIds.includes(teamId));
  const allocateTeamId = () => {
    const id = nextTeamId([localStorage.getItem(TEAM_ID_KEY) || '', ...teams.value.map((team) => team.id)]);
    rememberTeamId(id);
    return id;
  };
  const aiInTeam = (teamId: string, exceptId?: string) => aiMembers.value.find((member) => member.id !== exceptId && member.teamIds.includes(teamId));
  const agentById = (id?: string) => agents.find((agent) => agent.id === id);

  function validateTeams(teamIds: string[]) {
    if (teamIds.length === 0) return '请至少选择一个所属团队。';
    if (teamIds.some((teamId) => !teamById(teamId))) return '所选团队已失效，请重新选择。';
    return undefined;
  }

  function validateRemovedTeams(previous: TeamMember | undefined, nextTeamIds: string[]) {
    if (!previous) return undefined;
    const emptied = previous.teamIds.find((teamId) => !nextTeamIds.includes(teamId) && membersOf(teamId).every((member) => member.id === previous.id));
    return emptied ? `无法完成操作。「${teamById(emptied)?.name}」团队至少需要保留一名成员。` : undefined;
  }

  function saveHuman(draft: MemberDraft): Result<TeamMember> {
    const previous = memberById(draft.id);
    if (!previous && draft.version > 0) return { error: '成员已删除，请刷新后重试。' };
    if (!draft.account?.trim() || !/^[\w.+@-]{3,64}$/.test(draft.account.trim())) return { error: '请输入有效登录账号。' };
    if (members.value.some((member) => member.kind === 'human' && member.id !== draft.id && member.account?.toLowerCase() === draft.account?.trim().toLowerCase())) return { error: '该账号已存在，请更换账号。' };
    if (!draft.name.trim()) return { error: '请输入昵称。' };
    if (!['Owner', '客服', '管理员'].includes(draft.role)) return { error: '请选择有效角色。' };
    const teamError = validateTeams(draft.teamIds) || validateRemovedTeams(previous, draft.teamIds);
    if (teamError) return { error: teamError };
    if (!previous) {
      const error = passwordError(draft.password, draft.confirmPassword);
      if (error) return { error };
    }
    if (previous && draft.version !== previous.version) return { error: '成员信息已更新，请刷新后重试。' };
    const value: TeamMember = {
      account: draft.account.trim(), avatar: draft.avatar, enabled: Boolean(draft.enabled), id: draft.id, kind: 'human',
      name: draft.name.trim(), online: Boolean(draft.enabled && previous?.online), protected: previous?.protected, role: draft.role,
      teamIds: [...new Set(draft.teamIds)], timezone: draft.timezone || 'UTC+08:00', version: (previous?.version ?? 0) + 1,
    };
    const index = members.value.findIndex((member) => member.id === draft.id);
    if (index === -1) members.value.unshift(value); else members.value[index] = value;
    return { data: clone(value) };
  }

  function saveAi(draft: MemberDraft): Result<TeamMember> {
    const previous = memberById(draft.id);
    if (!previous && draft.version > 0) return { error: '成员已删除，请刷新后重试。' };
    if (previous && (previous.aiSource || 'adam') !== (draft.aiSource || 'adam')) return { error: 'AI 成员来源不可修改。' };
    if (!draft.name.trim()) return { error: '请输入昵称。' };
    const teamError = validateTeams(draft.teamIds) || validateRemovedTeams(previous, draft.teamIds);
    if (teamError) return { error: teamError };
    if (draft.teamIds.some((teamId) => aiInTeam(teamId, draft.id))) return { error: '该团队已有 AI 成员，每个团队最多添加一名 AI 成员。' };
    if (previous && draft.version !== previous.version) return { error: '成员信息已更新，请刷新后重试。' };
    const isWebhook = draft.aiSource === 'webhook';
    if (isWebhook) {
      try {
        const url = new URL(draft.webhookUrl || '');
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return { error: '消息接收地址仅支持不含用户名和密码的 HTTP 或 HTTPS 地址。' };
      } catch { return { error: '请输入有效的消息接收地址。' }; }
    }
    if (!isWebhook && !canUseAgentCatalog.value && previous?.agentId !== draft.agentId) return { error: '请先绑定 Adam Bot 后再选择 AI Agent。' };
    const agent = isWebhook ? undefined : agentById(draft.agentId);
    const localEdit = Boolean(previous && ((!previous.agentId && !draft.agentId) || (authorization.value.status === 'expired' && previous.agentId === draft.agentId)));
    const keepsExpiredAgent = Boolean(authorization.value.status === 'expired' && previous?.agentId === draft.agentId && agent?.published && agent.health !== 'deleted');
    if (!isWebhook && !localEdit && (!canUseAgentCatalog.value || !agent || !agent.published || agent.health === 'deleted')) return { error: '请选择有效且已发布的 AI Agent。' };
    if (!isWebhook && draft.online && !previous?.online && !keepsExpiredAgent && (!authorized.value || !agent || !agent.published || agent.health === 'deleted')) return { error: '请先恢复有效授权并绑定有效的 AI Agent 后再上线。' };
    const value: TeamMember = {
      agentId: localEdit ? previous?.agentId : agent?.id, agentName: localEdit ? previous?.agentName : agent?.name, aiSource: isWebhook ? 'webhook' : 'adam', avatar: draft.avatar,
      exception: localEdit ? previous?.exception : (agent?.health === 'unavailable' ? 'connection' : undefined),
      exceptionBeforeAuthorization: localEdit ? previous?.exceptionBeforeAuthorization : undefined,
      id: draft.id, kind: 'ai', name: draft.name.trim(), online: Boolean(draft.online), role: 'AI 成员',
      teamIds: [...new Set(draft.teamIds)], version: (previous?.version ?? 0) + 1,
      webhookToken: isWebhook ? previous?.webhookToken || draft.webhookToken || crypto.randomUUID() : undefined, webhookUrl: isWebhook ? draft.webhookUrl?.trim() : undefined,
    };
    const index = members.value.findIndex((member) => member.id === draft.id);
    if (index === -1) members.value.unshift(value); else members.value[index] = value;
    return { data: clone(value) };
  }

  function saveMember(draft: MemberDraft) {
    return draft.kind === 'human' ? saveHuman(draft) : saveAi(draft);
  }

  function removeMember(id: string): Result {
    const member = memberById(id);
    if (!member) return { error: '成员不存在。' };
    if (member.protected) return { error: '该 Owner 账号受保护，无法删除。' };
    const empty = member.teamIds.find((teamId) => membersOf(teamId).length === 1);
    if (empty) return { error: `无法完成操作。「${teamById(empty)?.name}」团队至少需要保留一名成员。` };
    members.value = members.value.filter((item) => item.id !== id);
    return {};
  }

  function toggleHumanEnabled(id: string, enabled: boolean): Result {
    const member = memberById(id);
    if (!member || member.kind !== 'human') return { error: '人类成员不存在。' };
    member.enabled = enabled;
    if (!enabled) member.online = false;
    member.version += 1;
    return {};
  }

  function resetPassword(id: string, password: string, confirmPassword: string): Result {
    const member = memberById(id);
    if (!member || member.kind !== 'human') return { error: '人类成员不存在。' };
    const error = passwordError(password, confirmPassword);
    if (error) return { error };
    member.online = false;
    member.version += 1;
    return {};
  }

  function setAiOnline(id: string, online: boolean): Result {
    const member = memberById(id);
    if (!member || member.kind !== 'ai') return { error: 'AI 成员不存在。' };
    const agent = agentById(member.agentId);
    const keepsExpiredAgent = Boolean(authorization.value.status === 'expired' && member.agentId && agent?.published && agent.health !== 'deleted');
    if (online && member.aiSource !== 'webhook' && !keepsExpiredAgent && (!authorized.value || !agent || !agent.published || agent.health === 'deleted')) return { error: '请先恢复有效授权并绑定有效的 AI Agent 后再上线。' };
    member.online = online;
    member.version += 1;
    return {};
  }

  function saveTeam(team: TeamRecord, memberIds: string[]): Result<TeamRecord> {
    const name = team.name.trim();
    const existing = teamById(team.id);
    if (!existing && team.version > 0) return { error: '团队已删除，请刷新后重试。' };
    if (!/^\d+$/.test(team.id)) return { error: '团队 ID 必须为纯数字。' };
    if (!name) return { error: '请输入团队名称。' };
    if (teams.value.some((item) => item.id !== team.id && item.name.toLowerCase() === name.toLowerCase())) return { error: '团队名称已存在。' };
    if (memberIds.length === 0) return { error: '请至少选择一名成员。' };
    if (memberIds.some((id) => !memberById(id))) return { error: '所选成员已失效，请重新选择。' };
    const selected = members.value.filter((member) => memberIds.includes(member.id));
    if (selected.filter((member) => member.kind === 'ai').length > 1) return { error: '该团队已有 AI 成员，每个团队最多添加一名 AI 成员。' };
    if (existing?.system && existing.name !== name) return { error: '通用团队不可重命名。' };
    if (existing && team.version !== existing.version) return { error: '团队信息已更新，请刷新后重试。' };
    const removedWithoutTeam = existing && membersOf(team.id).find((member) => !memberIds.includes(member.id) && member.teamIds.length === 1);
    if (removedWithoutTeam) return { error: '成员至少需要保留一个所属团队。' };
    const value: TeamRecord = { ...team, name, system: existing?.system, updatedAt: now(), version: (existing?.version ?? 0) + 1 };
    const index = teams.value.findIndex((item) => item.id === team.id);
    rememberTeamId(team.id);
    if (index === -1) teams.value.unshift(value); else teams.value[index] = value;
    members.value.forEach((member) => {
      const hadTeam = member.teamIds.includes(team.id);
      member.teamIds = member.teamIds.filter((teamId) => teamId !== team.id);
      if (memberIds.includes(member.id)) member.teamIds.push(team.id);
      if (hadTeam !== memberIds.includes(member.id)) member.version += 1;
    });
    return { data: clone(value) };
  }

  function canRemoveTeam(id: string): Result<TeamRecord> {
    const team = teamById(id);
    if (!team) return { error: '团队不存在。' };
    if (team.system) return { error: '通用团队不可删除。' };
    if (membersOf(id).some((member) => member.teamIds.length === 1)) return { error: '无法删除该团队，请先将仅属于本团队的成员加入其他团队。' };
    return { data: clone(team) };
  }

  function removeTeam(id: string): Result {
    const check = canRemoveTeam(id);
    if (check.error) return { error: check.error };
    teams.value = teams.value.filter((team) => team.id !== id);
    members.value.forEach((member) => {
      if (member.teamIds.includes(id)) {
        member.teamIds = member.teamIds.filter((teamId) => teamId !== id);
        member.version += 1;
      }
    });
    return {};
  }

  function completeAuthorization(tenantId: string, tenantName: string, accountName: string): Result {
    if (authorization.value.status !== 'none' && authorization.value.tenantId !== tenantId) return { error: '当前授权账号不属于原绑定的 Adam Bot 租户，请先解绑或更换账号。' };
    authorization.value = { accountName, fixed: true, status: 'valid', tenantId, tenantName };
    aiMembers.value.forEach((member) => {
      if (member.aiSource !== 'webhook' && member.exception === 'authorization') {
        member.exception = member.exceptionBeforeAuthorization || (agentById(member.agentId)?.health === 'unavailable' ? 'connection' : undefined);
        member.exceptionBeforeAuthorization = undefined;
        member.version += 1;
      }
    });
    return {};
  }

  function expireAuthorization() {
    authorization.value.status = 'expired';
    aiMembers.value.forEach((member) => {
      if (member.aiSource !== 'webhook' && member.agentId && member.exception !== 'authorization') {
        member.exceptionBeforeAuthorization = member.exception;
        member.exception = 'authorization';
        member.version += 1;
      }
    });
  }

  function unbindAuthorization() {
    const affected = aiMembers.value.filter((member) => member.aiSource !== 'webhook' && member.agentId).length;
    authorization.value = { fixed: false, status: 'none' };
    members.value.forEach((member) => {
      if (member.kind === 'ai' && member.aiSource !== 'webhook') {
        member.agentId = undefined;
        member.agentName = undefined;
        member.exception = undefined;
        member.exceptionBeforeAuthorization = undefined;
        member.version += 1;
      }
    });
    return affected;
  }

  function resetMock() {
    authorization.value = clone(seedAuthorization);
    members.value = clone(seedMembers);
    teams.value = clone(seedTeams);
    agentListState.value = 'ready';
  }

  return {
    agentById, agentListState, agents, aiInTeam, aiMembers, allocateTeamId, authorization, authorized, canUseAgentCatalog,
    canRemoveTeam, completeAuthorization, expireAuthorization, humans, memberById, members, membersOf, publishedAgents,
    removeMember, removeTeam, resetMock, resetPassword, saveMember, saveTeam, setAiOnline, teamById, teams, toggleHumanEnabled, unbindAuthorization,
  };
});
