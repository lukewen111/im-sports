<script setup lang="ts">
import type { Component } from 'vue';

import type { DemoSession } from '#/features/service/demo-store';

import { computed } from 'vue';
import { ElButton } from 'element-plus';

import QIcon from '#/components/q-icon/QIcon.vue';
import { avatarText, avatarTone } from '#/features/team/team-constants';
import { formatChatTime } from '#/utils/chat-time';

import IconSlot from './IconSlot.vue';
import { detailIcons as icons } from './icons';
import { useCustomerDetail } from './useCustomerDetail';

interface ChatInfoRow {
  avatar?: { style: { backgroundColor: string; color: string }; text: string };
  break: boolean;
  /** 渠道类型图标放在值前（同一行仅一处图标） */
  channelIcon?: 'chat' | 'earth' | 'send';
  copy: boolean;
  icon?: Component;
  label: string;
  mono: boolean;
  value: string;
}

const props = defineProps<{
  session: DemoSession;
}>();

const hook = useCustomerDetail();

const showStartUrl = computed(() => hook.channelTypeOf(props.session) !== 'telegram');

/** 渠道类型图标：网站小部件 / 聊天页面 / Telegram，与访问信息值前图标同一尺寸与颜色 */
const channelIcon = computed<ChatInfoRow['channelIcon']>(() => {
  const type = hook.channelTypeOf(props.session);
  if (type === 'telegram') return 'send';
  if (type === 'chat-page') return 'chat';
  return 'earth';
});

/** 所属团队：彩色方块头像（复用团队模块调色逻辑）+ 团队名称 */
const teamAvatar = computed<ChatInfoRow['avatar']>(() => {
  const info = hook.team.teamById(props.session.teamId);
  if (!info) return undefined;
  return { style: avatarTone(info.id), text: avatarText(info.name) };
});

const rows = computed<ChatInfoRow[]>(() => {
  const session = props.session;
  const list: ChatInfoRow[] = [
    { break: false, copy: true, icon: icons.key, label: '会话 ID', mono: true, value: session.id },
    { avatar: teamAvatar.value, break: false, copy: false, icon: icons.team, label: '所属团队', mono: false, value: hook.teamNameOf(session) },
    { break: false, copy: false, icon: icons.assignee, label: '当前接待人', mono: false, value: hook.assigneeLabel(session) },
    { break: false, channelIcon: channelIcon.value, copy: false, label: '渠道', mono: false, value: hook.channelNameOf(session) },
    { break: false, copy: false, icon: icons.calendar, label: '开始时间', mono: false, value: formatChatTime(session.startedAt || session.createdAt) },
  ];
  if (showStartUrl.value) {
    list.push({ break: true, copy: false, icon: icons.link, label: '开始于', mono: false, value: hook.startUrlOf(session) });
  }
  return list;
});

function copySessionId() {
  void hook.copyText(props.session.id, '会话 ID');
}
</script>

<template>
  <div class="chat-info">
    <div v-for="row in rows" :key="row.label" class="info-row">
      <IconSlot>
        <component :is="row.icon" v-if="row.icon" :size="14" class="row-icon" />
      </IconSlot>
      <span class="row-label">{{ row.label }}</span>
      <div class="row-value" :class="{ break: row.break }">
        <i v-if="row.avatar" class="team-avatar" :style="row.avatar.style">{{ row.avatar.text }}</i>
        <QIcon v-if="row.channelIcon" :name="row.channelIcon" :size="14" class="value-icon" color="#8c8c8e" />
        <span :class="{ mono: row.mono }">{{ row.value }}</span>
        <ElButton v-if="row.copy" link class="copy-button" aria-label="复制会话 ID" @click="copySessionId">
          <component :is="icons.copy" :size="13" />
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-info {
  display: grid;
  gap: 8px;
}
.info-row {
  display: grid;
  grid-template-columns: 20px 84px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-width: 0;
}
.row-icon {
  color: #8c8c8e;
}
.value-icon {
  flex: 0 0 auto;
  margin-right: 2px;
  color: #8c8c8e;
}
.row-label {
  overflow: hidden;
  font-size: 12px;
  color: #8c8c8e;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.row-value {
  display: flex;
  gap: 2px;
  align-items: center;
  min-width: 0;
}
.team-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  margin-right: 2px;
  place-items: center;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  border-radius: var(--ui-radius-control, 6px);
}
.row-value span {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 12px;
  line-height: 1.45;
  color: #131317;
}
.row-value span.mono {
  font-family: ui-monospace, 'SF Mono', Consolas, monospace;
  font-size: 11px;
}
.row-value.break span {
  word-break: break-all;
  white-space: normal;
}
.copy-button {
  flex: 0 0 auto;
  height: 18px;
  padding: 0 2px;
  color: #8c8c8e;
}
.copy-button:hover {
  color: #131317;
  background: transparent;
}
</style>
