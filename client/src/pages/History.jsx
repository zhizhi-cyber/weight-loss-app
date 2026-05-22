import { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler,
} from 'chart.js';
import { getRecords, getAnalysis } from '../api';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Filler);

function Calendar({ records, year, month, onSelectDate }) {
  const today = new Date().toISOString().split('T')[0];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const recordMap = {};
  records.forEach((r) => { recordMap[r.date] = r; });

  const dayHeaders = ['日', '一', '二', '三', '四', '五', '六'];
  const cells = [];

  for (let i = 0; i < startPad; i++) {
    cells.push(<div key={`pad-${i}`} className="calendar-day empty" />);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const rec = recordMap[dateStr];
    const isToday = dateStr === today;
    const hasRecord = !!rec;
    const wt = rec?.morning_weight;

    let cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (hasRecord) cls += ' has-record';
    if (wt && records.length > 1) {
      const prevDay = records.find((r) => r.date < dateStr && r.morning_weight);
      if (prevDay && wt < prevDay.morning_weight - 0.5) cls += ' good-day';
      else if (prevDay && wt > prevDay.morning_weight + 0.5) cls += ' bad-day';
    }

    cells.push(
      <div key={dateStr} className={cls} onClick={() => onSelectDate(dateStr)}>
        <span>{d}</span>
        {wt && <span className="calendar-day-weight">{wt}</span>}
      </div>
    );
  }

  return (
    <div>
      <div className="calendar-grid">
        {dayHeaders.map((h) => <div key={h} className="calendar-day-header">{h}</div>)}
        {cells}
      </div>
    </div>
  );
}

