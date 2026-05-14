### 모델 분류

#### `🟪 Model_100_issue tier analysis`

목적:

- 특정 이슈(테마/촉매)를 중심으로 **동일 밸류체인 또는 동일 테마에 묶인 종목 바스켓**이 어떻게 형성·확산·분화되었는지를 시간순으로 분석한다.
- 개별 뉴스 1건이 아니라 **이슈 1개가 만들어낸 종목 바스켓 전체의 라이프사이클**을 대상으로 한다.

### AI Research Preview 표 작성 규칙 (필수)

- `AI Research Window`의 `Preview`에서 **행/열이 있는 블록은 markdown table로 보이게 작성**하는 것을 기본 규칙으로 둔다.
- 즉 아래처럼 `| ... |` header row와 `| --- | --- |` separator row를 갖춘 표를 사용한다.

```md
| 항목 | 값 |
| --- | --- |
| 최종 판정 | `1 tier (지속형)` |
| 메인 direct anchor | `2026-01-27 GLW / Meta 최대 60억달러 fiber-optic 계약` |
```

- 단순 공백 정렬이나 `항목: 값` 반복은 Preview에서 행/열 구조가 깨지므로, **표처럼 보여야 하는 정보는 prose 대신 table로 유지**한다.
- 표 작성 최소 규칙:
   - 헤더 줄과 separator 줄을 반드시 함께 넣는다.
   - 각 row는 한 줄에서 닫는다.
   - 모든 row의 열 수를 맞춘다.
   - 행/열 의미가 있는 블록을 공백 정렬 pseudo-table로 쓰지 않는다.
- 열이 많아 폭이 넓어져도 prose로 축소하지 않는다. 현재 AI Research `Preview`는 넓은 표를 가로 스크롤로 보여줄 수 있으므로, **정보 구조 보존이 우선**이다.
- 특히 아래 섹션은 가능하면 표를 우선 사용한다.
   - `## 관련주 정리`
   - `## 오너십 데이터`
   - `### Governance / Dilution 리스크 감사`
   - `## 핵심 분석이슈`의 상단 요약 블록
   - 확산 타임라인 비교표, 오퍼링 history 표, red flag checklist 표

### 언제 쓰나

- 사용자가 `issue analysis`, `이슈 분석`, `tier 분석`, `바스켓 분석`, `순환매 분석`, `이슈 타임라인` 같은 표현을 쓸 때.
- 한 테마에 묶인 종목들의 첫 급등 → 확산 → 분화 → 소멸/지속 패턴을 정리할 때.
- AI research window 의 research page에 이슈 기반 분석 결과를 작성할 때.
- `Model_1`이 단일 뉴스 → 단일 종목 영향 분석이라면, `Model_100`은 **단일 이슈 → 종목 바스켓 영향 분석**이다.
- 사용자가 `관련주 확장`, `후보 더 넓혀`, `광통신 관련주 더 확장`, `빠진 관련주 있는지 더 보자`처럼 **기본 관련주 표 바깥의 후보 발굴까지 명시적으로 요구**할 때는, 아래 `관련주 확장` 추가 작업을 함께 적용한다.

### Model_100 과 다른 모델의 관계

- `Model_100`은 `Model_1`의 확장이 아니라 **별도 분석 프레임**이다.
- `Model_1`은 뉴스 1건 → 종목 영향을 분석하고, `Model_2`는 기간 내 뉴스를 case_type으로 분류한다.
- `Model_100`은 이슈 1개 → 관련 종목 바스켓 전체의 형성·확산·소멸을 시간축으로 분석한다.
- 단, `Model_1`의 same-ticker / other-ticker 조사, `Model_2`의 case_type 분류, DB 조회 방법은 `Model_100` 내에서도 도구로 활용할 수 있다.

### 기존 issue analysis page 선례 참고 규칙

- `Model_100`으로 새 이슈의 tier를 평가할 때는, 현재 DB의 `research_pages`에 저장된 기존 `issue analysis` / `Model_100` page를 **tier calibration 선례**로 먼저 참고한다.
- 목적은 새 이슈를 고립적으로 평가하지 않고, 과거에 `1 tier`, `1.5 tier`, `2 tier`, `3 tier`, `fail tier`로 정리된 page들이 어떤 change / HV / z-score / breadth / follow-through 조건에서 그렇게 판정됐는지 비교하기 위함이다.
- 최소 확인 대상은 아래와 같다.
   1. 같은 테마 또는 인접 테마의 기존 Model_100 page
   2. 같은 핵심 ticker 또는 direct peer가 포함된 기존 issue analysis page
   3. `Retrospective tier calibration 선례`에 명시된 fail-tier / boundary-tier page
- 기존 page를 참고할 때는 title의 tier 라벨만 보지 말고, page 본문 상단에 `Tier 재분류 메모`가 있는지 먼저 확인한다. 재분류 메모가 있으면 그것이 과거 본문보다 우선한다.
- 최종 판정에서는 가능하면 `참고한 기존 page / 유사점 / 차이점 / 이번 판정에 준 영향`을 짧은 표로 남긴다. 특히 새 이슈를 높은 tier로 올리거나 fail tier로 낮출 때는 최소 1개 이상의 기존 page와 비교한다.
- 기존 page 선례는 판단을 고정하는 족쇄가 아니라 calibration 기준이다. 새 이슈가 과거 선례보다 더 강하거나 약하면, 어떤 지표가 달랐는지(change, z-score, related-stock breadth, next-day follow-through, 7d/14d 유지력)를 숫자로 설명한다.

### Model_100 추가 작업: `관련주 확장`

- `관련주 확장`은 **기본 Model_100의 필수 절차가 아니라**, 사용자가 명시적으로 요청했을 때만 수행하는 선택적 추가 작업이다.
- 기본 Model_100 요청에서는 기존 방식대로 `관련주 정리 -> 오너십 데이터(ownership + governance/dilution audit) -> 핵심 분석이슈 -> 선행 이슈 -> 확산 타임라인 -> 최종 판정` 순서를 유지한다.
- 사용자가 `관련주 확장`을 붙여 요청하면, 기본 관련주 표를 만든 뒤 **후보군 discovery를 한 번 더 수행**해 빠진 종목이 없는지 점검하고, 새 후보의 `사업 유사도 등급`, `이슈 연결 방식`, `포함/제외 판단`을 별도 표로 남긴다.
- 즉 `관련주 정리`는 **현재 바스켓의 구조화**, `관련주 확장`은 **바스켓 바깥 후보의 추가 발굴과 누락 점검**이다.
- `관련주 확장`은 broad theme 아무 종목이나 늘어놓는 작업이 아니다. 반드시 `핵심 이슈 티커와의 사업 유사성`과 `실제 파동 동기화`를 함께 검증해야 한다.

### Model_100 기본 조사축: `governance / dilution risk audit`

- `governance / dilution risk audit`은 **기본 Model_100 절차**다. 사용자가 별도로 명시하지 않아도 수행한다.
- 따라서 `## 오너십 데이터`는 단순 ownership snapshot으로 끝내면 안 되고, **share structure / founder-control / insider ownership / dilution history / insider selling / capital raise / red flag audit**까지 포함해야 한다.
- `관련주 확장`은 여전히 선택적 추가 작업이지만, `governance / dilution risk audit`은 아니다. 확장 요청이 없어도 기본 basket에 대해서는 감사를 수행한다.
- 기본 Model_100 page에서는 `관련주 정리`에 남긴 ticker 전부에 대해 최소 1행 이상의 governance 비교표를 남기고, 핵심 ticker들에 대해서는 서술형 deep-dive를 추가한다.

---

## 이모지 마커 체계 (필수)

출력 문서에서 이벤트/이슈의 성격을 빠르게 구분하기 위해 아래 이모지를 **제목과 본문 모두**에서 일관되게 사용한다.

| 이모지 | 의미 | 사용 위치 |
| --- | --- | --- |
| 🔴 | **분석이슈 (메인 촉매)**: 바스켓 전체를 움직인 핵심 이벤트 | 메인 촉매 섹션 제목, 확산 타임라인 내 메인 이벤트 |
| 🟡 | **같은 티커 관련이슈**: 메인 촉매와 같은 티커에서 발생한 후속/선행 이벤트 | 선행 이슈·타임라인 내 same-ticker 항목 |
| 🔵 | **다른 티커 관련이슈**: 바스켓 내 다른 종목에서 발생한 연쇄/스필오버 이벤트 | 선행 이슈·타임라인 내 cross-ticker 항목 |
| 🟢 | **확산 타임라인 파동**: 바스켓 전체가 동시 반응한 파동 시점 | 확산 타임라인 내 바스켓-wide 파동 |
| ⚪ | **참고/배경**: 직접 주가 반응은 아니지만 맥락에 필요한 정보 | 산업 뉴스, 매크로 이벤트, 어닝 일정 등 |

**사용 규칙:**
- 모든 선행 이슈, 타임라인 항목, 관련이슈 기술 시 해당 이모지를 **줄 첫머리**에 붙인다.
- 하나의 이벤트가 여러 성격을 가질 수 있다 (예: 메인 촉매이면서 같은 티커). 이 경우 **가장 상위 성격의 이모지 1개만** 사용한다. 우선순위: 🔴 > 🟢 > 🔵 > 🟡 > ⚪.
- 확산 타임라인에서 "바스켓 전체 동시 급등"은 🟢, 그 안에서 개별 종목의 자체 촉매가 있으면 해당 종목 설명에 🟡 또는 🔵를 사용한다.

---

## 분석 절차 (5단계)

**작성 순서 고정 규칙 (필수):** 실제 조사 순서는 유연할 수 있어도, `research_pages.body` 작성 순서는 고정한다. 즉 `## 오너십 데이터` 바로 아래에는 반드시 **핵심 분석이슈(메인 촉매 / 메인 파동 anchor)** 를 먼저 배치하고, 그 다음에 선행/관련이슈를 배치한다. 오너십 아래에서 곧바로 선행 이슈부터 길게 전개하는 방식은 최신 Model_100 기준과 맞지 않는다.

### 1단계: 이슈 정의 및 관련주 정리

**목적:** 분석 대상 이슈의 핵심 내용을 확정하고, 그 이슈에 연결된 종목 바스켓을 정의한다.

필수 산출물:

1. **이슈 한줄 정의**: 어떤 이슈인지 1~2문장으로. 예: `AI 데이터센터 fiber-optic / optical component 밸류체인 이슈`.
2. **관련주 분류 테이블**: `사업 유사성 축`과 `이슈 연결 방식 축`을 **분리해서** 사용한다. Model_100에서 사용자가 말하는 `관련주`의 기본 뜻은 **핵심 이슈가 발생한 티커와 가장 유사한 사업을 하는 종목들**이다.

관련주 분류(사업 유사성 기준):

| 분류 | 설명 |
| --- | --- |
| 핵심 동종 peer | 핵심 이슈 티커와 **주요 제품, 주요 고객, 해결하는 전력/인프라 문제, capex budget 경쟁 상대**가 거의 같은 종목 |
| 인접 사업 peer | 정확히 같은 회사는 아니지만, **같은 고객의 같은 문제를 다른 기술/아키텍처로 푸는** 인접 경쟁 종목 |
| 약한 테마/read-through | 넓은 테마나 밸류체인은 겹치지만, 핵심 사업축이 달라 direct peer로 보기 어려운 종목 |

사업 유사도 등급 규칙:

| 등급 | 의미 | 운영적 정의 |
| --- | --- | --- |
| A | 매우 높음 | 핵심 이슈 티커와 **사실상 같은 사업을 비교**할 수 있는 종목. 같은 고객군, 같은 설치 레이어, 같은 예산 항목을 두고 경쟁하거나 대체될 수 있다. |
| B | 높음 | 완전한 동종은 아니지만, **같은 고객 문제를 직접 경쟁 기술로 해결**하는 인접 peer다. 같은 뉴스에서 read-through가 붙어도 이상하지 않다. |
| C | 보통 | 산업/테마는 겹치지만 핵심 사업축이 달라 **조건부 read-through** 정도로 보는 것이 맞다. |
| D | 낮음/참고 | sentiment gauge 또는 약한 테마 peer 수준이다. 같은 broad theme에 묶일 수는 있어도 `핵심 이슈 티커와 유사한 사업`으로 보긴 어렵다. |

이슈 연결 방식 태그:

| 태그 | 설명 |
| --- | --- |
| direct beneficiary | 이번 이벤트의 직접 수혜 당사자 |
| read-through | 같은 사업/인접 사업이라 sympathy가 번질 수 있는 종목 |
| validator / counterparty | 고객, utility, hyperscaler, 공급자, 계약 상대방처럼 **상업성 검증에는 중요하지만 같은 사업을 하지는 않는** 종목 |
| background | 매크로/정책/인프라 배경 설명용 |

- 각 관련주에 대해 `티커`, `관련주 분류`, `사업 유사도 등급`, `이슈 연결 방식`, `설명(왜 이 분류/등급인지)` 5개를 반드시 적는다.
- `관련주 분류`와 `사업 유사도 등급`은 **핵심 이슈 티커와의 사업 유사성**을 기준으로 판단한다. 계약 상대방인지, headline에 직접 등장했는지는 별도 축인 `이슈 연결 방식`에서 처리한다.
- `validator / counterparty`는 중요해도 **관련주 고등급의 근거가 아니다.** 예를 들어 `Oracle`, `AEP`처럼 이번 계약/검증에는 핵심이어도, 핵심 이슈 티커와 같은 사업을 하지 않으면 관련주 표에서 `A`나 `B`를 주지 않는다.
- `관련주`와 `검증자`를 섞지 않는다. 사용자가 `관련주`를 물으면 먼저 **동종/인접 사업 peer**를 정리하고, customer/utility/hyperscaler는 별도 `검증자 / counterparty` 표로 뺀다.
- `3개 이상 종목 동시 +5%` 같은 basket 확인 규칙도 **관련주 표에 들어간 same-business / adjacent-business basket** 기준으로만 계산한다. validator / counterparty는 이 분모에 넣지 않는다.
- 기본 `관련주 정리` 단계에서는 각 핵심 ticker에 대해 `현재 투자 스토리를 지탱하는 사업이 실제로 언제부터 운영됐는지`, `과거 사업/상호/핵심 테마를 빈번하게 바꿨는지`, `현재 사업이 과거 사업의 연장인지 사실상 새 사업인지`를 함께 확인한다.
- 이 business history 확인은 governance audit가 아니라 **관련주 적합성 검증**이다. 사업 유사도가 높아 보여도 현재 사업이 최근에 붙은 서사인지, 과거 사업과의 연속성이 약한지, 실제 운영 증거가 약한지는 `설명` 또는 짧은 메모에 남긴다.
- 상장 연혁이 길더라도 `법인 연혁`과 `현재 사업의 경제적 연혁`을 분리한다. 제품, 고객, 매출, 핵심 자산, 경영진의 연속성을 기준으로 `현재 사업 실질 시작 시점`을 판단한다.
- 이 business history 조사는 app DB에 없거나 매우 sparse할 가능성이 높으므로, `company_profiles.description`만으로 부족하면 **웹서치를 허용하고 권장**한다.
- business history 웹 확인 우선순위는 `SEC EDGAR / 20-F / 10-K / S-1 등 연차·등록 공시 -> 본국 공시 시스템(예: SEDAR+) -> issuer IR / about / history / timeline page -> archived press release / newsroom -> 신뢰 가능한 보조 프로필 사이트` 순서로 둔다.
- 검색 엔진(Bing, DuckDuckGo 등)은 **발견(discovery) 수단으로는 사용 가능**하지만, 최종 문서에는 검색 결과 페이지가 아니라 실제 근거 페이지를 source로 남긴다.
- 기본 예시:
   - `핵심 동종 peer + A + read-through`: BE 이슈에서 FCEL처럼 같은 데이터센터 onsite power / distributed generation 문제를 푸는 종목
   - `인접 사업 peer + B + read-through`: 같은 고객 예산을 놓고 다른 전력 아키텍처로 경쟁하는 엔진/터빈 계열
   - `약한 테마/read-through + C`: 수소/연료전지 broad theme는 겹치지만 핵심 사업축이 다른 종목
   - `validator / counterparty`: ORCL, AEP처럼 계약 검증에는 중요하지만 같은 사업을 하지는 않는 종목

#### `관련주 확장` 요청 시 추가 절차 (필수)

- 이 절차는 **사용자가 명시적으로 `관련주 확장`을 요청했을 때만** 수행한다. 기본 Model_100 요청에 자동으로 붙이지 않는다.
- `관련주 확장`의 목적은 이미 정한 바스켓을 옹호하는 것이 아니라, **하드코딩된 초기 바스켓 밖에 있던 후보가 빠졌는지 점검**하는 것이다.
- 최소 조사 축은 아래 4개를 모두 포함한다.
   1. `keyword 축`: 핵심 이슈를 설명하는 제품/기술/수요 키워드 묶음 작성
   2. `company description 축`: `company_profiles.description`, `securities.industry/sector` 확인
   3. `peer / graph 축`: `peers_json`, 기존 core ticker peer, 동일 파동일 동반 반응 종목 확인
   4. `price validation 축`: anchor day / front-wide breakout / 후속 파동일의 동기화 반응 확인
- `관련주 확장`에서 새 후보를 넣거나 제외할 때도 keyword match만으로 끝내지 말고, `현재 사업 실질 시작 시점`, `과거 사업/상호/핵심 테마 변경 여부`, `현재 사업의 실제 운영 증거`를 함께 확인한다.
- 과거 사업 전환이 잦거나 현재 테마가 최근에 붙은 서사에 가깝다면, 그 사실을 `포함/제외 판단`과 `설명` 칸에 남긴다. business history가 약하면 관련주 등급을 자동으로 높게 주지 않는다.
- DB에 business history가 없다고 해서 `관련주 확장` 검토를 멈추지 않는다. 이 경우 web search로 filing, IR history page, archived PR, home-market filing까지 추적해 포함/제외 판단을 이어간다.
- `관련주 확장`에서는 **적어도 1개의 keyword 묶음만 쓰고 끝내면 안 된다.** 가능하면 아래처럼 3개 이상 묶는다.
   - 제품 키워드: `transceiver`, `optical engine`, `laser`, `modulator`, `DSP`, `coherent`
   - 아키텍처 키워드: `silicon photonics`, `CPO`, `1.6T`, `800G`, `InP`, `PIC`
   - 고객/수요 키워드: `AI data center`, `hyperscaler`, `fiber-optic`, `optical interconnect`
- 후보 편입 검토 큐에 넣는 최소 조건은 아래 중 하나 이상이다.
   1. `company_profiles.description`에 핵심 키워드/동의어가 2개 이상 직접 등장
   2. core ticker의 peer/source text에서 반복적으로 연결
   3. 같은 파동일에 비정상 반응이 관찰되고 사업 설명도 theme와 연결
   4. news/headline/fulltext에서 해당 이슈 키워드와 함께 반복 출현
- `관련주 확장` 결과는 반드시 별도 표나 섹션으로 남긴다. 권장 컬럼은 `티커 | 후보 발견 경로 | 관련주 분류 | 사업 유사도 등급 | 이슈 연결 방식 | 파동 반응 요약 | 포함/제외 판단 | 설명` 이다.
- 포함한 종목뿐 아니라 **검토했지만 제외한 대표 후보도 최소 몇 개는 보이게** 남긴다. 그렇지 않으면 누락 점검 흔적이 사라진다.

#### 누락 방지 가드레일 (필수)

- **하드코딩한 초기 basket만으로 `관련주 확장`을 끝내면 미완료**로 본다. 확장 요청이 있었다면 keyword/description/peer 축의 후보 발굴 흔적이 문서나 작업 산출물에 남아야 한다.
- `securities.industry`, `sector`, 외부 스크리너 업종 라벨은 후보 정렬에 참고할 수 있지만, **제외의 단독 근거로 쓰면 안 된다.** 사업 설명과 제품 키워드가 더 우선이다.
- 특히 업종 라벨이 비정상적이어도 `company_profiles.description`에 핵심 기술이 직접 적혀 있으면 자동 제외하지 않는다.
- 광통신 / photonics / silicon photonics 계열에서는 `LWLG` 같은 종목이 대표적인 예외 케이스다. 예를 들어 `Chemicals - Specialty`처럼 보이더라도 description에 `electro-optic polymer`, `modulator`, `polymer photonic integrated circuits`, `silicon photonics`가 있으면 **반드시 확장 후보 검토 표에 올려야 한다.**
- 따라서 photonics/CPO/optical interconnect 이슈에서 `LWLG`를 비롯한 **업종 라벨 불일치 후보**는 `업종 라벨이 어색하다`는 이유만으로 누락하지 말고, `후보 검토 -> 포함 또는 제외 사유 기록` 절차를 거쳐야 한다.
- 최종 관련주 표에 넣지 않더라도, semantic match가 강한 후보를 제외했다면 **왜 제외했는지**를 `관련주 확장` 섹션에 적는다. 강한 semantic match 후보가 문서 어디에도 안 보이면 누락으로 간주한다.

3. **검증자 / counterparty 표**: customer, utility, hyperscaler, 공급자, 핵심 계약 상대방처럼 **이슈의 진위와 사업성을 검증**해 주지만 같은 사업을 하는 것은 아닌 종목이 있으면, 관련주 표와 분리해서 적는다.

- 이 표에는 `티커`, `역할`, `왜 관련주가 아닌가`, `이번 이슈에서 왜 중요한가`를 적는다.
- 이 표의 종목은 page 설명에는 중요할 수 있지만, related-stock ranking이나 basket propagation count에는 넣지 않는다.

4. **오너십 데이터 테이블**: 각 종목의 시총, Float %, Institutional %, Insider % 를 포함한다.
5. **Governance / dilution 리스크 감사 패키지**: `## 오너십 데이터` 섹션 안에서 각 종목의 지배구조와 희석 리스크를 비교표 중심으로 체계화한다.

오너십 데이터 조회 규칙:
- 출처: `GET /api/tickers` 또는 app DB의 `company_profiles` 테이블.
- 필수 컬럼: 시총(market_cap), Float %, Institutional %, Insider %.
- `institutional_pct`가 100% 초과할 수 있음 (중복 집계 특성). 이를 그대로 기록하고 `원래의 집계 특성 그대로`라고 주석 표기.
- 오너십 해석을 별도 문단으로 추가: 대형캡 vs 소형캡의 반응 차이, float 크기와 변동성 관계, insider 보유율이 시사하는 것 등.

#### Governance / dilution 리스크 감사 (기본 절차, 필수)

- 이 감사는 **Model_100 기본 조사축**이며, 사용자가 따로 요청하지 않아도 수행한다.
- `## 관련주 정리` 최종 표에 남긴 ticker는 **모두** governance 비교표 행을 가져야 한다. 사용자가 명시적으로 ticker list를 줬다면 그 목록은 전부 포함한다.
- 바스켓이 넓어 서술형 deep-dive를 줄여야 하더라도, 최소한 비교표 행은 전 ticker에 대해 유지한다. narrative 범위를 줄였으면 `핵심 ticker 상세 / 나머지 ticker 요약`처럼 축약 범위를 명시한다.
- 1차 소스와 2차 소스가 충돌하면 1차 소스를 우선하고, 2차 소스는 검산·시계열 보강·screening 보조 용도로만 쓴다.
- 숫자나 filing 근거를 확보하지 못한 항목은 추정으로 메우지 말고 `미확인`, `공시 미발견`, `source 확인 필요`처럼 명시한다.

##### Governance task 섹션 작성 규칙

- governance 관련 작성 분량이 많거나, 한 번에 모든 항목을 확정하기 어려우면 research page 안에 **별도 `### Governance task` 섹션을 추가**해 단계적으로 작성할 수 있다.
- 이 `Governance task` 섹션은 기존 `### Governance / Dilution 리스크 감사` 본문을 **대체하지 않는다.** 이미 governance 표/요약이 작성되어 있어도, 추가 조사·미확정 항목·후속 deep-dive는 항상 그 **아래 별도 섹션**에 누적한다.
- 사용자가 `하나씩`, `단계적으로`, `먼저 governance부터`, `거버넌스 task 따로`처럼 요청하면, governance audit를 한 번에 모두 끝내지 못해도 된다. 대신 각 회차에서 무엇을 완료했고 무엇이 남았는지를 `### Governance task` 섹션에 남겨 page 자체가 진행 상태를 보존해야 한다.
- `### Governance task` 섹션에는 가능하면 표를 우선 사용하고, 최소한 `task | 상태 | 이번 회차 산출물 | 남은 확인 source | 다음 단계`가 보이게 정리한다.
- task 분할 기본 예시는 `share structure`, `founder / control`, `insider ownership / voting power`, `5년 dilution`, `capital raise / shelf / ATM`, `Form 4 / insider selling`, `red flag checklist` 순서를 우선한다.

