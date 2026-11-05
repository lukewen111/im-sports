<script setup lang="ts">
/**
 * 字段图标统一容器：20×20 居中，保证四个区块的图标列宽、左边缘与垂直基线完全一致。
 */
</script>

<template>
  <span class="icon-slot" aria-hidden="true">
    <slot></slot>
  </span>
</template>

<style scoped>
.icon-slot {
  display: grid;
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  place-items: center;
  color: var(--ui-ink-3, #8c8c8e);
}
</style>
