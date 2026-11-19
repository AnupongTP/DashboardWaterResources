const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';

// ตรวจ LIFF ID token กับ LINE แล้วคืน userId (sub) หรือ null
export async function verifyIdToken(idToken, { channelId, fetchImpl = fetch } = {}) {
  if (!idToken || !channelId) return null;
  try {
    const res = await fetchImpl(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ id_token: String(idToken), client_id: String(channelId) }).toString()
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (String(data.aud) !== String(channelId) || typeof data.sub !== 'string' || !data.sub) return null;
    return data.sub;
  } catch {
    return null;
  }
}
