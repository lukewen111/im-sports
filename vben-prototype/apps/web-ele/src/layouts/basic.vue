<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElPopover } from 'element-plus';
import { Bell } from '@vben/icons';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { LOGIN_PATH } from '@vben/constants';
import { useWatermark } from '@vben/hooks';
import { BasicLayout, LockScreen } from '@vben/layouts';
import { preferences, usePreferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';

import { channelMeta } from '#/features/channels/channel-data';
import { useDemoServiceStore } from '#/features/service/demo-store';
import { usePrototypeAccess } from '#/features/team/access-store';
import { useAuthStore } from '#/store';
import { formatChatTime } from '#/utils/chat-time';
import LoginForm from '#/views/_core/authentication/login.vue';
import PersonalUserMenu from '#/views/personal/user-menu.vue';
import { resolveProfileIdentity } from '#/views/personal/profile-identity';

const router = useRouter();
const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const store = useDemoServiceStore();
const access = usePrototypeAccess();
const { destroyWatermark, updateWatermark } = useWatermark();
const { isDark } = usePreferences();

const noticeOpen = ref(false);

/* 铃铛列表直接读取当前成员的未读会话，不做额外轮询 */
const unreadSessions = computed(() =>
  store.sessions
    .filter((session) => session.status !== 'ended' && session.assigneeId === access.currentId && session.unread > 0)
    .sort((left, right) => +new Date(store.lastMessage(right)?.sentAt || right.createdAt) - +new Date(store.lastMessage(left)?.sentAt || left.createdAt)),
);

function customerName(customerId: string) {
  return store.customerById(customerId)?.name || '未知客户';
}

function customerIdentity(customerId: string) {
  const customer = store.customerById(customerId);
  return resolveProfileIdentity({ avatar: customer?.avatar, id: customerId, name: customer?.name });
}

function channelLabel(sessionId: string) {
  const session = store.sessionById(sessionId);
  const type = session ? store.sessionChannelType(session) : undefined;
  return type ? channelMeta[type].label : '渠道未知';
}

function lastTime(sessionId: string) {
  const session = store.sessionById(sessionId);
  return session ? store.lastMessage(session)?.sentAt || session.createdAt : undefined;
}

function openSession(sessionId: string) {
  noticeOpen.value = false;
  router.push({ path: '/inbox', query: { session: sessionId } });
}

function markAllRead() {
  unreadSessions.value.forEach((session) => store.markRead(session.id, access.currentId));
}

function viewAll() {
  noticeOpen.value = false;
  router.push('/inbox');
}

async function handleLogout() {
  try {
    await authStore.logout(false);
  } catch {
    // 演示环境的 setup store 不支持 $reset，兜底回登录页
    await router.replace(LOGIN_PATH);
  }
}

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

watch(
  () => ({
    enable: preferences.app.watermark,
    content: preferences.app.watermarkContent,
    isDark: isDark.value,
  }),
  async ({ enable, content, isDark: isDarkValue }) => {
    if (enable) {
      const watermarkColor = isDarkValue
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(0, 0, 0, 0.12)';

      await updateWatermark({
        advancedStyle: {
          colorStops: [
            {
              color: watermarkColor,
              offset: 0,
            },
            {
              color: watermarkColor,
              offset: 1,
            },
          ],
          type: 'linear',
        },
        content:
          content ||
          `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <PersonalUserMenu @logout="handleLogout" />
    </template>
    <template #notification>
      <ElPopover
        v-model:visible="noticeOpen"
        placement="bottom-end"
        :width="320"
        trigger="click"
        popper-class="chat-notice-popper"
      >
        <template #reference>
          <div class="mr-2 flex-center h-full">
            <button type="button" class="chat-notice-trigger" aria-label="消息通知">
              <Bell class="size-4" />
              <i v-if="unreadSessions.length" class="chat-notice-dot">{{ unreadSessions.length > 9 ? '9+' : unreadSessions.length }}</i>
            </button>
          </div>
        </template>
        <div class="chat-notice">
          <div class="chat-notice-head">
            <span>消息通知</span>
            <button type="button" class="chat-notice-action" :disabled="!unreadSessions.length" @click="markAllRead">全部已读</button>
          </div>
          <ul v-if="unreadSessions.length" class="chat-notice-list">
            <li v-for="session in unreadSessions" :key="session.id" class="chat-notice-item" @click="openSession(session.id)">
              <i class="chat-notice-avatar" :style="{ backgroundColor: customerIdentity(session.customerId).avatarColor }">{{ customerIdentity(session.customerId).initial }}</i>
              <div class="chat-notice-body">
                <div class="chat-notice-title">
                  <b>{{ customerName(session.customerId) }}</b>
                  <em class="chat-notice-count">{{ session.unread }} 条未读</em>
                </div>
                <small>{{ channelLabel(session.id) }} · {{ formatChatTime(lastTime(session.id)) }}</small>
              </div>
            </li>
          </ul>
          <div v-else class="chat-notice-empty">暂无新消息</div>
          <div class="chat-notice-foot">
            <button type="button" class="chat-notice-action" @click="viewAll">查看全部会话</button>
          </div>
        </div>
      </ElPopover>
    </template>
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>

<style scoped>
.chat-notice-trigger {
  position: relative;
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  place-items: center;
  color: hsl(var(--foreground));
  cursor: pointer;
  background: transparent;
  border: 0;
  border-radius: 6px;
  transition: background-color 0.15s ease;
}
.chat-notice-trigger:hover {
  background: hsl(var(--accent));
}
.chat-notice-dot {
  position: absolute;
  top: -2px;
  right: -4px;
  min-width: 15px;
  height: 15px;
  padding: 0 4px;
  color: #fff;
  font-size: 9px;
  font-style: normal;
  line-height: 15px;
  text-align: center;
  background: #ca0005;
  border-radius: 999px;
}
</style>

<style>
.chat-notice-popper {
  padding: 0 !important;
  overflow: hidden;
  border-radius: 12px !important;
}
.chat-notice {
  color: #131317;
  font-size: 12px;
}
.chat-notice-head,
.chat-notice-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: #fff;
}
.chat-notice-head {
  font-weight: 600;
  border-bottom: 1px solid #f0f0f1;
}
.chat-notice-foot {
  justify-content: center;
  border-top: 1px solid #f0f0f1;
}
.chat-notice-action {
  padding: 0;
  color: #62626d;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.chat-notice-action:hover:not(:disabled) {
  color: #131317;
}
.chat-notice-action:disabled {
  color: #c2c2c6;
  cursor: default;
}
.chat-notice-list {
  max-height: 320px;
  padding: 4px;
  margin: 0;
  overflow: auto;
  list-style: none;
}
.chat-notice-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 9px 10px;
  cursor: pointer;
  border-radius: 8px;
}
.chat-notice-item:hover {
  background: #f5f5f5;
}
.chat-notice-avatar {
  display: grid;
  flex: 0 0 auto;
  width: 28px;
  height: 28px;
  place-items: center;
  color: #fff;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  border-radius: 50%;
}
.chat-notice-body {
  flex: 1;
  min-width: 0;
}
.chat-notice-title {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: space-between;
}
.chat-notice-title b {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.chat-notice-count {
  flex: 0 0 auto;
  color: #ca0005;
  font-size: 10px;
  font-style: normal;
}
.chat-notice-body small {
  display: block;
  margin-top: 3px;
  color: #8c8c8e;
  font-size: 11px;
}
.chat-notice-empty {
  padding: 34px 14px;
  color: #8c8c8e;
  font-size: 12px;
  text-align: center;
}
</style>
