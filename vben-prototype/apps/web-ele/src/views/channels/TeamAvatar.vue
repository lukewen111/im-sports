<script lang="ts" setup>
import type { Team } from '#/features/channels/channel-data';

import { computed } from 'vue';

const props = defineProps<{ team?: Team }>();
const teamInitial = computed(() => props.team?.name.trim().slice(0, 1) || '团');
</script>

<template>
  <span class="team-reference-avatar" :class="{ 'is-empty': !team }">
    <img v-if="team?.avatar" :src="team.avatar" alt="" />
    <span v-else-if="team" aria-hidden="true">{{ teamInitial }}</span>
  </span>
</template>

<style scoped>
.team-reference-avatar { display:grid; width:28px; height:28px; flex:0 0 auto; place-items:center; overflow:hidden; color:#fff; background:#1677ff; border-radius:5px; font-size:13px; font-weight:600; line-height:1; }
.team-reference-avatar img { display:block; width:100%; height:100%; object-fit:cover; }
.team-reference-avatar.is-empty { color:#86909c; background:#f2f3f5; }
</style>
