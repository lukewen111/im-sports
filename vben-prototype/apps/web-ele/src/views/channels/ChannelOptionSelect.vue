<script lang="ts" setup>
import type { Team } from '#/features/channels/channel-data';

import { computed, nextTick, onBeforeUnmount, ref } from 'vue';

import TeamAvatar from './TeamAvatar.vue';

export interface ChannelSelectOption { label: string; team?: Team; value: string }

const props = defineProps<{ disabled?: boolean; modelValue?: string; options: ChannelSelectOption[]; placeholder?: string; variant?: 'default' | 'team' }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const open = ref(false);
const root = ref<HTMLElement>();
const menu = ref<HTMLElement>();
const menuStyle = ref<Record<string, string>>({});
const selected = computed(() => props.options.find((option) => option.value === props.modelValue));
const isTeamSelect = computed(() => props.variant === 'team');

function onDocumentPointerDown(event: PointerEvent) {
  if (!root.value?.contains(event.target as Node) && !menu.value?.contains(event.target as Node)) open.value = false;
}
function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false;
}
function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    void nextTick(positionMenu);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    document.addEventListener('keydown', onDocumentKeyDown);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
  } else cleanup();
}
function choose(value: string) {
  emit('update:modelValue', value);
  open.value = false;
  cleanup();
}
function cleanup() {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
  window.removeEventListener('resize', positionMenu);
  window.removeEventListener('scroll', positionMenu, true);
}
function positionMenu() {
  const trigger = root.value?.querySelector<HTMLElement>('.channel-option-select-trigger');
  if (!trigger) return;
  const rect = trigger.getBoundingClientRect();
  menuStyle.value = { left: `${rect.left}px`, minWidth: `${rect.width}px`, top: `${rect.bottom + (isTeamSelect.value ? 10 : 4)}px` };
}
onBeforeUnmount(cleanup);
</script>

<template>
  <div ref="root" class="channel-option-select" :class="{ 'is-team-select': isTeamSelect }">
    <button type="button" class="channel-option-select-trigger" :class="{ 'is-open': open }" :aria-expanded="open" :disabled="disabled" @click="toggle">
      <span class="channel-option-select-value" :class="{ 'is-placeholder': !selected, 'is-team-value': isTeamSelect && selected }">
        <template v-if="isTeamSelect && selected"><TeamAvatar :team="selected.team" /><span>{{ selected.label }}</span></template>
        <template v-else><TeamAvatar v-if="selected?.team" :team="selected.team" />{{ selected?.label || placeholder }}</template>
      </span><i aria-hidden="true"></i>
    </button>
    <Teleport to="body">
      <div v-if="open" ref="menu" class="channel-option-select-menu" :class="{ 'is-team-menu': isTeamSelect }" :style="menuStyle">
        <button v-for="option in options" :key="option.value" type="button" :aria-selected="option.value === modelValue" :class="{ 'is-selected': option.value === modelValue }" @click="choose(option.value)">
          <template v-if="isTeamSelect"><TeamAvatar :team="option.team" /><span>{{ option.label }}</span></template>
          <template v-else><TeamAvatar v-if="option.team" :team="option.team" /><span>{{ option.label }}</span></template>
        </button>
      </div>
    </Teleport>
  </div>
</template>
