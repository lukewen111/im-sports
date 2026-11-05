<script lang="ts" setup>
import { computed } from 'vue';

import { iconMap } from './index';

interface Props {
  color?: string;
  name: string;
  size?: number | string;
}

const props = withDefaults(defineProps<Props>(), {
  color: 'currentColor',
  size: 16,
});

const svg = computed(() => {
  const source = iconMap[props.name];
  if (!source) {
    return '';
  }
  return source
    .replace(/^\uFEFF/, '')
    .replace(/\swidth="[^"]*"/, '')
    .replace(/\sheight="[^"]*"/, '');
});

const boxStyle = computed(() => {
  const value = typeof props.size === 'number' ? `${props.size}px` : props.size;
  return {
    color: props.color,
    height: value,
    width: value,
  };
});
</script>

<template>
  <span class="q-icon" :style="boxStyle" aria-hidden="true" v-html="svg" />
</template>

<style scoped>
.q-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  line-height: 0;
  vertical-align: middle;
}

.q-icon :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
