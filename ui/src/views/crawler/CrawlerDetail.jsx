import { useState } from "react";
import axios from "axios";
import BASE_API from "../../js/resources/resourceAPI";
import ENUM from "../../js/resources/resourceEnum";
import resources from "../../js/resources/resourceMsg";
import { BaseInput } from "../../components/Shared.jsx";

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
  });
  const [selectors, setSelectors] = useState(
    initialSelectors?.length ? initialSelectors : [{}],
  );
  const [outputs, setOutputs] = useState(initialOutputs || []);
  const [activeTab, setActiveTab] = useState(0);
  const [detailSelectorIndex, setDetailSelectorIndex] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isSaved, setIsSaved] = useState(mode !== ENUM.formMode.Add);
  const [saving, setSaving] = useState(false);

  const updateCrawler = (name, value) => {
    setCrawler((current) => ({ ...current, [name]: value }));
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
        content: "User must import a CSV or Excel file containing URLs.",
      });
      return;
    }

    setSaving(true);
    try {
      if (mode === ENUM.formMode.Add && !isSaved) {
        await axios.post(BASE_API.CRAWLER, { crawler, selectors });
        setIsSaved(true);
        onToast(resources.toastMsg.addSuccessMsg, ENUM.toastEnum.success);
      } else {
        await axios.put(BASE_API.CRAWLER_CODE(crawler.crawlerCode), {
          crawler,
          selectors,
        });
        onToast(resources.toastMsg.updateSuccessMsg, ENUM.toastEnum.success);
      }
    } catch (error) {
      onPopup({
        type: ENUM.popupEnum.alert,
        content: `Unable to save crawler: ${error.response?.data?.message || error.message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  const extractSelectors = async () => {
    try {
      const { data } = await axios.post(
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
    }
  };

  const extractData = async () => {
    try {
      const { data } = await axios.post(
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
    }
  };

  const exportOutputs = () => {
    if (!outputs.length) {
      onToast("No data exist to export.", ENUM.toastEnum.error);
      return;
    }
    const headers = Object.keys(outputs[0]);
    downloadCsv("output.csv", [
      headers,
      ...outputs.map((row) => headers.map((header) => row[header])),
    ]);
  };

  const deleteSelector = (index) => {
    onPopup({
      type: ENUM.popupEnum.confirm,
      content: "Do you want to delete this selector?",
      onConfirm: () =>
        setSelectors((current) =>
          current.filter((_, selectorIndex) => selectorIndex !== index),
        ),
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
            <div className="w-75 flex">
              <div className="w-80 right-seperate">
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
                <div className="m-row">
                  <div className="w-75 mr-4">
                    <div className="m-label">URLs (<span className="required">*</span>)</div>
                    <div className="crawler-urls">
                      <table className="m-table">
                        <tbody className="m-tbody">
                          {crawler.urls.map((url, index) => (
                            <tr className="m-tr" key={`${url}-${index}`}>
                              <td className="m-td bg-white text-align-center">{index + 1}</td>
                              <td className="m-td bg-white">{url}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="w-25 flex align-center">
                    <label className="file-select w-80" title=".CSV, .XLSX or .XLS file">
                      <div className="select-button">
                        {selectedFile ? (
                          <span>File: {selectedFile.name}</span>
                        ) : (
                          <span>Choose File</span>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={importFile}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <div className="w-20">
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
              </div>
            </div>
            <div className="w-25 flex align-center flex-end">
              <button
                className="m-btn m-btn-primary btn-size-default mr-4"
                onClick={extractSelectors}
              >
                Extract Selectors
              </button>
              <button
                className="m-btn m-btn-primary btn-size-default"
                onClick={extractData}
              >
                Extract Data
              </button>
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
            {activeTab === 1 && (
              <button
                className="icon-button"
                title="Export output to CSV file"
                onClick={exportOutputs}
              >
                <span className="m-icon icon--excel" />
              </button>
            )}
          </div>

          {activeTab === 0 ? (
            <div className="grid-table">
              <table className="m-table">
                <thead className="m-thead">
                  <tr className="m-tr">
                    <th className="space sticky-col left" />
                    <th className="m-th" style={{ width: 30 }}>#</th>
                    <th className="m-th" style={{ width: 180 }}>Metadata</th>
                    <th className="m-th" style={{ width: 100 }}>Tag</th>
                    <th className="m-th" style={{ width: 350 }}>CSS</th>
                    <th className="m-th" style={{ width: 350 }}>XPath</th>
                    <th className="m-th" style={{ width: 100 }}>Event Type</th>
                    <th className="m-th" style={{ width: 30 }} />
                    <th className="space sticky-col right" />
                  </tr>
                </thead>
                <tbody className="m-tbody">
                  {selectors.map((selector, index) => (
                    <tr
                      className="m-tr"
                      key={selector.id ?? index}
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
                      <td className="m-td text-align-center">{selector.tag}</td>
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
                      <td className="m-td text-align-center">{selector.eventType}</td>
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
                      {Object.keys(outputs[0]).map((key) => (
                        <th className="m-th" key={key}>{key}</th>
                      ))}
                      <th className="space sticky-col right" />
                    </tr>
                  </thead>
                  <tbody className="m-tbody">
                    {outputs.map((output, index) => (
                      <tr className="m-tr" key={index}>
                        <td className="space static-col left" />
                        <td className="m-td text-align-center">{index + 1}</td>
                        {Object.entries(output).map(([key, value]) => (
                          <td className="m-td text-overflow-hidden" key={key} style={{ maxWidth: 250 }}>
                            {String(value ?? "")}
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
              className="m-btn-footer btn-size-default mg-r-6"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
          <div className="flex-grow" />
          <div className="right-group-btn flex">
            <button
              className="add-btn m-btn m-btn-primary"
              disabled={saving}
              onClick={saveCrawler}
            >
              {saving ? "Saving..." : "Save Crawler"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
