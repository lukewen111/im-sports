import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { usePrototypeAccess } from './access-store';
import { changePermission, emptyPermissions, findRole, fullPermissions, roleRecords } from './role-catalog';
import type { RoleRecord } from './role-catalog';
import { useRoleStore } from './role-store';
import { useTeamStore } from './team-store';

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
    key: (index: number) => [...values.keys()][index] ?? null,
    get length() { return values.size; },
  });
});

function draft(): RoleRecord {
  return { id: 'custom-test', name: '订单客服', kind: 'member', description: '', system: false, createdAt: '', version: 0, permissions: { ...emptyPermissions(), customers: 'self' } };
}
beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  roleRecords.value = roleRecords.value.filter((role) => role.system);
});
describe('角色与成员授权规则', () => {
  it('依赖自动补足，取消依赖撤销操作权限但不降级既有范围', () => {
    const p = emptyPermissions();
    changePermission(p, 'recall', true);
    expect([p.assigned, p.customers, p.recall]).toEqual(['self', 'self', true]);
    p.assigned = 'all';
    changePermission(p, 'takeover', true);
    expect(p.assigned).toBe('all');
    changePermission(p, 'assigned', 'none');
    expect([p.takeover, p.recall]).toEqual([false, false]);
  });
  it('Owner 也不能编辑或删除默认角色', () => {
    const store = useRoleStore();
    expect(store.save({ ...findRole('客服')!, name: '改名' })).toContain('默认角色');
    expect(store.remove('role-service')).toContain('默认角色');
  });
  it('自定义角色可用于创建成员，使用中的角色不能删除，重命名保留绑定', () => {
    const roles = useRoleStore();
    const team = useTeamStore();
    expect(roles.save(draft())).toBeUndefined();
    const result = team.saveMember({ id: 'test-member', account: 'test-account', name: '新成员', role: 'custom-test', kind: 'human', online: false, enabled: true, teamIds: ['100001'], version: 0, password: 'Mock12345', confirmPassword: 'Mock12345' });
    expect(result.error).toBeUndefined();
    expect(roles.count('custom-test')).toBe(1);
    expect(roles.remove('custom-test')).toContain('关联成员');
    expect(roles.save({ ...findRole('custom-test')!, name: '订单处理' })).toBeUndefined();
    expect(findRole(team.memberById('test-member')!.role)?.name).toBe('订单处理');
  });
  it('不可重复命名、保存空权限或覆盖新版本', () => {
    const roles = useRoleStore();
    expect(roles.save({ ...draft(), name: '客服' })).toContain('已存在');
    expect(roles.save({ ...draft(), permissions: emptyPermissions() })).toContain('页面访问');
    expect(roles.save(draft())).toBeUndefined();
    expect(roles.save({ ...draft(), version: 2 })).toContain('已变化');
  });
  it('管理员只看到普通类型，普通成员不能直接访问角色配置', () => {
    const access = usePrototypeAccess();
    const roles = useRoleStore();
    access.currentId = 'member-sophie';
    expect(roles.visible.map((role) => role.name)).toEqual(['客服']);
    expect(roles.save({ ...draft(), kind: 'admin' })).toContain('无权');
    access.currentId = 'member-mika';
    expect(roles.visible).toEqual([]);
    expect(access.canVisit('/team/roles')).toBe(false);
    expect(access.canVisit('/channels')).toBe(false);
    expect(roles.save(draft())).toContain('无权');
  });
  it('权限更新立即生效且不强制关闭接受聊天状态', () => {
    const roles = useRoleStore();
    const team = useTeamStore();
    const access = usePrototypeAccess();
    expect(roles.save({ ...draft(), permissions: fullPermissions() })).toBeUndefined();
    const member = team.memberById('member-chenyi')!;
    member.role = 'custom-test';
    access.currentId = member.id;
    expect(access.permissions.channels).toBe(true);
    access.currentId = 'member-owner';
    expect(roles.save({ ...findRole('custom-test')!, permissions: { ...emptyPermissions(), customers: 'self' } })).toBeUndefined();
    access.currentId = member.id;
    expect(access.permissions.channels).toBe(false);
    expect(member.online).toBe(true);
  });
  it('管理员授权不能超过自身，跨范围成员不能执行全局管理', () => {
    const roles = useRoleStore();
    const team = useTeamStore();
    const access = usePrototypeAccess();
    expect(roles.save({ ...draft(), kind: 'admin', permissions: { ...emptyPermissions(), humans: true, customers: 'self' } })).toBeUndefined();
    team.memberById('member-chenyi')!.role = 'custom-test';
    access.currentId = 'member-chenyi';
    expect(roles.save({ ...draft(), id: 'other', name: '越权', permissions: fullPermissions() })).toContain('超过');
    expect(access.canManageMember(team.memberById('member-sophie'))).toBe(false);
  });
  it('成员创建不能复制 Owner 身份，旧管理员标签兼容主管', () => {
    expect(findRole('管理员')?.name).toBe('主管');
    const result = useTeamStore().saveMember({ id: 'another-owner', account: 'other-owner', name: '冒充', role: 'Owner', kind: 'human', online: false, teamIds: ['100001'], version: 0 });
    expect(result.error).toContain('第二个 Owner');
  });
});
