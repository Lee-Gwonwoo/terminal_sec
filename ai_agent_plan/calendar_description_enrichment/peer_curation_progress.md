# 전체 Description + Peer Curation 진행 현황

## 목적

default universe 2,278개 ticker를 industry 우선순위대로 보면서, 각 회사의 실제 제품/고객/수요 driver/value-chain을 설명하는 enhanced description과 A/B/C/EXCLUDE peer graph를 같은 batch에서 함께 정리한다. provider raw description과 raw peers는 보존하되, Calendar/hover에서 보는 강화 layer는 사람이 검토 가능한 curated layer로 관리한다.

## 전체 기준

### Description 기준

각 ticker의 seed entry는 가능한 한 아래 항목을 함께 작성한다.

| 항목 | 의미 |
|------|------|
| shortDescription | Calendar/hover에서 빠르게 읽을 수 있는 1문장 사업 설명 |
| enhancedDescription | 제품, 고객, 매출 driver, AI/tech/industry 관련성을 포함한 상세 설명 |
| products | 실제 판매 제품/서비스 |
| revenueModel | 돈을 버는 방식과 주요 매출 축 |
| keyMetrics | 실적에서 확인할 지표 |
| watchPoints | 다음 실적/뉴스에서 볼 포인트 |
| risks | 투자/사업 리스크 |

### Peer 기준

| 등급 | 의미 | 표시/사용 |
|------|------|-----------|
| A | 핵심 peer 또는 강한 platform overlap | 관련주 핵심 묶음, 비교 우선 |
| B | 인접 경쟁, 공급망, read-through, 같은 capex cycle | 보조 관련주 / thematic basket |
| C | provider 후보 또는 약한 테마 후보 | 접힘/감사용 후보 |
| EXCLUDE | self, 공식 industry false positive, 명백한 비관련 후보 | 화면 기본 관련주에서 제외 |

## 진행 요약

| Batch | 범위 | Ticker 수 | 상태 | 검증 요약 |
|-------|------|-----------|------|-----------|
| 001 | Optical / photonics / AI data-center interconnect | 14 | 확인 대기 | LWLG official chemicals false positive 제거, photonics A/B peer 생성, backend/frontend build와 backend tests/API 검증 완료 |
| 002 | AI semiconductor / accelerator / memory / connectivity | 23 | 확인 대기 | NVDA/AMD accelerator, AVGO/MRVL/CRDO/ALAB connectivity/custom silicon, MU/RMBS memory, TXN/ADI analog, AMAT/LRCX/KLAC/TER semicap 분리 완료. backend/frontend build와 backend tests/API 검증 완료 |
| 003 | AI server / power / cooling / EMS | 11 | 확인 대기 | DELL/SMCI/HPE server OEM, CLS/JBL/FLEX EMS/ODM, VRT/ETN/TT/NVT/HUBB power/cooling physical infra 분리 완료. backend/frontend build와 backend tests/API 검증 완료 |
| 004 | Software/data/AI platforms | 16 | 확인 대기 | MSFT/ORCL cloud platform, PLTR/SNOW/MDB data/AI platform, PANW/CRWD/FTNT/ZS security, DDOG observability, NET/AKAM edge/CDN, CRWV GPU cloud, CRM/NOW/ADBE enterprise app/creative software 분리 완료. backend/frontend build와 backend tests/API 검증 완료 |
| 005 | Space / defense / satellite / dual-use tech | 미정 | 미착수 | RKLB/RDW/ASTS/SATS/VSAT/LDOS/CACI/SAIC 등 분리 예정 |
| 006+ | Healthcare, industrials, materials, energy, utilities, financials, consumer | 미정 | 미착수 | sector별 batch로 이어서 진행 |

## Batch 001 — Optical / Photonics / AI Data-Center Interconnect

### 처리 ticker

`LWLG`, `POET`, `COHR`, `LITE`, `AAOI`, `CIEN`, `FN`, `MTSI`, `IPGP`, `GLW`, `MRVL`, `CRDO`, `AVGO`, `ANET`

### 핵심 결정

