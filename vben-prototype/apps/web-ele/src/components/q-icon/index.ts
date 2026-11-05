import { addIcon } from '@vben/icons';

import aiHead from '../../assets/qingicon/ai-head.svg?raw';
import arrowLeft from '../../assets/qingicon/arrow-left.svg?raw';
import arrowUpBracket from '../../assets/qingicon/arrow-up-bracket.svg?raw';
import bellOff from '../../assets/qingicon/bell-off.svg?raw';
import bell from '../../assets/qingicon/bell.svg?raw';
import brandAndroid from '../../assets/qingicon/brands/android.svg?raw';
import brandApple from '../../assets/qingicon/brands/apple.svg?raw';
import brandChrome from '../../assets/qingicon/brands/chrome.svg?raw';
import brandEdge from '../../assets/qingicon/brands/edge.svg?raw';
import brandFirefox from '../../assets/qingicon/brands/firefox.svg?raw';
import brandSafari from '../../assets/qingicon/brands/safari.svg?raw';
import brandWindows from '../../assets/qingicon/brands/windows.svg?raw';
import browser from '../../assets/qingicon/browser.svg?raw';
import channel from '../../assets/qingicon/channel.svg?raw';
import chat from '../../assets/qingicon/chat.svg?raw';
import check from '../../assets/qingicon/check.svg?raw';
import chevronDown from '../../assets/qingicon/chevron-down.svg?raw';
import chevronRight from '../../assets/qingicon/chevron-right.svg?raw';
import chevronUp from '../../assets/qingicon/chevron-up.svg?raw';
import clock from '../../assets/qingicon/clock.svg?raw';
import close from '../../assets/qingicon/close.svg?raw';
import code from '../../assets/qingicon/code.svg?raw';
import copy from '../../assets/qingicon/copy.svg?raw';
import device from '../../assets/qingicon/device.svg?raw';
import detailCollapse from '../../assets/qingicon/detail-collapse.svg?raw';
import detailExpand from '../../assets/qingicon/detail-expand.svg?raw';
import earth from '../../assets/qingicon/earth.svg?raw';
import edit from '../../assets/qingicon/edit.svg?raw';
import emoji from '../../assets/qingicon/emoji.svg?raw';
import exclamation from '../../assets/qingicon/exclamation.svg?raw';
import externalLink from '../../assets/qingicon/external-link.svg?raw';
import file from '../../assets/qingicon/file.svg?raw';
import filter from '../../assets/qingicon/filter.svg?raw';
import image from '../../assets/qingicon/image.svg?raw';
import mail from '../../assets/qingicon/mail.svg?raw';
import messageCircleDots from '../../assets/qingicon/message-circle-dots.svg?raw';
import messageCircleText from '../../assets/qingicon/message-circle-text.svg?raw';
import messageCircle from '../../assets/qingicon/message-circle.svg?raw';
import minus from '../../assets/qingicon/minus.svg?raw';
import more from '../../assets/qingicon/more.svg?raw';
import os from '../../assets/qingicon/os-windows.svg?raw';
import panelExpand from '../../assets/qingicon/panel-expand.svg?raw';
import panelFold from '../../assets/qingicon/panel-fold.svg?raw';
import paperclip from '../../assets/qingicon/paperclip.svg?raw';
import phone from '../../assets/qingicon/phone.svg?raw';
import pin from '../../assets/qingicon/pin.svg?raw';
import plus from '../../assets/qingicon/plus.svg?raw';
import power from '../../assets/qingicon/power.svg?raw';
import refresh from '../../assets/qingicon/refresh.svg?raw';
import robot from '../../assets/qingicon/robot.svg?raw';
import search from '../../assets/qingicon/search.svg?raw';
import send from '../../assets/qingicon/send.svg?raw';
import settings from '../../assets/qingicon/settings.svg?raw';
import shield from '../../assets/qingicon/shield.svg?raw';
import team from '../../assets/qingicon/team.svg?raw';
import trash from '../../assets/qingicon/trash.svg?raw';
import translate from '../../assets/qingicon/translate.svg?raw';
import user from '../../assets/qingicon/user.svg?raw';
import workflow from '../../assets/qingicon/workflow.svg?raw';

