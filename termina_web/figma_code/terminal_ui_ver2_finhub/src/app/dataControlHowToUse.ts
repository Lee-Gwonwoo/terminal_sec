import type { DataControlHowToUseWindowData } from './types';

export type DataControlHowToUseKey =
  | 'price'
  | 'fmpRecentOhlc'
  | 'turnover'
  | 'calendarBackfill'
  | 'calendarRefresh'
  | 'calendarCustom'
  | 'companyDesc'
  | 'yahooDesc'
  | 'peersPull'
  | 'ipoDate'
  | 'ipoPricing'
  | 'recent'
  | 'fmpRecentChange'
  | 'custom';

export const dataControlHowToUseRegistry: Record<DataControlHowToUseKey, DataControlHowToUseWindowData> = {
  price: {
    key: 'price',
    title: 'OHLC 1D Price Update',
    summary: 'default ticker universe 기준으로 1일봉 가격 데이터를 최신 날짜까지 갱신합니다.',
    purpose: '뉴스 change 계산과 각종 후속 분석이 참조하는 가격 DB를 먼저 채우는 버튼입니다.',
    whenToRun: [
      '초기 세팅 직후 OHLC DB가 비어 있을 때 실행합니다.',
      '최근 뉴스의 change% 계산 전에 가격 DB 최신화가 필요할 때 실행합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다. default ticker universe 전체가 대상입니다.',
      'DB Max Date를 보고 최신 날짜와 차이가 큰지 먼저 확인합니다.',
    ],
    cautions: [
      '대상 ticker 수가 많으면 시간이 걸릴 수 있습니다.',
      '가격 DB가 비정상이면 후속 Change Update 결과도 같이 흔들립니다.',
    ],
    verify: [
      '완료 후 DB Max Date가 최신 거래일로 올라왔는지 확인합니다.',
      'Log에서 updated/failed ticker 수를 확인합니다.',
    ],
    route: '/api/ibkr/ohlc1d/update',
  },
  fmpRecentOhlc: {
    key: 'fmpRecentOhlc',
    title: 'FMP Recent OHLC Fill',
    summary: 'default ticker universe 기준으로 최근 구간의 누락 일봉만 FMP EOD API로 메웁니다.',
    purpose: 'IBKR 전체 가격 업데이트를 돌리지 않고도 최근 뉴스/분석에 필요한 누락 일봉 tail만 빠르게 보수하는 버튼입니다.',
    whenToRun: [
      '최근 뉴스 change 계산 전에 일부 ticker만 최신 일봉이 비어 있을 때 실행합니다.',
      'OHLC DB 전체 백필은 이미 되어 있고 최근 며칠 tail만 보수하고 싶을 때 적합합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다. 최근 7일 윈도우를 기준으로 default ticker universe 전체를 검사합니다.',
      '각 ticker는 현재 DB max date 다음 날부터만 요청하므로 이미 있는 row는 다시 받지 않습니다.',
    ],
    cautions: [
      'ET 장 마감 전에는 당일 bar를 받지 않도록 자동 제외합니다.',
      '최근 누락분 보수 전용이므로 과거 장기 공백을 메우는 용도는 아닙니다.',
    ],
    verify: [
      'Log에서 range, tickersFetched, totalRowsUpserted를 확인합니다.',
      '완료 후 DB Max Date 또는 개별 ticker 최근 일봉이 채워졌는지 확인합니다.',
    ],
    route: '/api/fmp/ohlc1d/update-recent-missing',
  },
  turnover: {
    key: 'turnover',
    title: 'OHLC Turnover Update',
    summary: 'default ticker universe 기준으로 OHLC 일봉의 빈 Turnover 값을 계산해 채웁니다.',
    purpose: 'Daily Change History Window에서 turnover filter와 turnover column을 안정적으로 쓰기 위한 백필 버튼입니다.',
    whenToRun: [
      'Daily Change History에서 turnover 값이 많이 비어 있을 때 실행합니다.',
      'OHLC 1D Price Update로 새 일봉을 적재한 뒤 과거 누락 turnover를 한 번 채우고 싶을 때 실행합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다. default ticker universe 전체가 대상입니다.',
      '이미 Turnover 값이 있는 row는 자동으로 skip합니다.',
    ],
    cautions: [
      'Open, Close, Volume 중 하나라도 비어 있으면 그 row는 계산하지 못하고 uncomputable로 남습니다.',
      'OHLC 1D Price Update와 동시에 돌릴 필요는 없습니다. 먼저 가격 적재를 끝내는 편이 안전합니다.',
    ],
    verify: [
      'Log에서 ticker별 updated / existing / uncomputable 수를 확인합니다.',
      '실행 후 Daily Change History에서 turnover filter를 넣었을 때 결과가 늘어나는지 확인합니다.',
    ],
    route: '/api/ibkr/ohlc1d/turnover/update',
  },
  calendarBackfill: {
    key: 'calendarBackfill',
    title: 'Initial Calendar Backfill',
    summary: '과거 2년 + 미래 180일 범위를 한 번에 적재하는 초기 캘린더 적재 버튼입니다.',
    purpose: 'calendar_events 테이블을 처음 채우거나 mock 데이터를 실데이터로 교체할 때 사용합니다.',
    whenToRun: [
      '캘린더 DB를 처음 세팅할 때 실행합니다.',
      '장기간 빈 구간이 있는 상태를 한 번에 메우고 싶을 때 실행합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다.',
      'default ticker universe 전체가 자동 대상입니다.',
    ],
    cautions: [
      '범위가 가장 넓어서 refresh/custom보다 오래 걸릴 수 있습니다.',
      'IBKR/TWS 연결 상태가 불안정하면 실패할 수 있습니다.',
    ],
    verify: [
      'Log에서 upserted 수와 에러 여부를 확인합니다.',
      'Calendar 창에서 과거/미래 이벤트가 모두 보이는지 확인합니다.',
    ],
    route: '/api/ibkr/calendar/update',
  },
  calendarRefresh: {
    key: 'calendarRefresh',
    title: 'Refresh Upcoming Calendar',
    summary: '최근 30일 overlap + 앞으로 90일 범위만 가볍게 새로 고칩니다.',
    purpose: '매일 운영 중 upcoming 일정만 자주 갱신하는 용도입니다.',
    whenToRun: [
      '정규 운영 중 캘린더를 빠르게 최신화할 때 실행합니다.',
      '전체 backfill은 이미 끝난 상태에서 최근/미래 일정만 갱신할 때 적합합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다.',
      'default ticker universe 전체가 대상입니다.',
    ],
    cautions: [
      '오래 비어 있던 과거 구간을 메우는 용도는 아닙니다.',
      'calendar backfill을 아직 안 돌린 상태라면 범위가 부족할 수 있습니다.',
    ],
    verify: [
      'Log에서 완료 여부를 확인합니다.',
      'Calendar 창에서 가까운 미래 일정이 최신 상태인지 확인합니다.',
    ],
    route: '/api/ibkr/calendar/update',
  },
  calendarCustom: {
    key: 'calendarCustom',
    title: 'Custom Calendar Update',
    summary: '사용자가 지정한 날짜 구간으로 캘린더 이벤트를 재수집합니다.',
    purpose: '특정 earnings season, 특정 월, 특정 누락 구간만 다시 메우는 용도입니다.',
    whenToRun: [
      '특정 날짜 범위만 다시 받고 싶을 때 실행합니다.',
      'preflight로 대상 범위를 확인한 뒤 좁은 구간만 선택해서 실행하는 것이 좋습니다.',
    ],
    inputs: [
      'From/To를 YYYY-MM-DD로 입력합니다.',
      '대상은 default ticker universe 전체입니다.',
    ],
    cautions: [
      '범위를 너무 넓게 잡으면 사실상 backfill과 비슷하게 오래 걸릴 수 있습니다.',
      'IBKR 응답 지연이 있으면 완료까지 시간이 걸릴 수 있습니다.',
    ],
    verify: [
      'preflight에서 totalTickers, existingEventsInRange를 먼저 확인합니다.',
      '실행 후 Log/result summary에서 fetchedEvents와 upserted를 확인합니다.',
    ],
    route: '/api/ibkr/calendar/update-custom',
  },
  companyDesc: {
    key: 'companyDesc',
    title: 'Company Description Update',
    summary: 'FMP 회사 설명을 default ticker universe 기준으로 일괄 수집합니다.',
    purpose: 'company profile 설명 컬럼을 채워서 뉴스/종목 탐색 시 기본 설명을 보여주기 위한 버튼입니다.',
    whenToRun: [
      '새 ticker를 universe에 추가한 뒤 설명이 비어 있을 때 실행합니다.',
      '설명 데이터의 누락분만 채우고 싶으면 Skip Existing 모드를 유지합니다.',
    ],
    inputs: [
      'Concurrency / Request Interval / Skip Existing 설정을 Settings 탭에서 조절합니다.',
      'Overwrite All은 기존 설명도 다시 덮어씁니다.',
    ],
    cautions: [
      'Overwrite All은 API 호출량이 크게 늘어날 수 있습니다.',
      'default universe가 잘못 구성돼 있으면 불필요한 ticker까지 같이 돌게 됩니다.',
    ],
    verify: [
      '완료 후 관련 company profile 필드가 채워졌는지 확인합니다.',
      'Log에서 requested/updated/failed ticker 수를 확인합니다.',
    ],
    route: '/api/company-profiles/pull-fmp',
  },
  yahooDesc: {
    key: 'yahooDesc',
    title: 'Yahoo Description Update',
    summary: 'Yahoo Finance 회사 설명을 default ticker universe 기준으로 일괄 수집합니다.',
    purpose: 'FMP와 별도로 Yahoo 설명 소스를 보완하거나 비교하기 위한 버튼입니다.',
    whenToRun: [
      'Yahoo 설명이 비어 있는 ticker를 채우고 싶을 때 실행합니다.',
      'Yahoo 쪽 설명 품질을 점검하거나 FMP와 비교할 때 사용합니다.',
    ],
    inputs: [
      'Concurrency / Request Interval / Skip Existing 설정을 먼저 확인합니다.',
      '비공식 소스 특성상 interval을 너무 낮추지 않는 편이 안전합니다.',
    ],
    cautions: [
      'request interval을 과도하게 낮추면 차단 위험이 있습니다.',
      'Overwrite All은 오래 걸리고 기존 설명을 다시 쓸 수 있습니다.',
    ],
    verify: [
      '완료 후 Yahoo 설명 필드가 채워졌는지 확인합니다.',
      'Log에서 업데이트/실패 ticker 수를 확인합니다.',
    ],
    route: '/api/company-profiles/pull-yahoo',
  },
  peersPull: {
    key: 'peersPull',
    title: 'Peers Data Update',
    summary: 'Finnhub peers 데이터를 기준으로 관련 종목 목록을 수집합니다.',
    purpose: '연관 종목 탐색이나 후속 분석에 사용할 peer set을 채우기 위한 버튼입니다.',
    whenToRun: [
      'default universe 변경 후 peers가 비어 있을 때 실행합니다.',
      '관련 종목 데이터가 오래됐다고 판단될 때 재수집합니다.',
    ],
    inputs: [
      'Skip Existing이면 이미 채워진 ticker는 건너뜁니다.',
      '대상은 default ticker universe 전체입니다.',
    ],
    cautions: [
      'Overwrite All은 peer set 전체를 다시 가져옵니다.',
      'source API 응답 품질에 따라 종목 품질이 달라질 수 있습니다.',
    ],
    verify: [
      '완료 후 peer 컬럼/관련 UI가 채워졌는지 확인합니다.',
      'Log에서 requested/updated/failed 수를 확인합니다.',
    ],
    route: '/api/company-profiles/pull-peers',
  },
  ipoDate: {
    key: 'ipoDate',
    title: 'IPO Date Update',
    summary: 'Finnhub profile2 기준 IPO date를 수집합니다.',
    purpose: '신규 상장 시점, 상장 연차 등을 참조하는 분석용 기초 필드를 채우기 위한 버튼입니다.',
    whenToRun: [
      '새 ticker를 추가했는데 IPO date가 비어 있을 때 실행합니다.',
      '회사 기본 정보 보강 작업을 할 때 peers/company description과 같이 돌릴 수 있습니다.',
    ],
    inputs: [
      'Skip Existing 설정을 확인합니다.',
      'default ticker universe 전체가 대상입니다.',
    ],
    cautions: [
      'Overwrite All은 이미 있는 값도 다시 씁니다.',
      'provider 값이 비어 있는 ticker는 실패 또는 skip될 수 있습니다.',
    ],
    verify: [
      '완료 후 IPO date 필드가 채워졌는지 확인합니다.',
      'Log에서 updated/failed ticker 수를 확인합니다.',
    ],
    route: '/api/company-profiles/pull-ipo-date',
  },
  ipoPricing: {
    key: 'ipoPricing',
    title: 'IPO Pricing Update',
    summary: 'FMP IPO calendar/prospectus 기준으로 IPO price range와 확정 공모가를 수집합니다.',
    purpose: 'Default Ticker의 IPO Price / Price Range 컬럼을 채워 신규 상장 종목의 공모 조건을 비교하기 위한 버튼입니다.',
    whenToRun: [
      'IPO date가 이미 채워진 ticker에 공모가 또는 price range가 비어 있을 때 실행합니다.',
      '새 IPO 종목을 default universe에 추가한 뒤 IPO Date Update를 먼저 실행하고 이어서 실행합니다.',
    ],
    inputs: [
      'Skip Existing 설정을 확인합니다. 기본값은 이미 IPO Price와 Price Range가 모두 있는 ticker를 건너뜁니다.',
      '대상은 default ticker universe 전체이며, IPO date가 없는 ticker는 자동으로 건너뜁니다.',
    ],
    cautions: [
      'FMP가 해당 IPO의 prospectus 가격을 구조화해서 제공하지 않으면 확정 공모가는 빈 칸으로 남습니다.',
      'Price Range는 FMP IPO calendar의 priceRange, IPO Price는 FMP IPO prospectus의 pricePublicPerShare 기준입니다.',
    ],
    verify: [
      '완료 후 Default Ticker에서 IPO Price / Price Range 컬럼이 채워졌는지 확인합니다.',
      'Log에서 updated, missingPricing, skippedExisting 수를 확인합니다.',
    ],
    route: '/api/company-profiles/pull-ipo-pricing',
  },
  recent: {
    key: 'recent',
    title: 'Recent Change% Update',
    summary: '최근 7일 뉴스에 대해 change metrics를 재계산하고, HV/Z Score는 missing row/metric만 추가로 채웁니다.',
    purpose: '일상 운영에서 최근 뉴스의 change%를 최신화하면서, 아직 비어 있는 HV/Z Score 컬럼도 함께 보강하는 버튼입니다.',
    whenToRun: [
      '최근 뉴스 change%가 비어 있거나 stale하다고 판단될 때 실행합니다.',
      'OHLC DB를 먼저 최신화한 뒤 실행하는 편이 안전합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다. 최근 7일 고정 범위입니다.',
      '필요 OHLC가 없으면 fallback으로 추가 조회가 발생할 수 있습니다.',
    ],
    cautions: [
      '이 버튼은 custom 누락 구간 보정용이 아니라 최근 운영용입니다.',
      'HV/Z Score는 missing-only fill이라 이미 저장된 non-null 값은 덮어쓰지 않습니다.',
      'OHLC가 많이 비어 있으면 fallback 때문에 느려질 수 있습니다.',
    ],
    verify: [
      '완료 후 merged/skipped 또는 update summary를 확인합니다.',
      '뉴스 리스트에서 최근 기사 change%가 채워졌는지 확인합니다.',
      'HV/Z Score 컬럼을 켰을 때 비어 있던 칸이 채워졌는지 확인합니다.',
    ],
    route: '/api/news/change/update-recent',
  },
  fmpRecentChange: {
    key: 'fmpRecentChange',
    title: 'FMP Recent Missing Change Fill',
    summary: '최근 7일 뉴스 중 change_pct가 비어 있는 row만 다시 계산하고, 필요한 OHLC는 FMP로 보강합니다.',
    purpose: '이미 계산된 change는 건드리지 않고 최근 누락분만 빠르게 메우기 위한 버튼입니다.',
    whenToRun: [
      '최근 뉴스 목록에서 일부 종목만 change%가 비어 있을 때 실행합니다.',
      'FMP recent OHLC fill 직후 누락 change만 이어서 계산하고 싶을 때 사용합니다.',
    ],
    inputs: [
      '별도 날짜 입력은 없습니다. 최근 7일 뉴스가 대상입니다.',
      'Change Update FMP Concurrency 설정이 FMP OHLC fallback 병렬도에 적용됩니다.',
    ],
    cautions: [
      '이미 change_pct가 있는 row는 skip하므로 전체 재계산 용도가 아닙니다.',
      'ET 장 마감 전에는 당일 일봉이 확정되지 않아 일부 same-day 뉴스는 계속 skip될 수 있습니다.',
    ],
    verify: [
      'Log에서 updated / skipped 수와 FMP fallback 메시지를 확인합니다.',
      'Recent 뉴스 목록에서 비어 있던 change% row가 채워졌는지 확인합니다.',
    ],
    route: '/api/news/change/update-recent-fmp-missing',
  },
  custom: {
    key: 'custom',
    title: 'Custom Change% Update',
    summary: '사용자 지정 날짜 범위 뉴스에 대해 change metrics를 다시 계산하고, HV/Z Score는 missing row/metric만 채웁니다.',
    purpose: '특정 기간 뉴스의 change%를 다시 계산하면서, 아직 비어 있는 HV/Z Score 칸만 추가 보강하는 버튼입니다.',
    whenToRun: [
      '특정 구간의 뉴스 change%만 다시 계산하고 싶을 때 실행합니다.',
      'preflight에서 totalRowsInRange / rowsExpectedToUpdate를 먼저 보고 범위를 조정하는 것이 좋습니다.',
    ],
    inputs: [
      'From/To를 YYYY-MM-DD로 입력합니다.',
      '필요 OHLC가 없으면 FMP fallback이 동작할 수 있습니다.',
    ],
    cautions: [
      '범위를 넓게 잡으면 처리 대상 rows가 급격히 늘 수 있습니다.',
      'HV/Z Score는 missing-only fill이라 이미 계산된 non-null 값은 그대로 유지됩니다.',
      '이미 계산된 row가 많으면 실제 updated보다 scanned rows가 훨씬 클 수 있습니다.',
    ],
    verify: [
      'preflight에서 rowsExpectedToUpdate를 먼저 확인합니다.',
      '실행 후 Log/result summary에서 rowsUpdated, rowsSkipped를 확인합니다.',
      'HV/Z Score 컬럼을 켰을 때 range 안의 빈 derived 칸이 채워졌는지 확인합니다.',
    ],
    route: '/api/news/change/update-custom',
  },
};