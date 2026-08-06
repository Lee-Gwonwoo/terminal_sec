import { sweepFinnhubIpoCalendar } from "./src/services/finnhubIpoCalendarProvider.js";
import sqlite3 from "sqlite3"; import { open } from "sqlite";
const prod = await open({ filename: "c:/github_coding/terminal_sec/terminal/backend/backend/data/app.db", driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY });
const missing = await prod.all<Array<{ticker:string; ipo_date:string|null}>>(`
  SELECT s.ticker, MAX(cp.ipo_date) ipo_date
  FROM ticker_universe_items ui JOIN securities s ON s.id=ui.security_id
  LEFT JOIN company_profiles cp ON cp.security_id=s.id
  WHERE ui.universe_id=1 GROUP BY s.ticker
  HAVING MAX(CASE WHEN cp.ipo_offer_price IS NOT NULL THEN 1 ELSE 0 END)=0`);
await prod.close();
const t0=Date.now();
const sweep = await sweepFinnhubIpoCalendar({ from: "2010-01-01", to: new Date().toISOString().slice(0,10), options:{ requestIntervalMs: 120 } });
console.log(`스윕 ${((Date.now()-t0)/1000).toFixed(1)}초: ${sweep.chunks}청크, 전체 ${sweep.totalRows}건 → 고유 티커 ${sweep.byTicker.size}, 실패 ${sweep.failedChunks.length}`);
let hit=0,priced=0,range=0;
for (const m of missing) {
  const d = sweep.byTicker.get(m.ticker.toUpperCase());
  if (!d || (d.offerPrice==null && !d.priceRange)) continue;
  hit++; if (d.offerPrice!=null) priced++; else range++;
}
console.log(`공모가 미보유 유니버스 ${missing.length}건 중 매칭 ${hit}건 (확정가 ${priced} / 범위만 ${range})`);
