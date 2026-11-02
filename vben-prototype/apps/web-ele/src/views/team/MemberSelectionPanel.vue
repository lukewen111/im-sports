<script lang="ts" setup>
import type { TeamMember } from '#/features/team/team-store';

import { computed, ref } from 'vue';

import { ElAvatar, ElCheckbox, ElMessage, ElOption, ElSelect, ElTabPane, ElTabs, ElTag } from 'element-plus';

import { avatarColor, avatarText } from '#/features/team/team-constants';

const props = defineProps<{ lockedIds?: string[]; members: TeamMember[]; modelValue: string[] }>();
const emit = defineEmits<{ 'update:modelValue': [value: string[]] }>();
const keyword = ref('');
const tab = ref<'ai' | 'all' | 'human'>('all');
const rows = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  return props.members.filter((member) => (tab.value === 'all' || member.kind === tab.value) && (!query || `${member.name}${member.account || ''}${member.id}`.toLowerCase().includes(query)));
});
const selectedMembers = computed(() => props.members.filter((member) => props.modelValue.includes(member.id)));
const selectedAiId = computed(() => props.members.find((member) => member.kind === 'ai' && props.modelValue.includes(member.id))?.id);
const isLocked = (id: string) => props.lockedIds?.includes(id) ?? false;
const disabledReason = (member: TeamMember) => isLocked(member.id) ? '已有成员不可取消' : (member.kind === 'ai' && selectedAiId.value && selectedAiId.value !== member.id ? '每个团队最多一名 AI 成员' : '');
const isDisabled = (member: TeamMember) => Boolean(disabledReason(member));
const selectableRows = computed(() => rows.value.filter((member) => !isDisabled(member)));
const allChecked = computed(() => selectableRows.value.length > 0 && selectableRows.value.every((member) => props.modelValue.includes(member.id)));
const indeterminate = computed(() => !allChecked.value && selectableRows.value.some((member) => props.modelValue.includes(member.id)));

function update(value: unknown) {
  if (!Array.isArray(value)) return;
  const visibleIds = new Set(rows.value.map((member) => member.id));
  const next = [...new Set([...value.map(String), ...(props.lockedIds || []), ...props.modelValue.filter((id) => !visibleIds.has(id))])];
  if (props.members.filter((member) => member.kind === 'ai' && next.includes(member.id)).length > 1) {
    ElMessage.warning('每个团队最多一名 AI 成员，请手动选择一名 AI 成员。');
    return;
  }
  emit('update:modelValue', next);
}

function removeMember(id: string) {
  if (isLocked(id)) return;
  emit('update:modelValue', props.modelValue.filter((item) => item !== id));
}

function toggleMember(member: TeamMember, checked: boolean) {
  if (isDisabled(member)) return;
  emit('update:modelValue', checked
    ? [...new Set([...props.modelValue, member.id])]
    : props.modelValue.filter((item) => item !== member.id));
}

function toggleAll(checked: boolean) {
  const visibleIds = new Set(rows.value.map((member) => member.id));
  if (!checked) return emit('update:modelValue', props.modelValue.filter((id) => isLocked(id) || !visibleIds.has(id)));
  const next = [...props.modelValue];
  const aiCandidates = selectableRows.value.filter((member) => member.kind === 'ai' && !next.includes(member.id));
  const needsAiChoice = !selectedAiId.value && aiCandidates.length > 1;
  if (needsAiChoice) ElMessage.warning('已选择人类成员，请手动选择一名 AI 成员。');
  rows.value.forEach((member) => {
    if (isDisabled(member) || (member.kind === 'ai' && needsAiChoice)) return;
    if (!next.includes(member.id)) next.push(member.id);
  });
  emit('update:modelValue', next);
}
</script>

<template>
  <div class="member-selection-panel">
    <ElSelect :model-value="modelValue" multiple filterable :filter-method="(value: string) => keyword = value" placeholder="请选择成员" popper-class="member-select-popper" @change="update">
      <template #tag>
        <ElTag v-for="member in selectedMembers.slice(0, 2)" :key="member.id" :closable="!isLocked(member.id)" disable-transitions class="member-select-tag" @close="removeMember(member.id)">
          <ElAvatar :size="22" :src="member.avatar" :style="{ background: avatarColor(member.id) }">{{ avatarText(member.name, member.account) }}</ElAvatar><span>{{ member.name }}</span>
        </ElTag>
        <ElTag v-if="selectedMembers.length > 2" disable-transitions>+{{ selectedMembers.length - 2 }}</ElTag>
      </template>
      <template #header>
        <ElTabs v-model="tab" class="member-select-tabs"><ElTabPane label="全部" name="all" /><ElTabPane label="人类成员" name="human" /><ElTabPane label="AI 成员" name="ai" /></ElTabs>
        <ElCheckbox :model-value="allChecked" :indeterminate="indeterminate" @change="(value) => toggleAll(Boolean(value))">全选</ElCheckbox>
      </template>
      <ElOption v-for="member in rows" :key="member.id" :label="`${member.name} ${member.account || member.id}`" :value="member.id" :disabled="isDisabled(member)">
        <span class="member-select-option">
          <ElCheckbox :model-value="modelValue.includes(member.id)" :disabled="isDisabled(member)" @click.stop @change="(value) => toggleMember(member, Boolean(value))" />
          <ElAvatar :size="36" :src="member.avatar" :style="{ background: avatarColor(member.id) }">{{ avatarText(member.name, member.account) }}</ElAvatar><span><b>{{ member.name }}</b><small>{{ member.account || member.id }}</small></span><small v-if="isDisabled(member)" class="member-select-disabled">{{ disabledReason(member) }}</small>
        </span>
      </ElOption>
    </ElSelect>
  </div>
</template>
