<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';

import QIcon from '#/components/q-icon/QIcon.vue';

interface Props {
  canAccess: boolean;
  memberName?: string;
}

const props = defineProps<Props>();
const route = useRoute();

const STORAGE_KEY = 'im-sports:settings-nav-collapsed';
const collapsed = ref(readCollapsed());

function readCollapsed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

watchEffect(() => {
  try {
    localStorage.setItem(STORAGE_KEY, collapsed.value ? '1' : '0');
  } catch {
    // 本地存储不可用时仅保留内存状态
  }
});

const navItems = [
  { icon: 'message-circle-dots', label: '自动消息设置', path: '/settings/reception/auto-message' },
  { icon: 'settings', label: '会话设置', path: '/settings/reception/session' },
  { icon: 'clock', label: '回复超时预警设置', path: '/settings/reception/response-alert' },
];

function isActive(path: string) {
  return route.path.replace(/\/$/, '') === path;
}

const pageTitle = computed(() => navItems.find((item) => isActive(item.path))?.label ?? '设置');
</script>

<template>
  <div class="settings-layout">
    <aside class="settings-nav">
      <h2 class="nav-title">设置</h2>

      <button
        class="nav-heading"
        type="button"
        :aria-expanded="!collapsed"
        aria-controls="settings-nav-items"
        @click="collapsed = !collapsed"
      >
        <span class="heading-text">聊天与接待</span>
        <QIcon
          class="heading-arrow"
          :class="{ 'is-collapsed': collapsed }"
          color="#62626D"
          name="chevron-down"
          :size="14"
        />
      </button>

      <div v-show="!collapsed" id="settings-nav-items" class="nav-items">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ 'is-active': isActive(item.path) }"
        >
          <QIcon class="nav-icon" :name="item.icon" :size="14" />
          <span class="nav-label">{{ item.label }}</span>
        </RouterLink>
      </div>
    </aside>

    <main class="settings-main">
      <header class="title-bar">
        <h1>{{ pageTitle }}</h1>
      </header>

      <section v-if="props.canAccess" class="content">
        <slot></slot>
      </section>

      <div v-else class="ui-empty">
        <strong>暂无权限访问设置</strong>
        <span>
          当前账号{{ props.memberName ? `（${props.memberName}）` : '' }}未被授予「设置」菜单权限，请联系管理员。
        </span>
      </div>
    </main>
  </div>
</template>

<style scoped>
.settings-layout {
  display: flex;
  height: calc(100vh - var(--ui-header-height, 48px));
  align-items: stretch;
  overflow: hidden;
  color: var(--ui-ink);
  background: #f5f5f5;
  font-size: 14px;
}

.settings-nav {
  box-sizing: border-box;
  width: 200px;
  flex: none;
  padding: 12px 12px 16px;
  background: #f7f7f7;
}

.nav-title {
  display: flex;
  min-height: 52px;
  align-items: center;
  margin: 0 0 8px;
  padding: 0 10px;
  color: var(--ui-ink);
  font-size: 17px;
  line-height: 24px;
  font-weight: 600;
}

.nav-heading {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  color: #131317;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.nav-heading:hover {
  background: #efefef;
}

.heading-text {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.heading-arrow {
  flex: none;
  transition: transform 0.15s ease;
}

.heading-arrow.is-collapsed {
  transform: rotate(-90deg);
}

.nav-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}

.nav-item {
  display: flex;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 var(--ui-menu-item-padding-right) 0 var(--ui-menu-item-padding-left);
  color: var(--ui-menu-item-color);
  font-size: 13px;
  font-weight: 400;
  line-height: 1;
  text-decoration: none;
  border-radius: var(--ui-menu-item-radius);
  transition:
    background 0.15s ease,
    color 0.15s ease;
}

.nav-item:hover {
  background: var(--ui-menu-item-bg-hover);
}

.nav-item.is-active {
  color: var(--ui-menu-item-color-active);
  font-weight: var(--ui-menu-item-weight-active);
  background: var(--ui-menu-item-bg-selected);
}

.nav-icon {
  width: 14px;
  height: 14px;
  flex: none;
}

.nav-label {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.settings-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 12px;
  overflow: hidden;
  background: #ffffff;
  border-radius: 16px;
}

.title-bar {
  display: flex;
  height: 48px;
  flex: none;
  align-items: center;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #ececed;
  border-radius: 16px 16px 0 0;
}

.title-bar h1 {
  margin: 0;
  color: #131317;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}

.content {
  box-sizing: border-box;
  width: 100%;
  max-width: 1100px;
  min-height: 0;
  flex: 1;
  padding: 12px 16px 24px;
  overflow-y: auto;
}

.ui-empty {
  max-width: 720px;
  margin: 12px 16px;
}
</style>
