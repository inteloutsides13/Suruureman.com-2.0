import { useState, useCallback } from "react";
import {
  readLocalStorageValue,
  removeLocalStorageValue,
  writeLocalStorageValue,
} from "@/lib/browser-storage";

const TOKEN_KEY = "sem_admin_token";
const EMAIL_KEY = "sem_admin_email";
const ROLE_KEY = "sem_admin_role";
const NAME_KEY = "sem_admin_name";
const USER_ID_KEY = "sem_admin_user_id";

export type AdminRole = "developer" | "admin" | "contributor";

export function hasIrabAccessRole(role: unknown): role is AdminRole {
  return role === "developer" || role === "admin" || role === "contributor";
}

export function getAdminToken(): string | null {
  return readLocalStorageValue(TOKEN_KEY);
}

export function getAdminRole(): AdminRole | null {
  return readLocalStorageValue(ROLE_KEY) as AdminRole | null;
}

export function getAdminName(): string | null {
  return readLocalStorageValue(NAME_KEY);
}

export function getAdminUserId(): number | null {
  const v = readLocalStorageValue(USER_ID_KEY);
  return v ? parseInt(v) : null;
}

export function isDeveloper(): boolean {
  return readLocalStorageValue(ROLE_KEY) === "developer";
}

export function isContributor(): boolean {
  return readLocalStorageValue(ROLE_KEY) === "contributor";
}

export function clearAdminSession(): void {
  removeLocalStorageValue(TOKEN_KEY);
  removeLocalStorageValue(EMAIL_KEY);
  removeLocalStorageValue(ROLE_KEY);
  removeLocalStorageValue(NAME_KEY);
  removeLocalStorageValue(USER_ID_KEY);
}

export function useAdminAuth() {
  const [token, setTokenState] = useState<string | null>(() => readLocalStorageValue(TOKEN_KEY));
  const [email, setEmailState] = useState<string | null>(() => readLocalStorageValue(EMAIL_KEY));
  const [role, setRoleState] = useState<AdminRole | null>(() => readLocalStorageValue(ROLE_KEY) as AdminRole | null);
  const [name, setNameState] = useState<string | null>(() => readLocalStorageValue(NAME_KEY));

  const login = useCallback((newToken: string, newEmail: string, newRole?: string, newName?: string, newUserId?: number) => {
    writeLocalStorageValue(TOKEN_KEY, newToken);
    writeLocalStorageValue(EMAIL_KEY, newEmail);
    const r = (newRole === "developer" || newRole === "admin" || newRole === "contributor") ? newRole : "admin";
    writeLocalStorageValue(ROLE_KEY, r);
    if (newName) writeLocalStorageValue(NAME_KEY, newName);
    if (newUserId) writeLocalStorageValue(USER_ID_KEY, String(newUserId));
    setTokenState(newToken);
    setEmailState(newEmail);
    setRoleState(r as AdminRole);
    setNameState(newName ?? null);
  }, []);

  const logout = useCallback(() => {
    clearAdminSession();
    setTokenState(null);
    setEmailState(null);
    setRoleState(null);
    setNameState(null);
  }, []);

  return {
    token,
    email,
    role,
    name,
    login,
    logout,
    isAuthenticated: !!token,
    isDeveloper: role === "developer",
    isAdmin: role === "admin" || role === "developer",
    isContributor: role === "contributor",
  };
}

let redirectingToLogin = false;

export async function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && !redirectingToLogin) {
    redirectingToLogin = true;
    clearAdminSession();
    window.location.href = "/admin/login";
    setTimeout(() => { redirectingToLogin = false; }, 3000);
  }

  return response;
}

/** Fetch utility for the contributor portal — same token, different redirect */
export async function contributorFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getAdminToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (response.status === 401 && !redirectingToLogin) {
    redirectingToLogin = true;
    clearAdminSession();
    window.location.href = "/admin/login";
    setTimeout(() => { redirectingToLogin = false; }, 3000);
  }

  return response;
}