##### 거버넌스 표 이후 오퍼링 히스토리 연동 규칙

- 사용자가 `거버넌스`와 `오퍼링 이력`을 함께 보려는 맥락이면, **거버넌스 비교표/요약을 먼저 작성한 뒤 회사별 오퍼링 히스토리 섹션으로 이어서 정리**한다.
- 즉 출력 흐름은 기본적으로 `거버넌스 표/요약 -> 회사별 오퍼링 이력 -> 여러 회사 비교 요약` 순서를 우선한다.
- 이때 오퍼링 이력은 반드시 **한 회사씩 완결형으로** 적는다. 예: `# POET ... 오퍼링 이력`을 끝내고 `## 주요 인사이트`까지 마친 뒤 다음 `# MXL ... 오퍼링 이력`으로 넘어간다.
- 여러 회사를 묶어 비교하더라도, 각 회사 섹션 안에서는 `범위 설명 -> 전체 목록 표 -> 주요 인사이트`를 유지하고, 마지막에만 `## 비교 요약` 또는 `## 비교 업데이트`를 둔다.
- 거버넌스 섹션에서 이미 `capital raise history`, `ATM`, `희석률`을 다뤘더라도, 회사별 오퍼링 history 표는 **생략하지 않는다.** 거버넌스 표는 비교용 요약이고, 오퍼링 history 표는 거래 연표/금액/구성 정리용으로 역할이 다르다.

##### 사용자 제공 초안 정리 규칙

- 사용자가 조사 내용을 거친 초안 형태로 제공하면, 그 내용을 바탕으로 **섹션 제목, markdown 표, 짧은 해설, 비교표**를 갖춘 완결형 문서로 재정렬한다.
- 사용자가 준 숫자/서술을 그대로 붙여넣지 말고, 최소한 아래를 정리한다.
   1. 제목과 범위 문단 분리
   2. 표 컬럼 정렬 및 헤더 복원
   3. `주요 인사이트` bullet 정리
   4. 여러 회사 비교표 또는 `비교 업데이트` 섹션 분리
- 사용자가 이미 `POET`, `MXL`, `LWLG`, `AXTI`처럼 회사별 블록을 준 경우, 각 회사를 독립 섹션으로 쪼개고 마지막에 비교표를 둔다.
- 사용자가 `5개 종목 Class B / Dual-class 구조 조사 결과`, `5개 종목 지분구조 및 희석 이력 종합 정리`, `각 종목별 세부 분석`처럼 결과 섹션 예시를 주면, 특별한 충돌이 없는 한 그 섹션명을 우선 존중한다.
- 단, 예시 문구를 그대로 복제하는 것이 목적은 아니고, **같은 정보 구조와 읽기 순서**를 재현하는 것이 목적이다.

필수 조사 항목:

1. **주식 구조 (Share Structure)**
   - `single-class` vs `dual-class` 여부.
   - dual-class이면 `Class A / Class B`의 주당 의결권 비율 (`1표 vs 10표`, `1표 vs 20표` 등).
   - `sunset provision` 존재 여부와 trigger (`time-based`, `ownership-based`, `death/disability`, `transfer-based`)를 적는다.
   - preferred stock의 `blank check` 권한(이사회 단독 발행 권한) 존재 여부.
   - 법인 소재지 (`Delaware`, `Nevada`, `Cayman`, `Canada` 등)와 `home country exemption` 적용 여부.
   - `authorized shares` vs `issued/outstanding shares` gap을 숫자와 비율로 적어 향후 dilution capacity를 계산한다.

2. **경영진 프로파일**
   - CEO 이름, 취임 시점, 재직 기간.
   - **창업자(Founder) 여부**를 `True founder`, `Co-founder`, `Professional manager` 중 하나로 분류한다.
   - `Chairman / CEO` 겸직 여부.
   - 창업자가 CEO가 아니고 이사회 또는 executive chair에만 남아 있으면 별도 표기한다.

3. **Insider Ownership / Voting Power**
   - CEO 개인 보유 주식 수와 보유율.
   - 창업자 보유율이 CEO와 다르면 별도 분리한다.
   - 직접 보유 vs `family trust`, LLC, partnership, vehicle을 통한 간접 보유를 구분한다.
   - dual-class이면 `Class B` 또는 고의결권 class 보유 수량과 voting power를 따로 적는다.
   - 전체 insider ownership 합계 %와 `CEO + 핵심 이사진` voting power 합계를 적는다.

4. **Shares Outstanding 추이 (최근 5년)**
   - 연도별 `shares outstanding`와 전년 대비 변동률을 표로 정리한다.
   - 5년 누적 희석률은 `(latest shares / oldest shares - 1) * 100`으로 계산한다.
   - 주요 offering 이벤트를 `ATM`, `follow-on`, `secondary`, `PIPE`, `convertible-linked` 중 어디에 해당하는지 분리해 타임라인화한다.
   - 각 주요 offering 이벤트마다 최소한 `pricing/launch date`, `closing date`(확인 가능할 때), `offering type`, `offering price/share`, `gross proceeds`, `shares sold`, `primary/secondary mix`, `당시 시가총액`, `offering size / 당시 시총 비율(%)`을 적는다.
   - `offering size / 당시 시총 비율(%)`은 가능하면 `gross proceeds / 당시 market cap * 100`으로 계산하고, gross proceeds 확인이 어려우면 `offering shares * offering price / 당시 market cap * 100`으로 근사한 뒤 근사값임을 표시한다.
   - `buyback` 유무와 규모를 함께 적는다.
   - `stock-based compensation (SBC)`가 희석에 얼마나 기여했는지 10-K/10-Q footnote와 diluted share count 변화를 근거로 추정한다.

5. **Insider Trading 패턴**
   - 최근 1~3년 `Form 4` 기준 매수 vs 매도 건수를 집계한다.
   - 주가 급등 시점의 대량 매도 여부와 timing을 분석한다.
   - `10b5-1 plan`에 의한 programmatic selling인지, discretionary sale인지 구분 가능한 범위에서 적는다.
   - 저점에서의 자기 매수 이력(창업자 conviction signal)이 있는지 본다.
   - 최근 대규모 매도 이벤트(`$5M` 이상)는 별도 표로 분리한다.

6. **자본 조달 History**
   - `ATM offering` 프로그램 존재 여부, 한도, 잔여 capacity.
   - `S-3 shelf registration` 등록 금액.
   - 주가 급등 시점에 equity offering을 반복하는 패턴인지 본다.
   - 개별 조달 이벤트는 `발표일`, `pricing date`, `settlement/closing date`, `offer price`, `직전 종가 대비 할인율`, `gross proceeds`, `당시 market cap 대비 비중`, `사용처`를 가능한 범위에서 같은 행에 모아 적는다.
   - 조달 자금 사용처를 `R&D`, `M&A`, `working capital`, `cash burn cover` 등으로 정리한다.
   - 수익성 상태(`흑자 / 적자`)와 cash burn rate를 같이 적어 financing dependence를 해석한다.

7. **종합 Red Flag 체크리스트**
   - 아래 항목을 ticker별 `Y/N`로 같은 표에 정리한다.
   - `Dual-class with 10+ votes/share held by founder`
   - `Founder/CEO 지분 5% 미만`
   - `3년 누적 희석률 30% 이상`
   - `ATM 프로그램 상시 운영`
   - `수익성 부재 + 반복적 equity offering`
   - `주가 급등 시 CEO 대량 매도`
   - `Home country exemption으로 주주 승인 우회 가능`
   - `Sunset provision 없는 perpetual dual-class`
   - `Blank check preferred stock 발행 권한`
   - `Related-party transaction 이력`

8. **최종 평가**
   - 종목 간 `governance` 관점 상대 순위를 매긴다.
   - 학술 프레임은 최소 `Bebchuk-Kastiel agency cost`, `Cremers dual-class life cycle`, `Jensen free cash flow problem`, `Myers-Majluf pecking order / adverse selection`을 사용해 해석한다.
   - `WeWork`, `Snap`, `Meta`, `Alphabet` 등 유사 사례와 비교할 수 있으면 붙인다.
   - 결론은 반드시 `구조적 리스크`와 `실제 운영상 리스크`를 분리해서 적는다. 예: `구조는 founder-control + blank check로 공격적이지만, 실제 최근 3년 행보는 buyback 우세`.

조사 방법 / 소스 우선순위:

- **1차 소스 (우선):** `SEC 10-K`, `S-1`, `DEF 14A`, `8-K`, `Form 4`, `10-Q`, `424B5 prospectus supplement`, charter/bylaws, 회사 IR의 board/management 페이지.
- **2차 소스 (보조):** `macrotrends.net`, `companiesmarketcap.com`, `gurufocus.com`, `insidertrades.com`, `fintel.io`, `simplywall.st`, `corpgov.law.harvard.edu`, `stocktitan.net`.
- app DB와 `GET /api/tickers`의 ownership/company-profile 값은 **편의용 cache**일 뿐, governance / dilution audit의 필수 선행조건이 아니다.
- 따라서 DB에 필요한 값이 없거나 sparse해도, governance 작업은 **중단하지 않고** `SEC EDGAR`와 회사 IR/filing 웹페이지를 직접 확인하는 방식으로 계속 진행한다.
- 특히 share structure, charter/bylaw, blank check preferred, sunset, beneficial ownership, Form 4, shelf/ATM, 424B5 offering 조건은 **웹에서 SEC filing 원문을 직접 찾아 확인하는 것을 허용하고 권장**한다.
- 웹 확인이 필요한 경우 우선순위는 `SEC EDGAR filing 원문 -> issuer IR filing mirror / proxy page -> 신뢰 가능한 보조 집계 사이트` 순서로 둔다.
- DB 부재로 웹 확인을 사용했다면, 결과 표나 본문에 최소한 `form type`, `filing date`, `source tag`, 가능하면 `document title`까지 남겨 어떤 공시를 근거로 썼는지 추적 가능하게 한다.
- share structure / blank check / domicile / sunset은 가능하면 charter, S-1, DEF 14A, 10-K의 risk factors와 governance section으로 확인한다.
- founder / CEO / chair 구조는 DEF 14A와 IR management page를 우선하고, founder 여부는 회사 역사/창업 서술과 연차보고서를 교차 확인한다.
- insider ownership / voting power는 DEF 14A beneficial ownership table을 우선 사용하고, Form 4와 13D/13G는 보조로 활용한다.
- shares outstanding 시계열은 10-K, 10-Q, S-3/424B5, 8-K를 우선 사용하고, `macrotrends`와 `companiesmarketcap`은 시계열 검산용으로 사용한다.
- insider trading pattern은 `Form 4`를 우선 사용하고, `gurufocus`, `insidertrades`, `fintel`은 event screening 보조로 쓴다.
- capital raise history는 `8-K`, `S-3`, `424B5`, underwriting agreement, ATM sales agreement를 우선 사용한다.
- offering price, shares sold, gross proceeds, pricing date는 `424B5`, underwriting agreement, ATM prospectus supplement를 우선하고, 당시 시총은 해당 날짜 전후의 `shares outstanding * close price` 또는 신뢰 가능한 market-cap source로 계산한다.
- 실무용 웹 fallback query 예시는 `company name + DEF 14A beneficial ownership`, `ticker + 424B5 offering price`, `company name + amended and restated certificate of incorporation blank check preferred`, `ticker + Form 4 10b5-1`처럼 form/type을 함께 붙이는 방식으로 좁힌다.

출력 형식 규칙:

- 종목별 narrative가 길어지더라도, 최소한 아래 비교표들은 기본으로 남긴다.
  - `share structure / founder-control / domicile / voting power` 비교표
   - `5년 shares outstanding / dilution / buyback / SBC / financing` 비교표
   - `offering date / offering type / offer price / shares sold / gross proceeds / market cap at pricing / offering % of market cap / use of proceeds` 비교표
  - `Form 4 / ATM / shelf / red flag` 비교표
- 핵심 숫자는 반드시 구체적으로 적는다. `%`, `주식 수`, `조달 금액`, `매도 금액`을 추상어로 대체하지 않는다.
- 평가 문장은 `괜찮다`처럼 뭉뚱그리지 말고, `구조는 X / 실제 행보는 Y`를 분리한다.
- 답변 언어는 한국어를 기본으로 하되, `dual-class`, `ATM offering`, `SBC`, `blank check preferred`, `sunset provision` 같은 금융 용어는 영어 병기를 유지한다.

### 단일 종목 오퍼링 / 유상증자 조사 출력 템플릿

