const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar_url: string | null;
  status: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface GoogleSignInConfig {
  client_id: string | null;
  configured: boolean;
}

const TOKEN_KEY = "fact_token";
const USER_KEY = "fact_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setAuth(data: AuthResponse) {
  localStorage.setItem(TOKEN_KEY, data.token);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  document.cookie = `fact_token=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  document.cookie = "fact_token=; path=/; max-age=0";
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(body.detail || `Error ${res.status}`);
  }

  return res.json();
}

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const data = await authFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  setAuth(data);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await authFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setAuth(data);
  return data;
}

export async function loginWithGoogle(credential: string): Promise<AuthResponse> {
  const data = await authFetch<AuthResponse>("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  setAuth(data);
  return data;
}

let googleSignInConfigPromise: Promise<GoogleSignInConfig> | null = null;

export function fetchGoogleSignInConfig(): Promise<GoogleSignInConfig> {
  if (!googleSignInConfigPromise) {
    googleSignInConfigPromise = authFetch<GoogleSignInConfig>("/api/auth/google/config");
  }
  return googleSignInConfigPromise;
}

export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;

  try {
    const user = await authFetch<AuthUser>("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    return user;
  } catch {
    clearAuth();
    return null;
  }
}

export function logout() {
  clearAuth();
  window.location.href = "/login";
}
