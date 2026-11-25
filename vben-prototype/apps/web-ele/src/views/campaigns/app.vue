<script setup lang="ts">
import type { CampaignType } from '#/features/campaigns/campaign-data';

import { computed, watch, watchEffect } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElButton, ElMessage, ElTabPane, ElTabs, ElTooltip } from 'element-plus';
import QIcon from '#/components/q-icon/QIcon.vue';
import ChannelGlyph from '#/views/channels/ChannelGlyph.vue';
import { campaignTypeLabels, campaignTypes } from '#/features/campaigns/campaign-data';
import { useCampaignStore } from '#/features/campaigns/campaign-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import CampaignList from './CampaignList.vue';
import CampaignEditor from './CampaignEditor.vue';
import CampaignHistory from './CampaignHistory.vue';

const route = useRoute();
const router = useRouter();
const access = usePrototypeAccess();
const store = useCampaignStore();

watch(
  () => access.canVisit('/campaigns'),
  (allowed) => {
    if (allowed) return;
    ElMessage.warning('活动权限已被收回，已退出活动模块');
    void router.replace(access.home);
  },
  { immediate: true },
);

const currentType = computed<CampaignType>(() => {
  const value = String(route.params.type || '');
  return (campaignTypes as string[]).includes(value) ? (value as CampaignType) : 'web-widget';
});

watchEffect(() => {
  const value = String(route.params.type || '');
  if (!(campaignTypes as string[]).includes(value)) void router.replace('/campaigns/web-widget');
});

const isEditor = computed(() => route.name === 'CampaignCreate' || route.name === 'CampaignEdit');
const activeTab = computed(() => (route.query.tab === 'history' ? 'history' : 'activities'));
const editorTitle = computed(() => (route.name === 'CampaignCreate' ? '创建活动' : '编辑活动'));
const sdkLimitReached = computed(() => currentType.value === 'sdk' && !isEditor.value && store.sdkCampaignCount >= 1);

function switchType(type: CampaignType) {
  if (type === currentType.value && !isEditor.value) return;
  void router.push(`/campaigns/${type}`);
}

function switchTab(name: string | number) {
  void router.replace({ path: route.path, query: name === 'history' ? { tab: 'history' } : {} });
}

function openCreate() {
  if (!access.canVisit('/campaigns')) {
    ElMessage.warning('活动权限已被收回，无法创建活动');
    void router.replace(access.home);
    return;
  }
  if (currentType.value === 'sdk' && store.sdkCampaignCount >= 1) {
    ElMessage.warning('SDK 最多创建 1 个活动');
    return;
  }
  void router.push(`/campaigns/${currentType.value}/create`);
}

function openHistory() {
  void router.replace({ path: route.path, query: { tab: 'history' } });
}

function backToList() {
  void router.push(`/campaigns/${currentType.value}`);
}
</script>

<template>
  <section class="campaigns-page">
    <div class="campaigns-layout" :class="{ 'is-editor': isEditor }">
      <aside v-if="!isEditor" class="campaigns-subnav">
        <div class="campaigns-subnav-title">活动</div>
        <button
          v-for="type in campaignTypes"
          :key="type"
          type="button"
          :class="{ 'is-active': currentType === type }"
          @click="switchType(type)"
        >
          <ChannelGlyph :type="type" />
          <span>{{ campaignTypeLabels[type] }}</span>
        </button>
      </aside>

      <main class="campaigns-main">
        <template v-if="isEditor">
          <header class="campaigns-panel-header">
            <div class="campaigns-header-actions">
              <button class="campaign-icon-button" type="button" :aria-label="`返回${campaignTypeLabels[currentType]}活动列表`" @click="backToList">
                <QIcon name="arrow-left" :size="18" />
              </button>
              <h1>{{ editorTitle }}</h1>
            </div>
          </header>
          <CampaignEditor
            :type="currentType"
            :campaign-id="String(route.params.id || '')"
            @cancel="backToList"
            @saved="backToList"
          />
        </template>

        <template v-else>
          <div class="campaigns-list-panel">
            <ElTabs :model-value="activeTab" class="campaigns-tabs" @tab-change="switchTab">
              <ElTabPane label="活动" name="activities">
                <CampaignList :type="currentType" @create="openCreate" @open-history="openHistory" />
              </ElTabPane>
              <ElTabPane label="运行历史" name="history">
                <CampaignHistory :type="currentType" />
              </ElTabPane>
            </ElTabs>
            <ElTooltip content="SDK 最多创建 1 个活动" placement="top" :disabled="!sdkLimitReached">
              <span class="campaigns-create-wrap">
                <ElButton
                  v-if="activeTab === 'activities'"
                  type="primary"
                  class="ui-btn-primary campaigns-create-button"
                  :disabled="sdkLimitReached"
                  @click="openCreate"
                >
                  <QIcon name="plus" :size="16" />
                  创建活动
                </ElButton>
              </span>
            </ElTooltip>
          </div>
        </template>
      </main>
    </div>
  </section>
</template>