- 사용자가 `한 회사씩`, `오퍼링 이력`, `유상증자`, `ATM`, `registered direct`, `PP`, `follow-on`, `희석 이력`처럼 **단일 종목의 자본조달 history 자체**를 묻는 경우, 기본 출력 순서는 아래와 같이 고정한다.
   1. 제목: `# {회사명} ({거래소: 티커}) 오퍼링 이력`
   2. 범위 선언: 조사 기간, 포함 범위, 제외 범위(`예: 업리스팅 이후만`, `TSXV 시절 소규모 PP 제외`)를 2~4문장으로 먼저 밝힌다.
   3. `## {범위명} 오퍼링 전체 목록` 표를 둔다.
   4. `## 주요 인사이트`에서 누적 조달 규모, 연도별 조달 패턴, 가장 큰 딜, ATM/워런트/잔여 capacity, 희석성 해석을 정리한다.
   5. 여러 종목을 함께 다루는 요청일 때만 마지막에 `## 비교 요약` 또는 `## Governance / 희석 해석`을 추가한다.
- **한 회사씩 완료 규칙:** 현재 회사의 표와 인사이트를 끝내기 전에는 다음 회사 섹션으로 넘어가지 않는다. 사용자가 `POET부터`, `먼저 LWLG`, `한 회사씩`이라고 말했으면 그 회사 1개를 완결형으로 마무리한 뒤 다음 회사를 진행한다.
- 전체 목록 표의 기본 컬럼은 아래를 우선한다.
   - `#`
   - `날짜 (발표/마감)`
   - `오퍼링 종류`
   - `총 금액 (USD)`
   - `오퍼링 가격`
   - `주식수/구성`
   - `당시 시총 비중 (추정)`
- `ATM offering`처럼 프로그램 한도만 있고 체결 시점의 고정 price/share가 없는 경우:
   - `총 금액 (USD)`에는 `프로그램 한도` 또는 `누적 실제 판매액`을 구분해서 적는다.
   - `오퍼링 가격`에는 `시장가 매매`, `avg $X.XX/share`, `미고정` 중 실제 공시 수준에 맞는 표현을 쓴다.
   - `주식수/구성`에는 `실제 판매분 별도 공시`, `누적 판매주식`, `warrant 없음/있음` 등을 구조적으로 적는다.
- `registered direct`, `bought deal`, `follow-on`, `PIPE`, `Canadian PP`, `LPC facility`, `ATM amendment`, `base shelf`는 서로 섞지 말고 **거래 성격별로 정확히 분류**한다.
- `preliminary prospectus`와 `final prospectus`가 같은 딜이면, **final 조건을 주 행으로 사용**하고 preliminary는 note 또는 날짜 칸 보조 설명으로 흡수한다. 같은 딜을 중복 집계하지 않는다.
- 워런트, commitment shares, underwriter option, over-allotment, ATM amendment 증액분, 기존 프로그램 carryover는 `주식수/구성` 칸에서 풀어 적고, `총 금액`과 혼동하지 않는다.
- 시총 비중이 정확 계산이 아닌 경우에는 반드시 `(추정)`을 붙이고, 가능하면 `gross proceeds / 당시 market cap`인지 `shares * price / market cap`인지 짧게 설명한다.
- 표만 던지고 끝내지 않는다. 사용자 예시처럼 **표 + 짧은 해설 + 핵심 경고/특이사항**을 같이 둔다.
- 사용자가 범위 제외를 원하지 않았더라도, 역사적으로 딜 수가 매우 많다면 표 위에서 `이번 답변은 NASDAQ 업리스팅 이후 중심`, `초기 OTC/TSXV 소규모 PP 제외`처럼 **이번 정리의 범위선**을 먼저 그어 독자가 무엇이 빠졌는지 알 수 있게 한다.

### 멀티-회사 오퍼링 / 지배구조 정리 템플릿

- 사용자가 여러 회사를 순차적으로 비교하려는 경우, 아래 순서를 기본으로 한다.
   1. `## {N}개 종목 Class B / Dual-class 구조 조사 결과` 또는 동등한 거버넌스 요약 표
   2. `## 주목할 포인트` 또는 `## 핵심 포인트`
   3. `## {N}개 종목 지분구조 및 희석 이력 종합 정리` 표
   4. `## 각 종목별 세부 분석`
   5. 회사별 오퍼링 이력 섹션들: `# POET ...`, `# MXL ...`, `# LWLG ...`처럼 **한 회사씩 완결형**
   6. 마지막 `## 비교 요약` 또는 `## 비교 업데이트`
- 위 구조는 사용자가 `이것도 참고해라`, `이런 식으로 정리해라`처럼 예시형 결과를 줄 때 특히 우선 적용한다.
- 멀티-회사 거버넌스 요약 표의 권장 컬럼은 `Ticker | 회사명 | Share 구조 | 세부사항` 또는 `Ticker | 주요 인물 | 창업자 여부 | 현재 지분율 | 보유 주식 수 | 최근 매매 패턴`이다.
- `각 종목별 세부 분석`에서는 회사당 1개 소제목을 두고, `창업자/전문경영인 여부`, `지분율`, `최근 매매 패턴`, `희석/ATM/오퍼링 체질`, `구조 리스크 vs 실제 행보`를 1~3문단으로 정리한다.
- 멀티-회사 오퍼링 이력 비교의 마지막 요약 표 권장 컬럼은 `상장 연도 | 상장 이후 총 equity 조달 | Follow-on/ATM 빈도 | 자본조달 방식 | 희석 체질 | 비즈니스 단계`다.
- 사용자가 예시에서 특정 표현을 반복하면, 예를 들어 `극명한 대조`, `모든 red flag`, `serial diluter 패턴` 같은 요약어는 그대로 복사하지 말고, **근거가 바로 뒤에 붙는 한줄 평가**로 재작성한다.
- 사용자가 일부 회사만 묶어서 비교하라고 하면 `## FORM & ACMR 지분구조 및 희석 이력 분석`처럼 **쌍/소수 종목 묶음 제목**을 그대로 사용할 수 있다. 이 경우에도 `요약 표 -> 핵심 포인트 -> 각 종목별 세부 분석 -> 필요 시 회사별 오퍼링 이력` 순서를 유지한다.

#### 사용자 예시형 결과 뼈대

- 아래 뼈대는 사용자가 `이런 식으로 정리해라`라고 준 예시를 markdown 결과물로 재구성할 때 우선 사용하는 기본 shape다.
- 숫자와 회사명은 실제 조사 결과로 교체하되, **제목 계층과 표 배치 순서**는 특별한 이유가 없으면 유지한다.

```md
## 5개 종목 Class B / Dual-class 구조 조사 결과

| Ticker | 회사명 | Share 구조 | 세부사항 |
| --- | --- | --- | --- |
| POET | POET Technologies | single-class | ... |
| MXL | MaxLinear | single-class | ... |
| LWLG | Lightwave Logic | single-class | ... |
| AXTI | AXT Inc. | single-class | ... |
| FORM | FormFactor | single-class | ... |

## 핵심 포인트

- ...
- ...

## 5개 종목 지분구조 및 희석 이력 종합 정리

| Ticker | 주요 인물 | 창업자 여부 | 현재 지분율 | 보유 주식 수 | 최근 매매 패턴 |
| --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... | ... |

## 각 종목별 세부 분석

### POET

- 구조:
- 실제 행보:

### MXL

- 구조:
- 실제 행보:

### LWLG

- 구조:
- 실제 행보:
```

```md
# POET Technologies (NASDAQ: POET) 오퍼링 이력

이번 정리는 ... 범위를 기준으로 한다. ... 는 제외/포함한다.

## 오퍼링 전체 목록

| # | 날짜 (발표/마감) | 오퍼링 종류 | 총 금액 (USD) | 오퍼링 가격 | 주식수/구성 | 당시 시총 비중 (추정) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | ... | ATM | ... | 시장가 매매 | ... | ... |
| 2 | ... | registered direct | ... | ... | ... | ... |

## 주요 인사이트

- 누적 equity 조달 규모:
- 가장 큰 딜 / 가장 희석적이었던 딜:
- ATM / shelf / warrant / 잔여 capacity:
- 구조적 리스크 vs 실제 운용 행보:

# MaxLinear (NASDAQ: MXL) 오퍼링 이력

...

# Lightwave Logic (NASDAQ: LWLG) 오퍼링 이력

...

## 비교 요약

| Ticker | 상장 연도 | 상장 이후 총 equity 조달 | Follow-on/ATM 빈도 | 자본조달 방식 | 희석 체질 | 비즈니스 단계 |
| --- | --- | --- | --- | --- | --- | --- |
| ... | ... | ... | ... | ... | ... | ... |
```

- 사용자가 `비교 업데이트`, `세 회사 비교 요약`, `거버넌스 관점 순위` 같은 마지막 섹션명을 명시했다면, 위 `## 비교 요약` 위치에 그 제목을 그대로 대체해 사용한다.

오너십 데이터 섹션 바로 아래에 반드시 이어져야 하는 것:
- **핵심 분석이슈 고정 블록**을 먼저 쓴다. 여기서 `이슈 티어가 만들어진 날`, `event_date`, `published_at`, `change_anchor`, 대표 headline/structured catalyst, 핵심 가격 반응 테이블을 먼저 제시한다.
- 그 다음에야 `이전에 같은 이슈가 있었나`, 같은 티커/다른 티커 관련이슈, 배경 이벤트를 쓴다.
- 즉 독자가 page를 위에서 아래로 읽을 때, "지금 무엇이 핵심 anchor인가"를 먼저 이해한 뒤 관련이슈 비교로 내려가야 한다.

### 2단계: 핵심 분석이슈 고정

**목적:** 오너십 데이터 바로 아래에서 이번 page의 중심 anchor가 되는 분석이슈를 먼저 고정한다. 관련이슈/선행이슈는 이 anchor와의 비교 자료로 배치한다.

핵심 분석이슈 블록에 반드시 포함할 항목:

| 항목 | 설명 |
| --- | --- |
| 메인 축 날짜 | page 상단의 `축 1`, `축 2` 같은 canonical axis 날짜. **기본값은 `change_anchor`** 이며, 장후 PR/공시/earnings면 다음 거래일을 쓴다. `event_date`, `published_at`는 아래 날짜 3줄에서 따로 적는다. |
| 날짜 3줄 | `event_date:`, `published_at:`, `change_anchor:`를 별도 줄로 정확히 쓴다. |
| 대표 headline / structured catalyst | 원문 headline, earnings, SEC filing, PR 등 이번 anchor를 대표하는 핵심 사건 1~2개. |
| 핵심 가격 반응 표 | 최소 `same-day`, `from-open`, `next day`, `7d`, `14d`, `30d`에 대해 **change + HV + z-score 삼중항** 을 정확한 숫자로 적는다. 필요 시 `open_to_high`도 추가한다. |
| 메인 촉매 판정 이유 | 왜 이 이슈가 바스켓을 대표하는 anchor인지, 왜 다른 이벤트보다 우선인지 설명한다. |
| 직접성 / 간접성 | 메인 종목과 peer 종목이 direct benefit인지 read-through인지 구분한다. |

핵심 분석이슈 블록 작성 규칙:
- 이 블록은 `오너십 데이터` 다음에 바로 와야 한다.
- 선행 이슈를 장황하게 쓰기 전에, 독자가 **먼저 분석 대상 anchor를 정확히 이해**할 수 있어야 한다.
- page 전체의 판정(`1 tier`, `fail tier` 등)은 이 블록에서 고정한 anchor를 기준으로 후속 비교가 이루어져야 한다.
- 이 블록의 가격 반응은 **당일 change만이 아니라 change/HV/z-score 전 구간 삼중항** 을 기준으로 쓴다.
- 사용자가 축 날짜를 지정했더라도, 그 날짜에 direct headline / filing / PR이 없고 단순 pre-bid 또는 선행 관찰일에 불과하면 **그 날짜를 canonical `축 1`로 승격하지 않는다.** 이런 경우에는 `선행 axis`, `pre-bid 관찰일`로만 적고, 실제 `축 날짜`는 first hard catalyst의 `change_anchor`로 옮긴다.
- 예를 들어 `2024-11-14` 장후 PR이라면 summary/table의 `축 날짜`는 `2024-11-15`가 기본값이다. 단, 본문 3줄에는 `event_date: 2024-11-14`, `published_at: ...`, `change_anchor: 2024-11-15`를 모두 남긴다.
- validator / counterparty는 `핵심 분석이슈`의 상업성 검증 근거로는 활용하지만, related-stock basket confirmation이나 tier 분모에는 넣지 않는다.

