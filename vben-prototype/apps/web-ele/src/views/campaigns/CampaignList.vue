<script setup lang="ts">
import type { ChannelType } from '#/features/channels/channel-data';
import type { Campaign, CampaignStatus } from '#/features/campaigns/campaign-data';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElMessage, ElMessageBox } from 'element-plus';
import { useCampaignStore } from '#/features/campaigns/campaign-store';
import { campaignStatus } from '#/features/campaigns/campaign-rules';
import { usePrototypeAccess } from '#/features/team/access-store';
import CampaignCard from './CampaignCard.vue';

const props = defineProps<{ type: ChannelType }>();
const emit = defineEmits<{ create: []; 'open-history': [] }>();

const store = useCampaignStore();
const access = usePrototypeAccess();
const route = useRoute();
const router = useRouter();

function ensureAccess() {
  if (access.canVisit('/campaigns')) return true;
  ElMessage.warning('活动权限已被收回，无法继续操作');
  void router.replace(access.home);
  return false;
}

function openCreate() {
  if (ensureAccess()) emit('create');
}

const filter = ref<'all' | CampaignStatus>('all');
const listFailed = ref(route.query.listError === '1');

const campaigns = computed(() => [...store.campaignsOf(props.type)].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
const counts = computed(() => {
  const result: Record<'all' | CampaignStatus, number> = { all: campaigns.value.length, active: 0, paused: 0, expired: 0 };
  for (const campaign of campaigns.value) result[campaignStatus(campaign)] += 1;
  return result;
});
const filters = computed(() => [
  { key: 'all' as const, label: '全部' },
  { key: 'active' as const, label: '进行中' },
  { key: 'paused' as const, label: '已暂停' },
  { key: 'expired' as const, label: '已过期' },
]);
const visible = computed(() => (filter.value === 'all' ? campaigns.value : campaigns.value.filter((campaign) => campaignStatus(campaign) === filter.value)));

function toggle(campaign: Campaign, value: boolean) {
  if (!ensureAccess()) return;
  const result = store.toggle(campaign.id, value);
  if (result.error) ElMessage.warning(result.error);
}

function run(campaign: Campaign) {
  if (!ensureAccess()) return;
  const result = store.runNow(campaign.id);
  if (result.error) {
    ElMessage.warning(result.error);
    return;
  }
  ElMessage.success('活动已开始运行，可在运行历史查看进度');
  emit('open-history');
}

function edit(campaign: Campaign) {
  if (!ensureAccess()) return;
  void router.push(`/campaigns/${props.type}/edit/${campaign.id}`);
}

function remove(campaign: Campaign) {
  if (!ensureAccess()) return;
  void ElMessageBox.confirm(`确认删除活动「${campaign.name}」？删除后运行历史仍会保留至 365 天。`, '删除活动', {
    cancelButtonText: '取消',
    confirmButtonText: '删除',
    type: 'warning',
  })
    .then(() => {
      const result = store.remove(campaign.id);
      if (result.error) ElMessage.warning(result.error);
      else ElMessage.success('活动已删除');
    })
    .catch(() => {});
}
</script>

<template>
  <div class="campaigns-pane">
    <div v-if="listFailed" class="campaigns-banner">
      <span>列表加载失败，已保留当前查询条件和已有数据。</span>
      <ElButton class="ui-btn-outline" @click="listFailed = false">重试</ElButton>
    </div>

    <div class="campaigns-toolbar">
      <button
        v-for="item in filters"
        :key="item.key"
        type="button"
        class="campaign-filter"
        :class="{ 'is-active': filter === item.key }"
        @click="filter = item.key"
      >
        {{ item.label }}
        <span class="campaign-filter-count">{{ counts[item.key] }}</span>
      </button>
    </div>

    <div class="campaigns-scroll">
      <div v-if="campaigns.length === 0" class="ui-empty">
        <strong>暂未创建活动</strong>
        <span>创建活动后，可向符合条件的客户批量发送消息。</span>
        <ElButton class="ui-btn-outline" @click="openCreate">创建活动</ElButton>
      </div>
      <div v-else-if="visible.length === 0" class="ui-empty">
        <strong>当前筛选下暂无活动</strong>
        <span>试试切换状态筛选条件。</span>
      </div>
      <div v-else class="campaign-grid">
        <CampaignCard
          v-for="campaign in visible"
          :key="campaign.id"
          :campaign="campaign"
          @edit="edit(campaign)"
          @remove="remove(campaign)"
          @run="run(campaign)"
          @toggle="(value) => toggle(campaign, value)"
        />
      </div>
    </div>
  </div>
</template>
