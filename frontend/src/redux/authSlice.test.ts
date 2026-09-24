// ---------------------------------------------------------------------------
// Tests for the auth thunks.
//
// The login thunk is the first request the app makes, so its failure messages
// matter: an unreachable API must not be reported as bad credentials.
// ---------------------------------------------------------------------------

import { beforeEach, describe, expect, it, vi } from 'vitest';

// The slice reads localStorage at module load, which node does not provide.
const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, String(value)),
  removeItem: (key: string) => store.delete(key),
  clear: () => store.clear(),
};

const post = vi.fn();

vi.mock('../services/api', () => ({
  default: {
    post,
    get: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

const { configureStore } = await import('@reduxjs/toolkit');
const { default: authReducer, login, logout } = await import('./authSlice');

function makeStore() {
  return configureStore({ reducer: { auth: authReducer } });
}

describe('login', () => {
  beforeEach(() => {
    store.clear();
    post.mockReset();
  });

  it('stores the token and the user on success', async () => {
    post.mockResolvedValueOnce({
      data: { accessToken: 'jwt-token', user: { id: '1', email: 'admin@autorox.in' } },
    });
    const redux = makeStore();

    const action: any = await redux.dispatch(login({ email: 'admin@autorox.in', password: 'secret' }));

    expect(login.fulfilled.match(action)).toBe(true);
    expect(action.payload).toEqual({ id: '1', email: 'admin@autorox.in' });
    expect(store.get('accessToken')).toBe('jwt-token');
    expect(JSON.parse(store.get('user') || 'null')).toEqual({ id: '1', email: 'admin@autorox.in' });
    expect(redux.getState().auth.isAuthenticated).toBe(true);
  });

  it('reports an unreachable API as a connection problem, not bad credentials', async () => {
    post.mockRejectedValueOnce(new Error('Network Error'));
    const redux = makeStore();

    const action: any = await redux.dispatch(login({ email: 'admin@autorox.in', password: 'secret' }));

    expect(login.rejected.match(action)).toBe(true);
    expect(action.payload).toMatch(/cannot reach the server/i);
    expect(redux.getState().auth.error).toMatch(/cannot reach the server/i);
    expect(redux.getState().auth.isAuthenticated).toBe(false);
  });

  it('surfaces the server message for invalid credentials', async () => {
    post.mockRejectedValueOnce({ response: { status: 401, data: { error: 'Invalid credentials' } } });
    const redux = makeStore();

    const action: any = await redux.dispatch(login({ email: 'admin@autorox.in', password: 'wrong' }));

    expect(action.payload).toBe('Invalid credentials');
    expect(store.get('accessToken')).toBeUndefined();
  });

  it('falls back to a generic message when the server sends no error text', async () => {
    post.mockRejectedValueOnce({ response: { status: 500, data: {} } });
    const redux = makeStore();

    const action: any = await redux.dispatch(login({ email: 'admin@autorox.in', password: 'secret' }));

    expect(action.payload).toBe('Login failed');
  });
});

describe('logout', () => {
  beforeEach(() => {
    store.clear();
    post.mockReset();
  });

  it('clears the session even when the server call fails', async () => {
    store.set('accessToken', 'jwt-token');
    store.set('user', '{"id":"1"}');
    post.mockRejectedValueOnce(new Error('Network Error'));
    const redux = makeStore();

    await redux.dispatch(logout());

    expect(store.get('accessToken')).toBeUndefined();
    expect(store.get('user')).toBeUndefined();
    expect(redux.getState().auth.isAuthenticated).toBe(false);
  });
});
