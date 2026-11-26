import type { Channel } from '#/features/channels/channel-data';
import type { Campaign, CampaignRun, CampaignType } from './campaign-data';

import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useChannelStore } from '#/features/channels/channel-store';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { CAMPAIGN_STORAGE_KEY, supportsBrowserPush } from './campaign-data';
import { browserEligibleTargets, campaignInvalidReason, candidateCustomers, campaignStatus } from './campaign-rules';
import { seedCampaigns, seedCampaignRuns } from './campaign-seed';
import { loadSubscriptions } from './campaign-subscription';

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
        let changed = false;
        // 旧演示数据迁移：单渠道 channelId 转为多渠道 channelIds
        for (const campaign of parsed.campaigns) {
          const legacy = campaign as Campaign & { channelId?: string };
          if (!Array.isArray(legacy.channelIds)) {
            legacy.channelIds = legacy.channelId ? [legacy.channelId] : [];
            changed = true;
          }
          if (legacy.channelId !== undefined) {
            delete legacy.channelId;
            changed = true;
          }
          // 已下线的发送者字段与 SDK 分类：清理旧数据，避免遗留配置影响页面
          if ('senderId' in campaign) {
            delete (campaign as Campaign & { senderId?: string }).senderId;
            changed = true;
          }
          // 浏览器通知字段迁移：旧活动补齐默认值，标题留空以便编辑时补填
          if (typeof (campaign as Partial<Campaign>).notificationTitle !== 'string') {
            campaign.notificationTitle = '';
            changed = true;
          }
          if (campaign.notificationLinkMode !== 'channel' && campaign.notificationLinkMode !== 'custom') {
            campaign.notificationLinkMode = 'channel';
            changed = true;
          }
        }
        const legacyCampaignCount = parsed.campaigns.length;
        const legacyRunCount = parsed.runs.length;
        parsed.campaigns = parsed.campaigns.filter((campaign) => campaign.type !== ('sdk' as CampaignType));
        parsed.runs = parsed.runs.filter((run) => run.type !== ('sdk' as CampaignType));
        if (parsed.campaigns.length !== legacyCampaignCount || parsed.runs.length !== legacyRunCount) changed = true;
        // 旧演示数据修正：「运行中」但缺少 startedAt 的记录转为错过计划的失败记录
        const staleRun = parsed.runs.find((run) => run.id === 'run-telegram-4' && run.status === 'running' && !run.startedAt);
        if (staleRun) {
          Object.assign(staleRun, { durationSec: 0, plannedAt: '2026-11-20T12:00:00.000Z', startedAt: undefined, status: 'failed' });
          changed = true;
        }
        // 旧演示数据修正：已实际开始且零目标的运行应为成功，而不是失败
        for (const run of parsed.runs) {
          if (run.status === 'failed' && run.startedAt && run.targetCustomers === 0) {
            run.status = 'success';
            changed = true;
          }
        }
        if (changed) localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(parsed));
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

  function invalidReasonFor(campaign: Campaign): string | undefined {
    return campaignInvalidReason(campaign.channelIds.map((id) => channelOf(id)));
  }

  function campaignsOf(type: CampaignType) {
    return campaigns.value.filter((campaign) => campaign.type === type);
  }

  function runsOf(type: CampaignType) {
    return runs.value.filter((run) => run.type === type);
  }

  function isRunning(campaignId: string) {
    return runs.value.some((run) => run.campaignId === campaignId && run.status === 'running' && run.startedAt);
  }

  function channelOptions(type: CampaignType) {
    return channelStore.channels.filter((channel) => channel.type === type && channel.enabled);
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
    if (input.type !== campaign.type) return { error: '活动所属渠道类型不可变更' };
    const name = input.name.trim();
    if (campaigns.value.some((item) => item.type === campaign.type && item.id !== id && item.name === name)) return { error: '同一渠道类型下活动名称不可重复' };
    const wasExpired = campaignStatus(campaign) === 'expired';
    // 单次活动的过期标记只在计划时间变化时重置；仅改名/改消息不应恢复已过期活动
    const planChanged = campaign.repeat !== input.repeat
      || campaign.date !== input.date
      || campaign.time !== input.time
      || campaign.timezone !== input.timezone;
    const nextExpired = input.repeat === 'once' ? (planChanged ? false : Boolean(campaign.expired)) : false;
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

    const targets = candidateCustomers(demoStore.sessions, campaign.channelIds);
    const targetCustomers = targets.length;
    // 网页渠道额外统计浏览器推送，Telegram 不适用（null 展示为 —）
    const web = supportsBrowserPush(campaign.type);
    const browserTargets = web
      ? browserEligibleTargets(targets, channelStore.channels, loadSubscriptions(demoStore.sessions, channelStore.channels), campaign)
      : [];
    const browserTargetCustomers = web ? browserTargets.length : null;

    // 运行开始后编辑活动只影响后续运行，因此消息规模在启动时固定
    const messagesPerCustomer = campaign.imageUrl ? 2 : 1;
    const messages = targetCustomers * messagesPerCustomer;
    const failedMessages = targetCustomers > 0 ? Math.min(messages, campaign.imageUrl && targetCustomers >= 5 ? 3 : 0) : 0;
    const successMessages = messages - failedMessages;
    const browserFailed = browserTargetCustomers !== null && browserTargetCustomers >= 10 ? Math.max(1, Math.floor(browserTargetCustomers * 0.05)) : 0;
    const browserSuccess = browserTargetCustomers === null ? null : browserTargetCustomers - browserFailed;
    // 发送客户数：任一方式至少成功一次的客户去重数，不能超过目标客户数
    const finalSentCustomers = Math.min(targetCustomers, successMessages + (browserSuccess ?? 0));

    const run: CampaignRun = {
      id: `run-${Date.now()}`,
      campaignId: campaign.id,
      type: campaign.type,
      snapshotName: campaign.name,
      status: 'running',
      targetCustomers,
      browserTargetCustomers,
      sentCustomers: 0,
      successMessages: 0,
      failedMessages: 0,
      browserSuccess: browserTargetCustomers === null ? null : 0,
      browserFailed: browserTargetCustomers === null ? null : 0,
      startedAt: stamp(),
      durationSec: 0,
    };
    runs.value.unshift(run);

    // 演示用短暂推进：仅内存态，不做真实调度；运行期间按分片累加统计
    const timer = window.setInterval(() => {
      const current = runs.value.find((item) => item.id === run.id);
      if (!current || current.status !== 'running') {
        window.clearInterval(timer);
        return;
      }
      const elapsed = Date.now() - new Date(run.startedAt || Date.now()).getTime();
      const progress = Math.min(1, Math.max(0, elapsed / 2600));
      current.sentCustomers = Math.floor(finalSentCustomers * progress);
      current.successMessages = Math.floor(successMessages * progress);
      current.failedMessages = Math.floor(failedMessages * progress);
      if (browserTargetCustomers !== null) {
        current.browserSuccess = Math.floor((browserSuccess ?? 0) * progress);
        current.browserFailed = Math.floor(browserFailed * progress);
      }
    }, 250);

    window.setTimeout(() => {
      window.clearInterval(timer);
      const current = runs.value.find((item) => item.id === run.id);
      if (!current) return;
      current.targetCustomers = targetCustomers;
      current.browserTargetCustomers = browserTargetCustomers;
      current.sentCustomers = finalSentCustomers;
      current.successMessages = successMessages;
      current.failedMessages = failedMessages;
      current.browserSuccess = browserTargetCustomers === null ? null : browserSuccess;
      current.browserFailed = browserTargetCustomers === null ? null : browserFailed;
      current.durationSec = 3;
      const anySuccess = successMessages > 0 || (browserSuccess ?? 0) > 0;
      const hasFailure = failedMessages > 0 || browserFailed > 0;
      // 零目标或全部正常跳过视为成功；有失败且无任何成功视为失败
      current.status = targetCustomers === 0 || anySuccess || !hasFailure ? 'success' : 'failed';
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

  // 渠道配置失效时自动暂停，恢复后也不自动启用
  watch(
    () => channelStore.channels,
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
    toggle,
    update,
  };
});
