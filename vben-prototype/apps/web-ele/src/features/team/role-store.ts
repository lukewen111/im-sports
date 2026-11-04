import type { RoleRecord } from './role-catalog';
import { computed } from 'vue';
import { defineStore } from 'pinia';
import { usePrototypeAccess } from './access-store';
import { normalizeRoleId, permissionsError, roleRecords } from './role-catalog';
import { useTeamStore } from './team-store';

export const useRoleStore = defineStore('prototype-roles', () => {
  const access = usePrototypeAccess();
  const team = useTeamStore();
  const visible = computed(() => !access.canManageRoles ? [] : roleRecords.value.filter((role) => access.isOwner || role.kind === 'member'));
  const assignable = computed(() => !access.isAdmin ? [] : roleRecords.value.filter((role) => access.isOwner || role.kind === 'member'));
  const count = (id: string) => team.humans.filter((member) => normalizeRoleId(member.role) === id).length;
  function save(draft: RoleRecord): string | undefined {
    if (!access.canManageRoles || !access.isOwner && draft.kind !== 'member') return '您无权管理此类型的角色。';
    const old = roleRecords.value.find((role) => role.id === draft.id);
    if (old?.system || draft.system) return '系统默认角色不可编辑。';
    if (old && (!access.isOwner && old.kind !== 'member' || old.kind !== draft.kind)) return '角色类型不可修改。';
    if (draft.version && (!old || old.version !== draft.version)) return '角色已变化，请刷新后重新编辑。';
    const name = draft.name.trim();
    if (!name) return '请输入角色名称。';
    if (name === 'Owner' || roleRecords.value.some((role) => role.id !== draft.id && role.name.toLowerCase() === name.toLowerCase())) return '角色名称已存在。';
    if (!['admin', 'member'].includes(draft.kind)) return '请选择角色类型。';
    const error = permissionsError(draft.permissions, access.permissions);
    if (error) return error;
    const value = { ...draft, permissions: { ...draft.permissions }, name, version: (old?.version || 0) + 1, createdAt: old?.createdAt || new Date().toISOString() };
    const index = roleRecords.value.findIndex((role) => role.id === draft.id);
    if (index < 0) roleRecords.value.push(value); else roleRecords.value[index] = value;
  }
  function remove(id: string): string | undefined {
    const role = roleRecords.value.find((item) => item.id === id);
    if (!role) return '角色已删除。';
    if (!access.canManageRoles || !access.isOwner && role.kind !== 'member') return '您无权删除该角色。';
    if (role.system) return '系统默认角色不可删除。';
    if (count(id)) return '该角色仍有关联成员，请先调整成员角色。';
    roleRecords.value = roleRecords.value.filter((item) => item.id !== id);
  }
  return { visible, assignable, count, save, remove };
});
