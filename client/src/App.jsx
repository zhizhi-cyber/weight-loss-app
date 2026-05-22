import { useState, useEffect, Component } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CheckIn from './pages/CheckIn';
import History from './pages/History';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import { getProfile } from './api';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon">⚠️</div>
          <h3>出了点问题</h3>
          <p style={{ marginBottom: 16 }}>{this.state.error.message}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>刷新</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    getProfile().then((data) => {
      if (data.exists) setProfile(data);
      else navigate('/checkin');
    }).catch(console.error).finally(() => setLoading(false));
  }, [navigate]);

  // 检测移动端键盘弹起，隐藏底部导航
  useEffect(() => {
    if (!window.visualViewport) return;
    const onResize = () => {
      const gap = window.innerHeight - window.visualViewport.height;
      setKeyboardOpen(gap > 80);
    };
    window.visualViewport.addEventListener('resize', onResize);
    return () => window.visualViewport.removeEventListener('resize', onResize);
  }, []);

  if (loading) return <div className="loading-screen">Loading...</div>;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <svg className="header-logo" viewBox="0 0 32 32" width="28" height="28" fill="none">
            <circle cx="16" cy="16" r="14" stroke="#A4F962" strokeWidth="2" />
            <path d="M10 18 L14 14 L17 17 L22 10" stroke="#A4F962" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="22" cy="10" r="2" fill="#A4F962" />
          </svg>
          <h1>身体管理</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {profile && (
            <span className="header-goal">{profile.starting_weight} → {profile.goal_weight}kg</span>
          )}
          <NavLink to="/settings" className="header-gear" title="设置">
            <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="1.5" fill="none">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </NavLink>
        </div>
      </header>

      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard profile={profile} />} />
            <Route path="/checkin" element={<CheckIn profile={profile} onProfileUpdate={setProfile} />} />
            <Route path="/history" element={<History profile={profile} />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/settings" element={<Settings profile={profile} onProfileUpdate={setProfile} />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <nav className={`bottom-nav${keyboardOpen ? ' nav-hidden' : ''}`}>
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">⌂</span>
          <span className="nav-label">首页</span>
        </NavLink>
        <NavLink to="/checkin" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">+</span>
          <span className="nav-label">打卡</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">◷</span>
          <span className="nav-label">历史</span>
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">?</span>
          <span className="nav-label">问AI</span>
        </NavLink>
      </nav>
    </div>
  );
}
