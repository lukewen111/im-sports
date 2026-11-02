import type { MenuRecordRaw } from '@vben/types';

import { QiAppsSquare, QiUserGroup } from 'qingicon-vue';

const canViewChannels = typeof window === 'undefined' || new URLSearchParams(window.location.search).get('role') !== 'none';

export const prototypeMenus: MenuRecordRaw[] = [
  {
    icon: QiUserGroup,
    name: '团队',
    path: '/team/members/all',
  },
  ...(canViewChannels ? [{ icon: QiAppsSquare, name: '渠道管理', path: '/channels' }] : []),
];
