import type { MenuRecordRaw } from '@vben/types';

import { qicon } from '#/components/q-icon/menu-icons';
import type { usePrototypeAccess } from './team/access-store';

export function buildPrototypeMenus(access: ReturnType<typeof usePrototypeAccess>): MenuRecordRaw[] {
  const p = access.permissions;
  return [
    ...(p.assigned !== 'none' || p.pending ? [{ icon: qicon('chat'), name: '聊天', path: '/inbox' }] : []),
    ...(p.customers !== 'none' ? [{ icon: qicon('user'), name: '客户', path: '/customers' }] : []),
    ...(access.teamEntry ? [{ icon: qicon('team'), name: '团队', path: access.teamEntry }] : []),
    ...(p.channels ? [{ icon: qicon('channel'), name: '渠道', path: '/channels' }] : []),
    ...(p.reports || p.reportsService
      ? [
          {
            children: [
              ...(p.reports ? [{ name: '概览', path: '/reports/overview' }] : []),
              ...(p.reportsService ? [{ name: '客服', path: '/reports/service' }] : []),
            ],
            icon: qicon('chart'),
            name: '报告',
            path: '/reports',
          },
        ]
      : []),
    ...(p.campaigns ? [{ icon: qicon('megaphone'), name: '活动', path: '/campaigns' }] : []),
    ...(p.settings ? [{ icon: qicon('settings'), name: '设置', path: '/settings/reception/auto-message' }] : []),
  ];
}
