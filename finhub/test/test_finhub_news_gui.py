import json
import logging
import random
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional

from PyQt6.QtCore import QDate, QObject, Qt, QThread, QUrl, pyqtSignal
from PyQt6.QtGui import QDesktopServices
from PyQt6.QtWidgets import (
    QApplication,
    QCheckBox,
    QComboBox,
    QDateEdit,
    QFormLayout,
    QHBoxLayout,
    QLabel,
    QLineEdit,
    QMainWindow,
    QMessageBox,
    QPushButton,
    QSpinBox,
    QSplitter,
    QTableWidget,
    QTableWidgetItem,
    QTextEdit,
    QVBoxLayout,
    QWidget,
)


FINNHUB_BASE_URL = "https://finnhub.io/api/v1"
DEFAULT_API_KEY_PATH = Path(__file__).resolve().parents[1] / "finhub_api_key" / "finhub_api_key"


def _setup_logger(log_path: Path) -> logging.Logger:
    logger = logging.getLogger("finhub_news_gui")
    logger.setLevel(logging.INFO)
    if logger.handlers:
        return logger

    log_path.parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.FileHandler(log_path, encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s | %(levelname)s | %(message)s")
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    return logger


def _read_api_key(api_key_path: Path) -> str:
    if not api_key_path.exists():
        raise FileNotFoundError(f"API key file not found: {api_key_path}")
    api_key = api_key_path.read_text(encoding="utf-8").strip()
    if not api_key:
        raise ValueError(f"API key file is empty: {api_key_path}")
    return api_key


def _build_url(path: str, params: Dict[str, str]) -> str:
    return f"{FINNHUB_BASE_URL}{path}?{urllib.parse.urlencode(params)}"


@dataclass(frozen=True)
class NewsItem:
    datetime_unix: int
    headline: str
    source: str
    summary: str
    url: str
    related: str

    @property
    def dt_local(self) -> datetime:
        return datetime.fromtimestamp(self.datetime_unix)


def _fetch_json_with_retries(
    *,
    url: str,
    timeout_sec: int,
    max_retries: int,
    stop_event: threading.Event,
) -> Any:
    """Fetch JSON with transient retries (429/5xx/network).

    IMPORTANT: `url` may include secrets (token) so do not log it.
    """

    last_exc: Optional[BaseException] = None
    for attempt in range(1, max_retries + 1):
        if stop_event.is_set():
            raise RuntimeError("Stopped")

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "finhub-news-gui"})
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                status = getattr(resp, "status", 200)
                body = resp.read().decode("utf-8")

            if status >= 400:
                raise urllib.error.HTTPError(url, status, f"HTTP {status}", hdrs=None, fp=None)

            return json.loads(body)

        except urllib.error.HTTPError as e:
            last_exc = e
            # Fail fast on auth / bad request
            if e.code in (400, 401, 403):
                raise

            # Retry on rate limit / server errors
            if e.code in (429, 500, 502, 503, 504):
                pass
            else:
                raise

        except (urllib.error.URLError, TimeoutError) as e:
            last_exc = e

        # Backoff with jitter
        delay = min(8.0, 0.25 * (2 ** (attempt - 1)))
        delay = delay * (0.75 + 0.5 * random.random())
        time.sleep(delay)

    if last_exc is not None:
        raise last_exc
    raise RuntimeError("Request failed")


def _safe_error_message(exc: BaseException) -> str:
    """Return a user/log safe error message that never includes request URLs/tokens."""
    if isinstance(exc, urllib.error.HTTPError):
        if exc.code == 429:
            return "HTTP 429: Rate limit (too many requests)"
        return f"HTTP {exc.code}: {exc.reason}"
    if isinstance(exc, urllib.error.URLError):
        return f"Network error: {getattr(exc, 'reason', exc)}"
    if isinstance(exc, TimeoutError):
        return "Timeout error"
    return f"{type(exc).__name__}: {exc}"


def _normalize_news_items(raw: Any) -> List[NewsItem]:
    items: List[NewsItem] = []
    if not isinstance(raw, list):
        return items

    for obj in raw:
        if not isinstance(obj, dict):
            continue
        try:
            items.append(
                NewsItem(
                    datetime_unix=int(obj.get("datetime") or 0),
                    headline=str(obj.get("headline") or ""),
                    source=str(obj.get("source") or ""),
                    summary=str(obj.get("summary") or ""),
                    url=str(obj.get("url") or ""),
                    related=str(obj.get("related") or ""),
                )
            )
        except Exception:
            continue

    # Sort newest first
    items.sort(key=lambda x: x.datetime_unix, reverse=True)
    return items


