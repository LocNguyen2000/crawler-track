import { useEffect, useRef, useState } from "react";

export function BaseInput({
  value = "",
  onChange,
  placeholder = "",
  disabled = false,
  iconName,
  className = "",
  inputRef,
  onKeyDown,
}) {
  const ref = useRef(null);
  const actualRef = inputRef || ref;

  return (
    <div className="m-input-wrapper">
      <input
        ref={actualRef}
        className={`m-input ${iconName ? "pr-2-75" : "pd-r-10"} ${className}`}
        value={value ?? ""}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {iconName && <div className={`m-icon icon--${iconName}`} />}
    </div>
  );
}

export function BaseToolbar({
  onSearch,
  onReload,
  onExport,
  onSettings,
  searchable = true,
}) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => onSearch?.(search), 250);
    return () => window.clearTimeout(timer);
  }, [search, onSearch]);

  return (
    <div className="m-toolbar">
      <div className="flex-grow" />
      {searchable && (
        <BaseInput
          value={search}
          onChange={setSearch}
          placeholder="Search keyword..."
          iconName="search"
        />
      )}
      <div className="toolbar-btn-wrapper">
        <button className="icon-button" title="Reload data" onClick={onReload}>
          <span className="m-icon icon--refresh" />
        </button>
        {onExport && (
          <button
            className="icon-button"
            title="Export data in CSV file"
            onClick={onExport}
          >
            <span className="m-icon icon--excel" />
          </button>
        )}
        {onSettings && (
          <button
            className="icon-button"
            title="Setting"
            onClick={onSettings}
          >
            <span className="m-icon icon--setting-grey" />
          </button>
        )}
      </div>
    </div>
  );
}

export function BaseToast({ type = "", content, onClose }) {
  useEffect(() => {
    if (!content) return undefined;
    const timer = window.setTimeout(onClose, 3500);
    return () => window.clearTimeout(timer);
  }, [content, onClose]);

  if (!content) return null;
  return (
    <div className="m-toast-frame" role="status">
      <div className={`m-toast ${type}`}>
        <div className="m-toast-messenger">
          <div className="toast-img" />
          <div className="toast-text">{content}</div>
        </div>
      </div>
    </div>
  );
}

export function BasePopup({ type, content, onClose, onConfirm, onDecline }) {
  if (!content) return null;
  const question = type === "question";
  const confirm = type === "confirm";

  return (
    <div className="m-shadow-box" role="presentation">
      <section className="m-popup" role="dialog" aria-modal="true">
        <div className="m-popup-body">
          <div className="popup-content flex">
            <div className={`m-icon icon--avatar-48 ${
              type === "alert"
                ? "icon--alert-exclamation"
                : question
                  ? "icon--question-mark"
                  : "icon--confirm-exclamation"
            }`} />
            <div className="m-popup-text">{content}</div>
          </div>
          <div className="popup-line" />
          <div className="m-popup-footer">
            {confirm && (
              <div className="flex space-between">
                <button className="m-btn btn-size-default m-btn-secondary" onClick={onClose}>No</button>
                <button className="m-btn btn-size-default m-btn-primary" onClick={onConfirm}>Yes</button>
              </div>
            )}
            {question && (
              <div className="flex">
                <button className="m-btn btn-size-default m-btn-secondary" onClick={onClose}>Cancel</button>
                <div className="flex-grow" />
                <button className="m-btn btn-size-default m-btn-secondary mr-4" onClick={onDecline}>No</button>
                <button className="m-btn btn-size-default m-btn-primary" onClick={onConfirm}>Yes</button>
              </div>
            )}
            {!confirm && !question && (
              <div className="flex justify-center">
                <button className="m-btn btn-size-default m-btn-primary" onClick={onClose}>Close</button>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
