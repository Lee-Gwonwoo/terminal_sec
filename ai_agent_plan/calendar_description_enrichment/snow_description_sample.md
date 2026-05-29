# SNOW 강화 Description 샘플

## 현재 로컬 데이터에서 보이는 한계
- 현재 SNOW의 Yahoo description은 “cloud-based data platform”이라는 큰 틀은 설명하지만, 실제로 어떤 상품/서비스를 팔고 어떤 사용량이 매출로 이어지는지까지는 부족하다.
- 현재 Finnhub peers는 `NET`, `CRWV`, `MDB`, `VRSN`, `TWLO`, `AKAM`, `OKTA`, `GDDY`, `APLD`처럼 넓게 묶여 있다. 이 중 일부는 enterprise/cloud theme read-through로 볼 수 있지만, SNOW의 직접 사업 peer로 그대로 쓰기에는 부정확하다.
- Calendar Window에서는 단순 회사 소개보다 “이 회사 실적에서 무엇을 봐야 하는지”와 “어떤 종목과 비교해야 하는지”가 더 중요하다.

## 상세 Description 초안
SNOW(Snowflake Inc.)는 기업이 여러 시스템과 클라우드에 흩어진 데이터를 한곳에서 저장, 정리, 분석, 공유하고 AI/앱 개발에 활용하게 해주는 클라우드 데이터 플랫폼 회사다. 핵심 제품은 Snowflake Data Cloud이며, 고객은 AWS, Microsoft Azure, Google Cloud 같은 hyperscaler 인프라 위에서 Snowflake를 사용한다. SNOW가 직접 데이터센터나 GPU를 대량 판매하는 회사는 아니고, 클라우드 위에 올라간 데이터 관리/분석/AI workload layer에 가깝다.

SNOW가 파는 가장 핵심적인 상품은 데이터 저장과 query compute 사용량이다. 고객은 Snowflake 안에 판매 데이터, 결제 데이터, 앱 로그, 고객 행동 데이터, 보안 로그, 재고/공급망 데이터 같은 기업 데이터를 적재하고, virtual warehouse라는 compute cluster를 켜서 SQL query, dashboard, report, machine learning feature 생성, 데이터 파이프라인 처리를 수행한다. 예를 들어 대형 retailer는 오프라인 POS, e-commerce 주문, loyalty program, 재고 데이터를 Snowflake에 모아 지역별 수요 예측과 마케팅 분석을 할 수 있다. 금융사는 거래 데이터와 고객 데이터를 합쳐 fraud detection, risk monitoring, regulatory reporting에 쓸 수 있다. SaaS 회사는 제품 사용 로그를 분석해 retention, churn, upsell 가능성을 추적할 수 있다.

Snowflake의 주요 서비스는 단순 저장소에 그치지 않는다. `Snowpipe`는 외부 시스템에서 새 데이터를 지속적으로 가져오는 ingestion 서비스이고, `Streams`와 `Tasks`는 변경 데이터 처리와 scheduled pipeline을 구성하는 데 쓰인다. `Snowpark`는 Python, Java, Scala 같은 언어로 데이터 처리 로직을 Snowflake 안에서 실행하게 해주며, 데이터 엔지니어와 데이터 사이언티스트가 별도 인프라로 데이터를 옮기지 않고 feature engineering이나 model scoring을 할 수 있게 한다. `Streamlit in Snowflake`는 데이터 앱과 내부 dashboard를 Snowflake 데이터 위에서 빠르게 만들게 해준다.

AI 관련해서는 `Snowflake Cortex AI`가 중요하다. Cortex는 기업이 Snowflake 안의 데이터를 기반으로 LLM 기능, text/document processing, semantic search, natural language analytics 같은 AI 기능을 쓰게 하는 제품군이다. 예를 들어 고객지원 티켓과 CRM 데이터를 Snowflake에 모아두고 Cortex Search/Analyst 계열 기능으로 “지난 분기 이탈 위험이 높은 고객군은 어디인가” 같은 질문을 자연어로 분석하는 식이다. `Document AI`는 계약서, invoice, 보험 청구서처럼 비정형 문서에서 정보를 추출하는 업무에 쓰일 수 있다. 이 제품들이 의미 있는 매출 기여를 하려면 단순 demo가 아니라 실제 고객 workload와 compute credit 사용량 증가로 이어져야 한다.

또 하나의 차별점은 데이터 공유와 ecosystem이다. Snowflake Marketplace와 data sharing 기능을 쓰면 기업이 데이터를 복사해서 보내지 않고도 외부 파트너, 공급망, 광고/마케팅 파트너, 금융 데이터 제공자와 데이터를 공유할 수 있다. 예를 들어 광고주는 clean room을 통해 개인정보를 직접 노출하지 않고 campaign 성과를 분석할 수 있고, 금융기관은 third-party market/economic data를 내부 데이터와 결합해 분석할 수 있다. 이런 기능은 SNOW를 단순 database가 아니라 enterprise data collaboration platform으로 보이게 만든다.

