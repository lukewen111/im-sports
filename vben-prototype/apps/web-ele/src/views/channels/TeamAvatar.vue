<script lang="ts" setup>
import type { Team } from '#/features/channels/channel-data';

import { computed } from 'vue';

import { avatarColor, avatarText } from '#/features/team/team-constants';

const props = defineProps<{ team?: Team }>();
const teamInitial = computed(() => avatarText(props.team?.name));
const teamColor = computed(() => props.team?.color || avatarColor(props.team?.id || 'empty'));
</script>

<template>
  <span class="team-reference-avatar" :class="{ 'is-empty': !team }" :style="team ? { background: teamColor } : undefined">
    <span v-if="team" aria-hidden="true">{{ teamInitial }}</span>
  </span>
</template>

<style scoped>
.team-reference-avatar { display:grid; width:28px; height:28px; flex:0 0 auto; place-items:center; overflow:hidden; color:#fff; background:#1677ff; border-radius:5px; font-size:13px; font-weight:600; line-height:1; }
.team-reference-avatar.is-empty { color:#86909c; background:#f2f3f5; }
</style>
