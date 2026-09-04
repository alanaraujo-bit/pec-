/**
 * Cliente da API.
 *
 * Fino de propósito: o servidor já devolve tudo calculado pelo `@pece/core`, então o app
 * não recalcula nada. Isso mantém a inteligência com uma fonte só da verdade — a tela
 * nunca discorda do histórico.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'pece.token';

/**
 * Em desenvolvimento o emulador Android não enxerga `localhost` da máquina — precisa de
 * `10.0.2.2`. Fora isso, aponta para a API de produção no Railway.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api-production-eb453.up.railway.app';

let cachedToken: string | null = null;

/** `expo-secure-store` não existe na web; ali caímos para o storage do navegador. */
async function readToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    cachedToken =
      Platform.OS === 'web'
        ? globalThis.localStorage?.getItem(TOKEN_KEY) ?? null
        : await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token;
  try {
    if (Platform.OS === 'web') {
      if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
      else globalThis.localStorage?.removeItem(TOKEN_KEY);
    } else if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  } catch {
    // Falha de armazenamento não deve derrubar o app; a sessão vive em memória.
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = await readToken();

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    // Rede fora do ar é um estado esperado, não um erro genérico.
    throw new ApiError(0, 'Sem conexão. Verifique sua internet.', 'offline');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.message ?? 'Algo deu errado.', data?.error);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T>(path: string) => request<T>('DELETE', path),
};

// ---------------------------------------------------------------------------
// Tipos de resposta — espelham o que a API devolve
// ---------------------------------------------------------------------------

export interface SessionUser {
  id: string;
  handle: string;
  displayName: string;
  region: string;
}

export interface AuthResponse {
  token: string;
  user: SessionUser;
  needsOnboarding: boolean;
}

export interface Finding {
  id: string;
  kind: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  category: string | null;
  what: string;
  why: string;
  how: string | null;
  technical: string[];
  confidence: 'high' | 'medium' | 'low';
  expectedGain: string | null;
  impactScore: number;
}

export interface FpsEstimate {
  fps: number;
  gpuBoundFps: number;
  cpuBoundFps: number;
  limitedBy: 'cpu' | 'gpu' | 'balanced';
  bottleneckSeverity: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface Diagnosis {
  verdict: 'healthy' | 'minor-improvements' | 'attention-needed' | 'critical';
  headline: string;
  summary: string;
  findings: Finding[];
  approved: Array<{ category: string; label: string; reason: string }>;
  performance: {
    fps: FpsEstimate | null;
    workloadLabel: string | null;
    meetsTarget: boolean | null;
    production: Array<{ workload: string; score: number; limitedBy: string }>;
  };
  power: {
    estimatedLoadWatts: number;
    psuWatts: number | null;
    utilization: number | null;
    headroomWatts: number | null;
  };
  limitations: string[];
}

export interface SetupScore {
  total: number;
  tier: 'entry' | 'solid' | 'strong' | 'excellent' | 'elite';
  dimensions: Array<{
    dimension: string;
    score: number;
    weight: number;
    label: string;
    reason: string;
  }>;
  weakest: string | null;
  potentialGain: number;
}

export interface Scenario {
  tier: 'economic' | 'balanced' | 'enthusiast';
  category: string;
  component: { id: string; model: string; fullName: string; brand: string; spec: Record<string, unknown> };
  estimatedCost: number;
  currency: string;
  fpsBefore: number;
  fpsAfter: number;
  gainPercent: number;
  compatibility: { level: string; issues: Array<{ level: string; message: string; detail: string }> };
  advantages: string[];
  disadvantages: string[];
  rationale: string;
}

export interface RigSummary {
  id: string;
  name: string;
  kind: string;
  isPrimary: boolean;
  visibility: string;
  showValue: boolean;
  componentCount: number;
  setupScore: number;
  tier: string;
  verdict: string;
  status: string;
  estimatedFps: number | null;
}

export interface CatalogComponent {
  id: string;
  category: string;
  brand: string;
  family: string;
  model: string;
  fullName: string;
  releaseYear: number;
  spec: Record<string, unknown>;
  msrpUsd: number | null;
  discontinued: boolean;
}

export interface FeedEvent {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
  automatic: boolean;
  author: { id: string; handle: string; displayName: string; avatarUrl: string | null };
  rig: { id: string; name: string } | null;
  reactions: { LOVE: number; LIKE: number; DISLIKE: number };
  viewerReaction: 'LOVE' | 'LIKE' | 'DISLIKE' | null;
  commentCount: number;
}

export interface FeedResponse {
  personal: {
    rigId: string;
    rigName: string;
    status: string;
    verdict: string;
    setupScore: number;
    headline: string;
    topFinding: { what: string; severity: string } | null;
  } | null;
  events: FeedEvent[];
  nextCursor: string | null;
}
