const BASE = '/api';

// 通用请求
export async function request(url, options = {}) {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '请求失败');
  }
  return res.json();
}

// 档案
export const getProfile = () => request('/profile');
export const saveProfile = (data) =>
  request('/profile', { method: 'POST', body: JSON.stringify(data) });

// 今日记录
export const getTodayRecord = () => request('/records/today');

// 历史记录
export const getRecords = (limit = 90) => request(`/records?limit=${limit}`);

// 提交打卡（支持 FormData 上传照片）
export const submitCheckIn = async (formData) => {
  const res = await fetch(`${BASE}/records`, {
    method: 'POST',
    body: formData, // FormData，不要设 Content-Type
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || '提交失败');
  }
  return res.json();
};

// 生成 AI 分析
export const generateAnalysis = (date) =>
  request(`/ai/analyze/${date}`, { method: 'POST' });

// 获取 AI 分析
export const getAnalysis = (date) => request(`/ai/${date}`);

// 提交体脂秤数据
export const submitBodyComp = (data) =>
  request('/records/bodycomp', { method: 'POST', body: JSON.stringify(data) });

// 删除打卡记录
export const deleteRecord = (date) =>
  request(`/records/${date}`, { method: 'DELETE' });
