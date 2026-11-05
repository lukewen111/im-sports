<script lang="ts" setup>
import type { Team } from '#/features/channels/channel-data';

import QIcon from '#/components/q-icon/QIcon.vue';

defineProps<{ agent?: Team }>();
</script>

<template>
  <span class="agent-reference-avatar" :class="{ 'is-empty': !agent }">
    <img v-if="agent?.avatar" :src="agent.avatar" alt="" />
    <QIcon v-else-if="agent" name="robot" :size="17" />
    <QIcon v-else name="exclamation" :size="17" />
  </span>
</template>

<style scoped>
.agent-reference-avatar { display: grid; width: 28px; height: 28px; flex: 0 0 auto; place-items: center; overflow: hidden; color: #1664ff; background: #f3f7ff; border-radius: 50%; }
.agent-reference-avatar img { display: block; width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
.agent-reference-avatar :deep(svg) { display: block; }
.agent-reference-avatar.is-empty { color: #86909c; background: #f2f3f5; }
</style>
