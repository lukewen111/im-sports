import type { Channel } from './channel-data';

import { computed, ref, watch } from 'vue';

import { defineStore } from 'pinia';

import { loadChannels, persistChannels, teams } from './channel-data';

interface DeletedChannelSnapshot { deletedAt: string; id: string; name: string; teamId?: string; type: Channel['type'] }

const DELETED_CHANNELS_KEY = 'im-support-vben:deleted-channel-snapshots';

export const useChannelStore = defineStore('im-support-channels', () => {
  const channels = ref<Channel[]>(loadChannels());
  const deletedChannelSnapshots = ref<DeletedChannelSnapshot[]>(JSON.parse(localStorage.getItem(DELETED_CHANNELS_KEY) || '[]'));
  watch(channels, persistChannels, { deep: true });
  watch(deletedChannelSnapshots, (value) => localStorage.setItem(DELETED_CHANNELS_KEY, JSON.stringify(value)), { deep: true });
  const validTeams = computed(() => teams.filter((team) => team.status === 'active'));
  const findTeam = (id?: string) => teams.find((team) => team.id === id);
  const resolveTeam = (id?: string) => {
    const team = findTeam(id);
    return team?.status === 'active' ? team : findTeam('team-default');
  };
  const hasChatPage = (teamId?: string, exceptId?: string) => channels.value.some((item) => item.type === 'chat-page' && item.teamId === teamId && item.id !== exceptId);
  const save = (channel: Channel) => {
    const index = channels.value.findIndex((item) => item.id === channel.id);
    const value = { ...channel, chatPageUrl: channel.type === 'chat-page' ? `/chat/${channel.teamId}` : channel.chatPageUrl, updatedAt: new Date().toISOString() };
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
    if (channels.value.some((item) => item.type === 'telegram' && item.id !== exceptId && item.botToken === value)) return { error: '该TG Bot已被其他渠道绑定' };
    return {};
  };
  const acknowledgeInstall = (id: string) => {
    const channel = channels.value.find((item) => item.id === id);
    if (channel?.type === 'web-widget') { channel.installStatus = 'success'; channel.installCheckedAt = new Date().toISOString(); }
  };
  return { acknowledgeInstall, channels, deletedChannelSnapshots, findTeam, hasChatPage, remove, resolveTeam, save, toggle, validTeams, verifyTelegram };
});
