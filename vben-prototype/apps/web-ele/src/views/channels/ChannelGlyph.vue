<script lang="ts" setup>
import type { ChannelType } from '#/features/channels/channel-data';

defineProps<{
  type: ChannelType;
}>();
</script>

<template>
  <span class="channel-glyph" :class="`is-${type}`" :aria-label="type">
    <svg v-if="type === 'web-widget'" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M3.5 9h17M3.5 15h17M12 3c2.3 2.4 3.5 5.4 3.5 9S14.3 18.6 12 21M12 3C9.7 5.4 8.5 8.4 8.5 12s1.2 6.6 3.5 9" />
    </svg>
    <svg v-else-if="type === 'telegram'" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M21.8 4.1 18.5 20c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1L18 6.5c.4-.4-.1-.6-.6-.2L6 13.4l-4.9-1.5c-1.1-.3-1.1-1.1.2-1.6L20.5 3c.9-.3 1.6.2 1.3 1.1Z" />
    </svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
      <path d="M7 9h10M7 13h6" />
    </svg>
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

.channel-glyph svg {
  display: block;
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentcolor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.6;
}

.channel-glyph.is-telegram {
  color: #2aabee;
}

.channel-glyph.is-telegram svg {
  fill: currentcolor;
  stroke: none;
}

.channel-glyph.is-chat-page {
  color: #0a7f77;
}
</style>
