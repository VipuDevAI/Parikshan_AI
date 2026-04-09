import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { AuthUser, UserRole } from "@shared/schema";

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (user: AuthUser, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem("safal_user");
    const storedToken = localStorage.getItem("safal_token");
    if (storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem("safal_user");
        localStorage.removeItem("safal_token");
      }
    }
    setIsLoading(false);
  }, []);

  const login = (user: AuthUser, token: string) => {
    setUser(user);
    localStorage.setItem("safal_user", JSON.stringify(user));
    localStorage.setItem("safal_token", token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("safal_user");
    localStorage.removeItem("safal_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function getToken(): string | null {
  return localStorage.getItem("safal_token");
}

export function hasRole(user: AuthUser | null, roles: UserRole[]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
