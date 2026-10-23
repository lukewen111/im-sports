<script lang="ts" setup>
import type { Team } from '#/features/channels/channel-data';

defineProps<{ agent?: Team }>();
</script>

<template>
  <span class="agent-reference-avatar" :class="{ 'is-empty': !agent }">
    <img v-if="agent?.avatar" :src="agent.avatar" alt="" />
    <svg v-else-if="agent" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6M12 3v3M7 7h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7a3 3 0 0 1 3-3Z" /><circle cx="9" cy="13" r="1" /><circle cx="15" cy="13" r="1" /><path d="M9 17h6" /></svg>
    <svg v-else viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6M12 17h.01" /></svg>
  </span>
</template>

<style scoped>
.agent-reference-avatar { display: grid; width: 28px; height: 28px; flex: 0 0 auto; place-items: center; overflow: hidden; color: #1664ff; background: #f3f7ff; border-radius: 50%; }
.agent-reference-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.agent-reference-avatar svg { width: 17px; height: 17px; fill: none; stroke: currentcolor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.7; }
.agent-reference-avatar.is-empty { color: #86909c; background: #f2f3f5; }
</style>
