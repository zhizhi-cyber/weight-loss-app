export default async function handler(req, res) {
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'say ok' }],
        max_tokens: 10,
      }),
    });
    const data = await response.json();
    res.json({ ok: true, status: response.status, result: data.choices?.[0]?.message?.content });
  } catch (err) {
    res.json({ ok: false, error: err.message, stack: err.stack });
  }
}