export const iconMap: Record<string, string> = {
  'ai-head': aiHead,
  'arrow-left': arrowLeft,
  'arrow-up-bracket': arrowUpBracket,
  'bell': bell,
  'bell-off': bellOff,
  'brand-android': brandAndroid,
  'brand-apple': brandApple,
  'brand-chrome': brandChrome,
  'brand-edge': brandEdge,
  'brand-firefox': brandFirefox,
  'brand-safari': brandSafari,
  'brand-windows': brandWindows,
  'browser': browser,
  'channel': channel,
  'chat': chat,
  'check': check,
  'chevron-down': chevronDown,
  'chevron-right': chevronRight,
  'chevron-up': chevronUp,
  'clock': clock,
  'close': close,
  'code': code,
  'copy': copy,
  'device': device,
  'detail-collapse': detailCollapse,
  'detail-expand': detailExpand,
  'earth': earth,
  'edit': edit,
  'emoji': emoji,
  'exclamation': exclamation,
  'external-link': externalLink,
  'file': file,
  'filter': filter,
  'image': image,
  'mail': mail,
  'message-circle': messageCircle,
  'message-circle-dots': messageCircleDots,
  'message-circle-text': messageCircleText,
  'minus': minus,
  'more': more,
  'os': os,
  'panel-expand': panelExpand,
  'panel-fold': panelFold,
  'paperclip': paperclip,
  'phone': phone,
  'pin': pin,
  'plus': plus,
  'power': power,
  'refresh': refresh,
  'robot': robot,
  'search': search,
  'send': send,
  'settings': settings,
  'shield': shield,
  'team': team,
  'trash': trash,
  'translate': translate,
  'user': user,
  'workflow': workflow,
};

export type QIconName = keyof typeof iconMap;

/**
 * 外层 `<svg>` 上需要向下继承的表现属性白名单。
 * 只承接描边/填充相关属性，避免把 width/height/viewBox/xmlns 带进 Iconify 容器。
 */
const svgInheritedAttrs = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
] as const;

/**
 * Vben 内置的侧栏折叠（ep:fold / ep:expand）与全局搜索 Esc 提示（mdi:keyboard-esc）
 * 默认会向 Iconify 在线接口取图。注册本地同风格图标，保证断网可用且不发起外链图标请求。
 */
addIcon('ep:fold', {
  body: svgBody(panelFold),
  height: 24,
  width: 24,
});
addIcon('ep:expand', {
  body: svgBody(panelExpand),
  height: 24,
  width: 24,
});
addIcon('mdi:keyboard-esc', {
  body: svgBody(close),
  height: 24,
  width: 24,
});

/**
 * 把本地 `<svg>` 转成 Iconify 可内联的 body：
 * Iconify 会自行创建 `<svg>`，若只截取内部 path，外层 `fill="none"`、
 * `stroke`、`stroke-width` 等表现属性会丢失，描边图标会被按实心填充渲染。
 * 这里用 `<g>` 承接外层表现属性（丢弃 width/height/viewBox/xmlns，避免与 Iconify 的容器冲突），
 * 不修改 SVG 文件本体。子节点上显式声明的同名属性会覆盖 `<g>` 的默认值。
 */
function svgBody(raw: string) {
  const source = raw.replace(/^\uFEFF/, '').trim();
  const openEnd = source.indexOf('>');
  const end = source.lastIndexOf('</svg>');
  if (openEnd === -1 || end === -1) {
    return source;
  }
  const openTag = source.slice(0, openEnd + 1);
  const attrs = svgInheritedAttrs
    .map((name) => {
      const matched = openTag.match(new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`, 'i'));
      return matched ? `${name}=${matched[1]}` : '';
    })
    .filter(Boolean)
    .join(' ');
  const body = source.slice(openEnd + 1, end).trim();
  return attrs ? `<g ${attrs}>${body}</g>` : body;
}
