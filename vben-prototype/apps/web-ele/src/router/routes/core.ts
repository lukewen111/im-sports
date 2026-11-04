import type { RouteRecordRaw } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';

import { QiAppsSquare, QiMessageSquareAi, QiPersonalization, QiRobot, QiUser, QiUserGroup } from 'qingicon-vue';

import { $t } from '#/locales';

const BasicLayout = () => import('#/layouts/basic.vue');
const AuthPageLayout = () => import('#/layouts/auth.vue');
/** 全局404页面 */
const fallbackNotFoundRoute: RouteRecordRaw = {
  component: () => import('#/views/_core/fallback/not-found.vue'),
  meta: {
    hideInBreadcrumb: true,
    hideInMenu: true,
    hideInTab: true,
    title: '404',
  },
  name: 'FallbackNotFound',
  path: '/:path(.*)*',
};

/** 基本路由，这些路由是必须存在的 */
const coreRoutes: RouteRecordRaw[] = [
  {
    component: () => import('#/views/channels/client.vue'),
    meta: { hideInMenu: true, hideInTab: true, title: '聊天页面' },
    name: 'ChannelChat',
    path: '/chat/:channelId',
  },
  {
    component: () => import('#/views/channels/client.vue'),
    meta: { hideInMenu: true, hideInTab: true, title: '网站小部件' },
    name: 'ChannelWidget',
    path: '/widget/:channelId',
  },
  /**
   * 根路由
   * 使用基础布局，作为所有页面的父级容器，子级就不必配置BasicLayout。
   * 此路由必须存在，且不应修改
   */
  {
    component: BasicLayout,
    meta: {
      hideInBreadcrumb: true,
      title: 'Root',
    },
    name: 'Root',
    path: '/',
    redirect: preferences.app.defaultHomePath,
    children: [
      { name: 'Inbox', path: 'inbox', component: () => import('#/views/inbox/app.vue'), meta: { icon: QiMessageSquareAi, title: '聊天' } },
      { name: 'Customers', path: 'customers', component: () => import('#/views/customers/app.vue'), meta: { icon: QiUser, title: '客户' } },
      {
        name: 'Team',
        path: 'team',
        redirect: '/team/members/all',
        meta: { icon: QiUserGroup, title: '团队' },
        children: [
          {
            name: 'TeamRoles',
            path: 'roles',
            component: () => import('#/views/team/app.vue'),
            meta: { icon: QiUserGroup, title: '角色配置' },
          },
          {
            name: 'TeamMembers',
            path: 'members',
            redirect: '/team/members/all',
            meta: { icon: QiUserGroup, title: '成员' },
            children: [
              {
                name: 'TeamAllMembers',
                path: 'all',
                component: () => import('#/views/team/app.vue'),
                meta: { icon: QiUserGroup, title: '全部人员' },
              },
              {
                name: 'TeamHumanMembers',
                path: 'human',
                component: () => import('#/views/team/app.vue'),
                meta: { icon: QiUser, title: '人类成员' },
              },
              {
                name: 'TeamAiMembers',
                path: 'ai',
                component: () => import('#/views/team/app.vue'),
                meta: { icon: QiRobot, title: 'AI 成员' },
              },
            ],
          },
          {
            name: 'Teams',
            path: 'teams',
            component: () => import('#/views/team/app.vue'),
            meta: { icon: QiUserGroup, title: '团队' },
          },
        ],
      },
      {
        name: 'Channels',
        path: 'channels',
        component: () => import('#/views/channels/app.vue'),
        meta: {
          affixTab: true,
          icon: QiAppsSquare,
          title: '渠道管理',
        },
      },
      { name: 'Reception', path: 'reception', component: () => import('#/views/reception/app.vue'), meta: { icon: QiPersonalization, title: '聊天与接待' } },
      { name: 'Personal', path: 'personal', component: () => import('#/views/personal/app.vue'), meta: { hideInMenu: true, icon: QiUser, title: '个人中心' } },
    ],
  },
  {
    component: AuthPageLayout,
    meta: {
      hideInTab: true,
      title: 'Authentication',
    },
    name: 'Authentication',
    path: '/auth',
    redirect: LOGIN_PATH,
    children: [
      {
        name: 'Login',
        path: 'login',
        component: () => import('#/views/_core/authentication/login.vue'),
        meta: {
          title: $t('page.auth.login'),
        },
      },
      {
        name: 'CodeLogin',
        path: 'code-login',
        component: () => import('#/views/_core/authentication/code-login.vue'),
        meta: {
          title: $t('page.auth.codeLogin'),
        },
      },
      {
        name: 'QrCodeLogin',
        path: 'qrcode-login',
        component: () =>
          import('#/views/_core/authentication/qrcode-login.vue'),
        meta: {
          title: $t('page.auth.qrcodeLogin'),
        },
      },
      {
        name: 'ForgetPassword',
        path: 'forget-password',
        component: () =>
          import('#/views/_core/authentication/forget-password.vue'),
        meta: {
          title: $t('page.auth.forgetPassword'),
        },
      },
      {
        name: 'Register',
        path: 'register',
        component: () => import('#/views/_core/authentication/register.vue'),
        meta: {
          title: $t('page.auth.register'),
        },
      },
    ],
  },
];

export { coreRoutes, fallbackNotFoundRoute };
