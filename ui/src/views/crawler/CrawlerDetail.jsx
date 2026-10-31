import { useRef, useState } from "react";
import apiClient from "../../js/apiClient.js";
import BASE_API from "../../js/resources/resourceAPI";
import ENUM from "../../js/resources/resourceEnum";
import resources from "../../js/resources/resourceMsg";
import { BaseInput } from "../../components/Shared.jsx";

const crawlerStatusKey = "__crawlerStatus";

function downloadCsv(filename, rows) {
  const contents = rows
    .map((row) =>
      row
        .map((value) => {
          const text = value == null ? "" : String(value);
          return `"${text.replaceAll('"', '""')}"`;
        })
        .join(","),
    )
    .join("\r\n");
  const blob = new Blob(["\uFEFF", contents], {
    type: "text/csv;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function CrawlerDetail({
  mode,
  crawler: initialCrawler,
  selectors: initialSelectors,
  outputs: initialOutputs,
  onClose,
  onToast,
  onPopup,
}) {
  const [crawler, setCrawler] = useState({
    ...initialCrawler,
    urls: initialCrawler.urls || [],
    headless: initialCrawler.headless ?? true,
  });
  const nextSelectorKey = useRef(initialSelectors?.length || 1);
  const [selectors, setSelectors] = useState(() => {
    const initialRows = initialSelectors?.length ? initialSelectors : [{}];
    return initialRows.map((selector, index) => ({
      ...selector,
      clientKey: selector.id || selector._id || `selector-${index}`,
    }));
  });
  const [outputs, setOutputs] = useState(initialOutputs || []);
  const [activeTab, setActiveTab] = useState(0);
  const [detailSelectorIndex, setDetailSelectorIndex] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [urlInput, setUrlInput] = useState("");
  const [isSaved, setIsSaved] = useState(mode !== ENUM.formMode.Add);
  const [saving, setSaving] = useState(false);
  const [recordingSelectors, setRecordingSelectors] = useState(false);
  const [extractingData, setExtractingData] = useState(false);
  const outputFields = outputs.length
    ? Object.keys(outputs[0]).filter((key) => key !== crawlerStatusKey)
    : [];
  const orderedOutputs = [...outputs].sort(
    (left, right) =>
      Number(right[crawlerStatusKey] === "NEW") -
      Number(left[crawlerStatusKey] === "NEW"),
  );

  const updateCrawler = (name, value) => {
    setCrawler((current) => ({ ...current, [name]: value }));
  };

  const addUrl = () => {
    const enteredUrls = urlInput
      .split(/\r?\n/)
      .map((url) => url.trim())
      .filter(Boolean);
    const knownUrls = new Set(crawler.urls);
    const urlsToAdd = [];
    let invalidCount = 0;
    let duplicateCount = 0;

    for (const url of enteredUrls) {
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        parsedUrl = null;
      }

      if (!parsedUrl || !["http:", "https:"].includes(parsedUrl.protocol)) {
        invalidCount++;
      } else if (knownUrls.has(url)) {
        duplicateCount++;
      } else {
        knownUrls.add(url);
        urlsToAdd.push(url);
      }
    }

    if (urlsToAdd.length) {
      updateCrawler("urls", [...crawler.urls, ...urlsToAdd]);
    }
    setUrlInput("");

    if (invalidCount || duplicateCount) {
      const skipped = [
        invalidCount && `${invalidCount} invalid`,
        duplicateCount && `${duplicateCount} duplicate`,
      ].filter(Boolean);
      onPopup({
        type: urlsToAdd.length ? ENUM.popupEnum.warning : ENUM.popupEnum.alert,
        content: `${urlsToAdd.length} URL(s) added. Skipped ${skipped.join(" and ")} line(s).`,
      });
    } else if (!urlsToAdd.length) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: "Enter one or more URLs, one per line.",
      });
    }
  };

  const removeUrl = (indexToRemove) => {
    updateCrawler(
      "urls",
      crawler.urls.filter((_, index) => index !== indexToRemove),
    );
  };

  const updateSelector = (index, name, value) => {
    setSelectors((current) =>
      current.map((selector, selectorIndex) =>
        selectorIndex === index
          ? { ...selector, [name]: value }
          : selector,
      ),
    );
  };

  const addSelector = () => {
    const index = selectors.length;
    setSelectors((current) => [
      ...current,
      {
        index,
        clientKey: `selector-${nextSelectorKey.current++}`,
        metadata: "",
        selectorCSS: "",
        selectorXPath: "",
        tag: "",
        eventType: "",
      },
    ]);
    setDetailSelectorIndex(index);
  };

  const importFile = async (event) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
    if (!file) return;
    try {
      const XLSX = await import("@e965/xlsx");
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet);
      const urls = rows.flatMap((row) => {
        const key = Object.keys(row).find((header) =>
          ["url", "urls", "link", "links"].includes(header.toLowerCase()),
        );
        return key && row[key] ? [String(row[key])] : [];
      });
      updateCrawler("urls", urls);
    } catch (error) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: `Unable to read the selected file: ${error.message}`,
      });
    } finally {
      event.target.value = "";
    }
  };

  const saveCrawler = async () => {
    if (!crawler.crawlerCode) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: "Crawler's code cannot be empty.",
      });
      return;
    }
    if (!crawler.crawlerName) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: "User must enter crawler's name.",
      });
      return;
    }
    if (!crawler.selectorType) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: "User must choose one selector type.",
      });
      return;
    }
    if (!crawler.urls?.length) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: "Add at least one URL manually or import a CSV or Excel file.",
      });
      return;
    }

    setSaving(true);
    try {
      if (mode === ENUM.formMode.Add && !isSaved) {
        await apiClient.post(BASE_API.CRAWLER, { crawler, selectors });
        setIsSaved(true);
        onToast(resources.toastMsg.addSuccessMsg, ENUM.toastEnum.success);
      } else {
        await apiClient.put(BASE_API.CRAWLER_CODE(crawler.crawlerCode), {
          crawler,
          selectors,
        });
        onToast(resources.toastMsg.updateSuccessMsg, ENUM.toastEnum.success);
      }
    } catch (error) {
      const responseMessage = error.response?.data;
      onPopup({
        type: ENUM.popupEnum.alert,
        content: `Unable to save crawler: ${
          typeof responseMessage === "string"
            ? responseMessage
            : responseMessage?.message || error.message
        }`,
      });
    } finally {
      setSaving(false);
    }
  };

  const extractSelectors = async () => {
    setRecordingSelectors(true);
    try {
      const { data } = await apiClient.post(
        BASE_API.CRAWLER_SLT_EXTRACT(crawler.crawlerCode),
      );
      setSelectors(Array.isArray(data) ? data : []);
    } catch (error) {
      const message =
        error.response?.status === 404
          ? "Crawler must be saved before extracting selectors."
          : `Unable to extract selectors: ${error.message}`;
      onPopup({
        type:
          error.response?.status === 404
            ? ENUM.popupEnum.warning
            : ENUM.popupEnum.alert,
        content: message,
      });
    } finally {
      setRecordingSelectors(false);
    }
  };

  const extractData = async () => {
    if (extractingData) return;

    setExtractingData(true);
    try {
      const { data } = await apiClient.post(
        BASE_API.CRAWLER_DATA_EXTRACT(crawler.crawlerCode),
      );
      setOutputs(Array.isArray(data) ? data : []);
      setActiveTab(1);
    } catch (error) {
      onPopup({
        type:
          error.response?.status === 404
            ? ENUM.popupEnum.warning
            : ENUM.popupEnum.alert,
        content:
          error.response?.status === 404
            ? String(error.response.data)
            : `Unable to extract data: ${error.message}`,
      });
    } finally {
      setExtractingData(false);
    }
  };

  const clearOutputs = () => {
    if (!outputs.length) return;

    onPopup({
      type: ENUM.popupEnum.confirm,
      content: "Clear all outputs for this crawler? This cannot be undone.",
      onConfirm: async () => {
        try {
          await apiClient.delete(BASE_API.CRAWLER_OUTPUTS(crawler.crawlerCode));
          setOutputs([]);
          onToast("Crawler outputs cleared.", ENUM.toastEnum.success);
        } catch (error) {
          onPopup({
            type: ENUM.popupEnum.alert,
            content: `Unable to clear outputs: ${
              error.response?.data?.message || error.message
            }`,
          });
        }
      },
    });
  };

  const exportOutputs = () => {
    if (!outputs.length) {
      onToast("No data exist to export.", ENUM.toastEnum.error);
      return;
    }
    const headers = outputFields;
    downloadCsv("output.csv", [
      headers,
      ...outputs.map((row) => headers.map((header) => row[header])),
    ]);
  };

  const deleteSelector = (index) => {
    onPopup({
      type: ENUM.popupEnum.confirm,
      content: "Do you want to delete this selector?",
      onConfirm: () => {
        setSelectors((current) =>
          current.filter((_, selectorIndex) => selectorIndex !== index),
        );
        setDetailSelectorIndex((current) => {
          if (current === index) return null;
          return current !== null && current > index ? current - 1 : current;
        });
      },
    });
  };

  return (
    <div className="m-shadow-box">
      <section
        className="m-dialog"
        id="crawlerDetail"
        role="dialog"
        aria-modal="true"
        aria-label="Crawler details"
      >
        <div className="m-dialog-header grey-background flex flex-align-center">
          <div className="m-icon icon--recent mr-4" />
          <div className="header-title text-overflow-hidden">CRAWLER DIALOG</div>
          <div className="detail-input" />
          <div className="flex-grow" />
          <div className="btn-detail-group flex flex-align-center">
            <div className="title__tour-guide">
              <div className="m-icon icon--tour" />
              <div className="tour-label">Guide</div>
            </div>
            <div className="btn-detail">
              <div className="m-icon icon--setting" title="Customize view" />
            </div>
            <div className="btn-detail">
              <div className="m-icon icon--help" title="Help (F1)" />
            </div>
            <button
              className="btn-detail icon-button"
              title="Close (ESC)"
              onClick={onClose}
            >
              <div className="m-icon icon--close" />
            </button>
          </div>
        </div>

        <div className="m-dialog-content">
          <div className="main-info flex grey-background" style={{ zIndex: 100 }}>
            <div className="crawler-main-layout">
              <div className="crawler-main-fields">
                <div className="m-row">
                  <div className="w-40 mr-4">
                    <div className="m-label">Crawler Code (<span className="required">*</span>)</div>
                    <BaseInput value={crawler.crawlerCode} disabled />
                  </div>
                  <div className="w-60">
                    <div className="m-label">Crawler Name (<span className="required">*</span>)</div>
                    <BaseInput
                      value={crawler.crawlerName}
                      onChange={(value) => updateCrawler("crawlerName", value)}
                    />
                  </div>
                </div>
                <div className="m-row">
                  <div className="w-full">
                    <div className="m-label">Description</div>
                    <BaseInput
                      value={crawler.description}
                      onChange={(value) => updateCrawler("description", value)}
                    />
                  </div>
                </div>
                <div className="m-row crawler-schedule-row">
                  <div className="w-full">
                    <div className="m-label">Optional Crawl Schedule (Cron)</div>
                    <BaseInput
                      value={crawler.cronExpression}
                      onChange={(value) => updateCrawler("cronExpression", value)}
                      placeholder="0 9 * * *"
                    />
                    <div className="schedule-help">
                      Five fields: minute hour day-of-month month day-of-week.
                      Runs in Asia/Ho_Chi_Minh time. Example: <code>0 9 * * *</code>{" "}
                      runs daily at 09:00. Leave empty to disable scheduling.
                    </div>
                  </div>
                </div>
              </div>
              <aside className="crawler-side-panel">
                <div className="left-seperate">
                  <div className="m-label">Selector Type (<span className="required">*</span>)</div>
                  <div className="ratio-check-detail">
                    {Object.entries(ENUM.selectorEnum).map(([label, value]) => (
                      <label className="m-radio" key={value}>
                        <input
                          className="m-inner-ratio"
                          type="radio"
                          name="selectorType"
                          value={value}
                          checked={crawler.selectorType === value}
                          onChange={() => updateCrawler("selectorType", value)}
                        />
                        <span className="m-radio-name">{label}</span>
                        <span className="m-radio-marked" />
                      </label>
                    ))}
                  </div>
                </div>
                <div className="crawler-browser-mode">
                  <div className="m-label">Browser Mode</div>
                  <div className="ratio-check-detail">
                    {[["Headless", true], ["Visible", false]].map(([label, value]) => (
                      <label className="m-radio" key={label}>
                        <input
                          className="m-inner-ratio"
                          type="radio"
                          name="crawlerHeadlessMode"
                          checked={crawler.headless === value}
                          onChange={() => updateCrawler("headless", value)}
                        />
                        <span className="m-radio-name">{label}</span>
                        <span className="m-radio-marked" />
                      </label>
                    ))}
                  </div>
                  <div className="schedule-help">
                    Visible mode requires a graphical display on the server.
                  </div>
                </div>
                <section className="crawler-url-panel">
                  <div className="crawler-url-panel-heading">
                    <div className="m-label">URLs (<span className="required">*</span>)</div>
                    <label className="file-select" title=".CSV, .XLSX or .XLS file">
                      <span className="select-button">
                        {selectedFile ? selectedFile.name : "Import"}
                      </span>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={importFile}
                      />
                    </label>
                  </div>
                  <div className="crawler-url-entry">
                    <textarea
                      className="m-input crawler-url-textarea"
                      value={urlInput}
                      onChange={(event) => setUrlInput(event.target.value)}
                      placeholder={"Enter one URL per line\nhttps://example.com"}
                      rows={3}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                          event.preventDefault();
                          addUrl();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="m-btn btn-size-default m-btn-primary"
                      onClick={addUrl}
                    >
                      Add
                    </button>
                  </div>
                  <div className="crawler-url-help">
                    One URL per line. Press Ctrl+Enter to add.
                  </div>
                  <div className="crawler-urls">
                    <table className="m-table">
                      <tbody className="m-tbody">
                        {crawler.urls.map((url, index) => (
                          <tr className="m-tr" key={`${url}-${index}`}>
                            <td className="m-td bg-white text-align-center">{index + 1}</td>
                            <td className="m-td bg-white">{url}</td>
                            <td className="m-td bg-white text-align-center">
                              <button
                                type="button"
                                className="crawler-url-remove plain-button"
                                aria-label={`Remove URL ${url}`}
                                onClick={() => removeUrl(index)}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                        {!crawler.urls.length && (
                          <tr className="m-tr">
                            <td className="m-td bg-white text-align-center" colSpan={3}>
                              No URLs added yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              </aside>
            </div>
          </div>

          <div className="grid-tab flex flex-align-center" style={{ zIndex: 99 }}>
            <div className="tab-left flex">
              <button
                className={`tab cur-pointer ${activeTab === 0 ? "active" : ""}`}
                onClick={() => setActiveTab(0)}
              >
                Selectors
              </button>
              <button
                className={`tab cur-pointer ${activeTab === 1 ? "active" : ""}`}
                onClick={() => setActiveTab(1)}
              >
                Outputs
              </button>
            </div>
            <div className="flex-grow" />
            <div className="crawler-tab-actions">
              {activeTab === 0 && (
                <button
                  type="button"
                  className="m-btn m-btn-primary btn-size-default"
                  onClick={addSelector}
                >
                  Add Selector
                </button>
              )}
              <button
                className="m-btn m-btn-primary btn-size-default"
                disabled={recordingSelectors}
                onClick={extractSelectors}
              >
                {recordingSelectors
                  ? "Recording... Close browser to finish"
                  : "Extract Selectors"}
              </button>
              <button
                className="m-btn m-btn-primary btn-size-default"
                disabled={extractingData}
                onClick={extractData}
                aria-live="polite"
              >
                {extractingData && (
                  <span className="crawler-button-spinner" aria-hidden="true" />
                )}
                {extractingData ? "Extracting..." : "Extract Data"}
              </button>
              {activeTab === 1 && (
                <>
                  <button
                    type="button"
                    className="m-btn btn-size-default m-btn-secondary"
                    disabled={!outputs.length}
                    onClick={clearOutputs}
                  >
                    Clear Outputs
                  </button>
                  <button
                    className="icon-button"
                    title="Export output to CSV file"
                    disabled={!outputs.length}
                    onClick={exportOutputs}
                  >
                    <span className="m-icon icon--excel" />
                  </button>
                </>
              )}
            </div>
          </div>

          {activeTab === 0 ? (
            <div className="grid-table">
              <table className="m-table">
                <thead className="m-thead">
                  <tr className="m-tr">
                    <th className="space sticky-col left" />
                    <th className="m-th" style={{ width: 30 }}>#</th>
                    <th className="m-th" style={{ width: 180 }}>Metadata</th>
                    <th className="m-th" style={{ width: 350 }}>CSS</th>
                    <th className="m-th" style={{ width: 350 }}>XPath</th>
                    <th className="m-th" style={{ width: 30 }} />
                    <th className="space sticky-col right" />
                  </tr>
                </thead>
                <tbody className="m-tbody">
                  {selectors.map((selector, index) => (
                    <tr
                      className="m-tr"
                      key={selector.clientKey ?? selector.id ?? selector._id ?? index}
                      onClick={() => setDetailSelectorIndex(index)}
                    >
                      <td className="space static-col left" />
                      <td className="m-td text-align-center">{index + 1}</td>
                      <td className="m-td">
                        {detailSelectorIndex === index ? (
                          <BaseInput
                            value={selector.metadata}
                            onChange={(value) => updateSelector(index, "metadata", value)}
                          />
                        ) : selector.metadata}
                      </td>
                      <td className="m-td text-overflow-hidden selector-edit-cell" title={selector.selectorCSS}>
                        {detailSelectorIndex === index ? (
                          <BaseInput
                            value={selector.selectorCSS}
                            onChange={(value) => updateSelector(index, "selectorCSS", value)}
                          />
                        ) : selector.selectorCSS}
                      </td>
                      <td className="m-td text-overflow-hidden selector-edit-cell" title={selector.selectorXPath}>
                        {detailSelectorIndex === index ? (
                          <BaseInput
                            value={selector.selectorXPath}
                            onChange={(value) => updateSelector(index, "selectorXPath", value)}
                          />
                        ) : selector.selectorXPath}
                      </td>
                      <td className="m-td text-align-center">
                        <button
                          className="selector-delete plain-button"
                          aria-label={`Delete selector ${index + 1}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            deleteSelector(index);
                          }}
                        >
                          ×
                        </button>
                      </td>
                      <td className="space static-col right" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid-table">
              {outputs.length ? (
                <table className="m-table">
                  <thead className="m-thead">
                    <tr className="m-tr">
                      <th className="space sticky-col left" />
                      <th className="m-th" style={{ width: 30 }}>#</th>
                      <th className="m-th">Status</th>
                      {outputFields.map((key) => (
                        <th className="m-th" key={key}>{key}</th>
                      ))}
                      <th className="space sticky-col right" />
                    </tr>
                  </thead>
                  <tbody className="m-tbody">
                    {orderedOutputs.map((output, index) => (
                      <tr className="m-tr" key={index}>
                        <td className="space static-col left" />
                        <td className="m-td text-align-center">{index + 1}</td>
                        <td className="m-td crawler-output-status">
                          {output[crawlerStatusKey] && (
                            <span className={`crawler-new-badge ${output[crawlerStatusKey] === "READ" ? "is-read" : ""}`}>
                              {output[crawlerStatusKey]}
                            </span>
                          )}
                        </td>
                        {outputFields.map((key) => (
                          <td className="m-td text-overflow-hidden" key={key} style={{ maxWidth: 250 }}>
                            {String(output[key] ?? "")}
                          </td>
                        ))}
                        <td className="space static-col right" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="text-align-center">No Data Output...</div>
              )}
            </div>
          )}
        </div>
        <footer className="m-dialog-footer">
          <div className="left-group-btn">
            <button
              type="button"
              className="m-btn btn-size-default m-btn-secondary"
              onClick={onClose}
            >
              Back
            </button>
          </div>
          <div className="flex-grow" />
          <div className="right-group-btn flex">
            <button
              type="button"
              className="m-btn btn-size-default m-btn-primary"
              disabled={saving}
              onClick={saveCrawler}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
