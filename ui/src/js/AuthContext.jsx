import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import apiClient, {
  API_ERROR_EVENT,
  AUTH_EXPIRED_EVENT,
  setAccessToken,
} from "./apiClient.js";
import BASE_API from "./resources/resourceAPI";

const AuthContext = createContext(null);
let sessionRestorePromise = null;

function restoreSession() {
  if (!sessionRestorePromise) {
    sessionRestorePromise = apiClient
      .post(BASE_API.AUTH_REFRESH, {}, { suppressErrorToast: true })
      .then(({ data }) => data)
      .finally(() => {
        sessionRestorePromise = null;
      });
  }
  return sessionRestorePromise;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const applySession = useCallback((session) => {
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;
    const expireSession = () => {
      if (active) clearSession();
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, expireSession);

    restoreSession()
      .then((session) => {
        if (active) applySession(session);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, expireSession);
    };
  }, [applySession, clearSession]);

  const login = useCallback(async (credentials) => {
    const { data } = await apiClient.post(BASE_API.AUTH_LOGIN, credentials);
    applySession(data);
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await apiClient.post(BASE_API.AUTH_LOGOUT);
    } catch (error) {
      if (!error.response) {
        window.dispatchEvent(
          new CustomEvent(API_ERROR_EVENT, {
            detail: `Unable to sign out: ${error.message}`,
          }),
        );
      }
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, isLoading, login, logout }),
    [user, isLoading, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