매출 구조는 사용량 기반 consumption model이 핵심이다. 고객이 장기 계약을 맺더라도 매출 인식은 실제 사용량, 즉 storage와 compute credit 소비에 크게 좌우된다. 그래서 SNOW 실적에서는 total revenue보다 `product revenue growth`가 더 중요하고, 다음 분기/연간 `product revenue guidance`가 주가 반응을 크게 좌우한다. 계약 잔고를 보여주는 `RPO`와 `current RPO`, 기존 고객이 얼마나 더 많이 쓰는지 보여주는 `net revenue retention`, 연간 product revenue $1M 이상 대형 고객 수, free cash flow margin도 함께 봐야 한다.

AI boom이 SNOW 실적에 반영되는 경로는 NVIDIA나 SMCI와 다르다. NVIDIA/SMCI는 AI 서버와 GPU 주문이 늘면 하드웨어 매출로 비교적 직접 반영되지만, SNOW는 기업들이 AI를 쓰기 위해 데이터를 정리하고, 데이터 접근 권한을 관리하고, 분석/AI application을 운영하면서 Snowflake compute 사용량이 늘어야 실적에 반영된다. 즉 “AI 수혜”의 핵심 질문은 Cortex나 Snowpark가 언급되는지 자체가 아니라, 그 결과 product revenue, RPO, 대형 고객 사용량, net revenue retention이 개선되는지다.

주요 리스크는 cloud cost optimization이다. Snowflake는 사용량 기반이라 고객이 query를 최적화하거나 workload를 줄이면 매출 성장률이 둔화될 수 있다. 고객 입장에서는 Snowflake 사용이 늘수록 비용도 커지기 때문에, 경기 둔화나 IT 예산 압박이 오면 dashboard refresh 빈도 축소, query 최적화, 저장 데이터 정리, cheaper storage/compute 대안 검토가 나타날 수 있다. 또한 Databricks, Google BigQuery, Amazon Redshift, Microsoft Fabric/Synapse 같은 경쟁 제품이 가격과 AI 통합 기능으로 압박할 수 있다.

## 짧은 UI 버전
SNOW는 기업 데이터를 클라우드에 모아 저장, 분석, 공유하고 AI/데이터 앱 개발에 쓰게 해주는 Snowflake Data Cloud 회사다. 고객은 Snowpipe, virtual warehouse, Snowpark, Cortex AI, Streamlit, Marketplace/clean room 같은 기능을 사용하며, 매출은 실제 query/compute credit 사용량이 늘어날수록 커지는 consumption model이다. 실적에서는 product revenue growth와 guidance, RPO/current RPO, net revenue retention, $1M+ customer count, Cortex/Snowpark/Streamlit 사용량 코멘트를 봐야 한다. AI boom 수혜는 GPU 판매처럼 즉시 반영되는 것이 아니라, 기업 데이터 정리와 AI application workload 증가가 Snowflake compute 사용량으로 이어질 때 확인된다. 핵심 리스크는 고객의 cloud cost optimization과 Databricks/BigQuery/Redshift/Microsoft Fabric 같은 경쟁 압박이다.

## 실적 체크 포인트
| 항목 | 왜 중요한가 | 좋은 신호 | 나쁜 신호 |
|------|-------------|-----------|-----------|
| product revenue growth | Snowflake 핵심 매출 성장률 | 성장률 재가속, guidance 상향 | 성장률 둔화, guidance 하향 |
| product revenue guidance | 사용량 기반 모델에서는 미래 사용량 전망이 핵심 | 다음 분기/연간 가이던스 상향 | beat 후에도 약한 가이던스 |
| RPO/current RPO | 계약 잔고와 단기 매출 전환 가능성 | 대형 고객 commit 증가 | RPO 성장 둔화 |
| net revenue retention | 기존 고객의 사용량 확대 | 안정적 고수준 또는 반등 | cloud optimization으로 둔화 |
| $1M+ customer count | enterprise 침투율 | 대형 고객 수 증가 | 신규/대형 고객 증가 둔화 |
| FCF margin / operating margin | 성장과 수익성의 균형 | 성장 둔화 없이 margin 개선 | 성장 둔화를 비용절감으로만 방어 |
| AI workload commentary | AI narrative가 실제 사용량으로 이어지는지 | Cortex/Snowpark 사용 사례와 consumption 기여 언급 | demo/관심 수준에 머무름 |

## Peers 재정리