### 3단계: 선행 이슈 조사

**목적:** 메인 촉매 이전에 같은 테마의 선행 신호가 있었는지 조사한다.

조사 범위:
- 메인 촉매 일자 기준 **최소 60일 이전**까지 소급.
- 1단계에서 정의한 관련주 전체 + 동일 산업 peer까지 포함.

조사 대상 DB/소스:
- `news_items` (company_news): headline, published_at, tickers_csv.
- `sec_filings` (fmp_sec): 8-K, 10-Q, 10-K, S-1 등.
- `news_fulltext` (fmp_pr): press release 전문.
- `calendar_events` (earnings): 어닝 발표일, eps_est, eps_actual.
- `ohlc_1d` (OHLC DB): 절대 가격 반응(change, turnover) 확인용.
- `news_change_metrics` 또는 `GET /api/news`, `GET /api/news/:id`: 뉴스 기준 파생 가격 반응, matching HV, z-score 확인용.

각 선행 이슈에 대해 반드시 기록할 항목:

| 항목 | 설명 |
| --- | --- |
| 날짜 | **event_date**(실제 이벤트 발생일)와 **published_at**(기사 게시일)를 구분 표기. 동일하면 한 번만 쓰고, 다르면 반드시 둘 다 표기한다. ISO 형식. 상세 규칙은 아래 「이벤트 날짜 vs 기사 날짜 구분 규칙」 참조. |
| 티커 | 해당 이슈의 주체 종목 |
| 데이터 소스 | `company_news`, `fmp_pr`, `fmp_sec`, `investing`, `calendar_events` 중 어디서 왔는지 |
| headline/제목 | 원문 headline 또는 filing type |
| 가격 반응 (전체 change + HV + z-score) | 해당 뉴스의 첫 반응 거래일 기준 **모든 주요 change 컬럼**과 **대응 HV, z-score 컬럼**을 함께 기록한다. 장 후(16:00 이후) 발표면 다음 거래일 기준. `change만 있고 HV/z-score가 없는 표`는 미완료다. |
| 다음 거래일 반응 | 첫 반응 거래일 바로 다음 거래일의 동일 **change/HV/z-score 삼중항** 전체 |
| 직전 어닝 / 다음 어닝 | 해당 이벤트 시점 기준 **가장 최근 과거 어닝 날짜** + **가장 가까운 미래 어닝 날짜**를 함께 기록한다. (상세는 아래 "어닝 날짜 연동 규칙" 참고) |
| 해석 | 이 이슈가 바스켓 전체에 미친 영향, 스필오버 여부, 지속성. change는 절대 상승폭, z-score는 HV 대비 얼마나 비정상적으로 강했는지 판단한다. 7d/14d/30d change로 유지 기간을 보고, z-score로 고변동성 종목의 착시를 걸러낸다. Turnover 급등은 기관/대형 자금 유입 가능성을 시사. |

선행 이슈 분류 (이모지 마커 적용):
- 🟡 **같은 티커 관련이슈**: 메인 촉매 티커와 동일한 종목에서의 선행 이벤트.
- 🔵 **다른 티커 관련이슈**: 바스켓 내 다른 종목 또는 같은 테마이지만 직접 관련주가 아닌 종목에서의 이벤트.
- ⚪ **배경 이벤트**: 직접 주가 반응은 없지만 맥락상 필요한 산업/매크로 뉴스.

**그룹 구조 (필수):** 선행 이슈를 나열할 때, 각 **분석이슈(이벤트)를 먼저 쓰고**, 바로 아래에 그 이벤트의 관련이슈(같은 티커 → 다른 티커 순)를 들여쓰기로 묶는다. 이벤트가 끝나면 다음 분석이슈로 넘어간다.

예시 구조:
```
🟡 2026-01-15 GLW — Corning Q4 earnings beat
   → 🟡 같은 티커: GLW 어닝 후 analyst PT 상향 3건 (1/16~1/17)
   → 🔵 다른 티커: LITE +3.2% read-through 반응 (1/15)
   → ⚪ 배경: AI capex 전망 상향 보고서 (Goldman, 1/14)

🔵 2025-12-18 LITE — Lumentum data center revenue guidance raise
   → 🟡 같은 티커: LITE 8-K filing (12/18)
   → 🔵 다른 티커: AAOI +5.1% 스필오버 (12/19)
```

가격 반응 계산 규칙:
- OHLC DB (`ohlc_1d`)에서 해당 거래일의 **모든 파생 change 컬럼**을 함께 조회한다:
  - `Change_1d_Pct`: 전일 종가 대비 당일 종가 등락률.
  - `Change_From_Open_Pct`: 당일 시가 대비 종가 등락률 (장중 방향성).
  - `Change_7d_Pct`: 7 거래일 전 종가 대비 등락률 (1주 누적).
  - `Change_14d_Pct`: 14 거래일 전 종가 대비 등락률 (2주 누적).
  - `Change_30d_Pct`: 30 거래일 전 종가 대비 등락률 (1개월 누적).
  - `Turnover`: 당일 거래대금 (Close × Volume). 평소 대비 급등 여부를 함께 해석.
- HV / z-score는 `news_change_metrics` 또는 `/api/news` 응답에서 **해당 뉴스 row 기준**으로 조회한다:
   - `hv_*`: change metric과 정의가 같은 historical series의 최근 `60 completed samples` 표준편차. annualized volatility가 아니라 **현재 change와 직접 비교 가능한 비연율화 sigma(%)** 다.
   - `zscore_* = actual_change / hv_*`: unitless 값이며, 절대값이 클수록 평소 변동성 대비 더 큰 움직임이다.
- 뉴스 published_at 시각이 16:00 이후(장 마감 후)이면, 다음 거래일을 "첫 거래일 반응"으로 사용한다.
- 뉴스 published_at 시각이 16:00 이전이면, 당일을 "첫 거래일 반응"으로 사용한다.
- **최소 기재 세트 (필수):** 아래 window는 값이 있으면 반드시 숫자로 적는다.
  - same-day close: `change_pct`, `hv_change_pct`, `zscore_change_pct`
  - same-day from open: `change_from_open_pct`, `hv_change_from_open_pct`, `zscore_change_from_open_pct`
  - next trading day close: `change_1d_pct`, `hv_change_1d_pct`, `zscore_change_1d_pct`
  - 1 week: `change_7d_pct`, `hv_change_7d_pct`, `zscore_change_7d_pct`
  - 2 weeks: `change_14d_pct`, `hv_change_14d_pct`, `zscore_change_14d_pct`
  - 1 month: `change_30d_pct`, `hv_change_30d_pct`, `zscore_change_30d_pct`
- `change_open_to_high_pct`, `hv_change_open_to_high_pct`, `zscore_change_open_to_high_pct`는 intraday squeeze 해석이 중요할 때 추가한다. 장중 과열/되밀림이 핵심인 fail-tier 사례에서는 사실상 필수에 가깝다.
- 값이 DB/API에 없으면 `(DB/API 미제공)`으로 명시하고, 가능한 경우 `ohlc_1d`로 절대 change를 보완한다. 하지만 **change만 적고 HV/z-score를 묵시적으로 생략**하면 안 된다.
- **해석 가이드**:
   - change는 **절대 반응 크기**를 보여준다.
   - HV는 **그 change가 평소 어느 정도 흔한지의 분모**를 보여준다.
   - z-score는 **HV 대비 초과반응**을 보여준다. 같은 +10%라도 고변동성 종목의 `zscore 0.8`과 저변동성 종목의 `zscore 2.4`는 질적으로 다르다.
   - `|zscore| < 1`: 대체로 평소 변동성 범위.
   - `1 <= |zscore| < 2`: 의미 있는 초과반응 가능.
   - `|zscore| >= 2`: 평소 변동성 대비 뚜렷한 비정상 반응.
   - 7d/14d/30d change와 대응 HV/z-score는 이슈의 지속력과 fade 속도를 해석한다.
   - Turnover 급등은 기관 자금 유입 시그널로 해석한다.

**분석 원칙:** 바스켓 내 종목 간 비교에서는 change, HV, z-score를 항상 삼중항으로 본다. change가 큰데 HV도 크고 z-score가 낮으면 원래 변동성이 큰 종목의 통상 범위일 수 있고, change가 상대적으로 작아도 HV가 낮아 z-score가 높으면 저변동성 종목에서 나온 강한 신호일 수 있다. 숫자는 가능하면 반올림 규칙을 일관되게 적용하되, page 전체에서 같은 자릿수 체계를 유지한다.

---

### 이벤트 날짜 vs 기사 날짜 구분 규칙 (필수)

company_news 분석 시, **이벤트가 실제로 발생한 날짜(event_date)**와 **기사가 게시된 날짜(published_at)**가 다른 경우가 빈번하다. 후속 기사의 change를 이벤트 첫 반응으로 착각하면 분석이 왜곡되므로, 아래 규칙을 적용한다.

#### 핵심 용어

| 용어 | 정의 | 예시 |
|------|------|------|
| **event_date** | 이벤트가 실제 발생한 날짜 (어닝 발표, 계약 체결, SEC filing 등) | 4/12에 어닝 발표 |
| **published_at** | 해당 이벤트를 보도/분석한 기사의 게시 시각 (DB 저장 값) | 4/13에 후속 분석 기사 게시 |
| **first_public_at** | 시장이 해당 이벤트를 **처음** 인지한 시점 | 4/12 16:05 ET (어닝 발표 직후) |
| **change_anchor** | change 지표 계산 시 기준으로 삼는 첫 거래일 | first_public_at이 16:00 ET 이후면 다음 거래일 |

#### 운영 규칙

1. **change_anchor는 항상 first_public_at 기준이다.**
   - "시장이 언제 처음 알았는가"가 가격 반응의 기준점이다. 이벤트 발생일 자체가 아니다.
   - 예: 4/12 장 마감 후 어닝 발표 → first_public_at = 4/12 16:05 → change_anchor = 4/13 (다음 거래일).

2. **후속 기사의 change를 이벤트 첫 반응으로 사용하지 않는다.**
   - 4/12에 어닝이 발표되고 4/13에 분석 기사가 나온 경우:
     - 기사 row의 `news_change_metrics`는 **4/13 기준** change를 담고 있다 (4/12 종가 대비 4/13 종가 등).
     - 이것은 **후속 반응(2일차)**이지, 이벤트 첫 반응이 아니다.
   - 이벤트 첫 반응은 `ohlc_1d`에서 change_anchor 날짜의 change를 직접 조회해야 한다.

3. **분석 문서에 기록할 때 날짜를 구분해서 명시한다.**
   - `이벤트 날짜(event_date)`: 실제 이벤트 발생일.
   - `기사 날짜(published_at)`: DB에 저장된 기사 게시일.
   - `가격 기준일(change_anchor)`: change 계산에 사용할 첫 거래일.
   - 세 날짜가 동일하면 한 번만 쓰되, **다를 때는 반드시 구분 표기**한다.

4. **event_date 판별 방법 (우선순위):**
   - ① `calendar_events.event_at` (어닝, SEC filing 등 구조화 데이터)
   - ② 기사 본문/headline에 명시된 날짜 ("reported on April 12", "filed on 4/12")
   - ③ 같은 이벤트에 대한 가장 이른 기사의 published_at
   - ④ 판별 불가 시 `(event_date 미확인, published_at 기준 사용)` 태그 표기

#### 구체 예시

**예시 A — 어닝 후속 분석 기사:**
- 4/12(금) 16:05 ET: AAPL 어닝 발표 (event_date = 4/12)
- 4/13(토): 분석 기사 게시 (published_at = 4/13) → 주말이므로 change 의미 없음
- change_anchor = 4/14(월, 첫 거래일)
- ✅ 이벤트 반응 = ohlc_1d에서 4/14의 Change_1d_Pct 등
- ❌ 4/13 기사 row의 news_change_metrics를 "어닝 반응"으로 사용하면 안 됨

**예시 B — 당일 보도 (세 날짜 동일):**
- 4/15(화) 09:30 ET: 대형 계약 발표 (event_date = 4/15)
- 4/15(화) 10:15 ET: 기사 게시 (published_at = 4/15)
- change_anchor = 4/15 (세 날짜 동일)
- ✅ 기사 row의 news_change_metrics를 그대로 이벤트 반응으로 사용 가능

