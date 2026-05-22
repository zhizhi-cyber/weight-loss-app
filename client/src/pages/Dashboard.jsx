import { useState, useEffect, useCallback } from 'react';
import { getTodayRecord, generateAnalysis, getRecords } from '../api';

function calcProgress(profile) {
  const start = profile.starting_weight;
  const goal = profile.goal_weight;
  const totalToLose = start - goal;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const startDate = new Date(profile.phase_start_date || today); startDate.setHours(0, 0, 0, 0);
  const deadline = new Date(profile.deadline); deadline.setHours(0, 0, 0, 0);
  const totalDays = Math.ceil((deadline - startDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil((deadline - today) / (1000 * 60 * 60 * 24)));
  const daysPassed = totalDays - remainingDays;
  const dailyTarget = totalDays > 0 ? totalToLose / totalDays : 0;
  const todayTarget = start - (dailyTarget * daysPassed);

  const phaseStart = new Date(profile.phase_start_date || today); phaseStart.setHours(0, 0, 0, 0);
  const phaseEnd = new Date(profile.phase_end_date || today); phaseEnd.setHours(0, 0, 0, 0);
  const phaseTotalDays = Math.ceil((phaseEnd - phaseStart) / (1000 * 60 * 60 * 24));
  const phaseRemaining = Math.max(0, Math.ceil((phaseEnd - today) / (1000 * 60 * 60 * 24)));
  const phaseDaysPassed = phaseTotalDays - phaseRemaining;
  const phaseToLose = (profile.phase_start_weight || start) - (profile.phase_goal_weight || goal);
  const phaseDailyTarget = phaseTotalDays > 0 ? phaseToLose / phaseTotalDays : 0;
  const phaseTodayTarget = (profile.phase_start_weight || start) - (phaseDailyTarget * phaseDaysPassed);

  return {
    start, goal, totalToLose, remainingDays, todayTarget, dailyTarget,
    phaseRemaining, phaseToLose, phaseTodayTarget, phaseDailyTarget,
    phaseGoal: profile.phase_goal_weight || goal,
    currentPhase: profile.current_phase || 1,
    phaseEndDate: profile.phase_end_date,
  };
}

function ProgressRing({ pct, size = 80, stroke = 5, color = 'var(--accent)' }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <div className="progress-ring-container" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--progress-bg)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <span className="progress-ring-text">{pct >= 0 ? pct.toFixed(1) : '0.0'}%</span>
    </div>
  );
}

