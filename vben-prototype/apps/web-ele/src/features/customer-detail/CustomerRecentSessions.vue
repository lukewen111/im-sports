<script setup lang="ts">
import type { DemoCustomer, DemoSession } from '#/features/service/demo-store';

import { computed } from 'vue';

import ChannelGlyph from '#/views/channels/ChannelGlyph.vue';
import { formatChatTime } from '#/utils/chat-time';

import IconSlot from './IconSlot.vue';
import { useCustomerDetail } from './useCustomerDetail';

const props = defineProps<{
  customer: DemoCustomer;
  excludeId?: string;
}>();

const emit = defineEmits<{
  select: [session: DemoSession];
}>();

const hook = useCustomerDetail();

const all = computed(() => {
  const list = hook.sessionsOf(props.customer);
  const filtered = props.excludeId ? list.filter((session) => session.id !== props.excludeId) : list;
  // PRD §5.4：固定展示最近 3 条
  return filtered.slice(0, 3);
});

function open(session: DemoSession) {
  if (!hook.canViewSession(session) || hook.isExpired(session)) return;
  emit('select', session);
}
</script>

<template>
  <div class="recent-list">
    <button
      v-for="session in all"
      :key="session.id"
      type="button"
      class="recent-item"
      :class="{ 'is-locked': !hook.canViewSession(session) }"
      :aria-disabled="!hook.canViewSession(session)"
      :title="hook.canViewSession(session) ? undefined : '暂无权限查看该会话'"
      @click="open(session)"
    >
      <!-- 先判权限：无权条目只显示占位，不暴露摘要 / 接待人 / 时间 -->
      <template v-if="!hook.canViewSession(session)">
        <IconSlot />
        <span class="locked-text">暂无权限查看该会话</span>
      </template>
      <template v-else>
        <IconSlot>
          <ChannelGlyph :type="hook.channelTypeOf(session)" />
        </IconSlot>
        <span class="recent-main">
          <b :class="{ expired: hook.isExpired(session) }">
            {{ hook.isExpired(session) ? '历史消息已过期' : hook.summaryOf(session) }}
          </b>
          <small>{{ hook.assigneeLabel(session) }} · {{ formatChatTime(hook.timeOf(session)) }}</small>
        </span>
      </template>
    </button>
    <p v-if="!all.length" class="empty">暂无会话</p>
  </div>
</template>

<style scoped>
.recent-list {
  display: grid;
}
.recent-item {
  display: flex;
  gap: 9px;
  align-items: center;
  width: 100%;
  padding: 9px 8px;
  margin: 0 -8px;
  font: inherit;
  color: #131317;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 8px;
  transition: background-color 0.12s ease;
}
.recent-item + .recent-item {
  border-top: 1px solid #f0f0f1;
  border-radius: 0;
}
.recent-item:hover:not(.is-locked) {
  background: #f5f5f5;
}
.recent-item.is-locked {
  cursor: not-allowed;
}
/* 与其余区块统一：20×20 图标槽内放 16px 渠道图标 */
.recent-item :deep(.channel-glyph) {
  width: 20px;
  height: 20px;
  color: #8c8c8e;
  background: #f5f5f5;
  border: 0;
  border-radius: 6px;
}
.recent-item :deep(.channel-glyph svg) {
  width: 16px;
  height: 16px;
}
/* ChannelGlyph 内部 QIcon 以行内 size 写死 22px，收敛到 16px 才不撑破 20px 图标槽 */
.recent-item :deep(.channel-glyph .q-icon) {
  width: 16px !important;
  height: 16px !important;
}
.recent-main {
  display: grid;
  flex: 1;
  gap: 3px;
  min-width: 0;
}
.recent-main b {
  overflow: hidden;
  font-size: 12px;
  font-weight: 500;
  color: #131317;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.recent-main b.expired {
  font-weight: 400;
  color: #62626d;
}
.recent-main small {
  overflow: hidden;
  font-size: 11px;
  color: #8c8c8e;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.locked-text {
  font-size: 12px;
  color: #8c8c8e;
}
.empty {
  margin: 0;
  padding: 4px 0 2px;
  font-size: 12px;
  color: #8c8c8e;
}
</style>
