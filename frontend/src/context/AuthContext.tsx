import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  weightKg: number | null;
  heightCm: number | null;
  birthDate: string | null;
  sex: string | null;
  sport: string | null;
  sportLevel: string | null;
  avatarBase64: string | null;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    name: string,
    sport?: string | null,
    sportLevel?: string | null
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    try {
      const me = await api.get<UserProfile>("/users/me");
      setUser(me);
    } catch {
      setUser(null);
      localStorage.removeItem("token");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ token: string; user: UserProfile }>("/auth/login", { email, password });
    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  async function register(
    email: string,
    password: string,
    name: string,
    sport?: string | null,
    sportLevel?: string | null
  ) {
    const res = await api.post<{ token: string; user: UserProfile }>("/auth/register", {
      email,
      password,
      name,
      sport: sport || null,
      sportLevel: sportLevel || null,
    });
    localStorage.setItem("token", res.token);
    setUser(res.user);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit etre utilise dans un AuthProvider");
  return ctx;
}
