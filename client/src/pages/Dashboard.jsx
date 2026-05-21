import { useState, useEffect, useCallback } from 'react';
import { getTodayRecord, generateAnalysis, getRecords } from '../api';

function calcTarget(profile) {
  const start = profile.starting_weight;
  const goal = profile.goal_weight;
  const totalToLose = start - goal;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(profile.deadline);
  deadline.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil((deadline - new Date(profile.phase_start_date)) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
  const daysPassed = totalDays - remainingDays;
  const dailyTarget = totalToLose / totalDays;
  const todayTarget = start - (dailyTarget * daysPassed);
  return { totalToLose, remainingDays, daysPassed, todayTarget, goal, start };
}

export default function Dashboard({ profile }) {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    getTodayRecord()
      .then((d) => {
        setData(d);
        setAnalysis(d.analysis);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Also get streak from records list
  useEffect(() => {
    getRecords(90).then((d) => setStreak(d.streak)).catch(() => {});
  }, []);

  const handleGenerateAI = async () => {
    if (!data?.date) return;
    setLoadingAI(true);
    try {
      const res = await generateAnalysis(data.date);
      setAnalysis(res.analysis);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingAI(false);
    }
  };

  if (loading) {
    return <div className="loading-screen">加载中...</div>;
  }

  if (!profile) {
    return (
      <div className="empty-state">
        <div className="icon">📝</div>
        <h3>还没有设置个人档案</h3>
        <p>请先去「打卡」页面完成设置</p>
      </div>
    );
  }

  const target = calcTarget(profile);
  const todayWeight = data?.record?.morning_weight || null;
  const totalLost = todayWeight ? profile.starting_weight - todayWeight : 0;
  const totalProgress = target.totalToLose > 0 ? (totalLost / target.totalToLose) * 100 : 0;
  const deviation = todayWeight ? todayWeight - target.todayTarget : null;
  const toGoal = todayWeight ? todayWeight - target.goal : null;

  return (
    <div>
      {/* 连胜 */}
      {streak > 0 && (
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <span className="streak-badge">
            🔥 连续打卡 {streak} 天
          </span>
        </div>
      )}

      {/* 今日体重卡片 */}
      <div className="card">
        <div className="card-title">今日体重</div>
        {todayWeight ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary-dark)' }}>
                {todayWeight}
                <span style={{ fontSize: 16, fontWeight: 500 }}> kg</span>
              </span>
              {deviation !== null && (
                <span className={`deviation-tag ${Math.abs(deviation) < 0.5 ? 'good' : deviation > 0 ? 'bad' : 'good'}`}>
                  {deviation > 0.05 ? `落后 ${deviation.toFixed(1)}kg` : deviation < -0.05 ? `领先 ${Math.abs(deviation).toFixed(1)}kg` : '正常波动'}
                </span>
              )}
            </div>

            <div className="progress-section" style={{ marginTop: 14 }}>
              <div className="progress-header">
                <span className="progress-label">{profile.starting_weight}kg → {target.goal}kg（还剩{target.remainingDays}天）</span>
                <span className={`progress-value ${totalProgress >= 0 ? 'positive' : 'negative'}`}>
                  {totalProgress.toFixed(1)}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.max(0, totalProgress))}%` }} />
              </div>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <div className="icon">⚖️</div>
            <h3>今天还没称重</h3>
            <p>去「打卡」页面记录你的体重吧</p>
          </div>
        )}
      </div>

      {/* 快速统计 */}
      {data?.record && (
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-value">{data.record.exercise_type || '—'}</div>
            <div className="stat-label">今日运动</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.record.exercise_steps > 0 ? data.record.exercise_steps.toLocaleString() : '—'}</div>
            <div className="stat-label">今日步数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.record.self_diet_score ?? '—'}</div>
            <div className="stat-label">饮食自评 /10</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.record.self_exercise_score ?? '—'}</div>
            <div className="stat-label">运动自评 /10</div>
          </div>
        </div>
      )}

      {/* AI 教练分析 */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">AI 教练</div>
        {analysis ? (
          <div className="ai-report">
            {analysis.data_summary && (
              <div className="ai-section">
                <h4>数据总结</h4>
                <p>{analysis.data_summary}</p>
              </div>
            )}
            {analysis.judgment && (
              <div className="ai-section">
                <h4>问题判断</h4>
                <p>{analysis.judgment}</p>
              </div>
            )}
            {analysis.suggestions && (
              <div className="ai-section">
                <h4>明日建议</h4>
                <p>{analysis.suggestions}</p>
              </div>
            )}
            {analysis.total_goal_json && (
              <div className="ai-section">
                <h4>总目标偏离度</h4>
                <p>{analysis.total_goal_json}</p>
              </div>
            )}
          </div>
        ) : data?.record ? (
          <div className="ai-empty">
            <p style={{ marginBottom: 12 }}>还没有今天的 AI 分析</p>
            <button className="btn btn-secondary" onClick={handleGenerateAI} disabled={loadingAI}>
              {loadingAI ? <span className="btn-loading"><span className="loading-spinner" />分析中...</span> : '生成 AI 教练分析'}
            </button>
          </div>
        ) : (
          <div className="ai-empty">
            <p>打卡后即可生成 AI 教练分析</p>
          </div>
        )}
      </div>
    </div>
  );
}
