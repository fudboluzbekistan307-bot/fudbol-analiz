import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

// Telegram Mini App ichida bo'lsa — to'liq ekranga yoyamiz
window.addEventListener('load', () => {
  const tg = window.Telegram?.WebApp;
  if (tg?.initData !== undefined) {
    tg.ready?.();
    tg.expand?.();
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
