import axios from "axios";
import BASE_API from "./resources/resourceAPI";

export const API_ERROR_EVENT = "api-client-error";
export const AUTH_EXPIRED_EVENT = "auth-session-expired";

const apiClient = axios.create();
let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token;
}

apiClient.defaults.withCredentials = true;

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const config = error.config;
    const isAuthRequest = config?.url?.includes("/auth/");
    if (status === 401 && accessToken && config && !config._authRetry && !isAuthRequest) {
      config._authRetry = true;
      if (!refreshPromise) {
        refreshPromise = axios
          .post(BASE_API.AUTH_REFRESH, {}, { withCredentials: true })
          .then(({ data }) => {
            setAccessToken(data.accessToken);
            return data.accessToken;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        const token = await refreshPromise;
        config.headers.Authorization = `Bearer ${token}`;
        return apiClient(config);
      } catch {
        setAccessToken(null);
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
      }
    }

    if (status >= 400 && status < 500 && !config?.suppressErrorToast) {
      const responseData = error.response.data;
      const message =
        typeof responseData === "string"
          ? responseData
          : responseData?.message;
      const content = message
        ? `Request failed (${status}): ${message}`
        : `Request failed (${status}).`;

      window.dispatchEvent(
        new CustomEvent(API_ERROR_EVENT, { detail: content }),
      );
    }

    return Promise.reject(error);
  },
);

export default apiClient;
