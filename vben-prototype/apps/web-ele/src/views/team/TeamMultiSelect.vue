<script lang="ts" setup>
import type { TeamRecord } from '#/features/team/team-store';

import { computed } from 'vue';

import { ElCheckbox, ElOption, ElSelect, ElTag } from 'element-plus';

import { avatarColor, avatarText } from '#/features/team/team-constants';

const props = withDefaults(defineProps<{
  disabledIds?: string[];
  modelValue: string[];
  teams: TeamRecord[];
}>(), { disabledIds: () => [] });

const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const teamAvatarStyle = (team: Pick<TeamRecord, 'id'> & { color?: string }) => ({ backgroundColor: team.color || avatarColor(team.id), color: '#fff' });
const selectedTeams = computed(() => props.teams.filter((team) => props.modelValue.includes(team.id)));
const selectable = computed(() => props.teams.filter((team) => !props.disabledIds.includes(team.id)));
const allChecked = computed(() => selectable.value.length > 0 && selectable.value.every((team) => props.modelValue.includes(team.id)));
const indeterminate = computed(() => !allChecked.value && selectable.value.some((team) => props.modelValue.includes(team.id)));

function update(value: unknown) {
  if (Array.isArray(value)) emit('update:modelValue', value.map(String));
}

function removeTeam(id: string) {
  emit('update:modelValue', props.modelValue.filter((item) => item !== id));
}

function toggleTeam(id: string, checked: boolean) {
  emit('update:modelValue', checked
    ? [...new Set([...props.modelValue, id])]
    : props.modelValue.filter((item) => item !== id));
}

function toggleAll(checked: boolean) {
  const selectableIds = new Set(selectable.value.map((team) => team.id));
  emit('update:modelValue', checked
    ? [...new Set([...props.modelValue, ...selectableIds])]
    : props.modelValue.filter((id) => !selectableIds.has(id)));
}
</script>

<template>
  <ElSelect class="team-select-control" :model-value="modelValue" multiple placeholder="至少选择一个团队" popper-class="team-select-popper" @change="update">
    <template #tag>
      <ElTag v-for="team in selectedTeams" :key="team.id" closable disable-transitions class="team-select-tag" @close="removeTeam(team.id)">
        <i :style="teamAvatarStyle(team)">{{ avatarText(team.name) }}</i><span>{{ team.name }}</span>
      </ElTag>
    </template>
    <template #header>
      <ElCheckbox :model-value="allChecked" :indeterminate="indeterminate" @change="(value) => toggleAll(Boolean(value))">全选</ElCheckbox>
    </template>
    <ElOption v-for="team in teams" :key="team.id" :label="team.name" :value="team.id" :disabled="disabledIds.includes(team.id)">
      <span class="team-select-option">
        <ElCheckbox :model-value="modelValue.includes(team.id)" :disabled="disabledIds.includes(team.id)" @click.stop @change="(value) => toggleTeam(team.id, Boolean(value))" />
        <i :style="teamAvatarStyle(team)">{{ avatarText(team.name) }}</i><span>{{ team.name }}</span><small v-if="disabledIds.includes(team.id)">已有 AI 成员</small>
      </span>
    </ElOption>
  </ElSelect>
</template>
