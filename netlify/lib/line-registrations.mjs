import { getStore } from '@netlify/blobs';

export const REGISTRATION_STORE = 'line-area-registrations';

// key = LINE userId
// value = {mode:'staff', type, slug, code, updatedAt} | {mode:'general', updatedAt}
export function createRegistrations(store) {
  return {
    async get(userId) {
      return (await store.get(userId, { type: 'json' })) || null;
    },
    async set(userId, entry) {
      const updatedAt = new Date().toISOString();
      if (entry && entry.mode === 'staff') {
        const { type, slug, code } = entry;
        await store.setJSON(userId, { mode: 'staff', type, slug, code, updatedAt });
      } else if (entry && entry.mode === 'general') {
        await store.setJSON(userId, { mode: 'general', updatedAt });
      } else {
        throw new Error('invalid registration');
      }
    }
  };
}

export function defaultRegistrations() {
  return createRegistrations(getStore({ name: REGISTRATION_STORE, consistency: 'strong' }));
}