### Core same-business / 직접 경쟁
| 이름 | 상장 여부 | 분류 이유 | SNOW와 비교할 때 주의점 |
|------|-----------|-----------|--------------------------|
| Databricks | 비상장 | lakehouse, data engineering, ML/AI platform에서 가장 직접적인 경쟁자 | 상장 ticker가 없어 Calendar chip에서는 text peer로 표시 필요 |
| Google BigQuery | GOOGL | cloud data warehouse 직접 경쟁 제품 | GOOGL 전체 매출에서 일부라 주가 민감도는 낮음 |
| Amazon Redshift | AMZN | AWS data warehouse/analytics 경쟁 제품 | AMZN은 hyperscaler/retail/ads 혼합 기업이라 직접 valuation peer는 아님 |
| Microsoft Fabric / Synapse | MSFT | enterprise data platform과 analytics stack에서 경쟁 | MSFT는 Office/Azure/AI platform 전체 영향이 커 직접 peer로 보기 어려움 |
| Oracle Autonomous Data Warehouse | ORCL | enterprise database/data warehouse 경쟁 | legacy database/ERP/cloud mix가 달라 pure-play 비교는 제한적 |

### Public adjacent / 상장 인접 비교
| Ticker | 회사 | 분류 이유 | 활용 방식 |
|--------|------|-----------|-----------|
| MDB | MongoDB | operational database와 developer data workload 쪽 인접 비교 | pure data/software growth multiple 비교 |
| CFLT | Confluent | data streaming/pipeline 계층 | 데이터가 Snowflake로 들어오기 전 real-time pipeline 수요 확인 |
| ESTC | Elastic | search, observability, security analytics 데이터 workload | AI/search analytics theme read-through |
| PLTR | Palantir | enterprise data integration과 AI application layer | AI/data application 예산 경쟁과 narrative 비교 |
| DDOG | Datadog | cloud observability/data workload 사용량 기반 software | enterprise cloud usage와 consumption sentiment 확인 |

### Platform partner + competitor
| Ticker | 회사 | 관계 | 해석 |
|--------|------|------|------|
| AMZN | Amazon | AWS 인프라 파트너이자 Redshift 경쟁자 | cloud workload 확대는 긍정, AWS native 경쟁은 리스크 |
| MSFT | Microsoft | Azure 파트너이자 Fabric/Synapse 경쟁자 | enterprise AI/data budget의 핵심 축 |
| GOOGL | Alphabet | GCP 파트너이자 BigQuery 경쟁자 | BigQuery pricing/AI integration이 경쟁 압박 |
| ORCL | Oracle | enterprise database/cloud 경쟁 | 기존 DB 고객 migration 경쟁 가능 |

### Read-through / 같은 날 분위기 참고
| Ticker | 회사 | 왜 참고하는가 | 직접 peer 여부 |
|--------|------|---------------|----------------|
| NET | Cloudflare | developer/cloud infrastructure sentiment | 직접 peer 아님 |
| CRWV | CoreWeave | AI cloud/GPU infrastructure sentiment | SNOW와 매출 구조가 다름 |
| APLD | Applied Digital | AI data center infrastructure theme | 직접 peer 아님 |
| NOW | ServiceNow | enterprise software budget와 AI workflow sentiment | 직접 peer 아님 |
| CRM | Salesforce | enterprise SaaS spending과 data/AI narrative | 직접 peer 아님 |

### 기존 provider peers 중 약한 후보/제외
| Ticker | 이유 |
|--------|------|
| VRSN | domain registry/Internet infrastructure 성격이 강해 SNOW 사업과 직접 관련 약함 |
| TWLO | communications API/CPaaS로 data warehouse peer가 아님 |
| AKAM | CDN/security/edge infrastructure로 SNOW와 직접 경쟁 관계가 약함 |
| OKTA | identity/security software로 enterprise software sentiment 외 직접 peer 아님 |
| GDDY | domain/hosting SMB exposure가 커 SNOW와 사업 비교 부적합 |

## Calendar 표시 권장 형태
- `Core`: Databricks, BigQuery, Redshift, Microsoft Fabric, Oracle ADW
- `Adjacent`: MDB, CFLT, ESTC, PLTR, DDOG
- `Platform`: AMZN, MSFT, GOOGL, ORCL
- `Read-through`: NET, CRWV, APLD, NOW, CRM
- `Weak`: VRSN, TWLO, AKAM, OKTA, GDDY

## 한 줄 요약
SNOW는 “AI 서버 판매 회사”가 아니라 “기업이 AI를 쓰기 전에 데이터를 모으고 처리하고 활용하게 해주는 consumption 기반 데이터 플랫폼 회사”이며, 실적 핵심은 AI 제품 언급보다 product revenue와 사용량 지표가 실제로 재가속되는지다.
