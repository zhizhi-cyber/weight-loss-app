import { useState, useEffect, Component } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import CheckIn from './pages/CheckIn';
import History from './pages/History';
import { getProfile } from './api';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="empty-state" style={{ paddingTop: 80 }}>
          <div className="icon">⚠️</div>
          <h3>出了点问题</h3>
          <p style={{ marginBottom: 16 }}>{this.state.error.message}</p>
          <button className="btn btn-primary btn-sm" onClick={() => window.location.reload()}>
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getProfile()
      .then((data) => {
        if (data.exists) {
          setProfile(data);
        } else {
          navigate('/checkin');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [navigate]);

  if (loading) {
    return <div className="loading-screen">加载中...</div>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>减肥陪伴</h1>
        {profile && (
          <span className="header-goal">
            {profile.starting_weight}kg → {profile.goal_weight}kg
          </span>
        )}
      </header>

      <main className="app-main">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard profile={profile} />} />
            <Route path="/checkin" element={<CheckIn profile={profile} onProfileUpdate={setProfile} />} />
            <Route path="/history" element={<History profile={profile} />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <nav className="bottom-nav">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📊</span>
          <span className="nav-label">首页</span>
        </NavLink>
        <NavLink to="/checkin" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📝</span>
          <span className="nav-label">打卡</span>
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
          <span className="nav-icon">📅</span>
          <span className="nav-label">历史</span>
        </NavLink>
      </nav>
    </div>
  );
}
