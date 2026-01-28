import { http } from './http';

export interface LoginPayload {
  username: string;
  password: string;
}

export interface LoginResult {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
}

export function login(payload: LoginPayload) {
  return http.post<LoginResult>('/api/v1/admin/auth/login', payload);
}

