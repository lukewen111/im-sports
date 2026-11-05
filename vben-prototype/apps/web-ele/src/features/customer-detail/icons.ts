import type { Component, PropType } from 'vue';

import { defineComponent, h } from 'vue';

import {
  QiCalendar,
  QiClock,
  QiComputer,
  QiCopy,
  QiEarth,
  QiEye,
  QiFile,
  QiGroup,
  QiKey,
  QiLink,
  QiMail,
  QiMapPin,
  QiMonitor,
  QiNote,
  QiPencil,
  QiPhone,
  QiTag,
  QiUser,
} from 'qingicon-vue';

import QIcon from '#/components/q-icon/QIcon.vue';

/**
 * 客户详情收起 / 展开图标：圆角外框 + 中间竖线分栏，
 * 收起箭头朝右（面板向右收窄），展开箭头朝左，与顶栏分栏图标同一家族。
 */
function detailPanelIcon(name: 'detail-collapse' | 'detail-expand', label: string) {
  return defineComponent({
    name: label,
    props: {
      size: { default: 16, type: [Number, String] as PropType<number | string> },
    },
    setup(props) {
      return () => h(QIcon, { name, size: props.size });
    },
  });
}

/**
 * 客户详情临时图标入口。
 * 并行的 QIcon 组件 / 本地图标库就绪后，只需替换本文件的实现，
 * 其它客户详情组件一律从 detailIcons 取图标，不做散乱 import。
 */
export const detailIcons = {
  assignee: QiUser,
  browser: QiEarth,
  calendar: QiCalendar,
  channel: QiEarth,
  chat: QiFile,
  collapse: detailPanelIcon('detail-collapse', 'CustomerDetailCollapseIcon'),
  copy: QiCopy,
  device: QiMonitor,
  duration: QiClock,
  email: QiMail,
  expand: detailPanelIcon('detail-expand', 'CustomerDetailExpandIcon'),
  history: QiClock,
  ip: QiEarth,
  key: QiKey,
  link: QiLink,
  location: QiMapPin,
  note: QiNote,
  os: QiComputer,
  pencil: QiPencil,
  phone: QiPhone,
  session: QiFile,
  source: QiEye,
  tag: QiTag,
  team: QiGroup,
  time: QiClock,
  user: QiUser,
  visit: QiEye,
} as const satisfies Record<string, Component>;

export type DetailIconName = keyof typeof detailIcons;
