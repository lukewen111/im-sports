import type { TeamMember } from './team-store';
import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { emptyPermissions, findRole, fullPermissions } from './role-catalog';
import { useTeamStore } from './team-store';

export const usePrototypeAccess = defineStore('prototype-access', () => {
  const team = useTeamStore();
  const currentId = ref(localStorage.getItem('im-support-vben:current-member') || 'member-owner');
  const current = computed(() => team.humans.find((member) => member.id === currentId.value && member.enabled));
  const isOwner = computed(() => current.value?.role === 'Owner');
  const isAdmin = computed(() => isOwner.value || findRole(current.value?.role || '')?.kind === 'admin');
  const permissions = computed(() => !current.value ? emptyPermissions() : isOwner.value ? fullPermissions() : findRole(current.value.role)?.permissions || emptyPermissions());
  const canManageRoles = computed(() => Boolean(current.value && isAdmin.value));
  const visibleTeams = computed(() => team.teams.filter((item) => permissions.value.teamScope === 'all' || current.value?.teamIds.includes(item.id)));
  const visibleMembers = computed(() => team.members.filter((member) => (member.kind === 'ai' ? permissions.value.ai : permissions.value.humans) && (permissions.value.teamScope === 'all' || member.teamIds.some((id) => current.value?.teamIds.includes(id)))));
  const teamEntry = computed(() => permissions.value.humans || permissions.value.ai ? '/team/members/all' : permissions.value.teams ? '/team/teams' : canManageRoles.value ? '/team/roles' : '');
  const home = computed(() => permissions.value.assigned !== 'none' || permissions.value.pending ? '/inbox' : permissions.value.customers !== 'none' ? '/customers' : teamEntry.value || (permissions.value.channels ? '/channels' : permissions.value.settings ? '/settings/reception/auto-message' : '/personal'));
  function canManageMember(member?: TeamMember, kind: 'ai' | 'human' = 'human') {
    const feature = (member?.kind || kind) === 'ai' ? permissions.value.ai : permissions.value.humans;
    return Boolean(isAdmin.value && feature && (!member || (!member.protected || isOwner.value) && (permissions.value.teamScope === 'all' || member.teamIds.every((id) => current.value?.teamIds.includes(id)))));
  }
  function canVisit(path: string) {
    const p = permissions.value;
    if (path.startsWith('/widget/') || path.startsWith('/chat/') || path.startsWith('/auth/')) return true;
    if (!current.value) return false;
    if (path.startsWith('/team/roles')) return canManageRoles.value;
    if (path.startsWith('/team/members/ai')) return p.ai;
    if (path.startsWith('/team/members/human')) return p.humans;
    if (path.startsWith('/team/members')) return p.humans || p.ai;
    if (path.startsWith('/team/teams')) return p.teams;
    if (path.startsWith('/channels')) return p.channels;
    if (path.startsWith('/inbox')) return p.assigned !== 'none' || p.pending;
    if (path.startsWith('/customers')) return p.customers !== 'none';
    if (path.startsWith('/settings')) return p.settings;
    if (path.startsWith('/reception')) return p.settings;
    return true;
  }
  watch(currentId, (id) => localStorage.setItem('im-support-vben:current-member', id));
  return { currentId, current, isOwner, isAdmin, permissions, canManageRoles, visibleTeams, visibleMembers, teamEntry, home, canManageMember, canVisit };
});