def _filter_items(items: List[NewsItem], keyword: str) -> List[NewsItem]:
    keyword = (keyword or "").strip().lower()
    if not keyword:
        return items

    filtered: List[NewsItem] = []
    for it in items:
        hay = " ".join([it.headline, it.summary, it.source, it.related]).lower()
        if keyword in hay:
            filtered.append(it)
    return filtered


class FetchWorker(QObject):
    status = pyqtSignal(str)
    error = pyqtSignal(str)
    finished = pyqtSignal(list)

    def __init__(
        self,
        *,
        api_key_path: Path,
        symbol: str,
        category: str,
        date_from: date,
        date_to: date,
        include_company_news: bool,
        include_category_news: bool,
        keyword: str,
        max_items: int,
        timeout_sec: int = 20,
        max_retries: int = 10,
    ) -> None:
        super().__init__()
        self._api_key_path = api_key_path
        self._symbol = symbol.strip().upper()
        self._category = category.strip()
        self._date_from = date_from
        self._date_to = date_to
        self._include_company_news = include_company_news
        self._include_category_news = include_category_news
        self._keyword = keyword
        self._max_items = max_items
        self._timeout_sec = timeout_sec
        self._max_retries = max_retries
        self._stop_event = threading.Event()

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:
        try:
            if not self._include_company_news and not self._include_category_news:
                self.finished.emit([])
                return

            api_key = _read_api_key(self._api_key_path)

            all_items: List[NewsItem] = []

            if self._include_company_news:
                if not self._symbol:
                    raise ValueError("Symbol is required for Company News")

                self.status.emit(f"Fetching company news: {self._symbol}")
                params = {
                    "symbol": self._symbol,
                    "from": self._date_from.isoformat(),
                    "to": self._date_to.isoformat(),
                    "token": api_key,
                }
                url = _build_url("/company-news", params)
                raw = _fetch_json_with_retries(
                    url=url,
                    timeout_sec=self._timeout_sec,
                    max_retries=self._max_retries,
                    stop_event=self._stop_event,
                )
                all_items.extend(_normalize_news_items(raw))

            if self._include_category_news:
                self.status.emit(f"Fetching category news: {self._category}")
                params = {
                    "category": self._category,
                    "token": api_key,
                }
                url = _build_url("/news", params)
                raw = _fetch_json_with_retries(
                    url=url,
                    timeout_sec=self._timeout_sec,
                    max_retries=self._max_retries,
                    stop_event=self._stop_event,
                )
                all_items.extend(_normalize_news_items(raw))

            # De-dupe by URL
            seen: set[str] = set()
            deduped: List[NewsItem] = []
            for it in sorted(all_items, key=lambda x: x.datetime_unix, reverse=True):
                if not it.url or it.url in seen:
                    continue
                seen.add(it.url)
                deduped.append(it)

            filtered = _filter_items(deduped, self._keyword)
            if self._max_items > 0:
                filtered = filtered[: self._max_items]

            self.finished.emit(filtered)

        except Exception as e:
            if str(e) == "Stopped":
                self.error.emit("Stopped")
                return
            # IMPORTANT: never include URL/token in UI/log output.
            self.error.emit(_safe_error_message(e))


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()

        self.setWindowTitle("Finnhub News Search")
        self.resize(1200, 800)

        self._log_path = Path(__file__).with_name(f"{Path(__file__).stem}_gui.log")
        self._logger = _setup_logger(self._log_path)

        self._thread: Optional[QThread] = None
        self._worker: Optional[FetchWorker] = None

        root = QWidget()
        layout = QVBoxLayout(root)

        # Controls
        controls = QWidget()
        form = QFormLayout(controls)

        self.api_key_path_edit = QLineEdit(str(DEFAULT_API_KEY_PATH))
        self.api_key_path_edit.setPlaceholderText("Path to finhub api key file")

        self.symbol_edit = QLineEdit("")
        self.symbol_edit.setPlaceholderText("e.g., AAPL")

        self.keyword_edit = QLineEdit("")
        self.keyword_edit.setPlaceholderText("Filter keyword (client-side)")

        self.category_combo = QComboBox()
        self.category_combo.addItems(["general", "forex", "crypto", "merger"])

        today = date.today()
        default_from = today - timedelta(days=7)

        self.from_date = QDateEdit()
        self.from_date.setCalendarPopup(True)
        self.from_date.setDate(QDate(default_from.year, default_from.month, default_from.day))

        self.to_date = QDateEdit()
        self.to_date.setCalendarPopup(True)
        self.to_date.setDate(QDate(today.year, today.month, today.day))

        self.include_company = QCheckBox("Company News")
        self.include_company.setChecked(True)

        self.include_category = QCheckBox("Category News")
        self.include_category.setChecked(False)

        self.max_items = QSpinBox()
        self.max_items.setRange(1, 500)
        self.max_items.setValue(100)

        self.search_btn = QPushButton("Search")
        self.stop_btn = QPushButton("Stop")
        self.stop_btn.setEnabled(False)

        buttons_row = QWidget()
        buttons_layout = QHBoxLayout(buttons_row)
        buttons_layout.setContentsMargins(0, 0, 0, 0)
        buttons_layout.addWidget(self.search_btn)
        buttons_layout.addWidget(self.stop_btn)

        form.addRow("API key path", self.api_key_path_edit)
        form.addRow("Symbol", self.symbol_edit)
        form.addRow("Keyword", self.keyword_edit)
        form.addRow("Category", self.category_combo)
        form.addRow("From", self.from_date)
        form.addRow("To", self.to_date)

        source_row = QWidget()
        source_layout = QHBoxLayout(source_row)
        source_layout.setContentsMargins(0, 0, 0, 0)
        source_layout.addWidget(self.include_company)
        source_layout.addWidget(self.include_category)
        source_layout.addStretch(1)
        form.addRow("Sources", source_row)

        form.addRow("Max items", self.max_items)
        form.addRow("", buttons_row)

        layout.addWidget(controls)

        # Results + details + log
        splitter = QSplitter(Qt.Orientation.Vertical)

        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Datetime", "Source", "Related", "Headline"])
        self.table.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.table.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.table.setWordWrap(False)
        self.table.horizontalHeader().setStretchLastSection(True)

        bottom_split = QSplitter(Qt.Orientation.Horizontal)

        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)

        self.detail = QTextEdit()
        self.detail.setReadOnly(True)
        self.detail.setPlaceholderText("Select a row to see details")

        self.open_link_btn = QPushButton("Open Link")
        self.open_link_btn.setEnabled(False)

        right_layout.addWidget(QLabel("Details"))
        right_layout.addWidget(self.detail)
        right_layout.addWidget(self.open_link_btn)

        self.log_view = QTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setPlaceholderText("Activity log")

        bottom_split.addWidget(right_panel)
        bottom_split.addWidget(self.log_view)
        bottom_split.setStretchFactor(0, 2)
        bottom_split.setStretchFactor(1, 1)

        splitter.addWidget(self.table)
        splitter.addWidget(bottom_split)
        splitter.setStretchFactor(0, 2)
        splitter.setStretchFactor(1, 1)

        layout.addWidget(splitter)

        self.setCentralWidget(root)

        self._current_items: List[NewsItem] = []
        self._current_url: Optional[str] = None

        # Wiring
        self.search_btn.clicked.connect(self._on_search)
        self.stop_btn.clicked.connect(self._on_stop)
        self.table.itemSelectionChanged.connect(self._on_row_selected)
        self.open_link_btn.clicked.connect(self._on_open_link)

        self._append_log(f"Log file: {self._log_path}")
        self._logger.info("GUI started")

    def closeEvent(self, event) -> None:  # type: ignore[override]
        try:
            self._on_stop()
        finally:
            self._logger.info("GUI closed")
            super().closeEvent(event)

    def _append_log(self, msg: str) -> None:
        ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.log_view.append(f"{ts} | {msg}")

    def _set_busy(self, busy: bool) -> None:
        self.search_btn.setEnabled(not busy)
        self.stop_btn.setEnabled(busy)
        self.api_key_path_edit.setEnabled(not busy)
        self.symbol_edit.setEnabled(not busy)
        self.keyword_edit.setEnabled(not busy)
        self.category_combo.setEnabled(not busy)
        self.from_date.setEnabled(not busy)
        self.to_date.setEnabled(not busy)
        self.include_company.setEnabled(not busy)
        self.include_category.setEnabled(not busy)
        self.max_items.setEnabled(not busy)

    def _on_search(self) -> None:
        if self._thread is not None:
            return

        api_key_path = Path(self.api_key_path_edit.text().strip())
        symbol = self.symbol_edit.text().strip()
        keyword = self.keyword_edit.text().strip()
        category = self.category_combo.currentText()

        qfrom = self.from_date.date()
        qto = self.to_date.date()
        date_from = date(qfrom.year(), qfrom.month(), qfrom.day())
        date_to = date(qto.year(), qto.month(), qto.day())
        if date_to < date_from:
            QMessageBox.warning(self, "Invalid Dates", "`To` date must be >= `From` date")
            return

        include_company_news = self.include_company.isChecked()
        include_category_news = self.include_category.isChecked()

        max_items = int(self.max_items.value())

        self._append_log("Search clicked")
        self._logger.info(
            "Search clicked | include_company=%s include_category=%s symbol=%s category=%s from=%s to=%s max_items=%s keyword_len=%s",
            include_company_news,
            include_category_news,
            symbol,
            category,
            date_from.isoformat(),
            date_to.isoformat(),
            max_items,
            len(keyword),
        )

        self._set_busy(True)
        self._current_items = []
        self._current_url = None
        self.open_link_btn.setEnabled(False)
        self.detail.clear()
        self.table.setRowCount(0)

        self._thread = QThread()
        self._worker = FetchWorker(
            api_key_path=api_key_path,
            symbol=symbol,
            category=category,
            date_from=date_from,
            date_to=date_to,
            include_company_news=include_company_news,
            include_category_news=include_category_news,
            keyword=keyword,
            max_items=max_items,
        )
        self._worker.moveToThread(self._thread)

        self._thread.started.connect(self._worker.run)
        self._worker.status.connect(self._on_status)
        self._worker.error.connect(self._on_error)
        self._worker.finished.connect(self._on_finished)

        self._worker.finished.connect(self._thread.quit)
        self._worker.error.connect(self._thread.quit)
        self._thread.finished.connect(self._cleanup_thread)

        self._thread.start()

    def _on_stop(self) -> None:
        if self._worker is not None:
            self._append_log("Stop requested")
            self._logger.info("Stop requested")
            self._worker.stop()

    def _cleanup_thread(self) -> None:
        self._set_busy(False)
        if self._thread is not None:
            self._thread.deleteLater()
        self._thread = None
        self._worker = None

    def _on_status(self, msg: str) -> None:
        self._append_log(msg)
        self._logger.info(msg)

    def _on_error(self, msg: str) -> None:
        # Do not show API key in UI; msg should not contain it.
        if msg == "Stopped":
            self._append_log("Stopped")
            self._logger.info("Stopped")
            return

        self._append_log(f"ERROR: {msg}")
        self._logger.error("Request failed: %s", msg)
        QMessageBox.critical(self, "Error", msg)

    def _on_finished(self, items: list) -> None:
        self._current_items = list(items)
        self._append_log(f"Done: {len(self._current_items)} items")
        self._logger.info("Done: %s items", len(self._current_items))

        self.table.setRowCount(len(self._current_items))
        for row, it in enumerate(self._current_items):
            dt_item = QTableWidgetItem(it.dt_local.strftime("%Y-%m-%d %H:%M"))
            source_item = QTableWidgetItem(it.source)
            related_item = QTableWidgetItem(it.related)
            headline_item = QTableWidgetItem(it.headline)

            dt_item.setData(Qt.ItemDataRole.UserRole, it.url)

            self.table.setItem(row, 0, dt_item)
            self.table.setItem(row, 1, source_item)
            self.table.setItem(row, 2, related_item)
            self.table.setItem(row, 3, headline_item)

        self.table.resizeColumnsToContents()

    def _on_row_selected(self) -> None:
        selected = self.table.selectedItems()
        if not selected:
            self.open_link_btn.setEnabled(False)
            self._current_url = None
            return

        row = selected[0].row()
        if row < 0 or row >= len(self._current_items):
            return

        it = self._current_items[row]
        self._current_url = it.url
        self.open_link_btn.setEnabled(bool(self._current_url))

        self.detail.setPlainText(
            "\n".join(
                [
                    f"Datetime: {it.dt_local.isoformat(sep=' ', timespec='minutes')}",
                    f"Source: {it.source}",
                    f"Related: {it.related}",
                    f"Headline: {it.headline}",
                    "",
                    it.summary,
                    "",
                    f"URL: {it.url}",
                ]
            )
        )

    def _on_open_link(self) -> None:
        if not self._current_url:
            return
        QDesktopServices.openUrl(QUrl(self._current_url))


def main() -> None:
    app = QApplication([])
    win = MainWindow()
    win.show()
    app.exec()


if __name__ == "__main__":
    main()
