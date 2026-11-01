import { useCallback, useEffect, useMemo, useState } from "react";
import apiClient from "../../js/apiClient.js";
import BASE_API from "../../js/resources/resourceAPI";
import ENUM from "../../js/resources/resourceEnum";
import CrawlerDetail from "./CrawlerDetail.jsx";
import { BasePopup, BaseToast, BaseToolbar } from "../../components/Shared.jsx";

function dateDifference(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 60) return `${minutes} minutes ago.`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hours ago.`;
  return `${Math.floor(hours / 24)} days ago.`;
}

function formatScheduledRun(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export default function CrawlerDashboard() {
  const [crawlers, setCrawlers] = useState([]);
  const [overview, setOverview] = useState({
    totalUrls: 0,
    totalDataAmount: 0,
    averagePfmTime: 0,
  });
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState(null);
  const [popover, setPopover] = useState(null);
  const [popup, setPopup] = useState(null);
  const [toast, setToast] = useState(null);

  const loadTable = useCallback(async () => {
    try {
      const { data } = await apiClient.get(BASE_API.CRAWLER);
      setCrawlers(Array.isArray(data.Data) ? data.Data : []);
      setOverview({
        totalUrls: data.TotalUrls ?? 0,
        totalDataAmount: data.TotalDataAmount ?? 0,
        averagePfmTime: data.AveragePfmTime ?? 0,
      });
      setLoadError("");
    } catch (error) {
      const message = error.response?.data?.message || error.message;
      setLoadError(`Unable to load crawlers: ${message}`);
    }
  }, []);

  useEffect(() => {
    loadTable();
  }, [loadTable]);

  const visibleCrawlers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return crawlers;
    return crawlers.filter((crawler) =>
      [
        crawler.crawlerCode,
        crawler.crawlerName,
        crawler.description,
        crawler.selectorType,
        crawler.status,
        crawler.lastScheduledRunAt,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [crawlers, query]);

  const openCrawler = async (crawler) => {
    try {
      const { data } = await apiClient.get(
        BASE_API.CRAWLER_CODE(crawler.crawlerCode),
      );
      setDetail({
        mode: ENUM.formMode.Edit,
        crawler: data.crawler,
        selectors: data.selectors,
        outputs: data.outputs,
      });
      setPopover(null);
    } catch (error) {
      if (error.response?.status >= 400 && error.response.status < 500) return;
      setToast({
        type: ENUM.toastEnum.error,
        content: `Unable to open crawler: ${error.message}`,
      });
    }
  };

  const createCrawler = async () => {
    try {
      const { data } = await apiClient.get(BASE_API.CRAWLER_NEW_CODE);
      setDetail({
        mode: ENUM.formMode.Add,
        crawler: { crawlerCode: `CRWL-${data}`, urls: [], headless: true },
        selectors: [{}],
        outputs: [],
      });
    } catch (error) {
      if (error.response?.status >= 400 && error.response.status < 500) return;
      setToast({
        type: ENUM.toastEnum.error,
        content: `Unable to create a crawler: ${error.message}`,
      });
    }
  };

  const deleteCrawler = async (crawler) => {
    try {
      await apiClient.delete(BASE_API.CRAWLER_CODE(crawler.crawlerCode));
      setCrawlers((current) =>
        current.filter((item) => item.crawlerCode !== crawler.crawlerCode),
      );
      setToast({ type: "success", content: "Crawler deleted successfully." });
    } catch (error) {
      if (error.response?.status >= 400 && error.response.status < 500) return;
      setToast({
        type: "error",
        content: `Unable to delete crawler: ${error.message}`,
      });
    }
  };

  return (
    <div className="m-view-container">
      <div className="m-title sticky" style={{ left: 0 }}>
        <div className="m-row">
          <div className="title-text">Crawler Dashboard</div>
          <div className="flex-grow" />
          <div className="m-btn-wrapper">
            <button
              className="m-btn m-btn-primary btn-size-default"
              onClick={createCrawler}
            >
              New Crawler
            </button>
          </div>
        </div>
      </div>

      <div className="m-overview sticky" style={{ left: 0 }}>
        <div className="overview-item overview-dued-debit">
          <div className="overview-data">
            <div className="overview-number">{overview.totalUrls}</div>
            <div className="overview-label">Total URL(s)</div>
          </div>
        </div>
        <div className="overview-item overview-deposit">
          <div className="overview-data">
            <div className="overview-number">{overview.totalDataAmount}</div>
            <div className="overview-label">Total Data Crawled</div>
          </div>
        </div>
        <div className="overview-item overview-payment">
          <div className="overview-data">
            <div className="overview-number">{overview.averagePfmTime}</div>
            <div className="overview-label">Average Performance Time (s)</div>
          </div>
        </div>
      </div>

      <BaseToolbar
        onSearch={setQuery}
        onReload={loadTable}
      />
      {import.meta.env.PROD && (
        <div className="schedule-production-warning dashboard-schedule-warning" role="note">
          Production scheduling is not customizable yet. All crawlers with a
          schedule run together daily at 07:00 Vietnam time; individual cron
          times are ignored.
        </div>
      )}
      {loadError && (
        <div className="ui-error" role="alert">
          {loadError}
          <button onClick={loadTable}>Retry</button>
        </div>
      )}
      <div className="table-data-control">
        <table className="m-table">
          <thead className="m-thead">
            <tr className="m-tr">
              <th className="space sticky-col left" />
              <th className="m-th" style={{ width: 50 }}>#</th>
              <th className="m-th" style={{ width: 150 }}>Crawler Code</th>
              <th className="m-th" style={{ width: 250 }}>Crawler Name</th>
              <th className="m-th" style={{ width: 90 }}>Status</th>
              <th className="m-th max-w-320">Description</th>
              <th className="m-th" style={{ width: 150 }}>Selector Type</th>
              <th className="m-th" style={{ width: 150 }}>Last modified</th>
              <th className="m-th" style={{ width: 120 }}>Performance (s)</th>
              <th className="m-th" style={{ width: 150 }}>Schedule</th>
              <th className="m-th" style={{ width: 190 }}>Last scheduled run</th>
              <th className="m-th">Task</th>
            </tr>
          </thead>
          <tbody className="m-tbody">
            {visibleCrawlers.map((crawler, index) => (
              <tr
                className="m-tr"
                key={crawler.crawlerCode || index}
                onDoubleClick={() => openCrawler(crawler)}
              >
                <td className="space static-col left" />
                <td className="m-td text-align-center">{index + 1}</td>
                <td className="m-td text-align-center">{crawler.crawlerCode}</td>
                <td className="m-td">{crawler.crawlerName}</td>
                <td className="m-td text-align-center">
                  <span className={`crawler-dashboard-status ${crawler.status === "NEW" ? "is-new" : "is-read"}`}>
                    {crawler.status || "READ"}
                  </span>
                </td>
                <td
                  className="m-td text-overflow-hidden max-w-320"
                  title={crawler.description}
                >
                  {crawler.description}
                </td>
                <td className="m-td text-align-center">{crawler.selectorType}</td>
                <td className="m-td text-align-center">{dateDifference(crawler.modifiedDate)}</td>
                <td className="m-td text-align-center">
                  {crawler.performance
                    ? Number.parseFloat(crawler.performance).toPrecision(4)
                    : "None"}
                </td>
                <td className="m-td text-align-center">
                  {crawler.cronExpression || "Manual"}
                </td>
                <td className="m-td text-align-center">
                  {formatScheduledRun(crawler.lastScheduledRunAt)}
                </td>
                <td className="m-td flex align-center justify-center">
                  <button
                    className="btn-edit-data pr-2 cur-pointer plain-button"
                    onClick={() => openCrawler(crawler)}
                  >
                    Detail
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Actions for ${crawler.crawlerCode}`}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setPopover({
                        crawler,
                        top: rect.bottom + 10,
                        left: rect.left - 20,
                      });
                    }}
                  >
                    <span className="m-icon icon--arrowup-bg-blue" />
                  </button>
                </td>
              </tr>
            ))}
            {visibleCrawlers.length === 0 && !loadError && (
              <tr className="m-tr">
                <td className="m-td text-align-center" colSpan={12}>
                  No crawlers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="m-paging">
          <div className="paging-left flex flex-align-center">
            <div className="total-data">
              Total: <b>{visibleCrawlers.length}</b> Records
            </div>
          </div>
        </div>
      </div>

      {popover && (
        <>
          <button
            className="popover-dismiss"
            aria-label="Close actions menu"
            onClick={() => setPopover(null)}
          />
          <ul
            className="m-popover"
            style={{ top: popover.top, left: popover.left }}
          >
            <li
              className="popover-list"
              onClick={() => {
                const target = popover.crawler;
                setPopover(null);
                setPopup({
                  type: "confirm",
                  content: "Confirm delete this crawler?",
                  onConfirm: () => deleteCrawler(target),
                });
              }}
            >
              Delete
            </li>
          </ul>
        </>
      )}

      {detail && (
        <CrawlerDetail
          key={detail.crawler.crawlerCode}
          {...detail}
          onClose={() => {
            setDetail(null);
            loadTable();
          }}
          onToast={(content, type) => setToast({ content, type })}
          onPopup={setPopup}
        />
      )}
      {popup && (
        <BasePopup
          type={popup.type}
          content={popup.content}
          onClose={() => setPopup(null)}
          onConfirm={() => {
            setPopup(null);
            popup.onConfirm?.();
          }}
          onDecline={() => {
            setPopup(null);
            popup.onDecline?.();
          }}
        />
      )}
      <BaseToast
        type={toast?.type}
        content={toast?.content}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
