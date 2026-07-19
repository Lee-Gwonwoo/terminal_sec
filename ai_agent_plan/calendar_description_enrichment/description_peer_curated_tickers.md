# Description + Peer 정리 완료 Ticker 요약

## 기준

- 범위: Calendar description enrichment 작업에서 Batch 001~005까지 description과 peer group을 함께 정리했거나, 이전 pilot 후 batch에서 다시 force refresh한 ticker.
- 상태: 구현/검증 완료, 사용자 화면 확인은 `확인 대기`.
- 중복 처리: 여러 batch에 들어간 ticker는 unique 목록에서 한 번만 표시한다.
- 총 unique ticker 수: 77개.

## 운영 규칙

- 앞으로 description + peer curation batch가 끝날 때마다 이 파일에 완료 ticker를 즉시 추가한다.
- `정리 완료` 기준은 `shortDescription`, `enhancedDescription`, products/revenue/watch/risk, `peerGroups`가 함께 있고 DB/API 검증을 통과한 ticker다.
- 자동 `default_universe_baseline/v1` peer edge만 있는 ticker는 이 파일에 넣지 않는다. 이 파일은 사람이 검토한 description + peer 동시 curation ledger로만 사용한다.
- 새 batch가 기존 ticker를 다시 보강하면 Batch별 목록에는 해당 batch에도 기록하되, Unique 목록에는 중복 없이 한 번만 남긴다.

## Peer-only 누락 점검

- 수동 curated `peer_groups_json`이 있는데 `short_description` 또는 `enhanced_description`이 비어 있는 ticker: 0개.
- Batch tag 기준(`industry_override_needed`, `full_peer_curation_batch_002`, `full_peer_curation_batch_003`, `full_peer_curation_batch_004`, `full_peer_curation_batch_005`)으로 peer는 정리됐지만 description이 비어 있는 ticker: 0개.
- 전체 자동 baseline peer graph 기준으로는 peer edge가 있지만 curated description이 아직 없는 ticker가 2,199개다. 이는 전체 default universe를 덮는 자동 peer baseline이며, 이 파일의 `정리 완료` ticker로 보지 않는다.

## Batch별 목록

| Batch | 범위 | Ticker 수 | Tickers |
|-------|------|-----------|---------|
| 001 | Optical / photonics / AI data-center interconnect | 14 | `LWLG`, `POET`, `COHR`, `LITE`, `AAOI`, `CIEN`, `FN`, `MTSI`, `IPGP`, `GLW`, `MRVL`, `CRDO`, `AVGO`, `ANET` |
| 002 | AI semiconductor / accelerator / memory / connectivity | 23 | `NVDA`, `AMD`, `AVGO`, `MRVL`, `MU`, `INTC`, `QCOM`, `TXN`, `ADI`, `MPWR`, `NXPI`, `LRCX`, `AMAT`, `KLAC`, `TER`, `ON`, `MCHP`, `GFS`, `ALAB`, `RMBS`, `CRDO`, `LSCC`, `MTSI` |
| 003 | AI server / power / cooling / EMS | 11 | `DELL`, `SMCI`, `HPE`, `VRT`, `CLS`, `JBL`, `FLEX`, `ETN`, `TT`, `NVT`, `HUBB` |
| 004 | Software / Data / AI Platform | 16 | `MSFT`, `ORCL`, `PLTR`, `PANW`, `CRWD`, `ADBE`, `NOW`, `FTNT`, `DDOG`, `NET`, `CRWV`, `SNOW`, `MDB`, `ZS`, `AKAM`, `CRM` |
| 005 | Software infrastructure/application remainder | 17 | `SNPS`, `VRSN`, `FFIV`, `DOCN`, `IOT`, `OKTA`, `RBRK`, `CHKP`, `CFLT`, `APP`, `UBER`, `INTU`, `CDNS`, `MSTR`, `ADSK`, `WDAY`, `ZM` |

## Unique 목록

`LWLG`, `POET`, `COHR`, `LITE`, `AAOI`, `CIEN`, `FN`, `MTSI`, `IPGP`, `GLW`, `MRVL`, `CRDO`, `AVGO`, `ANET`, `NVDA`, `AMD`, `MU`, `INTC`, `QCOM`, `TXN`, `ADI`, `MPWR`, `NXPI`, `LRCX`, `AMAT`, `KLAC`, `TER`, `ON`, `MCHP`, `GFS`, `ALAB`, `RMBS`, `LSCC`, `DELL`, `SMCI`, `HPE`, `VRT`, `CLS`, `JBL`, `FLEX`, `ETN`, `TT`, `NVT`, `HUBB`, `MSFT`, `ORCL`, `PLTR`, `PANW`, `CRWD`, `ADBE`, `NOW`, `FTNT`, `DDOG`, `NET`, `CRWV`, `SNOW`, `MDB`, `ZS`, `AKAM`, `CRM`, `SNPS`, `VRSN`, `FFIV`, `DOCN`, `IOT`, `OKTA`, `RBRK`, `CHKP`, `CFLT`, `APP`, `UBER`, `INTU`, `CDNS`, `MSTR`, `ADSK`, `WDAY`, `ZM`

## 빠른 확인 명령

```powershell
Set-Location "c:\github_coding\terminal_sec"
@'
import sqlite3
unique = ['LWLG','POET','COHR','LITE','AAOI','CIEN','FN','MTSI','IPGP','GLW','MRVL','CRDO','AVGO','ANET','NVDA','AMD','MU','INTC','QCOM','TXN','ADI','MPWR','NXPI','LRCX','AMAT','KLAC','TER','ON','MCHP','GFS','ALAB','RMBS','LSCC','DELL','SMCI','HPE','VRT','CLS','JBL','FLEX','ETN','TT','NVT','HUBB','MSFT','ORCL','PLTR','PANW','CRWD','ADBE','NOW','FTNT','DDOG','NET','CRWV','SNOW','MDB','ZS','AKAM','CRM','SNPS','VRSN','FFIV','DOCN','IOT','OKTA','RBRK','CHKP','CFLT','APP','UBER','INTU','CDNS','MSTR','ADSK','WDAY','ZM']
con = sqlite3.connect(r"terminal/backend/backend/data/app.db")
placeholders = ','.join('?' for _ in unique)
row = con.execute(f"""
select count(*) as rows,
       sum(short_description is not null and trim(short_description) != '') as short_ok,
       sum(enhanced_description is not null and trim(enhanced_description) != '') as enhanced_ok,
       sum(peer_groups_json is not null and json_array_length(peer_groups_json) > 0) as peer_groups_ok
from company_profile_enrichment e
join securities s on s.id = e.security_id
where s.ticker in ({placeholders})
""", unique).fetchone()
print(dict(zip(['rows','short_ok','enhanced_ok','peer_groups_ok'], row)))
print('expected_unique_count', len(unique))
'@ | python -
```
