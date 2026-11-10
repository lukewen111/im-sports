<script setup lang="ts">
import type { DemoCustomer, DemoSession } from '#/features/service/demo-store';

import { computed, ref } from 'vue';
import { ElCollapse, ElTooltip } from 'element-plus';

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

type DetailTab = 'business' | 'customer';
const tab = ref<DetailTab>('business');

function openTab(next: DetailTab) {
  tab.value = next;
  collapsed.value = false;
}

// 折叠状态在组件生命周期内保持（切换会话不会重置）
const activeNames = ref<(number | string)[]>(['basic', 'chat', 'recent', 'visit']);

// 两页共用同一套区块：聊天信息永远展示当前会话；客户页未传时回退到该客户最近一次会话
const activeSession = computed(() => {
  if (props.session) return props.session;
  if (!props.customer) return undefined;
  return hook.sessionsOf(props.customer)[0];
});

/* ---------------- 业务信息（只读演示数据，不接 store） ---------------- */
interface BusinessInfo {
  agentLine: string;
  platform: string;
  playerAccount: string;
  playerId: string;
  recharge: string;
  total: string;
  vipLevel: string;
  withdraw: string;
  withdrawable: string;
  withheld: string;
}

const EMPTY_BUSINESS: BusinessInfo = {
  agentLine: '', platform: '', playerAccount: '', playerId: '', recharge: '', total: '', vipLevel: '', withdraw: '', withdrawable: '', withheld: '',
};

const PLATFORMS = ['IM Sports', 'IMS Gaming'];
const PLAYER_ACCOUNT_BASE = 91_794_094_134;
const round = (value: number) => Math.round(value * 100) / 100;
/** 金额统一千分位 + 两位小数 */
const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 演示数据按客户 ID 稳定生成，同一客户刷新后不变，不同客户数值差异明显；
 * 金额关系保持自洽：充值统计 − 提现统计 = 总额 = 不可提现余额 + 可提现余额。
 */
const business = computed<BusinessInfo>(() => {
  const digits = props.customer?.id.replace(/\D/g, '') || '';
  const seed = Math.abs(Number(digits));
  if (!seed) return EMPTY_BUSINESS;
  const recharge = round(30_000 + (seed % 900) * 211 + (seed % 97) / 100);
  const withdraw = round(recharge * (0.35 + (seed % 25) / 100));
  const total = round(recharge - withdraw);
  const withheld = round(total * (0.1 + (seed % 17) / 100));
  return {
    agentLine: `AG-${1000 + (seed % 9000)}`,
    platform: PLATFORMS[seed % PLATFORMS.length] ?? 'IM Sports',
    playerAccount: `mmhl${PLAYER_ACCOUNT_BASE + seed}`,
    playerId: digits,
    recharge: money(recharge),
    total: money(total),
    vipLevel: `VIP ${(seed % 8) + 1}`,
    withdraw: money(withdraw),
    withdrawable: money(round(total - withheld)),
    withheld: money(withheld),
  };
});

/** 无值统一显示「-」，不隐藏整行 */
const show = (value: string) => value || '-';

interface BusinessField {
  copy: boolean;
  label: string;
  rawValue: string;
  value: string;
  /** 值可能较长，独占一行展示，避免被压缩或省略 */
  wide?: boolean;
}

function copyBusinessField(value: string, label: string) {
  if (!value) return;
  void hook.copyText(value, label);
}

const businessGroups = computed<{ fields: BusinessField[]; title: string }[]>(() => [
  {
    title: '基础信息',
    fields: [
      { copy: true, label: '玩家账号', rawValue: business.value.playerAccount, value: show(business.value.playerAccount), wide: true },
      { copy: true, label: '玩家 ID', rawValue: business.value.playerId, value: show(business.value.playerId), wide: true },
      { copy: false, label: 'VIP 等级', rawValue: business.value.vipLevel, value: show(business.value.vipLevel) },
    ],
  },
  {
    title: '平台信息',
    fields: [
      { copy: false, label: '平台', rawValue: business.value.platform, value: show(business.value.platform) },
      { copy: false, label: '代理线', rawValue: business.value.agentLine, value: show(business.value.agentLine) },
      { copy: false, label: '充值统计', rawValue: business.value.recharge, value: show(business.value.recharge) },
      { copy: false, label: '提现统计', rawValue: business.value.withdraw, value: show(business.value.withdraw) },
      { copy: false, label: '总额', rawValue: business.value.total, value: show(business.value.total) },
      { copy: false, label: '不可提现余额', rawValue: business.value.withheld, value: show(business.value.withheld) },
      { copy: false, label: '可提现余额', rawValue: business.value.withdrawable, value: show(business.value.withdrawable) },
    ],
  },
]);
</script>

