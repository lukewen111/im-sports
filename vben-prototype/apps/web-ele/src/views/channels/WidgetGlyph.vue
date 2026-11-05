<script lang="ts" setup>
import type { WidgetIcon } from '#/features/channels/channel-data';

import QIcon from '#/components/q-icon/QIcon.vue';

const props = defineProps<{
  customIcon?: string;
  type?: 'robot' | 'support' | WidgetIcon;
}>();
</script>

<template>
  <img v-if="props.type === 'custom' && props.customIcon" class="widget-custom-icon" :src="props.customIcon" alt="自定义图标" />
  <QIcon v-else-if="props.type === 'message-line' || props.type === 'support'" name="message-circle-text" :size="23" />
  <QIcon v-else-if="props.type === 'message-dark' || props.type === 'robot'" name="robot" :size="23" />
  <QIcon v-else name="message-circle-dots" :size="23" />
</template>

<style scoped>
:deep(svg) { display: block; }

:deep(.q-icon) { color: inherit; }
.widget-custom-icon { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