**예시 C — 전날 장 후 이벤트, 다음날 보도:**
- 4/12(월) 17:00 ET: CEO 사임 발표 (event_date = 4/12)
- 4/13(화) 06:30 ET: 기사 게시 (published_at = 4/13)
- first_public_at = 4/12 17:00, change_anchor = 4/13
- ✅ 기사 row의 news_change_metrics (4/13 기준)가 이벤트 첫 반응과 일치 → 사용 가능
- ⚠️ 단, change_from_open_pct로 장 시작 후 갭 반응과 장중 추가 반응을 별도 확인

---

### 4단계: 확산 타임라인

**목적:** 메인 촉매 이후 이슈가 어떻게 확산·강화·분화되었는지를 시간순으로 정리한다.

각 타임라인 항목에 반드시 포함할 내용:

| 항목 | 설명 |
| --- | --- |
| 날짜/기준일 | `event_date`, `published_at`, `change_anchor`를 구분 표기한다. 복수일이면 범위 표기 가능 (예: `2026-02-03~2026-02-06`), 단 기사 날짜와 가격 기준일이 다르면 반드시 별도 줄로 명시한다. |
| 촉매 이벤트 | 해당 시점의 핵심 뉴스/공시/어닝 내용 |
| 데이터 소스 | `company_news`, `fmp_pr`, `fmp_sec`, `calendar_events` 등 |
| 가격 반응 (전체 change + HV + z-score) | 바스켓 내 주요 종목의 당일 **전체 change 컬럼**과 **대응 HV, z-score 컬럼** 테이블. `same-day`, `from-open`, `1d`, `7d`, `14d`, `30d`를 원칙적으로 모두 본다. |
| 의미 | 이 이벤트가 이슈 확산에서 어떤 역할을 했는지. Turnover 변화로 자금 유입/이탈을 판단하고, **change/HV/z-score 삼중항** 으로 평소 변동성 대비 정말 강한 파동이었는지 판단한다. |

어닝 날짜 연동 규칙:
- 각 타임라인 이벤트(및 선행 이슈)마다, 해당 시점에서 **직전 어닝**(가장 최근 과거)과 **다음 어닝**(가장 가까운 미래)을 **모두** 기록한다.
- 어닝 데이터는 `calendar_events` 테이블에서 `event_type='earnings'`으로 조회한다.
- **직전 어닝 조회**: `event_at <= ? ORDER BY event_at DESC LIMIT 1` — 해당 시점까지 가장 최근 발표된 어닝.
- **다음 어닝 조회**: `event_at > ? ORDER BY event_at ASC LIMIT 1` — 해당 시점 이후 가장 가까운 예정 어닝.
- 직전 어닝과의 거리(일수)는 "어닝 서프라이즈 모멘텀이 아직 살아있는지" 판단에 사용한다. 직전 어닝이 10일 이내이면 서프라이즈 연장 효과 가능.
- 다음 어닝까지의 거리(일수)가 짧으면 그것이 추가 촉매(어닝 기대감) 역할을 할 수 있으므로 명시한다.
- 형식:
  - `직전 어닝: {ticker} {date} ({N}일 전)` — 없으면 `(DB 미수록)` 표기.
  - `다음 어닝: {ticker} {date} ({N}일 후)` — 없으면 `(DB 미수록)` 표기.

확산 타임라인에서 식별해야 하는 핵심 시점 (이모지 마커 적용):
1. 🔴 **이슈 티어가 만들어진 날**: 메인 촉매가 터진 날.
2. 🟢 **전면 부각의 날**: 바스켓 전체가 처음으로 동시 급등한 날.
3. 🟢 **2차 파동**: 어닝/추가 딜/analyst 상향 등으로 두 번째 급등이 온 시점.
4. 🔵 **테마 확장**: 이슈 주제가 원래 범위에서 인접 테마로 확장된 시점.
5. 🟡 **개별 확인**: 소형캡 개별 종목이 자체 수주/어닝으로 테마를 확인한 시점.

**바스켓 판정 모수 규칙 (필수):**
- `바스켓 전체`, `3개 이상 동시 +5%`, `peer propagation` 같은 판정은 **1단계 관련주 표에 들어간 same-business / adjacent-business peer**만을 기준으로 계산한다.
- customer, utility, hyperscaler, 계약 상대방 같은 `validator / counterparty`는 설명에는 중요하지만, basket count를 올리거나 내리는 종목으로 세지 않는다.
- 따라서 ORCL, AEP처럼 `상업성 검증자`인 종목은 strong validator일 수 있어도, `관련주가 잘 움직였는가`를 판단하는 숫자 계산에는 넣지 않는다.

**그룹 구조 (필수):** 확산 타임라인도 선행 이슈와 동일하게 **분석이슈 → 관련이슈** 그룹 형태로 작성한다. 각 파동/이벤트를 먼저 쓰고, 바로 아래에 같은 티커 관련이슈 → 다른 티커 관련이슈를 들여쓰기로 묶는다.

**핵심 분석이슈 우선 규칙 (필수):** 확산 타임라인 이전에 이미 `오너십 데이터 -> 핵심 분석이슈 고정 블록`이 나와 있어야 한다. 즉 타임라인의 첫 🔴 항목은 page의 첫 메인 anchor와 연결되어야 하며, 독자가 이전 섹션에서 이미 그 anchor의 의미와 가격 반응을 이해한 상태여야 한다.

**날짜 표기 규칙 (필수):** 각 타임라인 이벤트 블록 안에 아래 3줄을 기본으로 둔다.
- `event_date:` 실제 이벤트 발생일
- `published_at:` 기사 게시 시각 또는 공시 수집 시각
- `change_anchor:` 첫 가격 반응 기준 거래일
- 세 값이 모두 같으면 한 줄로 축약 가능하지만, 하나라도 다르면 반드시 분리 표기한다.

예시 구조:
```
🔴 2026-01-27 GLW — Meta-Corning $6B fiber-optic 계약 발표
   - event_date: 2026-01-27
   - published_at: 2026-01-27 02:30 ET
   - change_anchor: 2026-01-27
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🟡 같은 티커: GLW Q4 earnings (1/28) — EPS beat
   → 🔵 다른 티커: LITE +11.49%, COHR +8.21%, AAOI +7.17% 스필오버
   → ⚪ 배경: Meta AI capex $65B 발표 동일 주

🟢 2026-02-06 파동 — LITE 어닝 beat → 바스켓 전체 2차 급등
   - event_date: 2026-02-03
   - published_at: 2026-02-03 16:03 ET
   - change_anchor: 2026-02-04
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🟡 같은 티커: LITE Q2 guidance raise, revenue $800M beat
   → 🔵 다른 티커: AXTI +17.77%, AAOI +16.18%, AEHR +14.74%
   → 🔵 다른 티커: FN +13.84% (AI photonics read-through)

🟡 2026-03-09 AAOI — 1.6T transceiver volume order
   - event_date: 2026-03-09
   - published_at: 2026-03-09 07:00 ET
   - change_anchor: 2026-03-09
   [가격 반응 테이블: 전체 change + z-score (+ 필요시 hv)]
   → 🔵 다른 티커: AXTI +19.12%, LITE +14.73% 연쇄 반응
```

### 5단계: 티어 판정 및 최종 정리

**목적:** 이슈의 지속성·파급력을 기준으로 티어를 판정하고, 전체 분석을 정리한다.

#### 티어 분류 체계

| 티어 | 정의 | 판정 조건 |
| --- | --- | --- |
| **1 tier (지속형)** | 이슈가 2회 이상의 파동을 만들고, 바스켓 내 3개 이상 종목이 각 파동에서 5% 이상 동반 반응하며, **메인 anchor의 핵심 직접 수혜 티커**가 자신의 평소 변동성 대비도 강하게 반응한다. 또한 메인 anchor가 기존 thesis의 단순 반복/증액이 아니라 새로운 direct confirmation을 제공해야 한다. 메인 촉매 이후 30일 이상 테마가 유지됨. | 확산 타임라인에서 2차 파동 이상 존재 + 개별 확인 이벤트 1건 이상 + 핵심 티커 direct z-score 품질 충족 |
| **1.5 tier (단독 z-score 초강형 / 경계형)** | `1 tier`로 보기에는 바스켓 breadth, 2차 파동, 30일 지속력, 신규 direct confirmation 중 일부가 부족하지만, **메인 anchor의 핵심 직접 수혜 티커 단독 z-score가 예외적으로 강해** `2 tier`로 낮추면 신호를 과소평가하는 경우. 단, 관련주/peer basket의 실제 change 데이터가 횡보 또는 무반응이면 `1.5 tier`가 아니라 `fail tier` 또는 `3 tier`를 먼저 검토한다. | 핵심 티커 direct z-score가 매우 강함 + 최소한의 follow-through 또는 부분적 관련주 반응은 있으나, 1 tier의 breadth/지속성/신규성 조건은 완전히 충족하지 못함 |
| **2 tier (보통형)** | 이슈가 1~2회 파동을 만들었거나, breadth는 있었지만 **핵심 티커 direct z-score가 약하거나 기존 이슈의 반복/확대 성격이 강한 경우**. 단, 핵심 direct z-score가 예외적으로 강해 `2 tier`로 낮추면 신호를 과소평가하는 경계 사례는 `1.5 tier`를 먼저 검토한다. | 전면 부각은 있었으나 2차 파동이 약하거나, 핵심 direct surprise quality가 1.5 tier 이상에 못 미침 |
| **3 tier (약형)** | 이슈가 뉴스에 등장했으나 바스켓 전체 동시 급등이 미약하거나 1일 내 되돌림. | 전면 부각 부재 또는 즉시 반납 |
| **fail tier (스파이크 / 바스켓 미형성)** | 촉매 당일만 반응하고 다음 거래일 즉시 반납 또는 역전. 또는 headline과 단독 티커 반응은 좋아 보여도, 확인 가능한 change 데이터에서 관련주/peer basket이 사실상 횡보하거나 반응하지 않아 Model_100 이슈로 형성되지 못한 경우. | 메인 촉매 당일 반응 후 다음 거래일 반대 방향 또는 0% 근처, 또는 관련주 바스켓의 clean 동반 반응이 없고 후속 window에서도 상승 확산이 확인되지 않음 |

티어 판정 보조 기준:
- **핵심 티커 direct z-score 품질**: 메인 anchor의 직접 수혜 티커(또는 page의 핵심 티커)의 `same-day`, `from-open`, `1d`, `7d` z-score를 **최우선**으로 본다. 기본 가이드는 `same-day` 또는 `1d` 중 하나가 `|z| >= 2`에 근접하거나 이를 넘고, follow-through window(`1d`, `7d`, `14d`)에서도 추가 확인이 있어야 한다. sympathy peer의 z-score가 높아도 핵심 티커 direct z-score가 약하면 기본적으로 `2 tier` ceiling을 우선 검토한다.
- **1.5 tier 경계 규칙**: `1 tier`의 breadth/지속성/신규성 조건은 부족하지만 핵심 티커 direct z-score가 너무 강한 경우에는 `2 tier`로 강등하지 말고 `1.5 tier`를 검토한다. 운영 가이드는 `same-day`, `from-open`, `1d`, `7d` 중 하나가 대략 `|z| >= 3` 수준이거나, 둘 이상 window에서 `|z| >= 2` 수준이고, 다음 거래일/7d/14d follow-through 또는 관련주 일부 반응이 함께 확인되는 경우다. 단, 관련주 전파가 전혀 없거나, 관련주/peer basket의 change 데이터가 거의 횡보/무반응이고, 다음 거래일 또는 후속 window에서 확산이 확인되지 않으면 `1.5 tier`가 아니라 `fail tier` 또는 `3 tier`를 우선 검토한다.
- **파동 횟수**: 확산 타임라인에서 바스켓 3개 이상 종목이 동시 `Change_1d_Pct` 5% 이상 반응한 날의 횟수.
- **파동 지속력**: 각 파동일의 `Change_7d_Pct`/`Change_14d_Pct`가 양수를 유지하는지로 "되돌림 없는 진짜 파동"인지 판단.
- **HV 대비 초과반응**: 같은 파동이라도 `zscore_*`가 높은 종목이 자신의 평소 변동성 대비 더 강하게 반응한 것이다. 고변동성 소형주는 절대 change만 크고 z-score는 낮을 수 있으므로 반드시 함께 본다.
- **신규성 vs 반복성**: 메인 anchor가 이미 알려진 고객/계약/정책/테마의 단순 확대, 금액 상향, 반복 headline인지 확인한다. **기존 이슈의 반복/증액 성격이 강하면 breadth만으로 `1 tier`를 주지 않는다.** 이 경우 핵심 티커의 direct z-score가 아주 강하지만 신규성/지속성/breadth가 1 tier에 못 미치면 `1.5 tier`, 이전 precedent보다 명확히 강한 신규 counterparty / revenue attribution까지 추가된 경우에만 `1 tier` 승격을 검토한다.
- **지속 기간**: 메인 촉매부터 마지막 의미 있는 파동까지의 캘린더 일수.
- **개별 확인 이벤트**: 소형캡 자체 수주/어닝/딜로 테마를 독립적으로 확인한 횟수.
- **테마 확장 여부**: 이슈 주제가 원래 범위에서 인접 테마로 옮겨간 사례 유무.
- **Turnover 추이**: 파동별 Turnover가 이전 파동 대비 증가/감소하는지로 자금 유입 지속성을 판단.

