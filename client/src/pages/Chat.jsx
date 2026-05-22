import { useState, useRef, useEffect } from 'react';
import { request } from '../api';

const STORAGE_KEY = 'chat_messages';
const SUGGESTIONS = [
  '今天这个能不能吃？',
  '我多走了几步怎么算？',
  '今天体重涨了，是水还是脂肪？',
  '晚上饿了怎么办？',
  '腰不舒服能做什么运动？',
  '这周趋势怎么样？',
];

function compressImage(file) {
  return new Promise((resolve, reject) => {
    // 非图片文件直接返回 base64
    if (!file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    img.onload = () => {
      const maxW = 800, maxH = 800;
      let w = img.width, h = img.height;
      if (w > maxW || h > maxH) {
        if (w > h) { h = Math.round(h * maxW / w); w = maxW; }
        else { w = Math.round(w * maxH / h); h = maxH; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = URL.createObjectURL(file);
  });
}

function loadMessages() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* corrupted data */ }
  return [];
}

function saveMessages(msgs) {
  try {
    // 只保留最近 50 条，image blob URL 刷新后失效所以清掉
    const toSave = msgs.slice(-50).map(m => ({ ...m, image: undefined }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* quota exceeded, ignore */ }
}

export default function Chat() {
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const clearImage = () => setImage(null);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg && !image) return;
    if (loading) return;

    const currentImage = image;
    const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    const userMsg = { role: 'user', content: msg || '📷', time: timeStr, image: currentImage?.preview };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    saveMessages(newMessages);
    setInput('');
    setImage(null);
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const data = await request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg || undefined, image: currentImage?.base64 || undefined, history }),
      });
      const withReply = [...newMessages, {
        role: 'assistant',
        content: data.reply,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }];
      setMessages(withReply);
      saveMessages(withReply);
    } catch (err) {
      const withErr = [...newMessages, {
        role: 'assistant',
        content: '抱歉，出了点问题：' + err.message,
        isError: true,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }];
      setMessages(withErr);
      saveMessages(withErr);
    } finally { setLoading(false); }
  };

  const retry = () => {
    // 移除最后一条错误消息，重发上一条用户消息
    const errIdx = messages.findLastIndex(m => m.isError);
    if (errIdx < 0) return;
    const userMsg = messages[errIdx - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    setMessages(messages.slice(0, errIdx));
    send(userMsg.content);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="chat-container">
      {messages.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 10 }}>随时问 AI 教练</div>
          <div className="chat-suggestions">
            {SUGGESTIONS.map(s => (
              <button key={s} className="chat-suggestion-chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={clearChat} style={{ fontSize: 11, padding: '4px 12px' }}>清除对话</button>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.image && <img src={m.image} className="chat-msg-img" alt="upload" />}
            <div className="chat-msg-bubble">
              {m.content}
              {m.isError && (
                <button className="chat-retry-btn" onClick={retry}>重试</button>
              )}
            </div>
            <div className="chat-msg-time">{m.time}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg assistant">
            <div className="chat-msg-bubble" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="loading-spinner" style={{ width: 14, height: 14 }} /> 思考中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {image && (
        <div className="chat-img-preview">
          <img src={image.preview} alt="preview" />
          <button className="chat-img-remove" onClick={clearImage}>✕</button>
        </div>
      )}

      <div className="chat-input-row">
        <input
          type="file"
          ref={fileRef}
          accept="image/*"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const compressed = await compressImage(file);
              setImage({ base64: compressed, preview: compressed });
            } catch { /* ignore */ }
            e.target.value = '';
          }}
        />
        <button className="chat-attach-btn" onClick={() => fileRef.current?.click()} disabled={loading} title="上传图片">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="15" rx="3" />
            <circle cx="8.5" cy="12.5" r="2.5" />
            <path d="M22 14l-5-5-7 7-3-3-5 5" />
          </svg>
        </button>
        <input
          ref={inputRef}
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={image ? '添加文字说明...' : '问 AI 教练...'}
          disabled={loading}
        />
        <button className="chat-send-btn" onClick={() => send()} disabled={loading || (!input.trim() && !image)}>
          ↑
        </button>
      </div>
    </div>
  );
}
