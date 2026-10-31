import { useState } from "react";
import ENUM from "../../js/resources/resourceEnum";
import { isNumber } from "../../js/utils";
import { BaseInput, BaseToast, BaseToolbar } from "../../components/Shared.jsx";

function downloadCsv(filename, contents) {
  const blob = new Blob(["\uFEFF", contents], {
    type: "text/csv;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export default function UrlGenerator() {
  const [seedUrl, setSeedUrl] = useState("");
  const [pageParam, setPageParam] = useState("");
  const [startPage, setStartPage] = useState("");
  const [endPage, setEndPage] = useState("");
  const [urls, setUrls] = useState([]);
  const [toast, setToast] = useState(null);

  const generateUrl = () => {
    if (!isNumber(startPage) || !isNumber(endPage)) {
      setToast({
        type: ENUM.toastEnum.error,
        content: "Starting page or ending page must be a Number.",
      });
      return;
    }
    const generated = [];
    for (let page = Number.parseInt(startPage, 10); page <= Number.parseInt(endPage, 10); page += 1) {
      generated.push(`${seedUrl}${pageParam}`.replace("{number}", page));
    }
    setUrls(generated);
  };

  const exportData = () => {
    if (!urls.length) {
      setToast({
        type: ENUM.toastEnum.error,
        content: "No URL(s) exist to export.",
      });
      return;
    }
    downloadCsv("url.csv", `url\n${urls.join("\n")}\n`);
  };

  return (
    <div className="m-view-container url-generator">
      <div className="m-title sticky" style={{ left: 0 }}>
        <div className="m-row">
          <div className="title-text">URL Generator</div>
        </div>
        <div className="m-row">
          <div className="back">Generate Paginated URL(s) - Export URL(s) in CSV file</div>
        </div>
      </div>
      <div className="view-content">
        <div className="m-row">
          <div className="w-40 mr-4">
            <div className="m-label">Seed URL</div>
            <BaseInput
              value={seedUrl}
              onChange={setSeedUrl}
              placeholder="https://quotes.toscrape.com/"
            />
          </div>
          <div className="w-10 mr-4">
            <div className="m-label">Page Parameter</div>
            <BaseInput
              value={pageParam}
              onChange={setPageParam}
              placeholder="page/{number}"
            />
          </div>
          <div className="w-10 mr-4">
            <div className="m-label">Start Page</div>
            <BaseInput value={startPage} onChange={setStartPage} placeholder="1" />
          </div>
          <div className="w-10">
            <div className="m-label">End Page</div>
            <BaseInput value={endPage} onChange={setEndPage} placeholder="10" />
          </div>
        </div>
      </div>
      <BaseToolbar onExport={exportData} searchable={false} />
      <div className="grid-table">
        <table className="m-table">
          <thead className="m-thead">
            <tr className="m-tr">
              <th className="space sticky-col left" />
              <th className="m-th" style={{ width: 40 }}>#</th>
              <th className="m-th">URL(s)</th>
              <th className="space sticky-col right" />
            </tr>
          </thead>
          <tbody className="m-tbody">
            {urls.length ? (
              urls.map((url, index) => (
                <tr className="m-tr" key={`${url}-${index}`}>
                  <td className="space static-col left" />
                  <td className="m-td text-align-center">{index + 1}</td>
                  <td className="m-td">{url}</td>
                  <td className="space static-col right" />
                </tr>
              ))
            ) : (
              <tr className="m-tr">
                <td className="space static-col left" />
                <td className="m-td" />
                <td className="m-td" />
                <td className="space static-col right" />
              </tr>
            )}
          </tbody>
        </table>
        <div className="w-full bg-white" style={{ height: 10 }} />
      </div>
      <div className="m-dialog-footer url-generator-footer">
        <div className="flex-grow" />
        <div className="right-group-btn flex">
          <button
            className="m-btn m-btn-primary btn-size-default"
            onClick={generateUrl}
          >
            Generate URL
          </button>
        </div>
      </div>
      <BaseToast
        type={toast?.type}
        content={toast?.content}
        onClose={() => setToast(null)}
      />
    </div>
  );
}