- `LWLG`는 공식 분류가 `Basic Materials / Chemicals - Specialty`이지만, peer 축은 `electro-optic polymer`, `photonic modulator`, `optical interconnect`, `AI data-center bandwidth`로 본다.
- `LWLG -> COHR/LITE/AAOI/POET`는 A 등급이지만 `direct_competitor`가 아니라 `platform_overlap`으로 둔다.
- `LWLG -> CIEN/FN/MRVL/CRDO/GLW/MTSI`는 B 등급 `infrastructure_read_through`로 둔다.
- `LWLG -> KWR/MTX/NGVT/WDFC/IOSP/AVNT/FUL/OLN/ECVT/HWKN`는 `Chemicals - Specialty` false positive로 EXCLUDE 처리한다.
- `industry_override_needed` tag가 있는 ticker는 자동 same-industry / same-sector peer 생성을 건너뛴다.
- `COHR/LITE/AAOI`끼리는 mature optical component/transceiver direct peer로 두고, `LWLG/POET`와는 platform overlap으로 구분한다.

### 검증 쿼리

```powershell
Set-Location "c:\github_coding\terminal_sec"
@'
import sqlite3, json
con = sqlite3.connect(r"terminal/backend/backend/data/app.db")
con.row_factory = sqlite3.Row
for row in con.execute("""
select related_ticker, grade, relation_type, score, reason
from company_peer_edges
where source_ticker='LWLG' and grade!='EXCLUDE'
order by case grade when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end, score desc, related_ticker
"""):
    print(json.dumps(dict(row), ensure_ascii=False))
'@ | python -
```

### 현재 LWLG 기대 결과

| 등급 | 관계 | Tickers |
|------|------|---------|
| A | platform_overlap | AAOI, COHR, LITE, POET |
| B | infrastructure_read_through | CIEN, CRDO, FN, GLW, MRVL, MTSI |
| C | weak_provider_candidate | AIRG, AMPG, APH, BDC, BELFA, CPSH, KN, MPTI |
| EXCLUDE | official industry false positive / self | AVNT, ECVT, FUL, HWKN, IOSP, KWR, LWLG, MTX, NGVT, OLN |

## Batch 002 — AI Semiconductor / Accelerator / Memory / Connectivity

### 처리 ticker

`NVDA`, `AMD`, `AVGO`, `MRVL`, `MU`, `INTC`, `QCOM`, `TXN`, `ADI`, `MPWR`, `NXPI`, `LRCX`, `AMAT`, `KLAC`, `TER`, `ON`, `MCHP`, `GFS`, `ALAB`, `RMBS`, `CRDO`, `LSCC`, `MTSI`

### 핵심 결정

- `NVDA`의 A peer는 merchant AI accelerator 직접 경쟁인 `AMD`로 제한하고, `AVGO/MRVL`은 custom AI/network silicon B `platform_overlap`으로 낮췄다.
- `AVGO/MRVL/CRDO/ALAB/MTSI/RMBS`는 AI cluster connectivity, custom silicon, SerDes, PCIe/CXL, optical/electrical interconnect 축으로 묶는다.
- `MU/RMBS`는 memory/HBM/interface 축으로 보고, `NVDA/AMD`는 memory 수요 read-through로 둔다.
- `TXN/ADI/MPWR/NXPI/MCHP/ON`은 analog/embedded/auto/power semiconductor group으로 분리하고, AI accelerator와는 weak/provider 후보 이상으로 올리지 않는다.
- `LRCX/AMAT/KLAC/TER`는 semiconductor equipment/test group으로 분리하고, accelerator vendor와는 C `theme_overlap` 또는 weak evidence로만 둔다.
- `INTC/GFS`는 CPU/foundry/manufacturing 축으로 분리했다. `TSM`, `ASML`, `Samsung Memory`처럼 default universe에 없거나 이번 default query에 없는 직접 비교 대상은 `companies` evidence로만 남겼다.
- `full_peer_curation_batch_002` tag가 있는 ticker는 curated peer group을 source of truth로 보고, 자동 same-industry/same-sector peer 생성은 건너뛴다.
- 같은 tag가 있는 ticker의 provider raw peers는 숨기지 않고 C `weak_provider_candidate`로 낮춰, 셀 확장 시 감사용 후보로 볼 수 있게 했다.
- reciprocal direct peer generator가 Batch 002 source에 외부 A edge를 강제로 주입하지 않도록 막아, 예를 들어 `ANET -> AVGO` old A가 `AVGO -> ANET` A로 역주입되지 않게 했다.