#### Retrospective tier calibration 선례

다음 page들은 향후 Model_100에서 비슷한 이슈를 평가할 때 참고할 **재분류 선례**다. 핵심 목적은 headline 또는 단독 종목 반응이 좋아 보여도, 실제 related-stock basket의 change 데이터가 뒤따르지 않으면 높은 tier를 주지 않도록 기준을 고정하는 것이다.

| page id | 최신 판정 | 재분류 이유 |
| --- | --- | --- |
| `f422cd61-4f4e-4872-a891-c1e642b000a7` | `fail tier` | 최초에는 단독 z-score/anchor quality 때문에 `1.5 tier` 후보처럼 보였지만, 재점검 결과 관련주/peer basket이 clean하게 오르지 못했고 후속 change 데이터가 거의 횡보에 가까웠다. 단독 가격 반응만으로 Model_100 이슈 형성을 인정하지 않는다. |
| `2ef919a1-d5d2-4197-9b6d-2000a673f7b7` | `fail tier` | headline은 중상급 호재로 볼 여지가 있었지만, change 데이터 기준 실제 가격 반응과 관련주 확산이 거의 없었다. `좋은 뉴스`와 `Model_100 basket-forming issue`를 분리하는 선례다. |
| `a5afb1f8-5456-4109-a7be-8826c11871ed` | `fail tier` | NNE x SMCI AI data center nuclear MOU는 pre-open narrative는 강했지만, regular/next window에서 원전 관련주 basket이 동반 상승하지 못했다. pre-open spike candidate는 후속 change 확인 전까지 높은 tier로 확정하지 않는다. |

최종 정리 필수 산출물:

1. **한줄 결론**: 이슈 티어 판정 + 핵심 날짜 2개 (이슈 형성일 + 전면 부각일).
2. **최종 판정 문단**: `이슈 티어가 만들어진 날`, `전면 부각의 날`에 대한 근거 요약.
   - `1.5 tier`를 부여할 때는 **왜 `1 tier`는 아닌지**(부족한 breadth/지속성/신규성)와 **왜 `2 tier`로 낮추지 않는지**(핵심 티커 direct z-score와 follow-through 품질)를 각각 1문장 이상으로 분리해 적는다.
3. **선행 이슈 성격 정리**: 메인 촉매 이전 선행 이슈들의 공통 성격 (개별적, 단일 종목, 간접, 일회성 등).
4. **스코프 선언**: 이번 page가 `event-level` 판정인지 `issue-cycle-level` 판정인지 명시한다. anchor 날짜 page인데 cycle 누적 판정을 쓸 경우 제목/한줄 결론/최종 판정에서 그 스코프를 분명히 드러낸다.
5. **기존 issue analysis 선례 비교**: tier를 확정하기 전에 참고한 기존 Model_100 / issue analysis page를 `page id`, `기존 판정`, `유사점`, `차이점`, `이번 판정에 준 영향` 표로 남긴다. 참고할 만한 기존 page가 없으면 `기존 page 선례 미발견`이라고 명시한다.

---

## 출력 문서 구조 (research page body)

아래 섹션 순서와 제목을 기본 템플릿으로 사용한다. 사용자가 별도 구조를 요청하지 않으면 이 순서를 따른다.

단, 사용자가 `단일 회사 오퍼링 이력`, `유상증자 history`, `ATM / RD / PP 타임라인`처럼 **자본조달 history 자체만** 요구한 경우에는 아래 full research page 템플릿을 그대로 강제하지 않고, 위 `단일 종목 오퍼링 / 유상증자 조사 출력 템플릿`을 우선 적용한다. 즉 standalone offering audit 답변은 `제목 -> 범위 설명 -> 전체 목록 표 -> 주요 인사이트 -> 필요 시 비교/해석` 순서를 기본으로 하고, 관련주/확산 타임라인 섹션은 요구될 때만 붙인다.

`관련주 확장`을 명시적으로 요청받은 경우에는 `## 관련주 정리` 바로 아래에 `## 관련주 확장` 또는 동등한 보조 섹션을 추가해, **새 후보의 발견 경로 / 관련성 정도 / 포함 여부 / 제외 사유**를 남긴다. 기본 Model_100 요청에서는 이 섹션을 자동으로 추가하지 않는다.

```
## 한줄 결론
## 관련주 정리
   [표: 티커 / 분류 / 관련성 정도 등급 / 설명]
   - 각 핵심 ticker는 `현재 사업 실질 시작 시점 / 과거 사업 전환 여부 / 현재 사업과 과거 사업의 연속성`을 `설명` 또는 짧은 메모에 남긴다
## 관련주 확장 (사용자가 명시적으로 요청한 경우에만)
   [표: 티커 / 후보 발견 경로 / 분류 / 관련성 정도 등급 / 포함 여부 / 설명]
   - 새 후보는 `현재 사업 실질 시작 시점 / 사업 전환 이력 / 실제 운영 증거`까지 확인해 포함/제외 판단을 적는다
   - 사용한 keyword 묶음
   - 검토했지만 제외한 대표 후보와 제외 이유
## 오너십 데이터
   [표: market cap / float % / institutional % / insider %]
   ### Governance / Dilution 리스크 감사
   [표: share structure / class votes / sunset / blank check / domicile / home country exemption / authorized vs outstanding]
   [표: CEO / founder type / chair split / CEO ownership / founder ownership / insider ownership / voting power]
   [표: 5년 shares outstanding / YoY dilution / cumulative dilution / buyback / SBC / ATM / shelf / major offering timeline]
   [표: offering date / closing date / offering type / offer price / shares sold / gross proceeds / market cap at pricing / offering % of market cap / discount to prior close / use of proceeds]
   [표: Form 4 buy/sell / 10b5-1 여부 / large sales / red flag checklist]
   [요약: governance 상대 순위 / academic frame / comparable cases / 구조적 리스크 vs 실제 운영상 리스크]
   ### Governance task
   [표: task / 상태 / 이번 회차 산출물 / 남은 확인 source / 다음 단계]
   - 기존 governance 표/요약을 지우지 말고 그 아래에 추가 작성
   - 이미 governance 내용이 page에 있어도 별도 섹션으로 누적
   - 분량이 많으면 task 단위로 하나씩 완료해도 허용
## 🔴 핵심 분석이슈: {메인 촉매 날짜} {티커}
  - event_date: {실제 이벤트 날짜}
  - published_at: {기사/공시 시각}
  - change_anchor: {첫 가격 반응 기준일}
  - 대표 headline / structured catalyst
  [핵심 가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
  - 왜 이 이벤트가 이슈 티어를 만들었는가
  - 이 이슈가 정말 주가를 올릴 만한 이슈였나
## 🔴 {메인 촉매 날짜} 이전에 같은 이슈가 있었나
  (각 선행 이슈를 시간순으로 나열하되, 분석이슈 → 관련이슈 그룹 구조)
  🟡 {날짜} {티커} — {이벤트 제목}
     - event_date: {실제 이벤트 날짜}
     - published_at: {기사/공시 시각}
     - change_anchor: {첫 가격 반응 기준일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
     → ⚪ 배경
  🔵 {날짜} {티커} — {이벤트 제목}
     → ...
## 🟢 확산 타임라인
  (각 파동/이벤트를 시간순으로 나열하되, 분석이슈 → 관련이슈 그룹 구조)
  🔴 {날짜} {티커} — {메인 촉매}
     - event_date: {실제 이벤트 날짜}
     - published_at: {기사/공시 시각}
     - change_anchor: {첫 가격 반응 기준일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
  🟢 {날짜} 파동 — {파동 설명}
     - event_date: {실제 이벤트 날짜 또는 기간}
     - published_at: {대표 기사/공시 시각}
     - change_anchor: {파동 기준 거래일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🟡 같은 티커 관련이슈
     → 🔵 다른 티커 관련이슈
  🟡 {날짜} {티커} — {개별 확인 이벤트}
     - event_date: {실제 이벤트 날짜}
     - published_at: {기사/공시 시각}
     - change_anchor: {첫 가격 반응 기준일}
     [가격 반응 테이블: same-day / from-open / 1d / 7d / 14d / 30d의 change + hv + z-score]
     → 🔵 다른 티커 연쇄 반응
## 최종 판정
```

---

## DB / API 조회 규칙

### news_items (company_news)
- 조회: `SELECT * FROM news_items WHERE tickers_csv LIKE '%,{TICKER},%' AND published_at BETWEEN ? AND ? ORDER BY published_at`
- `tickers_csv`는 `,AAPL,MSFT,` 형식이므로 LIKE 패턴에 앞뒤 콤마 포함.
- `source` 컬럼으로 데이터 출처 확인 (finnhub, fmp 등).

### news_fulltext (fmp_pr)
- press release 전문. `news_id`로 `news_items`와 JOIN.
- PR 전문에서 계약 금액, 상대방, 제품 상세 등 추출.

### sec_filings (fmp_sec)
- `sec_filings` 테이블 자체에는 `ticker` 컬럼이 없다. ticker 기준으로 보려면 `news_items`와 `news_id`로 JOIN한다.
- 예시:
   ```sql
   SELECT sf.*, ni.tickers_csv, ni.title, ni.published_at
   FROM sec_filings sf
   JOIN news_items ni ON ni.id = sf.news_id
   WHERE ni.tickers_csv LIKE '%,{TICKER},%'
      AND sf.filed_at BETWEEN ? AND ?
   ORDER BY sf.filed_at
   ```
- filing type 컬럼명은 `filing_type`이 아니라 `form_type`이다. 값 예: `8-K`, `10-Q`, `10-K`, `S-1`.
- `accepted_at`과 `filed_at`이 다를 수 있으므로 장중/장후 판단이 중요하면 두 컬럼을 같이 본다.

### calendar_events (earnings)
- `SELECT * FROM calendar_events WHERE ticker=? AND event_type='earnings' ORDER BY event_at`
- `meta_json` 컬럼에 `eps_est`, `eps_actual`, `revenue_est`, `revenue_actual`, `confirmed`, `report_date` 포함.
- **다음 어닝 조회**: `event_at > ? ORDER BY event_at ASC LIMIT 1`.
- **직전 어닝 조회**: `event_at <= ? ORDER BY event_at DESC LIMIT 1`.
- 이벤트/촉매 분석 시 반드시 양방향(직전 + 다음)을 모두 조회하여 "직전 어닝 서프라이즈가 아직 유효한지"와 "다음 어닝 기대감이 추가 촉매인지"를 함께 판단한다.

### calendar_financial_series (실적 시계열)
- `SELECT * FROM calendar_financial_series WHERE ticker=? AND period_type='quarter' ORDER BY report_date DESC`
- 과거 실적 대비 서프라이즈 판단에 활용.

### news_change_metrics / `/api/news` (뉴스 파생 가격 반응, HV, z-score)
- 기본 저장소는 `news_change_metrics` 테이블이고, `GET /api/news`, `GET /api/news/:id`는 이를 JOIN한 snake_case field를 함께 반환한다.
- `reference_date`, `target_date`, `forward_trading_days`는 저장된 metric window를 검증하는 보조 필드다. `event_date ≠ published_at`인 경우, 이 값들과 `published_at`을 함께 보고 현재 row metric이 이벤트 첫 반응인지 후속 기사 반응인지 확인한다.
- page 작성 시에는 **가능한 한 change/HV/z-score를 같은 줄 또는 같은 표에서 나란히** 적는다. `change만 적고 HV/z-score는 본문 다른 곳에 흩어두는 방식`은 최신 기준과 맞지 않는다.
- base change metric key:
   - `change_pct`
   - `change_from_open_pct`
   - `change_open_to_high_pct`
   - `change_1d_pct`
   - `change_3d_pct`
   - `change_7d_pct`
   - `change_14d_pct`
   - `change_30d_pct`
