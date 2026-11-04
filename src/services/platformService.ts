import { authService } from './authService';
import { applyAction, publicSnapshot } from '../../shared/platform-core.mjs';
import { createInitialState } from '../../shared/platform-seeds.mjs';
import type { PlatformActor, PlatformAction, PlatformState } from '../types/platform';

const storageKey = 'vntravel.platform.sandbox.v1';
const modeKey = 'vntravel.platform.demo';
const apiUrl = (import.meta.env.VITE_COMMUNITY_API_URL || '').replace(/\/$/, '');
const readMode = () => { try { return sessionStorage.getItem(modeKey) === 'true'; } catch { return false; } };
let demo = readMode();
let demoAdmin = false;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(fn => fn());
function readSandbox(): PlatformState {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return createInitialState(true) as unknown as PlatformState;
  try {
    const state = JSON.parse(raw);
    if (!Array.isArray(state.posts) || !Array.isArray(state.itineraries) || !state.settings?.points) throw new Error();
    return state;
  } catch { throw new Error('Dữ liệu trải nghiệm trên trình duyệt bị lỗi. Xuất bản sao lưu trước khi đặt lại dữ liệu.'); }
}
async function request(action?: PlatformAction): Promise<PlatformState> {
  const token = await authService.getAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(apiUrl, { method: action ? 'POST' : 'GET', signal: controller.signal,
      headers: { ...(action ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(action ? { body: JSON.stringify(action) } : {}) });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'Không thể hoàn tất yêu cầu. Vui lòng thử lại.');
    if (!Array.isArray(data?.posts) || !Array.isArray(data?.itineraries)) throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
    return data;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('Chưa kết nối được cộng đồng. Kiểm tra mạng và thử lại.');
    throw error;
  } finally { clearTimeout(timeout); }
}
export const platformService = {
  getMode: (): 'demo' | 'live' | 'preview' => demo ? 'demo' : apiUrl ? 'live' : 'preview',
  getActor: (): PlatformActor | null => {
    if (demo) return demoAdmin ? { id: 'demo-admin', name: 'Quản trị mẫu', role: 'admin' } : { id: 'demo-visitor', name: 'Bạn · Trải nghiệm mẫu', role: 'user' };
    if (!apiUrl) return null;
    const user = authService.getUser();
    if (!user) return null;
    return { id: user.id, name: String(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Du khách'), role: user.app_metadata?.role === 'admin' ? 'admin' : 'user' };
  },
  subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  setDemoMode: (value: boolean) => { demo = value; demoAdmin = false; try { sessionStorage.setItem(modeKey,String(value)); } catch { /* in-memory preview */ } emit(); },
  setDemoAdmin: (value: boolean) => { if (!demo) throw new Error('Chỉ đổi vai trò trong dữ liệu mẫu.'); demoAdmin = value; emit(); },
  getSnapshot: async (): Promise<PlatformState> => demo ? publicSnapshot(readSandbox(),platformService.getActor()) as unknown as PlatformState : apiUrl ? request() : createInitialState(true) as unknown as PlatformState,
  mutate: async (action: PlatformAction): Promise<PlatformState> => {
    const actor = platformService.getActor();
    if (!actor) throw new Error(apiUrl ? 'Vui lòng đăng nhập để tiếp tục.' : 'Bật trải nghiệm mẫu để thử tính năng trên thiết bị này.');
    if (!demo) return request(action);
    const commit = () => {
      const updated = applyAction(readSandbox(),action,actor);
      try { localStorage.setItem(storageKey,JSON.stringify(updated)); } catch { throw new Error('Không thể lưu. Trình duyệt đã hết dung lượng hoặc chặn lưu trữ.'); }
      return publicSnapshot(updated,actor) as unknown as PlatformState;
    };
    if (navigator.locks) return navigator.locks.request(storageKey,commit);
    const pending = queue.then(commit); queue = pending.catch(() => undefined); return pending;
  },
};
window.addEventListener('storage', event => { if (event.key === storageKey && demo) emit(); });
