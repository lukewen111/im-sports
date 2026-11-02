import type { Channel } from './channel-data';

import { computed, ref, watch } from 'vue';

import { defineStore } from 'pinia';

import { DEFAULT_TEAM_ID, normalizeTeamId } from '../team/team-constants';
import { useTeamStore } from '../team/team-store';
import { loadChannels, persistChannels } from './channel-data';

interface DeletedChannelSnapshot { deletedAt: string; id: string; name: string; teamId?: string; type: Channel['type'] }

const DELETED_CHANNELS_KEY = 'im-support-vben:deleted-channel-snapshots';
const DELETED_TEAMS_KEY = 'im-support-vben:deleted-team-ids';
const TEAM_MIGRATIONS_KEY = 'im-support-vben:team-migration-audit';

export const useChannelStore = defineStore('im-support-channels', () => {
  const teamStore = useTeamStore();
  const channels = ref<Channel[]>(loadChannels());
  const deletedChannelSnapshots = ref<DeletedChannelSnapshot[]>(JSON.parse(localStorage.getItem(DELETED_CHANNELS_KEY) || '[]'));
  watch(channels, persistChannels, { deep: true });
  watch(deletedChannelSnapshots, (value) => localStorage.setItem(DELETED_CHANNELS_KEY, JSON.stringify(value)), { deep: true });
  const validTeams = computed(() => teamStore.teams.map((team) => ({ accepting: teamStore.membersOf(team.id).some((member) => member.online), color: team.color, id: team.id, name: team.name, status: 'active' as const })));
  const findTeam = (id?: string) => validTeams.value.find((team) => team.id === id);
  const resolveTeam = (id?: string) => {
    const team = findTeam(id);
    return team?.status === 'active' ? team : findTeam(DEFAULT_TEAM_ID);
  };
  const hasChatPage = (teamId?: string, exceptId?: string) => channels.value.some((item) => item.type === 'chat-page' && item.teamId === teamId && item.id !== exceptId);
  const save = (channel: Channel) => {
    const index = channels.value.findIndex((item) => item.id === channel.id);
    const teamId = normalizeTeamId(channel.teamId);
    const value = { ...channel, chatPageUrl: channel.type === 'chat-page' ? `/chat/${teamId}` : channel.chatPageUrl, teamId, updatedAt: new Date().toISOString() };
    if (index === -1) channels.value.unshift(value); else channels.value[index] = value;
    return value;
  };
  const remove = (id: string) => {
    const channel = channels.value.find((item) => item.id === id);
    if (!channel) return;
    deletedChannelSnapshots.value.unshift({ deletedAt: new Date().toISOString(), id: channel.id, name: channel.name, teamId: channel.teamId, type: channel.type });
    channels.value = channels.value.filter((item) => item.id !== id);
  };
  const toggle = (id: string, enabled: boolean) => {
    const channel = channels.value.find((item) => item.id === id); if (!channel) return { error: '渠道不存在' };
    const team = findTeam(channel.teamId);
    if (enabled && (!team || team.status !== 'active')) return { error: '请先绑定有效接待团队' };
    channel.enabled = enabled; channel.updatedAt = new Date().toISOString(); return {};
  };
  const verifyTelegram = (token?: string, exceptId?: string) => {
    const value = token?.trim() ?? '';
    if (!/^\d+:\S+$/.test(value) || value.includes('invalid')) return { error: 'Bot Token无效，请检查后重试' };
    if (value.includes('offline')) return { error: '连接失败，请稍后重试' };
    if (value.includes('external')) return { error: '该 Bot 正被其他系统使用' };
    const botId = value.split(':')[0];
    if (channels.value.some((item) => item.type === 'telegram' && item.id !== exceptId && (item.telegramBotId || item.botToken?.split(':')[0]) === botId)) return { error: '该TG Bot已被其他渠道绑定' };
    return { botId };
  };
  const acknowledgeInstall = (id: string) => {
    const channel = channels.value.find((item) => item.id === id);
    if (channel?.type === 'web-widget') { channel.installStatus = 'success'; channel.installCheckedAt = new Date().toISOString(); }
  };
  const deleteTeamBindings = (teamId: string) => {
    const affected = channels.value.filter((item) => item.teamId === teamId);
    const chatPageIds = new Set(affected.filter((item) => item.type === 'chat-page').map((item) => item.id));
    const migratedChannelIds = new Set(affected.filter((item) => item.type !== 'chat-page').map((item) => item.id));
    affected.forEach((item) => {
      if (item.type === 'chat-page') remove(item.id);
      else save({ ...item, teamId: DEFAULT_TEAM_ID });
    });

    const audit: Array<Record<string, unknown>> = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith('im-support-vben:conversation:') || !key.endsWith(':meta')) continue;
      try {
        const meta = JSON.parse(localStorage.getItem(key) || 'null') as null | Record<string, unknown>;
        if (!meta || normalizeTeamId(String(meta.teamId || '')) !== teamId || meta.status !== 'active') continue;
        const channelId = [...chatPageIds, ...migratedChannelIds].find((id) => key.includes(`:${id}:`));
        if (!channelId) continue;
        const changedAt = new Date().toISOString();
        if (chatPageIds.has(channelId)) Object.assign(meta, { archivedAt: changedAt, closeReason: 'team-deleted', originalTeamId: teamId, status: 'ended' });
        else Object.assign(meta, { originalTeamId: teamId, reassignedAt: changedAt, teamId: DEFAULT_TEAM_ID });
        localStorage.setItem(key, JSON.stringify(meta));
        audit.push({ channelId, conversationId: meta.id, mode: chatPageIds.has(channelId) ? 'ended' : 'migrated', teamId, updatedAt: changedAt });
      } catch {
        // Ignore malformed local Mock records and leave them untouched.
      }
    }
    const deletedTeamIds = new Set<string>(JSON.parse(localStorage.getItem(DELETED_TEAMS_KEY) || '[]'));
    deletedTeamIds.add(teamId);
    localStorage.setItem(DELETED_TEAMS_KEY, JSON.stringify([...deletedTeamIds]));
    const history = JSON.parse(localStorage.getItem(TEAM_MIGRATIONS_KEY) || '[]') as Array<Record<string, unknown>>;
    localStorage.setItem(TEAM_MIGRATIONS_KEY, JSON.stringify([...audit, ...history]));
    return { endedChatPages: chatPageIds.size, migratedChannels: migratedChannelIds.size, updatedConversations: audit.length };
  };
  return { acknowledgeInstall, channels, deleteTeamBindings, deletedChannelSnapshots, findTeam, hasChatPage, remove, resolveTeam, save, toggle, validTeams, verifyTelegram };
});