- HV field / metric key:
   - `hv_change_pct`
   - `hv_change_from_open_pct`
   - `hv_change_open_to_high_pct`
   - `hv_change_1d_pct`
   - `hv_change_3d_pct`
   - `hv_change_7d_pct`
   - `hv_change_14d_pct`
   - `hv_change_30d_pct`
- Z-score field / metric key:
   - `zscore_change_pct`
   - `zscore_change_from_open_pct`
   - `zscore_change_open_to_high_pct`
   - `zscore_change_1d_pct`
   - `zscore_change_3d_pct`
   - `zscore_change_7d_pct`
   - `zscore_change_14d_pct`
   - `zscore_change_30d_pct`
- 직접 조회 예시:
   ```sql
   SELECT news_id, metric_key, value_pct
   FROM news_change_metrics
   WHERE news_id = ?
      AND metric_key IN ('change_pct', 'change_7d_pct', 'hv_change_pct', 'zscore_change_pct', 'zscore_change_7d_pct')
   ORDER BY metric_key
   ```
- 해석 규칙:
   - `change_*`: 절대 반응 크기.
   - `hv_*`: 해당 change 정의와 같은 historical series의 비연율화 sigma.
   - `zscore_* = actual_change / hv_*`: HV 대비 초과반응 강도. unitless.
   - 바스켓 종목 간 "누가 평소 변동성 대비 더 강했는가" 비교에는 `zscore_*`를 우선 참고한다.
   - 단, **최종 서술은 change/HV/z-score를 함께** 본다. `zscore만 높다`, `change만 컸다`처럼 하나만 떼어 결론내리지 않는다.

### ohlc_1d (OHLC DB - 별도 SQLite)
- 경로: `OHLC_data/ohlc_1d_watchlist.sqlite`
- **기본 조회 (전체 change 포함)**:
  ```sql
  SELECT Datetime, Open, High, Low, Close, Volume,
         Change_1d_Pct, Change_From_Open_Pct,
         Change_7d_Pct, Change_14d_Pct, Change_30d_Pct,
         Turnover
  FROM ohlc_1d
  WHERE Symbol = ? AND Datetime BETWEEN ? AND ?
  ORDER BY Datetime
  ```
- 각 컬럼 의미:
  - `Change_1d_Pct`: 전일 종가 대비 당일 종가 등락률 (%).
  - `Change_From_Open_Pct`: 당일 시가 대비 종가 등락률 (%). 양수면 장중 상승 마감.
  - `Change_7d_Pct`: 7 거래일 전 종가 대비 등락률 (%). 1주 누적.
  - `Change_14d_Pct`: 14 거래일 전 종가 대비 등락률 (%). 2주 누적.
  - `Change_30d_Pct`: 30 거래일 전 종가 대비 등락률 (%). 1개월 누적.
  - `Turnover`: 거래대금 (Close × Volume). 유동성/자금 유입 지표.
- `Change_1d_Pct`가 NULL인 경우 수동 계산: `(Close / prev_Close - 1) * 100`.
- **분석 시 반드시 전체 change 컬럼을 사용한다.** `Change_1d_Pct`만 단독으로 사용하는 것은 불충분하다.
- `ohlc_1d` 자체에는 `hv_*`, `zscore_*` 컬럼이 없다. HV / z-score는 `news_change_metrics` 또는 `/api/news` 응답에서 가져온다.

### company_profiles (기업 컨텍스트)
- `company_profiles` 테이블 자체에는 `ticker` 컬럼이 없다. `securities`와 `security_id`로 JOIN해서 조회한다.
- 예시:
   ```sql
   SELECT cp.*, s.ticker, s.industry, s.sector
   FROM company_profiles cp
   JOIN securities s ON s.id = cp.security_id
   WHERE s.ticker = ?
   ORDER BY cp.fetched_at DESC, cp.id DESC
   ```
- 시총, float, institutional_pct, insider_pct, description, industry, sector, ipo_date를 본다.
- `company_profiles`는 source별 다중 row이며 컬럼이 sparse할 수 있으므로, ownership table 작성 시에는 **필드별 latest non-null merge**가 필요할 수 있다.
- `GET /api/tickers` 엔드포인트로도 조회 가능하다.

---

## 순환매(로테이션) 분석 규칙

- 확산 타임라인 내에서 **어떤 종목이 먼저 반응하고, 어떤 종목이 나중에 따라가는지** 패턴을 식별한다.
- 일반적 순환매 패턴:
  1. **대형캡 선도**: 이슈 직접 당사자(대형캡)가 먼저 반응 → 소형캡이 read-through로 따라감.
  2. **소형캡 선도**: 소형캡이 speculative 선반응 → 대형캡이 어닝/딜로 확인.
  3. **동시 반응**: 바스켓 전체가 같은 날 동시 급등.
- 각 파동에서 **선도 종목**과 **추종 종목**을 명시하고, 그 순서가 시총/유동성/직접성과 어떻게 관련되는지 설명한다.

---

## 비교 가능 사례 (comparable) 분석 규칙

### 동일 티커 비교 (same-ticker comparable)
- 같은 종목이 과거에 유사한 이슈로 급등/급락한 사례를 조사한다.
- 조사 범위: 최소 1년 소급.
- 비교 항목: 촉매 성격, **전체 change 컬럼** (`1d`, `From_Open`, `7d`, `14d`, `30d`, `Turnover`), **대응 z-score**, 지속 기간, 후속 어닝에서의 확인 여부.
- 7d/14d/30d 비교를 통해 "과거 사례는 1주 만에 되돌렸지만 이번에는 30d까지 유지" 같은 지속성 비교가 가능하고, z-score 비교를 통해 "이번 반응이 과거보다 HV 대비 더 강했는지"를 판단할 수 있다.

### 교차 티커 비교 (cross-ticker comparable)
- 다른 이슈 티어에서 유사한 패턴(대형 계약 발표 → 밸류체인 확산 등)을 보인 사례를 조사한다.
- 비교 항목: 이슈 성격, 바스켓 크기, 확산 속도, 티어 판정 결과, **전체 change 컬럼 비교**, **z-score 비교** (특히 어느 종목/파동이 HV 대비 더 비정상적이었는지).

---

## 데이터 소스 귀속 (attribution) 규칙 (필수)

- 모든 팩트(날짜, headline, 등락률, 어닝 수치)에는 **데이터 소스를 명시**한다.
- 허용되는 소스 태그: `company_news`, `fmp_pr`, `fmp_sec`, `calendar_events`, `ohlc_1d`, `news_change_metrics`, `investing`, `company_profiles`, `sec_10k`, `sec_s1`, `sec_def14a`, `sec_8k`, `sec_form4`, `sec_10q`, `sec_424b5`, `sec_edgar_web`, `sedar_plus_web`, `issuer_ir`, `issuer_ir_web`, `issuer_history_web`, `archived_pr_web`, `macrotrends`, `companiesmarketcap`, `gurufocus`, `insidertrades`, `fintel`, `simplywallst`, `corpgov_harvard`, `stocktitan`.
- 소스가 불명확한 정보는 `(출처 미확인)` 태그를 붙이고, 가능하면 DB 쿼리로 검증한다.
- headline은 DB에서 읽은 원문 그대로 적는다. 요약/의역하지 않는다.

---

## 금지 규칙

1. **가격 반응 없이 정당성 판정 금지**: change/HV/z-score 데이터 없이 "주가 영향이 있었다/없었다"를 판단하지 않는다.
2. **선행 이슈 생략 금지**: 메인 촉매 이전의 선행 이슈를 조사하지 않고 바로 메인 촉매부터 시작하지 않는다.
3. **바스켓 종목 임의 추가/제거 금지**: 1단계에서 확정한 관련주를 분석 도중에 설명 없이 바꾸지 않는다. 추가/제거 시 근거를 명시한다.
4. **어닝 날짜 누락 금지**: 확산 타임라인의 각 이벤트에서 직전 어닝과 다음 어닝 날짜를 모두 조회하지 않으면 미완료로 간주한다.
5. **티어 판정 근거 생략 금지**: 티어를 부여할 때 판정 조건(파동 횟수, 지속 기간, 개별 확인 이벤트)을 명시하지 않으면 미완료로 간주한다.
6. **축약 금지**: `Model_100`은 `ai-news-research.md`의 축약 금지 / 미완료 판정 규칙을 동일하게 적용한다.
7. **이벤트 날짜 / 기사 날짜 혼동 금지**: 후속 기사의 published_at 기준 change를 이벤트 첫 반응으로 기록하지 않는다. event_date ≠ published_at인 경우 반드시 event_date, published_at, change_anchor를 구분 표기한다. 날짜를 1개만 쓰면서 "이 날 +8% 반응"처럼 적으면, 그것이 이벤트 반응인지 후속 기사 반응인지 알 수 없으므로 미완료로 간주한다.
8. **오너십 아래에서 선행 이슈부터 시작 금지**: `## 오너십 데이터` 아래에 핵심 분석이슈 anchor를 먼저 고정하지 않고 곧바로 관련이슈/선행이슈부터 길게 전개하면 최신 Model_100 기준과 맞지 않는다.
9. **당일 change만으로 파동 판정 금지**: `change_pct` 또는 장중 등락만 보고 파동/실패/지속형을 판단하지 않는다. 최소 `same-day`, `from-open`, `1d`, `7d`, `14d`, `30d`의 change/HV/z-score를 함께 보고, 값이 없으면 그 부재를 명시해야 한다.
10. **관련성 정도 등급 누락 금지**: `## 관련주 정리`에서 각 티커의 `관련성 정도 등급`을 적지 않으면 미완료로 간주한다. 단순히 `직접 수혜/간접 수혜/peer`만 적고 끝내면 최신 Model_100 기준과 맞지 않는다.
11. **스코프 혼동 금지**: anchor 날짜 page인데 실제로는 issue-cycle 누적 강도를 쓰고 있다면, 이를 숨긴 채 `단일 이벤트 자체가 1 tier`처럼 서술하지 않는다. 스코프를 명시하지 못하면 기본적으로 anchor event의 direct surprise quality 기준으로 보수 판정한다.
12. **기존 이슈 반복 과대평가 금지**: 이미 알려진 고객 관계, 기존 계약의 증액/확대, 반복 headline만으로 breadth가 생겼다고 해서 자동으로 `1 tier`를 주지 않는다. 핵심 티커 direct z-score와 신규성 확인이 약하면 `2 tier` 우선 검토가 기본이다.
13. **Governance / dilution audit 생략 금지**: `Model_100` 기본 요청에서 `## 오너십 데이터`를 ownership 숫자만 적고 끝내면 미완료로 간주한다. 최소한 share structure, founder/CEO, insider ownership, 5년 dilution, capital raise, Form 4, red flag checklist가 보여야 한다.
14. **희석 capacity 숫자 없는 서술 금지**: `authorized shares 많다`, `희석 우려 있다`처럼 숫자 없는 인상비평으로 끝내지 않는다. 가능하면 `authorized vs outstanding` gap과 3년/5년 dilution 수치를 같이 적는다.
15. **Founder/manager 분류 뭉개기 금지**: founder가 아닌 professional manager를 `창업자형 리더십`처럼 모호하게 쓰지 않는다. `True founder / Co-founder / Professional manager` 중 하나로 명시한다.
16. **구조 리스크와 실제 행보 혼동 금지**: perpetual dual-class, blank check preferred, shelf/ATM capacity 같은 구조적 장치와, 실제로 그것을 얼마나 공격적으로 사용했는지는 분리해서 서술한다.
17. **Programmatic selling 단정 금지**: `10b5-1` 여부를 filing이나 Form 4 footnote로 확인하지 못했으면 programmatic selling으로 단정하지 않는다. 확인 불가 상태를 명시한다.
18. **오퍼링 핵심 수치 누락 금지**: 조달 이벤트를 언급하면서 `종류만` 적고 `날짜 / offer price / 당시 시총 대비 비중`을 빼면 미완료로 간주한다. 최소한 `offering date`, `offering type`, `offer price/share`, `market cap at pricing`, `offering % of market cap`는 확보를 시도하고, 불가하면 어떤 값이 왜 비어 있는지 적는다.
19. **DB 부재를 이유로 governance 조사 중단 금지**: ownership/governance 관련 값이 `company_profiles`나 app DB에 없더라도, SEC EDGAR / issuer IR 웹 원문 확인으로 계속 조사해야 한다. `DB에 없음`만 적고 멈추면 미완료로 간주한다.
