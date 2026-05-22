import { useState, useEffect, useRef } from 'react';
import { saveProfile, getTodayRecord, submitCheckIn, generateAnalysis, request, getRecords, deleteRecord } from '../api';
import SmartLog from './SmartLog';

function ScoreInput({ value, onChange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input type="number" min="1" max="10" className="form-input" style={{ width: 52, textAlign: 'center', padding: '8px 4px' }}
        value={value ?? ''} onChange={(e) => { const v = e.target.value; onChange(v ? Math.max(1, Math.min(10, parseInt(v) || 1)) : null); }}
        placeholder="1-10" />
      {value && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{value}/10</span>}
    </div>
  );
}

function PhotoUpload({ photo, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  useEffect(() => {
    if (photo instanceof File) { const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }
    else if (typeof photo === 'string' && photo) setPreview(`/photos/${photo}`);
    else setPreview(null);
  }, [photo]);
  return (
    <div className="photo-upload">
      {preview && <img src={preview} alt="" className="photo-preview" />}
      <button type="button" className="photo-add-btn" onClick={() => inputRef.current?.click()}>+</button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} hidden />
      {photo && <button type="button" className="btn btn-sm btn-secondary" onClick={() => onChange(null)}>清除</button>}
    </div>
  );
}

export default function CheckIn({ profile, onProfileUpdate }) {
  const [setup, setSetup] = useState({ age: '', height: '', starting_weight: '', goal_weight: '', deadline: '' });
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0], morning_weight: '',
    sleep_bedtime: '', sleep_waketime: '', sleep_interruptions: 0, sleep_energy: null,
    breakfast: '', lunch: '', dinner: '', snacks: '',
    exercise_type: '', exercise_duration: '', exercise_intensity: null, exercise_steps: '',
    body_waist: '', body_knee: '', body_fatigue: null, body_hunger: null, body_bowel: '',
    shooting_accuracy: '', stress_level: null, water_intake: '',
    self_diet_score: null, self_exercise_score: null,
  });
  const [photos, setPhotos] = useState({ breakfast_photo: null, lunch_photo: null, dinner_photo: null });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [lastWeight, setLastWeight] = useState(null);
  const [mode, setMode] = useState('smart');
  const [errors, setErrors] = useState({});
  const [hasExisting, setHasExisting] = useState(false);
  const [smogFilled, setSmogFilled] = useState(null); // SmartLog 填充预览

  useEffect(() => {
    if (!profile) return;
    const loadRecord = form.date === new Date().toISOString().split('T')[0]
      ? getTodayRecord().then((d) => ({ record: d.record }))
      : request(`/records/${form.date}`).then((d) => ({ record: d.record }));
    loadRecord.then((data) => {
      const r = data.record;
      setHasExisting(!!r);
      if (r) {
        setForm((prev) => ({
          ...prev, morning_weight: r.morning_weight ?? '', sleep_bedtime: r.sleep_bedtime ?? '', sleep_waketime: r.sleep_waketime ?? '',
          sleep_interruptions: r.sleep_interruptions ?? 0, sleep_energy: r.sleep_energy,
          breakfast: r.breakfast ?? '', lunch: r.lunch ?? '', dinner: r.dinner ?? '', snacks: r.snacks ?? '',
          exercise_type: r.exercise_type ?? '', exercise_duration: r.exercise_duration ?? '', exercise_intensity: r.exercise_intensity,
          exercise_steps: r.exercise_steps ?? '', body_waist: r.body_waist ?? '', body_knee: r.body_knee ?? '',
          body_fatigue: r.body_fatigue, body_hunger: r.body_hunger, body_bowel: r.body_bowel ?? '',
          shooting_accuracy: r.shooting_accuracy ?? '', stress_level: r.stress_level, water_intake: r.water_intake ?? '',
          self_diet_score: r.self_diet_score, self_exercise_score: r.self_exercise_score,
        }));
        if (r.breakfast_photo || r.lunch_photo || r.dinner_photo) {
          setPhotos({ breakfast_photo: r.breakfast_photo || null, lunch_photo: r.lunch_photo || null, dinner_photo: r.dinner_photo || null });
        }
      } else {
        setForm((prev) => ({
          ...prev, morning_weight: '', sleep_bedtime: '', sleep_waketime: '', sleep_interruptions: 0, sleep_energy: null,
          breakfast: '', lunch: '', dinner: '', snacks: '', exercise_type: '', exercise_duration: '', exercise_intensity: null,
          exercise_steps: '', body_waist: '', body_knee: '', body_fatigue: null, body_hunger: null, body_bowel: '',
          shooting_accuracy: '', stress_level: null, water_intake: '', self_diet_score: null, self_exercise_score: null,
        }));
        setPhotos({ breakfast_photo: null, lunch_photo: null, dinner_photo: null });
        setErrors({});
      }
    }).catch(console.error);
  }, [profile, form.date]);

  const validate = () => {
    const e = {};
    if (!form.morning_weight) e.morning_weight = '必填';
    if (!form.breakfast && !form.lunch && !form.dinner) e.diet = '至少记录一餐';
    if (!form.exercise_type) e.exercise_type = '必填';
    if (!form.sleep_bedtime) e.sleep_bedtime = '必填';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      const first = document.querySelector('.field-error');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return Object.keys(e).length === 0;
  };

  useEffect(() => {
    if (!profile) return;
    getRecords(14).then((data) => {
      const records = data.records || [];
      const today = new Date().toISOString().split('T')[0];
      const last = records.find((r) => r.date !== today && r.morning_weight);
      if (last) setLastWeight({ date: last.date, weight: last.morning_weight });
    }).catch(() => {});
  }, [profile]);

  const calcCompletion = () => {
    let filled = 0, total = 5;
    if (form.morning_weight !== '') filled++;
    if (form.breakfast || form.lunch || form.dinner) filled++;
    if (form.exercise_type) filled++;
    if (form.exercise_steps !== '' && parseInt(form.exercise_steps) > 0) filled++;
    if (form.sleep_bedtime) filled++;
    return Math.round((filled / total) * 100);
  };

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const handleFormChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSetup = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await saveProfile({ age: parseInt(setup.age), height: parseFloat(setup.height), starting_weight: parseFloat(setup.starting_weight), goal_weight: parseFloat(setup.goal_weight), deadline: setup.deadline });
      onProfileUpdate(data.profile); showToast('档案保存成功');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`确定删除 ${form.date} 的打卡记录？`)) return;
    setLoading(true);
    try {
      await deleteRecord(form.date);
      setForm((prev) => ({
        ...prev, morning_weight: '', sleep_bedtime: '', sleep_waketime: '', sleep_interruptions: 0, sleep_energy: null,
        breakfast: '', lunch: '', dinner: '', snacks: '', exercise_type: '', exercise_duration: '', exercise_intensity: null,
        exercise_steps: '', body_waist: '', body_knee: '', body_fatigue: null, body_hunger: null, body_bowel: '',
        shooting_accuracy: '', stress_level: null, water_intake: '', self_diet_score: null, self_exercise_score: null,
      }));
      setHasExisting(false);
      showToast('已删除');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('date', form.date);
      if (form.morning_weight !== '') fd.append('morning_weight', form.morning_weight);
      if (form.sleep_bedtime) fd.append('sleep_bedtime', form.sleep_bedtime);
      if (form.sleep_waketime) fd.append('sleep_waketime', form.sleep_waketime);
      fd.append('sleep_interruptions', form.sleep_interruptions);
      if (form.sleep_energy) fd.append('sleep_energy', form.sleep_energy);
      if (form.breakfast) fd.append('breakfast', form.breakfast);
      if (form.lunch) fd.append('lunch', form.lunch);
      if (form.dinner) fd.append('dinner', form.dinner);
      if (form.snacks) fd.append('snacks', form.snacks);
      if (form.exercise_type) fd.append('exercise_type', form.exercise_type);
      if (form.exercise_duration !== '') fd.append('exercise_duration', form.exercise_duration);
      if (form.exercise_intensity) fd.append('exercise_intensity', form.exercise_intensity);
      if (form.exercise_steps !== '') fd.append('exercise_steps', form.exercise_steps);
      if (form.body_waist) fd.append('body_waist', form.body_waist);
      if (form.body_knee) fd.append('body_knee', form.body_knee);
      if (form.body_fatigue) fd.append('body_fatigue', form.body_fatigue);
      if (form.body_hunger) fd.append('body_hunger', form.body_hunger);
      if (form.body_bowel) fd.append('body_bowel', form.body_bowel);
      if (form.shooting_accuracy !== '') fd.append('shooting_accuracy', form.shooting_accuracy);
      if (form.stress_level) fd.append('stress_level', form.stress_level);
      if (form.water_intake !== '') fd.append('water_intake', form.water_intake);
      if (photos.breakfast_photo instanceof File) fd.append('breakfast_photo', photos.breakfast_photo);
      if (photos.lunch_photo instanceof File) fd.append('lunch_photo', photos.lunch_photo);
      if (photos.dinner_photo instanceof File) fd.append('dinner_photo', photos.dinner_photo);
      await submitCheckIn(fd);
      showToast('打卡成功，正在生成 AI 分析...');
      try { await generateAnalysis(form.date); showToast('AI 复盘已更新'); } catch { showToast('打卡成功'); }
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  if (!profile) {
    return (
      <div className="setup-page">
        <h2>设置档案</h2>
        <form onSubmit={handleSetup}>
          <div className="form-group"><label className="form-label">年龄</label><input type="number" className="form-input" value={setup.age} onChange={(e) => setSetup({ ...setup, age: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">身高 cm</label><input type="number" className="form-input" value={setup.height} onChange={(e) => setSetup({ ...setup, height: e.target.value })} placeholder="例：193" required /></div>
          <div className="form-group"><label className="form-label">起始体重 kg</label><input type="number" step="0.1" className="form-input" value={setup.starting_weight} onChange={(e) => setSetup({ ...setup, starting_weight: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">目标体重 kg</label><input type="number" step="0.1" className="form-input" value={setup.goal_weight} onChange={(e) => setSetup({ ...setup, goal_weight: e.target.value })} required /></div>
          <div className="form-group"><label className="form-label">截止日期</label><input type="date" className="form-input" value={setup.deadline} onChange={(e) => setSetup({ ...setup, deadline: e.target.value })} required /></div>
          <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? '保存中...' : '开始'}</button>
        </form>
      </div>
    );
  }

  const completion = calcCompletion();

  return (
    <div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {/* Mode Toggle */}
      <div className="mode-toggle">
        <button className={`mode-toggle-btn ${mode === 'manual' ? 'active' : ''}`} onClick={() => setMode('manual')}>手动录入</button>
        <button className={`mode-toggle-btn ${mode === 'smart' ? 'active' : ''}`} onClick={() => setMode('smart')}>AI 智能录入</button>
      </div>

      {mode === 'smart' && (
        <SmartLog onFillForm={(data) => { setSmogFilled(data); }} />
      )}

      {smogFilled && (
        <div className="card">
          <div className="card-title">AI 提取数据预览</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
            {smogFilled.morning_weight && <div>体重: <strong style={{ color: 'var(--text)' }}>{smogFilled.morning_weight}kg</strong></div>}
            {smogFilled.breakfast && <div>早餐: {smogFilled.breakfast}</div>}
            {smogFilled.lunch && <div>午餐: {smogFilled.lunch}</div>}
            {smogFilled.dinner && <div>晚餐: {smogFilled.dinner}</div>}
            {smogFilled.exercise_type && <div>运动: {smogFilled.exercise_type} {smogFilled.exercise_duration || 0}min</div>}
            {smogFilled.exercise_steps > 0 && <div>步数: {smogFilled.exercise_steps}</div>}
            {smogFilled.sleep_bedtime && <div>入睡: {smogFilled.sleep_bedtime}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setForm(prev => ({ ...prev, ...smogFilled })); setSmogFilled(null); setMode('manual'); }}>
              确认并填写
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setSmogFilled(null)}>取消</button>
          </div>
        </div>
      )}

      {mode === 'manual' && (
        <form onSubmit={handleSubmit}>
          {/* Completion bar */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)' }}>完成度</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: completion >= 80 ? 'var(--success)' : completion >= 40 ? 'var(--warning)' : 'var(--text-secondary)' }}>{completion}%</span>
            </div>
            <div className="progress-bar" style={{ height: 4 }}>
              <div className="progress-bar-fill" style={{ width: `${completion}%`, background: completion >= 80 ? 'var(--success)' : completion >= 40 ? 'var(--warning)' : 'var(--accent)' }} />
            </div>
          </div>

          {/* Date + Weight */}
          <div className="card">
            <div className="form-row">
              <div className="form-group"><label className="form-label">日期</label><input type="date" className="form-input" value={form.date} onChange={(e) => handleFormChange('date', e.target.value)} /></div>
              <div className={`form-group${errors.morning_weight ? ' field-error' : ''}`}><label className="form-label">晨起体重 kg</label>
                <input type="number" step="0.1" className="form-input" value={form.morning_weight} onChange={(e) => handleFormChange('morning_weight', e.target.value)} placeholder="kg" />
                {errors.morning_weight && <span className="field-error-msg">{errors.morning_weight}</span>}
              </div>
            </div>
            {lastWeight && form.morning_weight && parseFloat(form.morning_weight) > 0 && (
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
                上次 {lastWeight.date}：{lastWeight.weight}kg
                <span style={{ fontWeight: 700, marginLeft: 8, color: parseFloat(form.morning_weight) < lastWeight.weight ? 'var(--success)' : parseFloat(form.morning_weight) > lastWeight.weight ? 'var(--danger)' : 'var(--text-secondary)' }}>
                  {parseFloat(form.morning_weight) < lastWeight.weight ? `↓${(lastWeight.weight - parseFloat(form.morning_weight)).toFixed(1)}` : parseFloat(form.morning_weight) > lastWeight.weight ? `↑${(parseFloat(form.morning_weight) - lastWeight.weight).toFixed(1)}` : '持平'}
                </span>
              </div>
            )}
          </div>

          {/* Sleep */}
          <div className="card">
            <div className="card-title">睡眠</div>
            <div className="form-row">
              <div className={`form-group${errors.sleep_bedtime ? ' field-error' : ''}`}><label className="form-label">入睡</label>
                <input type="time" className="form-input" value={form.sleep_bedtime} onChange={(e) => handleFormChange('sleep_bedtime', e.target.value)} />
                {errors.sleep_bedtime && <span className="field-error-msg">{errors.sleep_bedtime}</span>}
              </div>
              <div className="form-group"><label className="form-label">醒来</label><input type="time" className="form-input" value={form.sleep_waketime} onChange={(e) => handleFormChange('sleep_waketime', e.target.value)} /></div>
            </div>
            <div className="form-row" style={{ marginTop: 10 }}>
              <div className="form-group"><label className="form-label">夜醒次数</label><input type="number" min="0" className="form-input" value={form.sleep_interruptions} onChange={(e) => handleFormChange('sleep_interruptions', parseInt(e.target.value) || 0)} /></div>
              <div className="form-group"><label className="form-label">精神</label><ScoreInput value={form.sleep_energy} onChange={(v) => handleFormChange('sleep_energy', v)} /></div>
            </div>
          </div>

          {/* Diet */}
          <div className={`card${errors.diet ? ' field-error' : ''}`}>
            <div className="card-title">饮食 {errors.diet && <span className="field-error-msg">{errors.diet}</span>}</div>
            {['breakfast', 'lunch', 'dinner'].map((meal) => (
              <div className="form-group" key={meal}>
                <label className="form-label">{meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐'}</label>
                <textarea className="form-textarea" value={form[meal]} onChange={(e) => handleFormChange(meal, e.target.value)} placeholder="吃了什么..." rows={2} />
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {(meal === 'breakfast' ? ['鸡蛋+牛奶', '燕麦+鸡蛋', '全麦面包+蛋'] : meal === 'lunch' ? ['鸡胸肉沙拉', '小炒牛肉+少饭', '三文鱼+西兰花'] : ['鸡胸肉', '关东煮', '茶叶蛋+豆腐']).map((hint) => (
                    <button key={hint} type="button" className={`food-chip ${form[meal] === hint ? 'selected' : ''}`}
                      onClick={() => handleFormChange(meal, form[meal] === hint ? '' : hint)}>{hint}</button>
                  ))}
                </div>
                <div style={{ marginTop: 6 }}><span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>照片</span><PhotoUpload photo={photos[`${meal}_photo`]} onChange={(f) => setPhotos((p) => ({ ...p, [`${meal}_photo`]: f }))} /></div>
              </div>
            ))}
            <div className="form-group"><label className="form-label">零食/饮料</label><input type="text" className="form-input" value={form.snacks} onChange={(e) => handleFormChange('snacks', e.target.value)} placeholder="如实记录" /></div>
          </div>

          {/* Exercise */}
          <div className="card">
            <div className="card-title">运动</div>
            <div className={`form-group${errors.exercise_type ? ' field-error' : ''}`}><label className="form-label">类型</label>
              <input type="text" className="form-input" value={form.exercise_type} onChange={(e) => handleFormChange('exercise_type', e.target.value)} placeholder="跑步/投篮/力量..." />
              {errors.exercise_type && <span className="field-error-msg">{errors.exercise_type}</span>}
            </div>
            <div className="form-row-3">
              <div className="form-group"><label className="form-label">分钟</label><input type="number" min="0" className="form-input" value={form.exercise_duration} onChange={(e) => handleFormChange('exercise_duration', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">步数</label><input type="number" min="0" className="form-input" value={form.exercise_steps} onChange={(e) => handleFormChange('exercise_steps', e.target.value)} /></div>
            </div>
            <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">强度</label><ScoreInput value={form.exercise_intensity} onChange={(v) => handleFormChange('exercise_intensity', v)} /></div>
          </div>

          {/* Body + Water + Shooting */}
          <div className="card">
            <div className="card-title">身体 & 状态</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">腰围</label><input type="text" className="form-input" value={form.body_waist} onChange={(e) => handleFormChange('body_waist', e.target.value)} placeholder="cm" /></div>
              <div className="form-group"><label className="form-label">膝盖</label><input type="text" className="form-input" value={form.body_knee} onChange={(e) => handleFormChange('body_knee', e.target.value)} placeholder="正常/不适" /></div>
            </div>
            <div className="form-group"><label className="form-label">排便</label><input type="text" className="form-input" value={form.body_bowel} onChange={(e) => handleFormChange('body_bowel', e.target.value)} placeholder="正常/便秘/腹泻" /></div>
            <div className="form-group"><label className="form-label">疲劳感</label><ScoreInput value={form.body_fatigue} onChange={(v) => handleFormChange('body_fatigue', v)} /></div>
            <div className="form-group"><label className="form-label">饥饿感</label><ScoreInput value={form.body_hunger} onChange={(v) => handleFormChange('body_hunger', v)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">饮水量 L</label><input type="number" step="0.1" className="form-input" value={form.water_intake} onChange={(e) => handleFormChange('water_intake', e.target.value)} placeholder="例：1.5" /></div>
              <div className="form-group"><label className="form-label">投篮命中 %</label><input type="number" min="0" max="100" className="form-input" value={form.shooting_accuracy} onChange={(e) => handleFormChange('shooting_accuracy', e.target.value)} placeholder="例：42" /></div>
            </div>
            <div className="form-group" style={{ marginTop: 10 }}><label className="form-label">压力</label><ScoreInput value={form.stress_level} onChange={(v) => handleFormChange('stress_level', v)} /></div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginBottom: 8 }}>
            {loading ? <span className="btn-loading"><span className="loading-spinner" />保存中</span> : hasExisting ? '更新打卡' : '保存打卡'}
          </button>
          {hasExisting && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDelete} disabled={loading} style={{ marginBottom: 16, width: '100%', color: 'var(--danger)', borderColor: 'rgba(255,69,58,0.2)' }}>
              删除此打卡
            </button>
          )}
        </form>
      )}
    </div>
  );
}
