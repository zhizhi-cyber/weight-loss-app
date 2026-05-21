import { useState, useEffect, useCallback } from 'react';
import { getTodayRecord, generateAnalysis, getRecords } from '../api';

function calcProgress(profile) {
  const start = profile.starting_weight;
  const goal = profile.goal_weight;
  const totalToLose = start - goal;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(profile.phase_start_date || today);
  startDate.setHours(0, 0, 0, 0);

  const deadline = new Date(profile.deadline);
  deadline.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((deadline - startDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)));
  const daysPassed = totalDays - remainingDays;
  const dailyTarget = totalDays > 0 ? totalToLose / totalDays : 0;
  const todayTarget = start - (dailyTarget * daysPassed);

  // Phase
  const phaseStart = new Date(profile.phase_start_date || today);
  phaseStart.setHours(0, 0, 0, 0);
  const phaseEnd = new Date(profile.phase_end_date || today);
  phaseEnd.setHours(0, 0, 0, 0);
  const phaseTotalDays = Math.ceil((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24));
  const phaseRemaining = Math.max(0, Math.ceil((phaseEnd - today) / (1000 * 60 * 60 * 24)));
  const phaseDaysPassed = phaseTotalDays - phaseRemaining;
  const phaseToLose = (profile.phase_start_weight || start) - (profile.phase_goal_weight || goal);
  const phaseDailyTarget = phaseTotalDays > 0 ? phaseToLose / phaseTotalDays : 0;
  const phaseTodayTarget = (profile.phase_start_weight || start) - (phaseDailyTarget * phaseDaysPassed);

  return {
    start, goal, totalToLose, totalDays, remainingDays, daysPassed, dailyTarget, todayTarget,
    phaseStart, phaseEnd, phaseTotalDays, phaseRemaining, phaseDaysPassed,
    phaseToLose, phaseDailyTarget, phaseTodayTarget,
    phaseGoal: profile.phase_goal_weight || goal,
    currentPhase: profile.current_phase || 1,
  };
}

export default function Dashboard({ profile }) {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    getTodayRecord()
      .then((d) => { setData(d); setAnalysis(d.analysis); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { getRecords(90).then((d) => setStreak(d.streak)).catch(() => {}); }, []);

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

  if (loading) return <div className="loading-screen">加载中...</div>;

  if (!profile) {
    return (
      <div className="empty-state">
        <div className="icon">📝</div>
        <h3>还没有设置个人档案</h3>
        <p>请先去「打卡」页面完成设置</p>
      </div>
    );
  }

  const p = calcProgress(profile);
  const todayWeight = data?.record?.morning_weight || null;
  const totalLost = todayWeight ? p.start - todayWeight : 0;
  const totalProgress = p.totalToLose > 0 ? (totalLost / p.totalToLose) * 100 : 0;
  const deviation = todayWeight ? todayWeight - p.todayTarget : null;
  const toGoal = todayWeight ? todayWeight - p.goal : null;

  // Phase
  const phaseLost = todayWeight ? (profile.phase_start_weight || p.start) - todayWeight : 0;
  const phaseProgress = p.phaseToLose > 0 ? (phaseLost / p.phaseToLose) * 100 : 0;
  const phaseDeviation = todayWeight ? todayWeight - p.phaseTodayTarget : null;

  return (
    <div>
      {/* 连胜 + 剩余天数 */}
      <div style={{ textAlign: 'center', marginBottom: 14, display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        {streak > 0 && <span className="streak-badge">🔥 连续打卡 {streak} 天</span>}
        <span className="streak-badge" style={{ background: '#dbeafe', color: '#1e40af' }}>
          ⏱ 还剩 {p.remainingDays} 天
        </span>
      </div>

      {/* 今日体重 */}
      <div className="card">
        <div className="card-title">今日体重</div>
        {todayWeight ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div>
                <span style={{ fontSize: 36, fontWeight: 700, color: 'var(--primary-dark)' }}>
                  {todayWeight}
                </span>
                <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-muted)' }}> kg</span>
              </div>
              {deviation !== null && (
                <span className={`deviation-tag ${Math.abs(deviation) < 0.5 ? 'neutral' : deviation > 0 ? 'bad' : 'good'}`}>
                  {deviation > 0.01 ? `落后 ${deviation.toFixed(2)}kg` : deviation < -0.01 ? `领先 ${Math.abs(deviation).toFixed(2)}kg` : '达标'}
                </span>
              )}
            </div>

            {/* 总目标进度 */}
            <div className="progress-section" style={{ marginTop: 16 }}>
              <div className="progress-header">
                <span className="progress-label">
                  总目标 {p.goal}kg · 还差{toGoal?.toFixed(1)}kg · 每日需减约{p.dailyTarget.toFixed(3)}kg
                </span>
                <span className={`progress-value ${totalProgress >= 0 ? 'positive' : 'negative'}`}>
                  {totalProgress >= 0 ? totalProgress.toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${Math.min(100, Math.max(0, totalProgress))}%` }} />
              </div>
            </div>

            {/* 阶段进度 */}
            <div className="progress-section">
              <div className="progress-header">
                <span className="progress-label">
                  阶段{p.currentPhase} · {p.phaseGoal}kg · 还剩{p.phaseRemaining}天
                </span>
                <span className={`progress-value ${phaseProgress >= 0 ? 'positive' : 'negative'}`}>
                  {phaseProgress >= 0 ? phaseProgress.toFixed(1) : '0.0'}%
                </span>
              </div>
              <div className="progress-bar" style={{ background: '#fef3c7' }}>
                <div className="progress-bar-fill" style={{
                  width: `${Math.min(100, Math.max(0, phaseProgress))}%`,
                  background: 'var(--warning)',
                }} />
              </div>
            </div>

            {/* 目标线对比 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>总目标线 {p.todayTarget.toFixed(2)}kg</span>
              <span>阶段线 {p.phaseTodayTarget.toFixed(2)}kg</span>
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
                <h4>📋 数据总结</h4>
                <p>{analysis.data_summary}</p>
              </div>
            )}
            {analysis.total_goal_json && (
              <div className="ai-section">
                <h4>🎯 总目标进度</h4>
                <p>{analysis.total_goal_json}</p>
              </div>
            )}
            {analysis.phase_goal_json && (
              <div className="ai-section">
                <h4>📊 阶段目标进度</h4>
                <p>{analysis.phase_goal_json}</p>
              </div>
            )}
            {analysis.judgment && (
              <div className="ai-section">
                <h4>🔍 问题判断</h4>
                <p>{analysis.judgment}</p>
              </div>
            )}
            {analysis.suggestions && (
              <div className="ai-section">
                <h4>💡 明日建议</h4>
                <p>{analysis.suggestions}</p>
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
          <div className="ai-empty"><p>打卡后即可生成 AI 教练分析</p></div>
        )}
      </div>
    </div>
  );
}
