import { useState, useRef } from 'react';
import { request, submitCheckIn, generateAnalysis } from '../api';

export default function SmartLog({ onFillForm }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('图片不能超过 10MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result.split(',')[1]);
      setImagePreview(reader.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !image) return;
    setLoading(true); setError(null);
    try {
      const data = await request('/ai/smart-log', { method: 'POST', body: JSON.stringify({ text: text.trim(), image }) });
      setResult(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleFillAndSave = async () => {
    if (!result?.extracted) return;
    const e = result.extracted;
    const date = new Date().toISOString().split('T')[0];

    const fd = new FormData();
    fd.append('date', date);
    if (e.morning_weight) fd.append('morning_weight', e.morning_weight);
    if (e.sleep_bedtime) fd.append('sleep_bedtime', e.sleep_bedtime);
    if (e.sleep_waketime) fd.append('sleep_waketime', e.sleep_waketime);
    fd.append('sleep_interruptions', e.sleep_interruptions || 0);
    if (e.sleep_energy) fd.append('sleep_energy', e.sleep_energy);
    if (e.breakfast) fd.append('breakfast', e.breakfast);
    if (e.lunch) fd.append('lunch', e.lunch);
    if (e.dinner) fd.append('dinner', e.dinner);
    if (e.snacks) fd.append('snacks', e.snacks);
    if (e.exercise_type) fd.append('exercise_type', e.exercise_type);
    if (e.exercise_duration) fd.append('exercise_duration', e.exercise_duration);
    if (e.exercise_intensity) fd.append('exercise_intensity', e.exercise_intensity);
    if (e.exercise_steps) fd.append('exercise_steps', e.exercise_steps);
    if (e.body_waist) fd.append('body_waist', e.body_waist);
    if (e.body_knee) fd.append('body_knee', e.body_knee);
    if (e.body_fatigue) fd.append('body_fatigue', e.body_fatigue);
    if (e.body_hunger) fd.append('body_hunger', e.body_hunger);
    if (e.body_bowel) fd.append('body_bowel', e.body_bowel);
    if (e.shooting_accuracy) fd.append('shooting_accuracy', e.shooting_accuracy);
    if (e.stress_level) fd.append('stress_level', e.stress_level);
    if (e.water_intake) fd.append('water_intake', e.water_intake);
    if (e.self_diet_score) fd.append('self_diet_score', e.self_diet_score);
    if (e.self_exercise_score) fd.append('self_exercise_score', e.self_exercise_score);

    setSaving(true);
    try {
      await submitCheckIn(fd);
      try { await generateAnalysis(date); } catch {}
      onFillForm({
        morning_weight: e.morning_weight ?? '',
        sleep_bedtime: e.sleep_bedtime ?? '', sleep_waketime: e.sleep_waketime ?? '',
        sleep_interruptions: e.sleep_interruptions ?? 0, sleep_energy: e.sleep_energy,
        breakfast: e.breakfast ?? '', lunch: e.lunch ?? '', dinner: e.dinner ?? '', snacks: e.snacks ?? '',
        exercise_type: e.exercise_type ?? '', exercise_duration: e.exercise_duration ?? '',
        exercise_intensity: e.exercise_intensity, exercise_steps: e.exercise_steps ?? '',
        body_waist: e.body_waist ?? '', body_knee: e.body_knee ?? '',
        body_fatigue: e.body_fatigue, body_hunger: e.body_hunger, body_bowel: e.body_bowel ?? '',
        shooting_accuracy: e.shooting_accuracy ?? '', stress_level: e.stress_level, water_intake: e.water_intake ?? '',
        self_diet_score: e.self_diet_score, self_exercise_score: e.self_exercise_score,
      });
    } catch (err) { setError('保存失败: ' + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="card">
        <div className="card-title">AI 智能录入</div>
        <div className="form-group">
          <label className="form-label">记事本内容</label>
          <textarea className="form-textarea" value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"随便写，AI 会识别：\n\n早上117.9kg，两个鸡蛋一块面包\n中午小炒黄牛肉盖饭少饭\n晚上鸡胸肉沙拉\n投篮55分钟，命中率42%\n步数8500，昨晚醒了8次\n喝了1.5升水"}
            rows={7} style={{ fontSize: 14 }} />
        </div>
        <div className="form-group">
          <label className="form-label">或拍张记事本照片</label>
          <div className="photo-upload">
            {imagePreview && <img src={imagePreview} alt="" className="photo-preview" />}
            <button type="button" className="photo-add-btn" onClick={() => fileRef.current?.click()}>+</button>
            {image && <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setImage(null); setImagePreview(null); }}>清除</button>}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} hidden />
          </div>
        </div>
        {error && <div className="toast error" style={{ position: 'static', marginBottom: 12 }}>{error}</div>}
        <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || (!text.trim() && !image)}>
          {loading ? <span className="btn-loading"><span className="loading-spinner" />分析中</span> : '开始分析'}
        </button>
      </div>

      {result && (
        <>
          {result.coaching && (
            <div className="milestone-card">
              <div className="emoji">🧑‍🏫</div>
              <div className="title">{result.coaching.key_win || '分析完成'}</div>
              <div className="sub">⚠️ {result.coaching.key_risk} · 🎯 {result.coaching.tomorrow_focus}</div>
            </div>
          )}

          {result.diet_analysis && (
            <div className="card">
              <div className="card-title">饮食分析</div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                <p>{result.diet_analysis.summary}</p>
                <p style={{ marginTop: 4 }}>评级：<strong style={{ color: 'var(--text)' }}>{result.diet_analysis.nutrition_rating}</strong>
                  {result.extracted?.total_kcal_estimate && <span> · 约{result.extracted.total_kcal_estimate}kcal</span>}
                </p>
                {result.diet_analysis.suggestions?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {result.diet_analysis.suggestions.map((s, i) => <div key={i} style={{ marginBottom: 2 }}>· {s}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {result.exercise_analysis && (
            <div className="card">
              <div className="card-title">运动分析</div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                <p>{result.exercise_analysis.summary}</p>
                <p style={{ marginTop: 4 }}>效率：<strong style={{ color: 'var(--text)' }}>{result.exercise_analysis.effectiveness}</strong>
                  {result.exercise_analysis.kcal_burned_estimate && <span> · 消耗约{result.exercise_analysis.kcal_burned_estimate}kcal</span>}
                </p>
                {result.exercise_analysis.shooting_tips && <p style={{ marginTop: 4, color: 'var(--accent)' }}>🏀 {result.exercise_analysis.shooting_tips}</p>}
                {result.exercise_analysis.improvements?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {result.exercise_analysis.improvements.map((s, i) => <div key={i} style={{ marginBottom: 2 }}>· {s}</div>)}
                  </div>
                )}
              </div>
            </div>
          )}

          <button className="btn btn-primary" onClick={handleFillAndSave} disabled={saving} style={{ marginBottom: 16 }}>
            {saving ? <span className="btn-loading"><span className="loading-spinner" />保存中</span> : '确认并保存打卡'}
          </button>
        </>
      )}
    </div>
  );
}
