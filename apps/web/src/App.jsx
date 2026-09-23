import { NavLink, Route, Routes, Link } from 'react-router-dom';
import Home from './pages/Home.jsx';
import MatchPage from './pages/Match.jsx';
import LivePage from './pages/Live.jsx';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>Fudbol Analiz</span>
        </Link>
        <nav>
          <NavLink to="/" end>O'yinlar</NavLink>
          <NavLink to="/live" className="nav-live">
            <span className="dot" /> Live
          </NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="*" element={<div className="empty">Sahifa topilmadi. <Link to="/">Bosh sahifa</Link></div>} />
        </Routes>
      </main>
      <footer className="footer">
        Hozircha <b>mock ma'lumotlar</b> bilan ishlaydi — haqiqiy API keyinroq ulanadi. Tahlillar ehtimollarga asoslangan, kafolat emas.
      </footer>
    </div>
  );
}
