import type { MenuRecordRaw } from '@vben/types';

import { QiAppsSquare, QiMessageSquareAi, QiPersonalization, QiUser, QiUserGroup } from 'qingicon-vue';
import type { usePrototypeAccess } from './team/access-store';

export function buildPrototypeMenus(access: ReturnType<typeof usePrototypeAccess>): MenuRecordRaw[] {
  const p = access.permissions;
  return [
    ...(p.assigned !== 'none' || p.pending ? [{ icon: QiMessageSquareAi, name: '聊天', path: '/inbox' }] : []),
    ...(p.customers !== 'none' ? [{ icon: QiUser, name: '客户', path: '/customers' }] : []),
    ...(access.teamEntry ? [{ icon: QiUserGroup, name: '团队', path: access.teamEntry }] : []),
    ...(p.channels ? [{ icon: QiAppsSquare, name: '渠道管理', path: '/channels' }] : []),
    ...(p.settings ? [{ icon: QiPersonalization, name: '聊天与接待', path: '/reception' }] : []),
  ];
}
