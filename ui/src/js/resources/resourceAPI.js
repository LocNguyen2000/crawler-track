const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const BASE_API = {
    AUTH_SIGNUP: `${API_BASE_URL}/auth/signup`,
    AUTH_LOGIN: `${API_BASE_URL}/auth/login`,
    AUTH_VERIFY_EMAIL: `${API_BASE_URL}/auth/verify-email`,
    AUTH_RESEND_VERIFICATION: `${API_BASE_URL}/auth/resend-verification`,
    AUTH_REFRESH: `${API_BASE_URL}/auth/refresh`,
    AUTH_LOGOUT: `${API_BASE_URL}/auth/logout`,
    AUTH_PENDING_USERS: `${API_BASE_URL}/auth/admin/pending-users`,
    AUTH_USER_APPROVAL(userId) {
        return `${API_BASE_URL}/auth/admin/users/${userId}/approval`
    },
    CRAWLER: `${API_BASE_URL}/crawler/`,
    CRAWLER_OVERVIEW: `${API_BASE_URL}/crawler/healthcheck`,
    CRAWLER_NEW_CODE: `${API_BASE_URL}/crawler/newCrawlerCode`,
    CRAWLER_CODE(code){
        return `${API_BASE_URL}/crawler/${code}`
    },
    CRAWLER_OUTPUTS(code){
        return `${API_BASE_URL}/crawler/${code}/outputs`
    },
    CRAWLER_SLT_CODE(code){
        return `${API_BASE_URL}/crawler/selectors/${code}`
    },
    CRAWLER_SLT_EXTRACT(code){
        return `${API_BASE_URL}/crawler/record/${code}`
    },
    CRAWLER_DATA_EXTRACT(code){
        return `${API_BASE_URL}/crawler/scrape/${code}`
    }
}
export default BASE_API;