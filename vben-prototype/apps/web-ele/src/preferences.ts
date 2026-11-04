import { defineOverridesPreferences } from '@vben/preferences';

const logoSource = `${import.meta.env.BASE_URL}im-support-logo.svg`;

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  app: {
    contentPadding: 0,
    defaultHomePath: '/inbox',
    enableCheckUpdates: false,
    enablePreferences: false,
    layout: 'sidebar-nav',
    name: 'IM Support',
  },
  breadcrumb: {
    enable: true,
    hideOnlyOne: false,
    showHome: false,
    showIcon: true,
  },
  copyright: {
    enable: false,
  },
  header: {
    height: 70,
  },
  logo: {
    enable: true,
    source: logoSource,
  },
  navigation: {
    accordion: true,
    split: false,
    styleType: 'rounded',
  },
  sidebar: {
    collapsed: false,
    collapsedButton: true,
    draggable: false,
    // Vben 当前布局内部以 true 表示禁用鼠标进入后自动展开／离开收起。
    expandOnHover: true,
    fixedButton: false,
    width: 224,
  },
  tabbar: {
    enable: false,
  },
  theme: {
    colorPrimary: 'hsl(217 100% 54%)',
    fontSize: 14,
    mode: 'light',
    radius: '0.5',
  },
  widget: {
    fullscreen: true,
    globalSearch: true,
    languageToggle: true,
    lockScreen: false,
    notification: true,
    refresh: true,
    sidebarToggle: true,
    themeToggle: true,
    timezone: true,
  },
});
