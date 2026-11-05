import { defineComponent, h } from 'vue';

import QIcon from './QIcon.vue';

/** 把本地 qingicon SVG 包装成可直接用于菜单/路由 meta.icon 的组件 */
export function qicon(name: string) {
  return defineComponent({
    name: `QIcon_${name.replace(/-/g, '_')}`,
    setup() {
      return () => h(QIcon, { name, size: 16 });
    },
  });
}
