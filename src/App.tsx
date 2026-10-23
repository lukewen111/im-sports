import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  IconApps,
  IconClockCircle,
  IconCustomerService,
  IconDashboard,
  IconDown,
  IconEdit,
  IconEye,
  IconFullscreen,
  IconMenu,
  IconMessage,
  IconMobile,
  IconMoonFill,
  IconNotification,
  IconRefresh,
  IconRobot,
  IconSearch,
  IconSettings,
  IconTranslate,
  IconUser,
  IconUserGroup,
} from '@arco-design/web-react/icon';
import { ChannelProvider } from './store';
import { ChannelsPage } from './pages/ChannelsPage';
import { ChannelClientPage } from './pages/ChannelClientPage';

const menuItems = [
  { label: '数据总览', icon: <IconDashboard /> },
  { label: '客户咨询', icon: <IconMessage /> },
  { label: '客户列表', icon: <IconClockCircle /> },
  { label: '客服监控', icon: <IconEye /> },
  { label: '工单列表', icon: <IconEdit /> },
  { label: '用户管理', icon: <IconUser /> },
  { label: '团队管理', icon: <IconUserGroup /> },
  { label: '客服信息管理', icon: <IconCustomerService /> },
];

function ProductSidebar() {
  return <aside className="product-sidebar">
    <div className="product-brand"><span className="brand-mark"><IconCustomerService /></span><strong>IM Support</strong></div>
    <div className="nav-section-title"><span><IconRobot />AI客服</span><IconDown /></div>
    <nav className="product-nav" aria-label="产品功能">
      {menuItems.map((item) => <button type="button" key={item.label} tabIndex={-1}>{item.icon}<span>{item.label}</span></button>)}
      <button type="button" className="active" aria-current="page"><IconApps /><span>渠道管理</span></button>
    </nav>
    <div className="sidebar-footer"><button type="button" aria-label="收起侧边栏"><IconMenu /></button><button type="button" aria-label="固定侧边栏"><IconSettings /></button></div>
  </aside>;
}

function ProductHeader() {
  return <header className="product-header">
    <div className="header-leading">
      <button type="button" aria-label="展开菜单"><IconMenu /></button>
      <button type="button" aria-label="刷新"><IconRefresh /></button>
      <span className="header-context"><IconMobile />渠道管理</span>
    </div>
    <div className="header-actions">
      <div className="global-search"><IconSearch /><span>搜索</span><kbd>Ctrl K</kbd></div>
      <button type="button" aria-label="设置"><IconSettings /></button>
      <button type="button" aria-label="深色模式"><IconMoonFill /></button>
      <button type="button" aria-label="语言"><IconTranslate /></button>
      <span className="timezone">当前时区: (UTC+08:00)</span>
      <button type="button" aria-label="全屏"><IconFullscreen /></button>
      <span className="presence"><i />离线</span>
      <button type="button" aria-label="通知"><IconNotification /></button>
      <span className="user-avatar">OP<i /></span>
    </div>
  </header>;
}

function AppRoutes() {
  const location = useLocation();
  if (location.pathname.startsWith('/widget/') || location.pathname.startsWith('/chat/')) {
    return <Routes><Route path="/widget/:channelId" element={<ChannelClientPage type="web-widget" />} /><Route path="/chat/:channelId" element={<ChannelClientPage type="chat-page" />} /><Route path="*" element={<Navigate to="/channels" replace />} /></Routes>;
  }
  return <div className="app-shell">
    <ProductSidebar />
    <div className="product-workspace">
      <ProductHeader />
      <main className="app-main">
        <div className="page-title"><h1>渠道管理</h1></div>
        <div className="page-content"><Routes><Route path="/" element={<Navigate to="/channels" replace />} /><Route path="/channels/*" element={<ChannelsPage />} /><Route path="*" element={<Navigate to="/channels" replace />} /></Routes></div>
      </main>
    </div>
  </div>;
}

export default function App() {
  return <ChannelProvider><AppRoutes /></ChannelProvider>;
}