### 검증 쿼리

```powershell
Set-Location "c:\github_coding\terminal_sec"
@'
import sqlite3, json
con=sqlite3.connect(r"terminal/backend/backend/data/app.db")
con.row_factory=sqlite3.Row
for ticker in ['NVDA','AMD','AVGO','CRDO','MU','TXN','LRCX','ALAB']:
    print('\n##', ticker)
    rows=con.execute("""
    select related_ticker, grade, relation_type, score, reason
    from company_peer_edges
    where source_ticker=? and grade!='EXCLUDE'
    order by case grade when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end, score desc, related_ticker
    limit 12
    """, (ticker,)).fetchall()
    for row in rows:
        print(json.dumps(dict(row), ensure_ascii=False))
'@ | python -
```

### 현재 대표 기대 결과

| Ticker | A 핵심 | B 보조/read-through | C/weak 처리 |
|--------|--------|---------------------|-------------|
| NVDA | AMD | AVGO, MRVL, MU, RMBS | AMAT, KLAC, LRCX, TER 및 provider raw semis 후보 |
| AMD | NVDA, INTC, QCOM | AVGO, MRVL | broad provider semis 후보 |
| AVGO | ALAB, CRDO, MRVL | AMD, NVDA | broad analog/memory/CPU 후보 |
| CRDO | ALAB, AVGO, MRVL, MTSI, RMBS | AMD, DELL, NVDA, SMCI, AAOI, CIEN | provider raw 후보 |
| MU | RMBS | AMD, NVDA, STX, WDC | broad semiconductor 후보 |
| TXN | ADI, MCHP, MPWR, NXPI, ON | 없음 | broad AI/semis provider 후보 |
| LRCX | AMAT, KLAC, TER | MU | ACMR, AMKR, ENTG, FORM, MKSI, ONTO 등 provider 후보 |
| ALAB | AVGO, CRDO, MRVL, MTSI, RMBS | AMD, DELL, NVDA, SMCI | broad semiconductor 후보 |

### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `seedCompanyProfileEnrichment.ts`, `seedCompanyPeerEdges.ts`, `companyProfileEnrichmentRepository.ts` 오류 0개 |
| 데이터 seed | ✅ | `npm.cmd run seed:company-enrichment -- --force --tickers=...` 성공, Batch 002 23개 ticker force refresh |
| peer graph 재생성 | ✅ | `npm.cmd run seed:company-peers`: 28,025 edges, visible coverage 2,276/2,278, grade counts `A=855`, `B=20,656`, `C=4,977`, `EXCLUDE=1,537` |
| DB spot check | ✅ | NVDA/AMD/AVGO/CRDO/MU/TXN/LRCX/ALAB 대표 peer rank 확인 |
| 런타임 API | ✅ | `GET /api/company-profiles/NVDA`, `GET /api/company-profiles/TXN`, `GET /api/company-profiles/ALAB` 응답에서 refreshed `curated_peers` 확인 |
| backend build | ✅ | `terminal/backend`에서 `npm.cmd run build` 성공 |
| backend tests | ✅ | `terminal/backend`에서 `npm.cmd run test`: 17 files / 104 tests passed |
| frontend build | ✅ | `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm.cmd run build` 성공 |

### 남은 확인

- 사용자가 Calendar Window에서 Batch 002 ticker들의 `Curated Peers` 접힘/펼침 표시를 직접 확인하면 `사용자 확인 후 완료`로 갱신한다.
- 다음 batch로는 AI server / power / cooling / EMS value-chain을 진행한다.

## Batch 003 — AI Server / Power / Cooling / EMS

### 처리 ticker

`DELL`, `SMCI`, `HPE`, `VRT`, `CLS`, `JBL`, `FLEX`, `ETN`, `TT`, `NVT`, `HUBB`

### 핵심 결정

