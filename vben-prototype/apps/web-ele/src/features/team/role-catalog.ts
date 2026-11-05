import { ref, watch } from 'vue';

export type DataScope = 'all' | 'none' | 'self' | 'team';
export type RoleKind = 'admin' | 'member';
export interface RolePermissions {
  assigned: DataScope;
  pending: boolean;
  takeover: boolean;
  transfer: boolean;
  end: boolean;
  customers: DataScope;
  recall: boolean;
  teams: boolean;
  humans: boolean;
  ai: boolean;
  teamScope: 'all' | 'team';
  channels: boolean;
  settings: boolean;
}
export interface RoleRecord {
  id: string;
  name: string;
  kind: RoleKind;
  description: string;
  system: boolean;
  createdAt: string;
  version: number;
  permissions: RolePermissions;
}
export const emptyPermissions = (): RolePermissions => ({
  assigned: 'none', pending: false, takeover: false, transfer: false, end: false,
  customers: 'none', recall: false, teams: false, humans: false, ai: false,
  teamScope: 'team', channels: false, settings: false,
});
export const fullPermissions = (): RolePermissions => ({
  assigned: 'all', pending: true, takeover: true, transfer: true, end: true,
  customers: 'all', recall: true, teams: true, humans: true, ai: true,
  teamScope: 'all', channels: true, settings: true,
});
const defaults: RoleRecord[] = [
  { id: 'role-supervisor', name: '主管', kind: 'admin', description: '管理全部业务数据及普通成员角色。', system: true, createdAt: '', version: 1, permissions: fullPermissions() },
  { id: 'role-service', name: '客服', kind: 'member', description: '处理本人会话与客户，查看所属团队成员。', system: true, createdAt: '', version: 1, permissions: { ...fullPermissions(), assigned: 'self', customers: 'self', teamScope: 'team', channels: false, settings: false } },
];
const KEY = 'im-support-vben:roles-v1';
function loadRoles(): RoleRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '[]') as RoleRecord[];
    return [...structuredClone(defaults), ...saved.filter((role) => !role.system && !defaults.some((item) => item.id === role.id))];
  } catch { return structuredClone(defaults); }
}
// 共享目录独立于成员 Store，避免成员校验与角色成员数之间的循环依赖。
export const roleRecords = ref<RoleRecord[]>(loadRoles());
watch(roleRecords, (roles) => localStorage.setItem(KEY, JSON.stringify(roles)), { deep: true, flush: 'sync' });
export const normalizeRoleId = (value: string) => ({ 管理员: 'role-supervisor', 主管: 'role-supervisor', 客服: 'role-service' })[value as '主管' | '客服' | '管理员'] || value;
export const findRole = (id: string) => roleRecords.value.find((role) => role.id === normalizeRoleId(id));
export const roleName = (id: string) => findRole(id)?.name || id;
export const scopeRank = (scope: DataScope) => ({ none: 0, self: 1, team: 2, all: 3 })[scope];
export const permissionLabels = {
  pending: '待分配', takeover: '接管会话', transfer: '转接会话', end: '结束会话', recall: '回聊',
  teams: '团队管理', humans: '人类成员', ai: 'AI 成员', channels: '渠道', settings: '聊天与接待',
} as const;
export type BooleanPermission = keyof typeof permissionLabels;
export function changePermission(p: RolePermissions, key: BooleanPermission | 'assigned' | 'customers', value: boolean | DataScope) {
  if (key === 'assigned' || key === 'customers') p[key] = value as DataScope;
  else p[key] = Boolean(value);
  if ((key === 'takeover' || key === 'recall') && value && p.assigned === 'none') p.assigned = 'self';
  if (key === 'recall' && value && p.customers === 'none') p.customers = 'self';
  if (key === 'assigned' && value === 'none') { p.takeover = false; p.recall = false; }
  if (key === 'customers' && value === 'none') p.recall = false;
}
export function permissionsError(p: RolePermissions, ceiling: RolePermissions): string | undefined {
  if (![p.assigned !== 'none', p.pending, p.customers !== 'none', p.teams, p.humans, p.ai, p.channels, p.settings].some(Boolean)) return '请至少选择一项业务页面访问权限。';
  if ((p.takeover || p.recall) && p.assigned === 'none' || p.recall && p.customers === 'none') return '权限依赖不完整，请重新配置。';
  if (scopeRank(p.assigned) > scopeRank(ceiling.assigned) || scopeRank(p.customers) > scopeRank(ceiling.customers)) return '数据范围不能超过您当前的权限。';
  if ((p.teams || p.humans || p.ai) && scopeRank(p.teamScope) > scopeRank(ceiling.teamScope)) return '团队数据范围不能超过您当前的权限。';
  if ((Object.keys(permissionLabels) as BooleanPermission[]).some((key) => p[key] && !ceiling[key])) return '不能授予您当前未拥有的功能权限。';
  return undefined;
}
