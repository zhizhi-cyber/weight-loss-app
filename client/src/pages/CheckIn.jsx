import { useState, useEffect, useRef } from 'react';
import { saveProfile, getTodayRecord, submitCheckIn, generateAnalysis, request, getRecords } from '../api';

function RatingDots({ value, onChange }) {
  return (
    <div className="rating">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          className={`rating-dot${value === n ? ' selected' : ''}`}
          onClick={() => onChange(value === n ? null : n)}
        >
          {n}
        </button>
      ))}
      {value && <span className="rating-num">{value}/10</span>}
    </div>
  );
}

function PhotoUpload({ photo, onChange }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    if (photo instanceof File) {
      const url = URL.createObjectURL(photo);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    } else if (typeof photo === 'string' && photo) {
      setPreview(`/photos/${photo}`);
    } else {
      setPreview(null);
    }
  }, [photo]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onChange(file);
  };

  return (
    <div className="photo-upload">
      {preview && <img src={preview} alt="预览" className="photo-preview" />}
      <button type="button" className="photo-add-btn" onClick={() => inputRef.current?.click()}>
        +
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} hidden />
      {photo && (
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => onChange(null)}>
          清除
        </button>
      )}
    </div>
  );
}

function CollapsibleCard({ title, section, collapsed, onToggle, children }) {
  const isCollapsed = collapsed[section];
  return (
    <div className="card">
      <div className="card-title" onClick={() => onToggle(section)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ marginRight: 6 }}>{isCollapsed ? '▸' : '▾'}</span>
        {title}
      </div>
      {!isCollapsed && children}
    </div>
  );
}