- `DELL/SMCI/HPE`는 branded AI server OEM/system peer로 보고 A `direct_competitor`로 묶는다.
- `CLS/JBL/FLEX`는 EMS/ODM 및 hardware manufacturing value-chain group으로 분리하고 서로 A `direct_competitor`로 둔다.
- `DELL/SMCI/HPE -> CLS/JBL/FLEX`는 direct peer가 아니라 B `customer_supplier`로 둔다.
- `VRT/ETN/NVT/HUBB`는 electrical/power/enclosure/data-center physical infrastructure group으로 묶고, `TT`는 HVAC/thermal/cooling 축으로 `VRT`와 가장 가깝게 둔다.
- `DELL/SMCI/HPE -> VRT/ETN/TT/NVT/HUBB`는 서버 판매의 수요 read-through이므로 B `infrastructure_read_through`로 둔다.
- `TT`는 공식 industry가 `Construction`이지만, Batch 003에서는 data-center cooling/thermal management exposure만 반영한다. 서버 OEM이나 electrical supplier와 직접 peer로 섞지 않는다.
- `full_peer_curation_batch_003` tag가 있는 ticker는 curated peer group을 source of truth로 보고, 자동 same-industry/same-sector peer 생성은 건너뛴다.
- 같은 tag가 있는 ticker의 provider raw peers는 C `weak_provider_candidate`로 낮춰, 셀 확장 시 감사용 후보로 남긴다.

### 검증 쿼리

```powershell
Set-Location "c:\github_coding\terminal_sec"
@'
import sqlite3, json
con=sqlite3.connect(r"terminal/backend/backend/data/app.db")
con.row_factory=sqlite3.Row
for ticker in ['DELL','SMCI','HPE','CLS','JBL','FLEX','VRT','ETN','TT','NVT','HUBB']:
    print('\n##', ticker)
    rows=con.execute("""
    select related_ticker, grade, relation_type, score, reason
    from company_peer_edges
    where source_ticker=? and grade!='EXCLUDE'
    order by case grade when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end, score desc, related_ticker
    limit 14
    """, (ticker,)).fetchall()
    for row in rows:
        print(json.dumps(dict(row), ensure_ascii=False))
'@ | python -
```

### 현재 대표 기대 결과

| Ticker | A 핵심 | B 보조/read-through | C/weak 처리 |
|--------|--------|---------------------|-------------|
| DELL | HPE, SMCI | CLS, FLEX, JBL, AMD, NVDA, ETN, HUBB, NVT, TT, VRT | provider raw computer hardware 후보 |
| SMCI | DELL, HPE | AMD, NVDA, CLS, FLEX, JBL, ETN, HUBB, NVT, TT, VRT | provider raw hardware 후보 |
| HPE | DELL, SMCI | CLS, FLEX, JBL, ANET, CIEN, CSCO, ETN, HUBB, NVT, TT | provider raw communication equipment 후보 |
| CLS | FLEX, JBL | DELL, HPE, SMCI | ETN, HUBB, NVT, VRT 등 data-center infrastructure adjacent |
| JBL | CLS, FLEX | DELL, HPE, SMCI | raw EMS/electronics 후보 |
| FLEX | CLS, JBL | DELL, HPE, SMCI, ETN, HUBB, NVT, VRT | raw EMS/electronics 후보 |
| VRT | ETN, HUBB, NVT, TT | DELL, HPE, SMCI | broad electrical/provider 후보 |
| ETN | HUBB, NVT, VRT | DELL, HPE, SMCI, TT | provider raw electrical/industrial 후보 |
| TT | VRT | ETN, HUBB, NVT, DELL, HPE, SMCI | provider raw construction/HVAC 후보 |
| NVT | ETN, HUBB, VRT | DELL, HPE, SMCI, TT | provider raw electrical 후보 |
| HUBB | ETN, NVT, VRT | DELL, HPE, SMCI, TT | provider raw electrical 후보 |

### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `seedCompanyProfileEnrichment.ts`, `seedCompanyPeerEdges.ts`, `companyProfileEnrichmentRepository.ts` 오류 0개 |
| 데이터 seed | ✅ | `npm.cmd run seed:company-enrichment -- --force --tickers=DELL,SMCI,HPE,VRT,CLS,JBL,FLEX,ETN,TT,NVT,HUBB` 성공 |
| peer graph 재생성 | ✅ | `npm.cmd run seed:company-peers`: 28,004 edges, visible coverage 2,276/2,278, grade counts `A=853`, `B=20,610`, `C=5,004`, `EXCLUDE=1,537` |
| DB spot check | ✅ | DELL/SMCI/HPE/CLS/JBL/FLEX/VRT/ETN/TT/NVT/HUBB 대표 peer rank 확인 |
| 런타임 API | ✅ | `GET /api/company-profiles/DELL`, `GET /api/company-profiles/VRT`, `GET /api/company-profiles/CLS` 응답에서 refreshed `curated_peers` 확인 |
| backend build | ✅ | `terminal/backend`에서 `npm.cmd run build` 성공 |
| backend tests | ✅ | `terminal/backend`에서 `npm.cmd run test`: 17 files / 104 tests passed |
| frontend build | ✅ | `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm.cmd run build` 성공 |

### 남은 확인

- 사용자가 Calendar Window에서 Batch 003 ticker들의 `Curated Peers` 접힘/펼침 표시를 직접 확인하면 `사용자 확인 후 완료`로 갱신한다.
- 다음 batch로는 Software / Data / AI Platform을 진행한다.

## Batch 004 — Software / Data / AI Platform

### 처리 ticker

`MSFT`, `ORCL`, `PLTR`, `PANW`, `CRWD`, `ADBE`, `NOW`, `FTNT`, `DDOG`, `NET`, `CRWV`, `SNOW`, `MDB`, `ZS`, `AKAM`, `CRM`

### 핵심 결정

- 이번 batch부터 description과 peer group을 같은 seed entry에서 함께 정리하는 방식을 적용했다.
- `MSFT/ORCL`은 hyperscale cloud + enterprise software + database/AI platform 축으로 보고 A/B를 분리했다. `MSFT -> ORCL`은 A `platform_overlap`, `CRM/NOW/ADBE/PLTR/SNOW/MDB/DDOG/PANW/CRWD/FTNT/ZS`는 B adjacent로 둔다.
- `PLTR/SNOW/MDB`는 data/AI platform 축으로 묶되, `PLTR`는 operational AI/ontology/government workflow, `SNOW`는 cloud data warehouse/data sharing, `MDB`는 developer database/data platform으로 설명을 분리했다.
- `PANW/CRWD/FTNT/ZS`는 cybersecurity platform cluster로 묶고, `NET/AKAM`은 edge/security adjacent로 낮췄다.
- `DDOG`은 observability/devops cluster로 두고, security/data platform names는 B theme/platform adjacent로 둔다.
- `NET/AKAM`은 edge/CDN/application delivery cluster로 묶고, SASE/security pure-play와 developer/cloud names는 B adjacent로 둔다.
- `CRWV`는 software infrastructure industry에 들어 있지만 실제 peer 축은 GPU cloud/AI infrastructure로 분리했다. `NBIS/APLD/CORZ`는 A, `MSFT/ORCL/NVDA/DELL/SMCI/VRT`는 B read-through 또는 adjacent로 둔다.
- `CRM/NOW/ADBE`는 enterprise application/workflow/creative-digital-experience software로 분리했다. broad AI software theme만 공유하는 data/security names는 B/C 이상으로 무리 승격하지 않는다.
- `full_peer_curation_batch_004` tag가 있는 ticker는 curated peer group을 source of truth로 보고, 자동 same-industry/same-sector peer 생성은 건너뛴다.
- 같은 tag가 있는 ticker의 provider raw peers는 C `weak_provider_candidate`로 낮춰, 셀 확장 시 감사용 후보로 남긴다.

### 검증 쿼리

