import { useState, useEffect } from 'react';
import { saveProfile, getProfile } from '../api';

export default function Settings({ profile, onProfileUpdate }) {
  const [form, setForm] = useState({ age: '', height: '', starting_weight: '', goal_weight: '', deadline: '', body_fat: '', health_notes: '', life_context: '', ideal_note: '' });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (profile) {
      setForm({
        age: profile.age || '',
        height: profile.height || '',
        starting_weight: profile.starting_weight || '',
        goal_weight: profile.goal_weight || '',
        deadline: profile.deadline || '',
        body_fat: profile.body_fat || '',
        health_notes: profile.health_notes || '',
        life_context: profile.life_context || '',
        ideal_note: profile.ideal_note || '',
      });
    }
  }, [profile]);

  const showToast = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 2500); };
  const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const data = await saveProfile({
        age: parseInt(form.age), height: parseFloat(form.height),
        starting_weight: parseFloat(form.starting_weight), goal_weight: parseFloat(form.goal_weight),
        deadline: form.deadline,
        body_fat: form.body_fat ? parseFloat(form.body_fat) : undefined,
        health_notes: form.health_notes || undefined,
        life_context: form.life_context || undefined,
        ideal_note: form.ideal_note || undefined,
      });
      onProfileUpdate(data.profile);
      showToast('设置已保存');
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  if (!profile) return null;

  return (
    <div>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      <form onSubmit={handleSubmit}>

        <div className="settings-section">
          <div className="settings-section-title">基本信息</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">年龄</label><input type="number" className="form-input" value={form.age} onChange={e => handleChange('age', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">身高 cm</label><input type="number" className="form-input" value={form.height} onChange={e => handleChange('height', e.target.value)} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">起始体重 kg</label><input type="number" step="0.1" className="form-input" value={form.starting_weight} onChange={e => handleChange('starting_weight', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">目标体重 kg</label><input type="number" step="0.1" className="form-input" value={form.goal_weight} onChange={e => handleChange('goal_weight', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">截止日期</label><input type="date" className="form-input" value={form.deadline} onChange={e => handleChange('deadline', e.target.value)} /></div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">身体数据</div>
          <div className="form-group">
            <label className="form-label">体脂率 %</label>
            <input type="number" step="0.1" className="form-input" value={form.body_fat} onChange={e => handleChange('body_fat', e.target.value)} placeholder="例如：30.8" />
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-title">个人背景</div>
          <div className="form-group">
            <label className="form-label">健康备注</label>
            <input type="text" className="form-input" value={form.health_notes} onChange={e => handleChange('health_notes', e.target.value)} placeholder="如：有轻度腰肌劳损、脂肪肝" />
          </div>
          <div className="form-group">
            <label className="form-label">生活情况</label>
            <input type="text" className="form-input" value={form.life_context} onChange={e => handleChange('life_context', e.target.value)} placeholder="如：工作忙、夜间需照顾婴儿" />
          </div>
          <div className="form-group">
            <label className="form-label">理想目标</label>
            <input type="text" className="form-input" value={form.ideal_note} onChange={e => handleChange('ideal_note', e.target.value)} placeholder="如：85-90kg、15-18%体脂" />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginBottom: 16 }}>
          {loading ? <span className="btn-loading"><span className="loading-spinner" />保存中</span> : '保存设置'}
        </button>
      </form>
    </div>
  );
}
