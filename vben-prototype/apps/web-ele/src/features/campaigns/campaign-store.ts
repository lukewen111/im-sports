import type { Channel, ChannelType } from '#/features/channels/channel-data';
import type { TeamMember } from '#/features/team/team-store';
import type { Campaign, CampaignRun } from './campaign-data';

import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useChannelStore } from '#/features/channels/channel-store';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { useTeamStore } from '#/features/team/team-store';
import { CAMPAIGN_STORAGE_KEY } from './campaign-data';
import { campaignInvalidReason, candidateCustomerCount, campaignStatus } from './campaign-rules';
import { seedCampaigns, seedCampaignRuns } from './campaign-seed';

export type CampaignInput = Omit<Campaign, 'createdAt' | 'expired' | 'id' | 'updatedAt'> & { expired?: boolean };

interface PersistedState {
  campaigns: Campaign[];
  runs: CampaignRun[];
}

interface Result<T = undefined> {
  data?: T;
  error?: string;
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (Array.isArray(parsed.campaigns) && Array.isArray(parsed.runs)) {
        // 旧演示数据修正：「运行中」但缺少 startedAt 的记录转为错过计划的失败记录
        const staleRun = parsed.runs.find((run) => run.id === 'run-telegram-4' && run.status === 'running' && !run.startedAt);
        if (staleRun) {
          Object.assign(staleRun, { durationSec: 0, plannedAt: '2026-11-20T12:00:00.000Z', startedAt: undefined, status: 'failed' });
          localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      }
    }
  } catch {
    // 使用内置演示数据
  }
  return { campaigns: structuredClone(seedCampaigns), runs: structuredClone(seedCampaignRuns) };
}