<template>
  <aside
    v-if="open"
    class="customer-detail"
    :class="{ 'is-collapsed': collapsed }"
  >
    <div v-if="collapsed" class="strip">
      <button
        type="button"
        class="strip-btn"
        aria-label="展开"
        title="展开"
        @click="collapsed = false"
      >
        <component :is="icons.expand" :size="16" />
      </button>
      <button
        type="button"
        class="strip-btn"
        aria-label="业务信息"
        title="业务信息"
        @click="openTab('business')"
      >
        <component :is="icons.tag" :size="16" />
      </button>
      <button
        type="button"
        class="strip-btn"
        aria-label="客户信息"
        title="客户信息"
        @click="openTab('customer')"
      >
        <component :is="icons.user" :size="16" />
      </button>
    </div>

    <template v-else>
      <header class="panel-head">
        <div class="panel-tabs">
          <ElTooltip content="业务信息" placement="bottom">
            <button
              type="button"
              class="panel-tab"
              :class="{ active: tab === 'business' }"
              aria-label="业务信息"
              @click="tab = 'business'"
            >
              <component :is="icons.tag" :size="16" />
            </button>
          </ElTooltip>
          <ElTooltip content="客户信息" placement="bottom">
            <button
              type="button"
              class="panel-tab"
              :class="{ active: tab === 'customer' }"
              aria-label="客户信息"
              @click="tab = 'customer'"
            >
              <component :is="icons.user" :size="16" />
            </button>
          </ElTooltip>
        </div>
        <button
          type="button"
          class="head-icon is-collapse"
          aria-label="收起"
          title="收起"
          @click="collapsed = true"
        >
          <component :is="icons.collapse" :size="16" />
        </button>
      </header>

      <div v-if="tab === 'business'" class="panel-body business-info">
        <section v-for="group in businessGroups" :key="group.title" class="business-group">
          <h3 class="business-title">{{ group.title }}</h3>
          <div class="business-grid">
            <div v-for="field in group.fields" :key="field.label" class="business-field" :class="{ 'is-wide': field.wide }">
              <span class="business-label">{{ field.label }}</span>
              <span class="business-value-row">
                <span class="business-value" :class="{ 'is-empty': field.value === '-' }">{{ field.value }}</span>
                <ElTooltip v-if="field.copy && field.rawValue" :content="`复制${field.label}`" placement="top">
                  <button
                    type="button"
                    class="business-copy-button"
                    :aria-label="`复制${field.label}`"
                    @click="copyBusinessField(field.rawValue, field.label)"
                  >
                    <component :is="icons.copy" :size="13" />
                  </button>
                </ElTooltip>
              </span>
            </div>
          </div>
        </section>
      </div>

      <ElCollapse v-else v-model="activeNames" class="detail-collapse">
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

/* ---------- 收起后的 32px 窄条：竖排展开 / 业务信息 / 客户信息 ---------- */
.customer-detail.is-collapsed {
  padding: 0;
}
.strip {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  width: 100%;
  padding: 8px 0;
}
.strip-btn {
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
.strip-btn:hover {
  color: #131317;
  background: #f5f5f5;
}

/* ---------- 展开态 ---------- */
.panel-head {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px 9px 14px;
  border-bottom: 1px solid var(--line, #ececed);
}
.panel-tabs {
  display: flex;
  gap: 2px;
  align-items: center;
  min-width: 0;
}
.panel-tab {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  place-items: center;
  color: #8c8c8e;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition: color 0.15s ease, background-color 0.15s ease;
}
.panel-tab:hover {
  color: #131317;
  background: #f5f5f5;
}
.panel-tab.active {
  color: #131317;
  background: #e6e6e7;
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

.panel-body {
  flex: 1;
  min-height: 0;
  padding: 14px;
  overflow-y: auto;
}
.business-info {
  display: grid;
  gap: 18px;
  align-content: start;
}
.business-title {
  margin: 0 0 8px;
  color: #131317;
  font-size: 13px;
  font-weight: 600;
}
.business-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
}
.business-field {
  display: grid;
  gap: 2px;
  min-width: 0;
}
/* 玩家账号、玩家 ID 等长值独占一行，避免窄栏内被压缩 */
.business-field.is-wide {
  grid-column: 1 / -1;
}
.business-label {
  color: #8c8c8e;
  font-size: 12px;
  line-height: 16px;
  overflow-wrap: anywhere;
}
.business-value {
  color: #131317;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: normal;
}
.business-value-row {
  display: flex;
  gap: 4px;
  align-items: flex-start;
  min-width: 0;
}
.business-value-row .business-value {
  min-width: 0;
}
.business-copy-button {
  display: grid;
  flex: 0 0 20px;
  width: 20px;
  height: 20px;
  padding: 0;
  color: #8c8c8e;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 5px;
  place-items: center;
}
.business-copy-button:hover {
  color: #1664ff;
  background: #f2f3f5;
}
.business-value.is-empty {
  color: #8c8c8e;
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
