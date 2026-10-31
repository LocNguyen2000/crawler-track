const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const BASE_API = {
    CRAWLER: `${API_BASE_URL}/crawler/`,
    CRAWLER_OVERVIEW: `${API_BASE_URL}/crawler/healthcheck`,
    CRAWLER_NEW_CODE: `${API_BASE_URL}/crawler/newCrawlerCode`,
    CRAWLER_CODE(code){
        return `${API_BASE_URL}/crawler/${code}`
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