```powershell
Set-Location "c:\github_coding\terminal_sec"
@'
import sqlite3, json
batch=['MSFT','ORCL','PLTR','PANW','CRWD','ADBE','NOW','FTNT','DDOG','NET','CRWV','SNOW','MDB','ZS','AKAM','CRM']
con=sqlite3.connect(r"terminal/backend/backend/data/app.db")
con.row_factory=sqlite3.Row
placeholders=','.join('?' for _ in batch)
print(dict(con.execute(f"""
select count(*) rows,
       sum(short_description is not null and trim(short_description)!='') short_ok,
       sum(enhanced_description is not null and trim(enhanced_description)!='') enhanced_ok,
       sum(products_json is not null and json_array_length(products_json)>0) products_ok,
       sum(peer_groups_json is not null and json_array_length(peer_groups_json)>0) peers_ok,
       sum(tags_json like '%full_peer_curation_batch_004%') tag_ok
from company_profile_enrichment e
join securities s on s.id=e.security_id
where s.ticker in ({placeholders})
""", batch).fetchone()))
for ticker in ['MSFT','PANW','SNOW','NET','CRWV']:
    print('\n##', ticker)
    rows=con.execute("""
    select related_ticker, grade, relation_type, score, reason
    from company_peer_edges
    where source_ticker=? and grade!='EXCLUDE'
    order by case grade when 'A' then 1 when 'B' then 2 when 'C' then 3 else 4 end, score desc, related_ticker
    limit 14
    """, (ticker,)).fetchall()
    for row in rows:
        print(json.dumps(dict(row), ensure_ascii=False))
'@ | python -
```

### 현재 대표 기대 결과

| Ticker | A 핵심 | B 보조/read-through | C/weak 처리 |
|--------|--------|---------------------|-------------|
| MSFT | ORCL | ADBE, CRM, NOW, DDOG, MDB, PLTR, SNOW, CRWD, FTNT, PANW, ZS | provider raw broad software 후보 |
| PANW | CHKP, CRWD, FTNT, ZS | AKAM, NET, MSFT, ORCL | broad provider software 후보 |
| SNOW | MDB, ORCL, PLTR | MSFT, CFLT, DDOG, ESTC | AKAM, CRWV, NET, OKTA 등 provider raw 후보 |
| NET | AKAM, ATEN, FFIV | CRWD, FTNT, PANW, ZS, DDOG, DOCN, MSFT | broad cloud/software provider 후보 |
| CRWV | APLD, CORZ, NBIS | MSFT, ORCL, DELL, NVDA, SMCI, VRT | broad software/provider 후보 |

### 검증 결과

| 검증 계층 | 결과 | 비고 |
|-----------|------|------|
| 정적 분석 | ✅ | `seedCompanyProfileEnrichment.ts`, `seedCompanyPeerEdges.ts` 오류 0개 |
| 데이터 seed | ✅ | `npm.cmd run seed:company-enrichment -- --force --tickers=MSFT,ORCL,PLTR,PANW,CRWD,ADBE,NOW,FTNT,DDOG,NET,CRWV,SNOW,MDB,ZS,AKAM,CRM` 성공. clean 재실행 기준 16 updated, limit 16 |
| peer graph 재생성 | ✅ | `npm.cmd run seed:company-peers`: 28,014 edges, visible coverage 2,276/2,278, grade counts `A=888`, `B=20,538`, `C=5,051`, `EXCLUDE=1,537` |
| DB spot check | ✅ | Batch 004 ticker 16/16에서 short/enhanced/products/peerGroups/tag 존재 확인. MSFT/PANW/SNOW/NET/CRWV 대표 peer rank 확인 |
| 런타임 API | ✅ | `GET /api/company-profiles/MSFT`, `PANW`, `SNOW`, `NET`, `CRWV` 응답에서 `short_description`과 `curated_peers` 확인 |
| backend build | ✅ | `terminal/backend`에서 `npm.cmd run build` 성공 |
| backend tests | ✅ | `terminal/backend`에서 `npm.cmd run test`: 17 files / 104 tests passed |
| frontend build | ✅ | `termina_web/figma_code/terminal_ui_ver2_finhub`에서 `npm.cmd run build` 성공 |

### 남은 확인

- 사용자가 Calendar Window에서 Batch 004 ticker들의 description hover와 `Curated Peers` 접힘/펼침 표시를 직접 확인하면 `사용자 확인 후 완료`로 갱신한다.
- 다음 batch 후보는 Software - Infrastructure/Application의 남은 상위 ticker 또는 Space/Defense queue 중 사용자 우선순위에 따라 정한다.

## 완료 기록 규칙

- Batch 완료 후 이 파일의 진행 요약 상태를 `확인 대기`로 바꾼다.
- 사용자가 화면/API 결과를 확인하면 `사용자 확인 후 완료`로 갱신한다.
- 각 Batch는 description seed 변경, peer group seed 변경, `company_peer_edges` 재생성, DB/API spot check, build/test를 통과해야 한다.