export const useCampaignStore = defineStore('im-support-campaigns', () => {
  const channelStore = useChannelStore();
  const teamStore = useTeamStore();
  const demoStore = useDemoServiceStore();

  const initial = load();
  const campaigns = ref<Campaign[]>(initial.campaigns);
  const runs = ref<CampaignRun[]>(initial.runs);
  /** 仅用于「运行中」耗时逐秒刷新 */
  const tick = ref(Date.now());
  window.setInterval(() => {
    if (runs.value.some((run) => run.status === 'running' && run.startedAt)) tick.value = Date.now();
  }, 1000);

  const stamp = () => new Date().toISOString();
  const persist = () => {
    try {
      localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify({ campaigns: campaigns.value, runs: runs.value }));
    } catch {
      // 演示环境本地配额不足时保留内存态，不阻断页面操作
    }
  };
  watch([campaigns, runs], persist, { deep: true });

  const channelOf = (id: string): Channel | undefined => channelStore.channels.find((channel) => channel.id === id);
  const senderOf = (id: string): TeamMember | undefined => teamStore.members.find((member) => member.id === id);

  function invalidReasonFor(campaign: Campaign): string | undefined {
    const channel = channelOf(campaign.channelId);
    const teamExists = Boolean(channel?.teamId && teamStore.teams.some((team) => team.id === channel.teamId));
    return campaignInvalidReason(campaign, channel, senderOf(campaign.senderId), teamExists);
  }

  function campaignsOf(type: ChannelType) {
    return campaigns.value.filter((campaign) => campaign.type === type);
  }

  function runsOf(type: ChannelType) {
    return runs.value.filter((run) => run.type === type);
  }

  function isRunning(campaignId: string) {
    return runs.value.some((run) => run.campaignId === campaignId && run.status === 'running' && run.startedAt);
  }

  function channelOptions(type: ChannelType) {
    return channelStore.channels.filter((channel) => channel.type === type && channel.enabled);
  }

  function senderOptions(channelId: string) {
    const channel = channelOf(channelId);
    if (!channel?.teamId) return [];
    return teamStore.membersOf(channel.teamId).filter((member) => (member.kind === 'ai' ? member.exception !== 'agent' : member.enabled !== false));
  }

  function create(input: CampaignInput): Result<Campaign> {
    const name = input.name.trim();
    if (campaigns.value.some((campaign) => campaign.type === input.type && campaign.name === name)) return { error: '同一渠道类型下活动名称不可重复' };
    const campaign: Campaign = {
      ...input,
      name,
      createdAt: stamp(),
      expired: Boolean(input.expired),
      id: `campaign-${input.type}-${Date.now()}`,
      updatedAt: stamp(),
    };
    campaigns.value.unshift(campaign);
    return { data: campaign };
  }

  function update(id: string, input: CampaignInput): Result<Campaign> {
    const campaign = campaigns.value.find((item) => item.id === id);
    if (!campaign) return { error: '活动不存在或已被删除' };
    const name = input.name.trim();
    if (campaigns.value.some((item) => item.type === campaign.type && item.id !== id && item.name === name)) return { error: '同一渠道类型下活动名称不可重复' };
    const wasExpired = campaignStatus(campaign) === 'expired';
    const nextExpired = input.repeat === 'once' ? Boolean(input.expired) : false;
    Object.assign(campaign, input, {
      name,
      expired: nextExpired,
      updatedAt: stamp(),
      // 已过期活动重新配置有效计划后恢复为已暂停，需操作者手动启用
      enabled: wasExpired && !nextExpired ? false : input.enabled,
    });
    return { data: campaign };
  }

  function remove(id: string): Result {
    if (isRunning(id)) return { error: '活动正在运行中，暂时无法删除' };
    campaigns.value = campaigns.value.filter((campaign) => campaign.id !== id);
    return {};
  }

  function toggle(id: string, enabled: boolean): Result {
    const campaign = campaigns.value.find((item) => item.id === id);
    if (!campaign) return { error: '活动不存在或已被删除' };
    if (enabled && campaignStatus(campaign) === 'expired') return { error: '活动已过期，无法启用' };
    if (enabled && invalidReasonFor(campaign)) return { error: '活动配置已失效，请先修正后再启用' };
    campaign.enabled = enabled;
    campaign.updatedAt = stamp();
    return {};
  }

  function runNow(id: string): Result<CampaignRun> {
    const campaign = campaigns.value.find((item) => item.id === id);
    if (!campaign) return { error: '活动不存在或已被删除' };
    if (campaignStatus(campaign) === 'expired') return { error: '活动已过期，无法运行' };
    if (invalidReasonFor(campaign)) return { error: '活动配置已失效，请修正后重试' };
    if (isRunning(id)) return { error: '活动正在运行中，请稍后再试' };

    const targets = candidateCustomerCount(demoStore.sessions, campaign.channelId);
    // 运行开始后编辑活动只影响后续运行，因此消息规模在启动时固定
    const messagesPerCustomer = campaign.imageUrl ? 2 : 1;
    const run: CampaignRun = {
      id: `run-${Date.now()}`,
      campaignId: campaign.id,
      type: campaign.type,
      snapshotName: campaign.name,
      status: 'running',
      sentCustomers: 0,
      successMessages: 0,
      failedMessages: 0,
      startedAt: stamp(),
      durationSec: 0,
    };
    runs.value.unshift(run);

    // 演示用短暂推进：仅内存态，不做真实调度；运行期间按分片累加统计
    const messages = targets * messagesPerCustomer;
    const failed = targets > 0 ? Math.min(messages, campaign.imageUrl && targets >= 5 ? 3 : 0) : 0;
    const finalSuccess = messages - failed;
    const timer = window.setInterval(() => {
      const current = runs.value.find((item) => item.id === run.id);
      if (!current || current.status !== 'running') {
        window.clearInterval(timer);
        return;
      }
      const elapsed = Date.now() - new Date(run.startedAt || Date.now()).getTime();
      const progress = Math.min(1, Math.max(0, elapsed / 2600));
      current.sentCustomers = Math.floor(targets * progress);
      current.successMessages = Math.floor(finalSuccess * progress);
      current.failedMessages = Math.floor(failed * progress);
    }, 250);

    window.setTimeout(() => {
      window.clearInterval(timer);
      const current = runs.value.find((item) => item.id === run.id);
      if (!current) return;
      current.sentCustomers = targets;
      current.successMessages = finalSuccess;
      current.failedMessages = failed;
      current.durationSec = 3;
      current.status = messages > 0 && current.successMessages === 0 ? 'failed' : 'success';
      if (campaign.repeat === 'once') {
        const target = campaigns.value.find((item) => item.id === campaign.id);
        if (target) {
          target.expired = true;
          target.updatedAt = stamp();
        }
      }
    }, 2600);

    return { data: run };
  }

  // 渠道或发送者配置失效时自动暂停，恢复后也不自动启用
  watch(
    [() => channelStore.channels, () => teamStore.members, () => teamStore.teams],
    () => {
      for (const campaign of campaigns.value) {
        if (!campaign.enabled) continue;
        if (invalidReasonFor(campaign)) {
          campaign.enabled = false;
          campaign.updatedAt = stamp();
        }
      }
    },
    { deep: true, immediate: true },
  );

  const runningTick = computed(() => tick.value);

  return {
    campaigns,
    runs,
    runningTick,
    campaignsOf,
    channelOf,
    channelOptions,
    create,
    invalidReasonFor,
    isRunning,
    remove,
    runNow,
    runsOf,
    senderOf,
    senderOptions,
    toggle,
    update,
  };
});
