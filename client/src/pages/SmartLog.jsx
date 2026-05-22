import { useState, useRef } from 'react';
import { request } from '../api';

export default function SmartLog({ onFillForm }) {
  const [text, setText] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('图片不能超过 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      setImage(base64);
      setImagePreview(reader.result);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!text.trim() && !image) return;
    setLoading(true);
    setError(null);
    try {
      const data = await request('/ai/smart-log', {
        method: 'POST',
        body: JSON.stringify({ text: text.trim(), image }),
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFillForm = () => {
    if (!result?.extracted) return;
    const e = result.extracted;
    onFillForm({
      morning_weight: e.morning_weight ?? '',
      sleep_bedtime: e.sleep_bedtime ?? '',
      sleep_waketime: e.sleep_waketime ?? '',
      sleep_interruptions: e.sleep_interruptions ?? 0,
      sleep_energy: e.sleep_energy,
      breakfast: e.breakfast ?? '',
      lunch: e.lunch ?? '',
      dinner: e.dinner ?? '',
      snacks: e.snacks ?? '',
      exercise_type: e.exercise_type ?? '',
      exercise_duration: e.exercise_duration ?? '',
      exercise_intensity: e.exercise_intensity,
      exercise_steps: e.exercise_steps ?? '',
      body_waist: e.body_waist ?? '',
      body_knee: e.body_knee ?? '',
      body_fatigue: e.body_fatigue,
      body_hunger: e.body_hunger,
      body_bowel: e.body_bowel ?? '',
      self_diet_score: e.self_diet_score,
      self_exercise_score: e.self_exercise_score,
    });
    setResult(null);
    setText('');
    setImage(null);
    setImagePreview(null);
  };

  return (
    <div>
      {/* 输入区 */}
      <div className="card">
        <div className="card-title">🤖 AI 智能录入</div>
        <div className="form-group">
          <label className="form-label">把你的记事本内容贴进来</label>
          <textarea
            className="form-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"随便写，AI 会识别：\n\n例：\n早上117.9kg，两个鸡蛋一块面包\n中午小炒黄牛肉盖饭少饭\n晚上鸡胸肉沙拉\n投篮55分钟，步数8500\n昨晚醒了8次，精神不太好\n\n或者贴一整天的流水账也行..."}
            rows={8}
            style={{ fontSize: 14 }}
          />
        </div>
        <div className="form-group">
          <label className="form-label">或者拍张记事本照片（可选）</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {imagePreview && (
              <img src={imagePreview} alt="预览" style={{ width: 60, height: 60, borderRadius: 8, objectFit: 'cover' }} />
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {image ? '更换照片' : '选择照片'}
            </button>
            {image && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setImage(null); setImagePreview(null); }}>
                清除
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImage} hidden />
          </div>
        </div>

        {error && <div className="toast error" style={{ position: 'static', marginBottom: 12 }}>{error}</div>}

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={loading || (!text.trim() && !image)}
        >
          {loading ? <span className="btn-loading"><span className="loading-spinner" />AI 分析中...</span> : '开始分析'}
        </button>
      </div>

      {/* 结果区 */}
      {result && (
        <div>
          {/* 教练总结 */}
          {result.coaching && (
            <div className="card" style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', border: '1px solid #a7f3d0' }}>
              <div className="card-title">🧑‍🏫 教练总结</div>
              <div style={{ fontSize: 14, lineHeight: 1.8 }}>
                <p style={{ marginBottom: 6 }}>👍 <strong>亮点：</strong>{result.coaching.key_win}</p>
                <p style={{ marginBottom: 6 }}>⚠️ <strong>风险：</strong>{result.coaching.key_risk}</p>
                <p style={{ marginBottom: 6 }}>🎯 <strong>减肥建议：</strong>{result.coaching.weight_loss_advice}</p>
                <p>📌 <strong>明天重点：</strong>{result.coaching.tomorrow_focus}</p>
              </div>
            </div>
          )}

          {/* 饮食分析 */}
          {result.diet_analysis && (
            <div className="card">
              <div className="card-title">🍽 饮食分析</div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <p>{result.diet_analysis.summary}</p>
                <p style={{ marginTop: 4 }}>
                  营养评级：<strong>{result.diet_analysis.nutrition_rating}</strong>
                  {result.diet_analysis.protein_estimate && ` · 蛋白质约${result.diet_analysis.protein_estimate}`}
                  {result.extracted?.total_kcal_estimate && ` · 总热量约${result.extracted.total_kcal_estimate}kcal`}
                </p>
                {result.diet_analysis.suggestions?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <strong>改善建议：</strong>
                    <ul style={{ paddingLeft: 18, margin: '4px 0' }}>
                      {result.diet_analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 运动分析 */}
          {result.exercise_analysis && (
            <div className="card">
              <div className="card-title">🏃 运动分析</div>
              <div style={{ fontSize: 13, lineHeight: 1.8 }}>
                <p>{result.exercise_analysis.summary}</p>
                <p style={{ marginTop: 4 }}>
                  效率评级：<strong>{result.exercise_analysis.effectiveness}</strong>
                  {result.exercise_analysis.kcal_burned_estimate && ` · 消耗约${result.exercise_analysis.kcal_burned_estimate}kcal`}
                </p>
                {result.exercise_analysis.shooting_tips && (
                  <p style={{ marginTop: 4 }}>🏀 <strong>投篮优化：</strong>{result.exercise_analysis.shooting_tips}</p>
                )}
                {result.exercise_analysis.improvements?.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <strong>改进建议：</strong>
                    <ul style={{ paddingLeft: 18, margin: '4px 0' }}>
                      {result.exercise_analysis.improvements.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 一键填入 */}
          <button className="btn btn-primary" onClick={handleFillForm} style={{ marginBottom: 16 }}>
            📋 一键填入打卡表单
          </button>
        </div>
      )}
    </div>
  );
}
