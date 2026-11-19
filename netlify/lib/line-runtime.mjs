import { verifyIdToken } from './line-client.mjs';
import { parseAreaCodes } from './line-codes.mjs';
import { defaultRegistrations } from './line-registrations.mjs';

// ประกอบ deps จริงจาก environment ของ Netlify: LINE_LOGIN_CHANNEL_ID, LINE_AREA_CODES
let cachedCodes = { source: null, map: null };

export function runtimeDeps(env = process.env) {
  if (!env.LINE_LOGIN_CHANNEL_ID) console.error('LINE_LOGIN_CHANNEL_ID is not set; all LINE requests will be rejected');
  return {
    verify: (idToken) => verifyIdToken(idToken, { channelId: env.LINE_LOGIN_CHANNEL_ID }),
    registrations: defaultRegistrations(),
    codes: () => {
      const source = env.LINE_AREA_CODES;
      if (cachedCodes.source !== source) cachedCodes = { source, map: parseAreaCodes(source) };
      return cachedCodes.map;
    }
  };
}