export default function Dashboard({ profile }) {
  const [data, setData] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [streak, setStreak] = useState(0);
  const [loadingAI, setLoadingAI] = useState(false);
  const [loading, setLoading] = useState(true);
  const [metabolism, setMetabolism] = useState(null);

  const loadData = useCallback(() => {
    getTodayRecord().then((d) => { setData(d); setAnalysis(d.analysis); }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (profile) getRecords(90).then((d) => setStreak(d.streak)).catch(() => {}); }, [profile]);

  const handleGenerateAI = async () => {
    if (!data?.date) return;
    setLoadingAI(true);
    try {
      const res = await generateAnalysis(data.date);
      setAnalysis(res.analysis);
      if (res.metabolism) setMetabolism(res.metabolism);
    } catch (err) { alert(err.message); }
    finally { setLoadingAI(false); }
  };

  if (loading) return <div className="loading-screen">Loading...</div>;
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
  const phaseLost = todayWeight ? (profile.phase_start_weight || p.start) - todayWeight : 0;
  const phaseProgress = p.phaseToLose > 0 ? (phaseLost / p.phaseToLose) * 100 : 0;

  const isGood = deviation !== null && deviation <= 0;
  const kgToGoal = toGoal ? toGoal.toFixed(1) : '—';

  return (
    <div>
      {/* 顶部状态条 */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {streak > 0 && <span className="streak-badge">{streak} 天连续</span>}
        <span className="streak-badge" style={{ background: 'rgba(142,142,147,0.1)', color: 'var(--text-secondary)', border: '0.5px solid rgba(142,142,147,0.15)' }}>
          {p.remainingDays} 天剩余
        </span>
      </div>

      {/* 体重英雄数字 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-secondary)', marginBottom: 4 }}>
          今日体重
        </div>
        {todayWeight ? (
          <>
            <div className="hero-number">{todayWeight}<span className="hero-unit"> kg</span></div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 8 }}>
              {deviation !== null && (
                <span className={`deviation-tag ${Math.abs(deviation) < 0.5 ? 'neutral' : deviation > 0 ? 'bad' : 'good'}`}>
                  {deviation > 0.01 ? `落后 ${deviation.toFixed(1)}` : deviation < -0.01 ? `领先 ${Math.abs(deviation).toFixed(1)}` : '达标'}
                </span>
              )}
              <span className="deviation-tag neutral">距目标 {kgToGoal} kg</span>
            </div>
          </>
        ) : (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <h3>今天还没称重</h3>
            <p>去打卡页面记录体重</p>
          </div>
        )}
      </div>

      {/* 双目标进度 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          {/* 总目标 */}
          <div style={{ textAlign: 'center' }}>
            <ProgressRing pct={totalProgress} size={90} stroke={6} color="var(--accent)" />
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              总目标 {p.goal}kg
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {p.remainingDays}天 · 每日{(p.dailyTarget * 1000).toFixed(0)}g
            </div>
          </div>

          {/* 分隔 */}
          <div style={{ width: 1, height: 60, background: 'var(--border)' }} />

          {/* 阶段目标 */}
          <div style={{ textAlign: 'center' }}>
            <ProgressRing pct={phaseProgress} size={90} stroke={6} color="var(--warning)" />
            <div style={{ marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              阶段{p.currentPhase} · {p.phaseGoal}kg
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {p.phaseRemaining}天 · {p.phaseEndDate}截止
            </div>
          </div>
        </div>

        {/* 偏离说明 */}
        {deviation !== null && (
          <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: isGood ? 'rgba(48,209,88,0.08)' : 'rgba(255,69,58,0.06)', fontSize: 13, color: isGood ? 'var(--success)' : 'var(--danger)', textAlign: 'center', fontWeight: 500 }}>
            {isGood
              ? `领先阶段目标 ${Math.abs(deviation).toFixed(1)}kg，继续保持`
              : Math.abs(deviation) < 0.5
                ? `接近目标线，偏差 ${deviation.toFixed(1)}kg，正常波动范围内`
                : `落后阶段目标 ${deviation.toFixed(1)}kg，需关注饮食和步数`}
          </div>
        )}
      </div>

      {/* 今日快速统计 */}
      {data?.record && (
        <div className="stat-grid">
          <div className="stat-item">
            <div className="stat-value accent">{data.record.exercise_type || '—'}</div>
            <div className="stat-label">运动</div>
          </div>
          <div className="stat-item">
            <div className="stat-value accent">{data.record.exercise_steps > 0 ? (data.record.exercise_steps / 1000).toFixed(1) + 'k' : '—'}</div>
            <div className="stat-label">步数</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.record.self_diet_score ?? '—'}</div>
            <div className="stat-label">饮食 /10</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{data.record.self_exercise_score ?? '—'}</div>
            <div className="stat-label">运动 /10</div>
          </div>
        </div>
      )}

      {/* 代谢数据 */}
      {metabolism && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-title">代谢数据</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 14 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)' }}>{metabolism.bmr}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>BMR kcal</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{metabolism.tdee}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>TDEE kcal</div>
            </div>
          </div>
        </div>
      )}

      {/* 里程碑 */}
      {streak > 0 && streak % 7 === 0 && (
        <div className="milestone-card">
          <div className="emoji">⚡️</div>
          <div className="title">里程碑 {streak} 天</div>
          <div className="sub">已坚持 {streak} 天，下一站 {streak + 7} 天</div>
        </div>
      )}

      {/* AI 教练复盘 */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">AI 教练复盘</div>
        {analysis ? (
          <div className="ai-report">
            {analysis.data_summary && (
              <div className="ai-section"><h4>今日总结</h4><p>{analysis.data_summary}</p></div>
            )}
            {analysis.calorie_bill && (
              <div className="ai-section"><h4>热量账单</h4><p>{analysis.calorie_bill}</p></div>
            )}
            {analysis.nutrition && (
              <div className="ai-section"><h4>营养结构</h4><p>{analysis.nutrition}</p></div>
            )}
            {analysis.weight_cause && (
              <div className="ai-section"><h4>体重变化</h4><p>{analysis.weight_cause}</p></div>
            )}
            {analysis.total_goal_json && (
              <div className="ai-section"><h4>总目标</h4><p>{analysis.total_goal_json}</p></div>
            )}
            {analysis.phase_goal_json && (
              <div className="ai-section"><h4>阶段目标</h4><p>{analysis.phase_goal_json}</p></div>
            )}
            {analysis.highlights && (
              <div className="ai-section"><h4>成长亮点</h4><p>{analysis.highlights}</p></div>
            )}
            {analysis.problems && (
              <div className="ai-section"><h4>问题行为</h4><p>{analysis.problems}</p></div>
            )}
            {analysis.suggestions && (
              <div className="ai-section"><h4>明日关键调整</h4><p>{analysis.suggestions}</p></div>
            )}
          </div>
        ) : data?.record ? (
          <div className="ai-empty">
            <p style={{ marginBottom: 12 }}>打卡完成，生成今日复盘</p>
            <button className="btn btn-secondary btn-sm" onClick={handleGenerateAI} disabled={loadingAI}>
              {loadingAI ? <span className="btn-loading"><span className="loading-spinner" />分析中</span> : '生成 AI 复盘'}
            </button>
          </div>
        ) : (
          <div className="ai-empty"><p>今日打卡后即可生成复盘</p></div>
        )}
      </div>
    </div>
  );
}
