import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import { setCreateRoot } from '@arco-design/web-react/es/_util/react-dom';
import '@arco-design/web-react/dist/css/arco.css';
import './styles/global.css';
import App from './App';

setCreateRoot(createRoot);

createRoot(document.getElementById('root')!).render(
  <StrictMode><ConfigProvider locale={zhCN}><HashRouter><App /></HashRouter></ConfigProvider></StrictMode>,
);

