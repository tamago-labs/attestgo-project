import 'dotenv/config';

export const BASE = (process.env.TOKEN_API_URL || process.env.TOKEN_API_BASE || 'https://9aozj1j64j.execute-api.ap-southeast-1.amazonaws.com/prod').replace(/\/$/, '');
export const PLATFORM_API_KEY = process.env.PLATFORM_API_KEY || process.env.X_PLATFORM_API_KEY || '';

function headers(withAuth = true): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (withAuth && PLATFORM_API_KEY) h['x-platform-api-key'] = PLATFORM_API_KEY;
  return h;
}

async function handle(res: Response) {
  const text = await res.text();
  let body: any;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text.slice(0, 800) }; }
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 800)}`);
  return body;
}

export async function apiPost(path: string, data: any, withAuth = true) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: headers(withAuth), body: JSON.stringify(data) });
  return handle(res);
}
export async function apiGet(path: string, withAuth = false) {
  const res = await fetch(`${BASE}${path}`, { method: 'GET', headers: headers(withAuth) });
  return handle(res);
}
export async function apiPatch(path: string, data: any) {
  const res = await fetch(`${BASE}${path}`, { method: 'PATCH', headers: headers(true), body: JSON.stringify(data) });
  return handle(res);
}
export async function apiDelete(path: string) {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers(true) });
  return handle(res);
}
