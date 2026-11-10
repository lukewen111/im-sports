<script setup lang="ts">
import { computed, ref } from 'vue';

import QIcon from '#/components/q-icon/QIcon.vue';

import NotificationPanel from '../settings/notification/app.vue';
import ChatToolsPanel from '../settings/tools/app.vue';

type SectionKey = 'notification' | 'tools';

const activeSection = ref<SectionKey>('notification');

const sections = [
  { icon: 'bell', key: 'notification' as const, label: '消息通知' },
  { icon: 'message-circle-text', key: 'tools' as const, label: '聊天工具' },
];

const pageTitle = computed(() => sections.find((item) => item.key === activeSection.value)?.label || '个人资料');
</script>

<template>
  <div class="profile-layout">
    <aside class="profile-nav" aria-label="个人资料导航">
      <h1>个人资料</h1>
      <button
        v-for="item in sections"
        :key="item.key"
        type="button"
        class="nav-item"
        :class="{ 'is-active': activeSection === item.key }"
        :aria-current="activeSection === item.key ? 'page' : undefined"
        @click="activeSection = item.key"
      >
        <QIcon :name="item.icon" :size="14" />
        <span>{{ item.label }}</span>
      </button>
    </aside>

    <main class="profile-main">
      <header class="title-bar">
        <h2>{{ pageTitle }}</h2>
      </header>
      <section class="profile-content">
        <NotificationPanel v-if="activeSection === 'notification'" />
        <ChatToolsPanel v-else />
      </section>
    </main>
  </div>
</template>

<style scoped>
.profile-layout {
  display: flex;
  height: calc(100vh - var(--ui-header-height, 48px));
  align-items: stretch;
  overflow: hidden;
  color: var(--ui-ink);
  background: #fff;
  font-size: 14px;
}

.profile-nav {
  box-sizing: border-box;
  width: 200px;
  flex: none;
  padding: 12px;
  background: transparent;
}

.profile-nav h1 {
  display: flex;
  min-height: 52px;
  align-items: center;
  margin: 0 0 8px;
  padding: 0 10px;
  color: var(--ui-ink);
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
}

.nav-item {
  display: flex;
  width: 100%;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 var(--ui-menu-item-padding-right) 0 var(--ui-menu-item-padding-left);
  color: var(--ui-menu-item-color);
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: var(--ui-menu-item-radius);
}

.nav-item + .nav-item {
  margin-top: 2px;
}

.nav-item:hover {
  background: var(--ui-menu-item-bg-hover);
}

.nav-item.is-active {
  color: var(--ui-menu-item-color-active);
  font-weight: var(--ui-menu-item-weight-active);
  background: var(--ui-menu-item-bg-selected);
}

.profile-main {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  margin: 12px;
  overflow: hidden;
  background: #fff;
  border-radius: 16px;
}

.title-bar {
  display: flex;
  height: 48px;
  flex: none;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #ececed;
}

.title-bar h2 {
  margin: 0;
  color: #131317;
  font-size: 16px;
  font-weight: 500;
  line-height: 24px;
}

.profile-content {
  box-sizing: border-box;
  width: 100%;
  max-width: 1100px;
  min-height: 0;
  flex: 1;
  padding: 12px 16px 24px;
  overflow-y: auto;
}

@media (max-width: 720px) {
  .profile-layout {
    flex-direction: column;
  }

  .profile-nav {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 4px;
  }

  .profile-nav h1 {
    min-height: 40px;
    margin: 0 auto 0 0;
  }

  .nav-item {
    width: auto;
  }

  .profile-main {
    margin-top: 0;
  }
}
</style>