export default function History({ profile }) {
  const [records, setRecords] = useState([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [detailTab, setDetailTab] = useState('record');

  useEffect(() => {
    getRecords(90).then((data) => {
      setRecords(data.records || []);
      setStreak(data.streak || 0);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  const handleSelectDate = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedAnalysis(null);
    setDetailTab('record');
    setLoadingAnalysis(true);
    try {
      const data = await getAnalysis(dateStr);
      if (data.analysis) setSelectedAnalysis(data.analysis);
    } catch (err) { console.error(err); }
    finally { setLoadingAnalysis(false); }
  };

  if (loading) return <div className="loading-screen">Loading...</div>;
  if (!profile) {
    return (
      <div className="empty-state">
        <div className="icon">📅</div>
        <h3>还没有个人档案</h3>
        <p>请先去「打卡」页面完成设置</p>
      </div>
    );
  }

  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));

  // Chart data
  const withWeight = records.filter((r) => r.morning_weight).reverse();
  const labels = withWeight.map((r) => r.date.slice(5));
  const weights = withWeight.map((r) => r.morning_weight);

  // Target line
  const targetLine = [];
  if (profile && withWeight.length > 0) {
    const start = profile.starting_weight;
    const goal = profile.goal_weight;
    const journeyStart = new Date(profile.phase_start_date);
    const journeyDeadline = new Date(profile.deadline);
    const journeyDays = Math.max(1, Math.ceil((journeyDeadline - journeyStart) / (1000 * 60 * 60 * 24)));
    const dailyDrop = (start - goal) / journeyDays;
    for (let i = 0; i < withWeight.length; i++) {
      const daysFromStart = Math.ceil((new Date(withWeight[i].date) - journeyStart) / (1000 * 60 * 60 * 24));
      targetLine.push(start - dailyDrop * Math.max(0, daysFromStart));
    }
  }

  const chartData = {
    labels,
    datasets: [
      {
        label: '体重',
        data: weights,
        borderColor: '#A4F962',
        backgroundColor: 'rgba(164, 249, 98, 0.08)',
        fill: true, tension: 0.4, pointRadius: 3, pointHoverRadius: 6, borderWidth: 2,
      },
      ...(targetLine.length > 0 ? [{
        label: '目标线',
        data: targetLine,
        borderColor: '#FFD60A',
        borderDash: [6, 3],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
        tension: 0.4,
      }] : []),
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 10 }, color: '#8E8E93' } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y} kg` } },
    },
    scales: {
      y: { title: { display: true, text: 'kg', font: { size: 10 }, color: '#8E8E93' }, ticks: { font: { size: 10 }, color: '#8E8E93' }, grid: { color: '#2C2C2E' } },
      x: { ticks: { font: { size: 10 }, color: '#8E8E93', maxTicksLimit: 8 }, grid: { display: false } },
    },
  };

  const latestWeight = withWeight.length > 0 ? withWeight[withWeight.length - 1].morning_weight : null;
  const firstWeight = withWeight.length > 0 ? withWeight[0].morning_weight : null;
  const weekRecords = records.filter((r) => {
    const d = new Date(r.date); const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo && r.morning_weight;
  }).length;

  // Selected date detail
  const selectedRecord = selectedDate ? records.find((r) => r.date === selectedDate) : null;

  return (
    <div>
      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-item">
          <div className="stat-value accent">{latestWeight ?? '—'}</div>
          <div className="stat-label">最新 kg</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">
            {firstWeight && latestWeight
              ? `${firstWeight > latestWeight ? '-' : '+'}${Math.abs(firstWeight - latestWeight).toFixed(1)}`
              : '—'}
          </div>
          <div className="stat-label">变化 kg</div>
        </div>
        <div className="stat-item">
          <div className="stat-value accent">{streak}</div>
          <div className="stat-label">连续天</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{weekRecords}/7</div>
          <div className="stat-label">本周称重</div>
        </div>
      </div>

      {/* Weight Chart */}
      {withWeight.length >= 2 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">体重趋势</div>
          <div className="history-chart"><Line data={chartData} options={chartOptions} /></div>
        </div>
      )}

      {/* Calendar */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="calendar-month-header">
          <button className="calendar-month-nav" onClick={prevMonth}>‹</button>
          <div className="calendar-month-title">{year}年{month + 1}月</div>
          <button className="calendar-month-nav" onClick={nextMonth}>›</button>
        </div>
        <Calendar records={records} year={year} month={month} onSelectDate={handleSelectDate} />
        {selectedRecord && (
          <div className="day-detail-panel">
            <div className="day-detail-tabs">
              <button className={`day-detail-tab ${detailTab === 'record' ? 'active' : ''}`} onClick={() => setDetailTab('record')}>打卡数据</button>
              <button className={`day-detail-tab ${detailTab === 'analysis' ? 'active' : ''}`} onClick={() => setDetailTab('analysis')}>AI 复盘</button>
            </div>

            {detailTab === 'record' && (
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
                {selectedRecord.morning_weight && <div><strong style={{ color: 'var(--text)' }}>体重</strong> {selectedRecord.morning_weight}kg</div>}
                {(selectedRecord.breakfast || selectedRecord.lunch || selectedRecord.dinner) && (
                  <div><strong style={{ color: 'var(--text)' }}>饮食</strong> 早:{selectedRecord.breakfast || '—'} 午:{selectedRecord.lunch || '—'} 晚:{selectedRecord.dinner || '—'}</div>
                )}
                {selectedRecord.snacks && <div><strong style={{ color: 'var(--text)' }}>零食</strong> {selectedRecord.snacks}</div>}
                {selectedRecord.exercise_type && <div><strong style={{ color: 'var(--text)' }}>运动</strong> {selectedRecord.exercise_type} {selectedRecord.exercise_duration || 0}min · {selectedRecord.exercise_steps || 0}步</div>}
                <div><strong style={{ color: 'var(--text)' }}>睡眠</strong> {selectedRecord.sleep_bedtime || '?'}→{selectedRecord.sleep_waketime || '?'} 夜醒{selectedRecord.sleep_interruptions || 0}次 精神{selectedRecord.sleep_energy || '?'}/10</div>
                {selectedRecord.water_intake && <div><strong style={{ color: 'var(--text)' }}>饮水</strong> {selectedRecord.water_intake}L</div>}
                <div><strong style={{ color: 'var(--text)' }}>自评</strong> 饮食{selectedRecord.self_diet_score || '?'}/10 运动{selectedRecord.self_exercise_score || '?'}/10</div>
                {selectedRecord.body_bowel && <div><strong style={{ color: 'var(--text)' }}>排便</strong> {selectedRecord.body_bowel}</div>}
              </div>
            )}

            {detailTab === 'analysis' && (
              loadingAnalysis ? (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-tertiary)' }}>
                  <span className="loading-spinner" /> 加载中...
                </div>
              ) : selectedAnalysis ? (
                <div className="ai-report">
                  {selectedAnalysis.data_summary && <div className="ai-section"><h4>今日总结</h4><p>{selectedAnalysis.data_summary}</p></div>}
                  {selectedAnalysis.calorie_bill && <div className="ai-section"><h4>热量账单</h4><p>{selectedAnalysis.calorie_bill}</p></div>}
                  {selectedAnalysis.nutrition && <div className="ai-section"><h4>营养结构</h4><p>{selectedAnalysis.nutrition}</p></div>}
                  {selectedAnalysis.weight_cause && <div className="ai-section"><h4>体重变化</h4><p>{selectedAnalysis.weight_cause}</p></div>}
                  {selectedAnalysis.total_goal_json && <div className="ai-section"><h4>总目标</h4><p>{selectedAnalysis.total_goal_json}</p></div>}
                  {selectedAnalysis.phase_goal_json && <div className="ai-section"><h4>阶段目标</h4><p>{selectedAnalysis.phase_goal_json}</p></div>}
                  {selectedAnalysis.highlights && <div className="ai-section"><h4>成长亮点</h4><p>{selectedAnalysis.highlights}</p></div>}
                  {selectedAnalysis.problems && <div className="ai-section"><h4>问题行为</h4><p>{selectedAnalysis.problems}</p></div>}
                  {selectedAnalysis.suggestions && <div className="ai-section"><h4>明日关键调整</h4><p>{selectedAnalysis.suggestions}</p></div>}
                </div>
              ) : (
                <div className="ai-empty"><p>该日没有 AI 复盘</p></div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
