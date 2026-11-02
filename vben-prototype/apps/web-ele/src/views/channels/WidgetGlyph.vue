<script lang="ts" setup>
import type { WidgetIcon } from '#/features/channels/channel-data';

import { QiMessageCircleDots, QiMessageCircleText, QiRobot } from 'qingicon-vue';

const props = defineProps<{
  customIcon?: string;
  type?: 'robot' | 'support' | WidgetIcon;
}>();
</script>

<template>
  <img v-if="props.type === 'custom' && props.customIcon" class="widget-custom-icon" :src="props.customIcon" alt="自定义图标" />
  <QiMessageCircleText v-else-if="props.type === 'message-line' || props.type === 'support'" :size="23" />
  <QiRobot v-else-if="props.type === 'message-dark' || props.type === 'robot'" :size="23" />
  <QiMessageCircleDots v-else :size="23" />
</template>

<style scoped>
:deep(svg) { display: block; }
.widget-custom-icon { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
