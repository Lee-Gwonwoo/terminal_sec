import type { DataControlHowToUseWindowData } from './types';

export type DataControlHowToUseKey =
  | 'price'
  | 'calendarBackfill'
  | 'calendarRefresh'
  | 'calendarCustom'
  | 'companyDesc'
  | 'yahooDesc'
  | 'peersPull'
  | 'ipoDate'
  | 'recent'
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
  recent: {
    key: 'recent',
    title: 'Recent Change% Update',
    summary: '최근 7일 뉴스에 대해 change metrics를 재계산합니다.',
    purpose: '일상 운영에서 최근 뉴스의 change% 컬럼만 빠르게 최신화하는 버튼입니다.',
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
      'OHLC가 많이 비어 있으면 fallback 때문에 느려질 수 있습니다.',
    ],
    verify: [
      '완료 후 merged/skipped 또는 update summary를 확인합니다.',
      '뉴스 리스트에서 최근 기사 change%가 채워졌는지 확인합니다.',
    ],
    route: '/api/news/change/update-recent',
  },
  custom: {
    key: 'custom',
    title: 'Custom Change% Update',
    summary: '사용자 지정 날짜 범위 뉴스에 대해 change metrics를 다시 계산합니다.',
    purpose: '특정 기간 뉴스만 골라 change% 누락분을 보정하거나 과거 범위를 다시 계산하는 버튼입니다.',
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
      '이미 계산된 row가 많으면 실제 updated보다 scanned rows가 훨씬 클 수 있습니다.',
    ],
    verify: [
      'preflight에서 rowsExpectedToUpdate를 먼저 확인합니다.',
      '실행 후 Log/result summary에서 rowsUpdated, rowsSkipped를 확인합니다.',
    ],
    route: '/api/news/change/update-custom',
  },
};