import { defineOverridesPreferences } from '@vben/preferences';

const logoSource = `${import.meta.env.BASE_URL}chatscale-symbol.svg`;

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
    name: 'ChatScale',
  },
  breadcrumb: {
    enable: false,
    hideOnlyOne: false,
    showHome: false,
    showIcon: true,
  },
  copyright: {
    enable: false,
  },
  header: {
    height: 48,
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
    width: 208,
  },
  tabbar: {
    enable: false,
  },
  theme: {
    // 近黑主色（#131317），让 Element Plus 全色阶随之收敛，蓝色只保留为信息面。
    colorDestructive: '#CA0005',
    colorPrimary: 'hsl(240 6% 8%)',
    colorSuccess: '#1E9E5B',
    colorWarning: '#D0810B',
    fontSize: 14,
    mode: 'light',
    radius: '0.75',
  },
  widget: {
    fullscreen: true,
    globalSearch: false,
    languageToggle: true,
    lockScreen: false,
    notification: true,
    refresh: true,
    sidebarToggle: true,
    themeToggle: true,
    timezone: true,
  },
});
