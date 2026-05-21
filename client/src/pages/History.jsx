import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Filler,
} from 'chart.js';
import { getRecords } from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

export default function History({ profile }) {
  const [records, setRecords] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRecords(90)
      .then((data) => {
        setRecords(data.records || []);
        setStreak(data.streak || 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading-screen">加载中...</div>;
  }

  if (!profile) {
    return (
      <div className="empty-state">
        <div className="icon">📅</div>
        <h3>还没有个人档案</h3>
        <p>请先去「打卡」页面完成设置</p>
      </div>
    );
  }

  // Build chart data (reverse to chronological order)
  const withWeight = records
    .filter((r) => r.morning_weight)
    .reverse();

  const labels = withWeight.map((r) => r.date.slice(5)); // MM-DD
  const weights = withWeight.map((r) => r.morning_weight);

  // Target line
  const targetLine = [];
  if (profile && withWeight.length > 0) {
    const start = profile.starting_weight;
    const goal = profile.goal_weight;
    const firstDate = new Date(withWeight[0].date);
    const lastDate = new Date(withWeight[withWeight.length - 1].date);
    const totalDays = Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)) || 1;
    const dailyDrop = (start - goal) / ((new Date(profile.deadline) - new Date(profile.phase_start_date)) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < withWeight.length; i++) {
      const d = new Date(withWeight[i].date);
      const daysFromStart = Math.ceil((d - new Date(profile.phase_start_date)) / (1000 * 60 * 60 * 24));
      targetLine.push(start - dailyDrop * Math.max(0, daysFromStart));
    }
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: '实际体重 (kg)',
        data: weights,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
        borderWidth: 2.5,
      },
      ...(targetLine.length > 0
        ? [
            {
              label: '目标线 (kg)',
              data: targetLine,
              borderColor: '#f59e0b',
              borderDash: [6, 3],
              borderWidth: 1.5,
              pointRadius: 0,
              fill: false,
              tension: 0.3,
            },
          ]
        : []),
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: { boxWidth: 12, padding: 16, font: { size: 11 } },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} kg`,
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'kg', font: { size: 11 } },
        ticks: { font: { size: 10 } },
      },
      x: {
        ticks: { font: { size: 10 }, maxTicksLimit: 10 },
      },
    },
  };

  // Stats
  const latestWeight = withWeight.length > 0 ? withWeight[withWeight.length - 1].morning_weight : null;
  const firstWeight = withWeight.length > 0 ? withWeight[0].morning_weight : null;
  const weekRecords = records.filter((r) => {
    const d = new Date(r.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && r.morning_weight;
  }).length;

  return (
    <div>
      {/* 摘要统计 */}
      <div className="stat-grid">
        <div className="stat-item">
          <div className="stat-value">{latestWeight ?? '—'}</div>
          <div className="stat-label">最新体重 kg</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">
            {firstWeight && latestWeight
              ? `${(firstWeight - latestWeight > 0 ? '-' : '+')}${Math.abs(firstWeight - latestWeight).toFixed(1)}`
              : '—'}
          </div>
          <div className="stat-label">期间变化 kg</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{streak}</div>
          <div className="stat-label">连续打卡 天</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{weekRecords}/7</div>
          <div className="stat-label">近7天称重</div>
        </div>
      </div>

      {/* 体重趋势图 */}
      {withWeight.length >= 2 ? (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">体重趋势</div>
          <div className="history-chart">
            <Line data={chartData} options={chartOptions} />
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-title">体重趋势</div>
          <div className="empty-state">
            <div className="icon">📈</div>
            <p>数据还太少，至少需要 2 天称重数据才能显示趋势图</p>
          </div>
        </div>
      )}

      {/* 历史记录列表 */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">最近记录</div>
        {records.length === 0 ? (
          <div className="empty-state">
            <p>还没有任何打卡记录</p>
          </div>
        ) : (
          records.slice(0, 30).map((r) => (
            <div key={r.date} className="record-item">
              <div>
                <div className="record-date">{r.date}</div>
                <div className="record-meta">
                  {r.exercise_type || '无运动'} · {r.exercise_steps > 0 ? `${r.exercise_steps}步` : ''}
                  {r.self_diet_score ? ` · 饮食${r.self_diet_score}分` : ''}
                </div>
              </div>
              <div className="record-weight">
                {r.morning_weight ? `${r.morning_weight} kg` : '未称'}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
