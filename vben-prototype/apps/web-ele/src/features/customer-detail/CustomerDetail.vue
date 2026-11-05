<script setup lang="ts">
import type { DemoCustomer, DemoSession } from '#/features/service/demo-store';

import { computed, ref } from 'vue';
import { ElCollapse } from 'element-plus';

import CustomerBasicInfo from './CustomerBasicInfo.vue';
import CustomerChatInfo from './CustomerChatInfo.vue';
import CustomerRecentSessions from './CustomerRecentSessions.vue';
import CustomerVisitInfo from './CustomerVisitInfo.vue';
import InfoSection from './InfoSection.vue';
import { detailIcons as icons } from './icons';
import { useCustomerDetail } from './useCustomerDetail';

const props = withDefaults(defineProps<{
  customer?: DemoCustomer;
  editable?: boolean;
  session?: DemoSession;
}>(), {
  customer: undefined,
  editable: false,
  session: undefined,
});

const open = defineModel<boolean>('open', { default: true });
const collapsed = defineModel<boolean>('collapsed', { default: false });

const emit = defineEmits<{
  select: [session: DemoSession];
}>();

const hook = useCustomerDetail();

// 折叠状态在组件生命周期内保持（切换会话不会重置）
const activeNames = ref<(number | string)[]>(['basic', 'chat', 'recent', 'visit']);

// 两页共用同一套区块：聊天信息永远展示当前会话；客户页未传时回退到该客户最近一次会话
const activeSession = computed(() => {
  if (props.session) return props.session;
  if (!props.customer) return undefined;
  return hook.sessionsOf(props.customer)[0];
});
</script>

<template>
  <aside
    v-if="open"
    class="customer-detail"
    :class="{ 'is-collapsed': collapsed }"
  >
    <button
      v-if="collapsed"
      type="button"
      class="strip"
      aria-label="展开客户详情"
      title="展开客户详情"
      @click="collapsed = false"
    >
      <i class="strip-icon">
        <component :is="icons.expand" :size="16" />
      </i>
    </button>

    <template v-else>
      <header class="panel-head">
        <span class="panel-title">客户详情</span>
        <div class="panel-actions">
          <button
            type="button"
            class="head-icon is-collapse"
            aria-label="收起客户详情"
            title="收起"
            @click="collapsed = true"
          >
            <component :is="icons.collapse" :size="16" />
          </button>
        </div>
      </header>

      <ElCollapse v-model="activeNames" class="detail-collapse">
        <InfoSection name="basic" title="基础信息" :icon="icons.user">
          <CustomerBasicInfo v-if="customer" :customer="customer" :editable="editable" />
        </InfoSection>

        <!-- 两页共用同一顺序：基础信息 → 聊天信息 → 近期会话 → 访问信息（PRD §1.3 / §5） -->
        <InfoSection v-if="activeSession" name="chat" title="聊天信息" :icon="icons.chat">
          <CustomerChatInfo :session="activeSession" />
        </InfoSection>

        <InfoSection name="recent" title="近期会话" :icon="icons.history">
          <CustomerRecentSessions
            v-if="customer"
            :customer="customer"
            :exclude-id="activeSession?.id"
            @select="emit('select', $event)"
          />
        </InfoSection>

        <InfoSection name="visit" title="访问信息" :icon="icons.source">
          <CustomerVisitInfo v-if="customer" :customer="customer" :session="activeSession" />
        </InfoSection>
      </ElCollapse>
    </template>
  </aside>
</template>

<style scoped>
.customer-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--line, #ececed);
  border-radius: 16px;
}

/* ---------- 收起后的 32px 窄条：只保留展开图标 ---------- */
.customer-detail.is-collapsed {
  padding: 0;
}
.strip {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 0;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.strip:hover {
  background: #f5f5f5;
}
.strip-icon {
  display: grid;
  width: 22px;
  height: 22px;
  place-items: center;
  color: #62626d;
}
.strip:hover .strip-icon {
  color: #131317;
}

/* ---------- 展开态 ---------- */
.panel-head {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  border-bottom: 1px solid var(--line, #ececed);
}
.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: #62626d;
}
.panel-actions {
  display: flex;
  gap: 4px;
  align-items: center;
}
.head-icon {
  display: grid;
  width: 24px;
  height: 24px;
  padding: 0;
  place-items: center;
  color: #62626d;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
}
.head-icon:hover {
  color: #131317;
  background: #f5f5f5;
}

.detail-collapse {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-top: 0;
  border-bottom: 0;
}
.detail-collapse :deep(.el-collapse-item) {
  border-top: 1px solid var(--line, #ececed);
}
.detail-collapse :deep(.el-collapse-item:first-child) {
  border-top: 0;
}
.detail-collapse :deep(.el-collapse-item__header) {
  display: flex;
  align-items: center;
  height: auto;
  padding: 12px 14px;
  font-size: 13px;
  font-weight: 600;
  color: #131317;
  background: transparent;
  border-bottom: 0;
}
.detail-collapse :deep(.el-collapse-item__arrow) {
  margin: 0 0 0 8px;
  color: #8c8c8e;
  font-size: 12px;
}
.detail-collapse :deep(.el-collapse-item__wrap) {
  background: transparent;
  border-bottom: 0;
}
.detail-collapse :deep(.el-collapse-item__content) {
  padding-bottom: 0;
  font-size: 12px;
  color: #131317;
}
</style>