export default function CheckIn({ profile, onProfileUpdate }) {
  // ---- Setup form state ----
  const [setup, setSetup] = useState({
    age: '',
    height: '',
    starting_weight: '',
    goal_weight: '',
    deadline: '',
  });

  // ---- Check-in form state ----
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    morning_weight: '',
    sleep_bedtime: '',
    sleep_waketime: '',
    sleep_interruptions: 0,
    sleep_energy: null,
    breakfast: '',
    lunch: '',
    dinner: '',
    snacks: '',
    exercise_type: '',
    exercise_duration: '',
    exercise_intensity: null,
    exercise_steps: '',
    body_waist: '',
    body_knee: '',
    body_fatigue: null,
    body_hunger: null,
    body_bowel: '',
    self_diet_score: null,
    self_exercise_score: null,
  });
  const [photos, setPhotos] = useState({
    breakfast_photo: null,
    lunch_photo: null,
    dinner_photo: null,
  });

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const [lastWeight, setLastWeight] = useState(null);

  // 获取上次体重用于对比
  useEffect(() => {
    if (!profile) return;
    getRecords(14).then((data) => {
      const records = data.records || [];
      const today = new Date().toISOString().split('T')[0];
      const last = records.find((r) => r.date !== today && r.morning_weight);
      if (last) setLastWeight({ date: last.date, weight: last.morning_weight });
    }).catch(() => {});
  }, [profile]);

  // 计算打卡完成度
  const calcCompletion = () => {
    let filled = 0, total = 0;
    if (form.morning_weight !== '') filled++;
    total++;
    if (form.sleep_bedtime) filled++;
    total++;
    if (form.breakfast) filled++;
    total++;
    if (form.lunch) filled++;
    total++;
    if (form.dinner) filled++;
    total++;
    if (form.exercise_type) filled++;
    total++;
    if (form.exercise_duration !== '' && parseInt(form.exercise_duration) > 0) filled++;
    total++;
    if (form.self_diet_score) filled++;
    total++;
    return Math.round((filled / total) * 100);
  };

  // Load today's record on mount, or load record for selected date
  useEffect(() => {
    if (!profile) return;
    const loadRecord = form.date === new Date().toISOString().split('T')[0]
      ? getTodayRecord().then((d) => ({ record: d.record }))
      : request(`/records/${form.date}`).then((d) => ({ record: d.record }));

    loadRecord
      .then((data) => {
        if (data.record) {
          const r = data.record;
          setForm((prev) => ({
            ...prev,
            morning_weight: r.morning_weight ?? '',
            sleep_bedtime: r.sleep_bedtime ?? '',
            sleep_waketime: r.sleep_waketime ?? '',
            sleep_interruptions: r.sleep_interruptions ?? 0,
            sleep_energy: r.sleep_energy ?? null,
            breakfast: r.breakfast ?? '',
            lunch: r.lunch ?? '',
            dinner: r.dinner ?? '',
            snacks: r.snacks ?? '',
            exercise_type: r.exercise_type ?? '',
            exercise_duration: r.exercise_duration ?? '',
            exercise_intensity: r.exercise_intensity ?? null,
            exercise_steps: r.exercise_steps ?? '',
            body_waist: r.body_waist ?? '',
            body_knee: r.body_knee ?? '',
            body_fatigue: r.body_fatigue ?? null,
            body_hunger: r.body_hunger ?? null,
            body_bowel: r.body_bowel ?? '',
            self_diet_score: r.self_diet_score ?? null,
            self_exercise_score: r.self_exercise_score ?? null,
          }));
          if (r.breakfast_photo || r.lunch_photo || r.dinner_photo) {
            setPhotos({
              breakfast_photo: r.breakfast_photo || null,
              lunch_photo: r.lunch_photo || null,
              dinner_photo: r.dinner_photo || null,
            });
          }
        } else {
          // Reset form for new date
          setForm((prev) => ({
            ...prev,
            morning_weight: '', sleep_bedtime: '', sleep_waketime: '',
            sleep_interruptions: 0, sleep_energy: null,
            breakfast: '', lunch: '', dinner: '', snacks: '',
            exercise_type: '', exercise_duration: '', exercise_intensity: null,
            exercise_steps: '', body_waist: '', body_knee: '',
            body_fatigue: null, body_hunger: null, body_bowel: '',
            self_diet_score: null, self_exercise_score: null,
          }));
          setPhotos({ breakfast_photo: null, lunch_photo: null, dinner_photo: null });
        }
      })
      .catch(console.error);
  }, [profile, form.date]);

  const toggleSection = (section) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // ---- Setup submit ----
  const handleSetup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await saveProfile({
        age: parseInt(setup.age),
        height: parseFloat(setup.height),
        starting_weight: parseFloat(setup.starting_weight),
        goal_weight: parseFloat(setup.goal_weight),
        deadline: setup.deadline,
      });
      onProfileUpdate(data.profile);
      showToast('档案保存成功！');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ---- Check-in submit ----
  const handleSubmit = async (e) => {
    e.preventDefault();
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
      if (form.self_diet_score) fd.append('self_diet_score', form.self_diet_score);
      if (form.self_exercise_score) fd.append('self_exercise_score', form.self_exercise_score);

      // Photos
      if (photos.breakfast_photo instanceof File) fd.append('breakfast_photo', photos.breakfast_photo);
      if (photos.lunch_photo instanceof File) fd.append('lunch_photo', photos.lunch_photo);
      if (photos.dinner_photo instanceof File) fd.append('dinner_photo', photos.dinner_photo);

      await submitCheckIn(fd);
      showToast('打卡成功！正在生成 AI 分析...');

      // 自动生成 AI 分析
      try {
        await generateAnalysis(form.date);
        showToast('AI 教练分析已更新！');
      } catch {
        showToast('打卡成功（AI 分析生成失败，可稍后重试）');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // ---- Show setup form if no profile ----
  if (!profile) {
    return (
      <div className="setup-page">
        <h2>设置个人档案</h2>
        <form onSubmit={handleSetup}>
          <div className="form-group">
            <label className="form-label">年龄</label>
            <input type="number" className="form-input" value={setup.age} onChange={(e) => setSetup({ ...setup, age: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">身高（cm）</label>
            <input type="number" className="form-input" value={setup.height} onChange={(e) => setSetup({ ...setup, height: e.target.value })} placeholder="例如：170" required />
          </div>
          <div className="form-group">
            <label className="form-label">起始体重（kg）</label>
            <input type="number" step="0.1" className="form-input" value={setup.starting_weight} onChange={(e) => setSetup({ ...setup, starting_weight: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">目标体重（kg）</label>
            <input type="number" step="0.1" className="form-input" value={setup.goal_weight} onChange={(e) => setSetup({ ...setup, goal_weight: e.target.value })} required />
          </div>
          <div className="form-group">
            <label className="form-label">截止日期</label>
            <input type="date" className="form-input" value={setup.deadline} onChange={(e) => setSetup({ ...setup, deadline: e.target.value })} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '保存中...' : '开始减肥之旅'}
          </button>
        </form>
      </div>
    );
  }

  // ---- Check-in form ----
  const completion = calcCompletion();

  return (
    <div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <form onSubmit={handleSubmit}>
        {/* 完成度 */}
        <div className="card" style={{ padding: '12px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: completion > 0 ? 6 : 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>今日打卡进度</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: completion >= 80 ? 'var(--success)' : completion >= 40 ? 'var(--warning)' : 'var(--text-muted)' }}>
              {completion}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className="progress-bar-fill" style={{
              width: `${completion}%`,
              background: completion >= 80 ? 'var(--success)' : completion >= 40 ? 'var(--warning)' : 'var(--primary)',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* 日期 */}
        <div className="card">
          <div className="card-title">日期</div>
          <input type="date" className="form-input" value={form.date} onChange={(e) => handleFormChange('date', e.target.value)} />
        </div>

        {/* 体重 */}
        <div className="card">
          <div className="card-title">晨起体重</div>
          <div className="form-row">
            <input type="number" step="0.1" className="form-input" value={form.morning_weight} onChange={(e) => handleFormChange('morning_weight', e.target.value)} placeholder="kg" />
          </div>
          {lastWeight && form.morning_weight && parseFloat(form.morning_weight) > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-muted)' }}>
              上次（{lastWeight.date}）{lastWeight.weight}kg
              <span style={{
                fontWeight: 600,
                marginLeft: 8,
                color: parseFloat(form.morning_weight) < lastWeight.weight ? 'var(--success)' : parseFloat(form.morning_weight) > lastWeight.weight ? 'var(--danger)' : 'var(--text-muted)',
              }}>
                {parseFloat(form.morning_weight) < lastWeight.weight ? `↓ ${(lastWeight.weight - parseFloat(form.morning_weight)).toFixed(1)}kg` : parseFloat(form.morning_weight) > lastWeight.weight ? `↑ ${(parseFloat(form.morning_weight) - lastWeight.weight).toFixed(1)}kg` : '持平'}
              </span>
            </div>
          )}
        </div>

        {/* 睡眠 */}
        <CollapsibleCard title="睡眠" section="sleep" collapsed={collapsed} onToggle={toggleSection}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">入睡时间</label>
              <input type="time" className="form-input" value={form.sleep_bedtime} onChange={(e) => handleFormChange('sleep_bedtime', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">醒来时间</label>
              <input type="time" className="form-input" value={form.sleep_waketime} onChange={(e) => handleFormChange('sleep_waketime', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">中途醒来次数</label>
              <input type="number" min="0" className="form-input" value={form.sleep_interruptions} onChange={(e) => handleFormChange('sleep_interruptions', parseInt(e.target.value) || 0)} />
            </div>
            <div className="form-group">
              <label className="form-label">醒来精神状态（1-10）</label>
              <RatingDots value={form.sleep_energy} onChange={(v) => handleFormChange('sleep_energy', v)} />
            </div>
          </div>
        </CollapsibleCard>

        {/* 饮食 */}
        <CollapsibleCard title="饮食" section="meals" collapsed={collapsed} onToggle={toggleSection}>
          {['breakfast', 'lunch', 'dinner'].map((meal) => (
            <div className="form-group" key={meal}>
              <label className="form-label">{meal === 'breakfast' ? '早餐' : meal === 'lunch' ? '午餐' : '晚餐'}</label>
              <textarea className="form-textarea" value={form[meal]} onChange={(e) => handleFormChange(meal, e.target.value)} placeholder="吃了什么..." rows={2} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {(meal === 'breakfast' ? ['鸡蛋+牛奶', '燕麦+鸡蛋', '全麦面包+蛋', '无糖酸奶+坚果'] : meal === 'lunch' ? ['鸡胸肉沙拉', '小炒牛肉+少饭', '三文鱼+西兰花', '卤牛肉+青菜'] : ['鸡胸肉', '关东煮(萝卜海带)', '茶叶蛋+豆腐', '无糖茶']).map((hint) => (
                  <button
                    key={hint}
                    type="button"
                    style={{
                      fontSize: 11,
                      padding: '3px 8px',
                      borderRadius: 12,
                      border: '1px solid var(--border)',
                      background: form[meal] === hint ? 'var(--primary-light)' : '#f8fafc',
                      color: form[meal] === hint ? 'var(--primary-dark)' : 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                    onClick={() => handleFormChange(meal, form[meal] === hint ? '' : hint)}
                  >
                    {hint}
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>照片（可选）</span>
                <PhotoUpload photo={photos[`${meal}_photo`]} onChange={(f) => setPhotos((p) => ({ ...p, [`${meal}_photo`]: f }))} />
              </div>
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">加餐/零食</label>
            <input type="text" className="form-input" value={form.snacks} onChange={(e) => handleFormChange('snacks', e.target.value)} placeholder="吃了什么..." />
          </div>
        </CollapsibleCard>

        {/* 运动 */}
        <CollapsibleCard title="运动" section="exercise" collapsed={collapsed} onToggle={toggleSection}>
          <div className="form-group">
            <label className="form-label">运动类型</label>
            <input type="text" className="form-input" value={form.exercise_type} onChange={(e) => handleFormChange('exercise_type', e.target.value)} placeholder="跑步、游泳、力量训练..." />
          </div>
          <div className="form-row-3">
            <div className="form-group">
              <label className="form-label">时长（分钟）</label>
              <input type="number" min="0" className="form-input" value={form.exercise_duration} onChange={(e) => handleFormChange('exercise_duration', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">步数</label>
              <input type="number" min="0" className="form-input" value={form.exercise_steps} onChange={(e) => handleFormChange('exercise_steps', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">运动强度（1-10）</label>
            <RatingDots value={form.exercise_intensity} onChange={(v) => handleFormChange('exercise_intensity', v)} />
          </div>
        </CollapsibleCard>

        {/* 身体状态 */}
        <CollapsibleCard title="身体状态" section="body" collapsed={collapsed} onToggle={toggleSection}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">腰围</label>
              <input type="text" className="form-input" value={form.body_waist} onChange={(e) => handleFormChange('body_waist', e.target.value)} placeholder="cm" />
            </div>
            <div className="form-group">
              <label className="form-label">膝盖状况</label>
              <input type="text" className="form-input" value={form.body_knee} onChange={(e) => handleFormChange('body_knee', e.target.value)} placeholder="正常/不适..." />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">疲劳感（1-10）</label>
              <RatingDots value={form.body_fatigue} onChange={(v) => handleFormChange('body_fatigue', v)} />
            </div>
            <div className="form-group">
              <label className="form-label">饥饿感（1-10）</label>
              <RatingDots value={form.body_hunger} onChange={(v) => handleFormChange('body_hunger', v)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">排便</label>
            <input type="text" className="form-input" value={form.body_bowel} onChange={(e) => handleFormChange('body_bowel', e.target.value)} placeholder="正常/便秘/腹泻..." />
          </div>
        </CollapsibleCard>

        {/* 自我评价 */}
        <CollapsibleCard title="今日自评" section="self" collapsed={collapsed} onToggle={toggleSection}>
          <div className="form-group">
            <label className="form-label">饮食控制（1-10）</label>
            <RatingDots value={form.self_diet_score} onChange={(v) => handleFormChange('self_diet_score', v)} />
          </div>
          <div className="form-group">
            <label className="form-label">运动完成（1-10）</label>
            <RatingDots value={form.self_exercise_score} onChange={(v) => handleFormChange('self_exercise_score', v)} />
          </div>
        </CollapsibleCard>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginBottom: 16 }}>
          {loading ? <span className="btn-loading"><span className="loading-spinner" />提交中...</span> : '保存打卡'}
        </button>
      </form>
    </div>
  );
}
