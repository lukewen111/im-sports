<script setup lang="ts">
import type { Component } from 'vue';

import { ElCollapseItem } from 'element-plus';

defineProps<{
  icon: Component;
  name: string;
  title: string;
}>();
</script>

<template>
  <ElCollapseItem :name="name" class="info-section">
    <template #title>
      <span class="section-title">
        <component :is="icon" :size="15" class="section-icon" />
        <b>{{ title }}</b>
      </span>
      <span class="section-extra" @click.stop>
        <slot name="extra"></slot>
      </span>
    </template>
    <div class="section-body">
      <slot></slot>
    </div>
  </ElCollapseItem>
</template>

<style scoped>
.section-title {
  display: inline-flex;
  flex: 1;
  gap: 7px;
  align-items: center;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  color: #131317;
}
.section-icon {
  flex: 0 0 auto;
  color: #62626d;
}
.section-extra {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  margin-left: 8px;
}
.section-body {
  padding: 0 14px 14px;
}
</style>
