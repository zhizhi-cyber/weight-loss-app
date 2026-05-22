import { useState, useRef, useEffect } from 'react';
import { request } from '../api';

const SUGGESTIONS = [
  '今天这个能不能吃？',
  '我多走了几步怎么算？',
  '今天体重涨了，是水还是脂肪？',
  '晚上饿了怎么办？',
  '腰不舒服能做什么运动？',
  '这周趋势怎么样？',
];

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);        // { base64, preview }
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
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setImage(null);
    setLoading(true);

    try {
      const history = messages.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const data = await request('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: msg || undefined, image: currentImage?.base64 || undefined, history }),
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '抱歉，出了点问题：' + err.message,
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally { setLoading(false); }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
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

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role}`}>
            {m.image && <img src={m.image} className="chat-msg-img" alt="upload" />}
            <div className="chat-msg-bubble">{m.content}</div>
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
              const base64 = await toBase64(file);
              setImage({ base64, preview: URL.createObjectURL(file) });
            } catch { /* ignore */ }
            e.target.value = '';
          }}
        />
        <button className="chat-attach-btn" onClick={() => fileRef.current?.click()} disabled={loading} title="拍照/上传图片">
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
