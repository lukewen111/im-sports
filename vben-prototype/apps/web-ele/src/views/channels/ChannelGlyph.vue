<script lang="ts" setup>
import type { ChannelType } from '#/features/channels/channel-data';

import { QiEarth, QiMessageSquare } from 'qingicon-vue';

defineProps<{
  type: ChannelType;
}>();
</script>

<template>
  <span class="channel-glyph" :class="`is-${type}`" :aria-label="type">
    <QiEarth v-if="type === 'web-widget'" :size="22" />
    <svg v-else-if="type === 'telegram'" class="telegram-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.8 4.1 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18 6.5c.4-.4-.1-.6-.6-.2L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.5 3c.9-.3 1.6.2 1.3 1.1Z" />
    </svg>
    <QiMessageSquare v-else :size="22" />
  </span>
</template>

<style scoped>
.channel-glyph {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  place-items: center;
  overflow: hidden;
  color: #1664ff;
  background: #fff;
  border: 1px solid #dde2e9;
  border-radius: 8px;
}

.channel-glyph :deep(svg) {
  display: block;
}

.channel-glyph.is-telegram {
  color: #2aabee;
}

.channel-glyph .telegram-brand-icon {
  width: 22px;
  height: 22px;
  fill: currentcolor;
  stroke: none;
}

.channel-glyph.is-chat-page {
  color: #0a7f77;
}
</style>
