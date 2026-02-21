# 벤징가(Benzinga) 스타일 주식·뉴스 플랫폼 구축 프롬프트

## 프로젝트 개요
벤징가(Benzinga) 및 TradingView와 유사한 전문적인 주식·뉴스 플랫폼 웹 애플리케이션을 구축합니다. 다중 탭 시스템과 드래그 & 리사이즈 가능한 윈도우를 제공하며, 각 윈도우 간 연동 기능을 갖춘 현대적인 트레이딩 플랫폼입니다.

## 기술 스택
- **프레임워크**: React 18.3.1 + TypeScript
- **스타일링**: Tailwind CSS v4
- **UI 라이브러리**: Material-UI (@mui/material 7.3.5)
- **상태 관리**: React Hooks (useState, useEffect, useMemo)
- **주요 라이브러리**:
  - `react-dnd` + `react-dnd-html5-backend`: 드래그 앤 드롭
  - `re-resizable`: 윈도우 리사이즈
  - `react-datepicker`: 날짜 선택
  - `lucide-react`: 아이콘

## 핵심 기능 요구사항

### 1. 다중 탭 시스템
- **탭 생성/관리**:
  - "+" 버튼으로 새 탭 추가
  - 탭 생성 시 모달에서 포함할 윈도우 타입 선택 (News, Watchlist, Calendar)
  - 탭 이름은 우클릭(Context Menu)으로 수정 가능
  - 탭 닫기 (최소 1개 탭은 유지)
  - 탭 전환 시 각 탭의 윈도우 상태 독립적으로 유지

- **탭 레이아웃**:
  - 1개 윈도우: 중앙에 크게 배치 (800×600)
  - 2개 윈도우: 좌우 분할 배치 (각 600×600)
  - 3개 이상: 계단식(staggered) 배치 (40px씩 오프셋)

### 2. 드래그 & 리사이즈 가능한 윈도우 (DraggableWindow)
- **드래그 기능**:
  - 윈도우 헤더를 드래그하여 자유롭게 이동
  - 화면 경계를 벗어나지 않도록 제한
  - 드래그 중 투명도 조절로 시각적 피드백

- **리사이즈 기능**:
  - `re-resizable` 라이브러리 사용
  - 8방향 리사이즈 핸들 (top, right, bottom, left, topRight, bottomRight, bottomLeft, topLeft)
  - 최소 크기: 400×300
  - 최대 크기: 화면 크기 - 100 (좌우/상하 여백)

- **윈도우 헤더**:
  - 타이틀 표시
  - 닫기 버튼 (X)
  - 드래그 핸들 영역

### 3. 뉴스 윈도우 (NewsWindow)
- **불리언 검색 (Boolean Search)**:
  - AND 연산자: 공백 또는 명시적 "AND"
  - OR 연산자: "OR" 키워드
  - 예시: "TSLA OR Tesla", "Apple AND earnings"
  - 대소문자 구분 없이 검색

- **필터링 시스템**:
  - **날짜 범위**: DatePicker로 From/To 날짜 선택
  - **시가총액**: Large Cap, Mid Cap, Small Cap 다중 선택
  - **뉴스 소스**: Bloomberg, Reuters, CNBC 등 다중 선택
  - **섹터**: Technology, Finance, Healthcare 등 다중 선택
  - 필터 적용 시 배지로 표시, 개별 또는 일괄 제거 가능

- **검색 설정 저장/불러오기**:
  - 현재 검색어 + 필터 조합을 이름을 붙여 저장
  - 저장된 검색 목록에서 선택하여 즉시 적용
  - 저장된 검색 삭제 기능
  - localStorage에 영구 저장

- **뉴스 리스트**:
  - 시간, 티커(클릭 가능), 제목, 출처 표시
  - 티커 클릭 시 연동된 윈도우에 전파 (linkId 기반)
  - 뉴스 아이템 클릭 시 상세 내용 확장
  - 호버 효과 및 선택 상태 시각화

### 4. 워치리스트 윈도우 (WatchlistWindow)
- **종목 리스트**:
  - 티커, 회사명, 현재가, 변동금액, 변동률 표시
  - 상승/하락에 따른 색상 표시 (초록/빨강)
  - 티커 클릭 시 연동된 뉴스 윈도우에 자동 검색

- **검색 및 추가**:
  - 상단 검색창으로 새 종목 검색
  - 검색 결과에서 종목 추가
  - 종목 삭제 기능

- **정렬 기능**:
  - 티커, 가격, 변동률 등 컬럼별 정렬
  - 오름차순/내림차순 토글

### 5. 캘린더 윈도우 (CalendarWindow) - Benzinga/TradingView 스타일
**완전히 재설계된 전문적인 캘린더 시스템**

#### 5.1 탭 구조
- **4개의 독립적인 탭**:
  1. **Earnings** (실적 발표)
  2. **Conference** (컨퍼런스)
  3. **Dividend** (배당)
  4. **Analyst Rating** (애널리스트 의견)

- 각 탭은 완전히 독립적인 컬럼 설정, 필터, 정렬 상태 유지
- 탭 전환 시 필터 자동 초기화 (선택사항)

#### 5.2 컬럼 시스템

**Earnings 탭 컬럼** (기본값):
- ✅ Date Announcement (발표 날짜) - 130px
- ✅ Time (발표 시각) - 80px
- ✅ Symbol (티커) - 80px
- ❌ Name (회사명) - 150px (기본 숨김)
- ❌ Event (이벤트명) - 200px (기본 숨김)
- ✅ Session (장 세션) - 110px
- ✅ Period (분기) - 80px
- ✅ Confirmed (확정 여부) - 90px
- ✅ EPS (주당순이익) - 80px
- ✅ Est. EPS (예상 EPS) - 90px
- ✅ Surprise % (서프라이즈) - 100px
- ✅ Revenue (매출) - 110px
- ✅ Est. Revenue (예상 매출) - 120px

**Conference 탭 컬럼** (기본값):
- ✅ Date Announcement - 130px
- ✅ Time - 80px
- ✅ Symbol - 80px
- ❌ Name - 150px (기본 숨김)
- ❌ Event - 250px (기본 숨김)
- ✅ Session - 110px
- ✅ Confirmed - 90px

**Dividend 탭 컬럼** (기본값):
- ✅ Date Announcement - 130px
- ✅ Time - 80px
- ✅ Symbol - 80px
- ❌ Name - 150px (기본 숨김)
- ❌ Event - 250px (기본 숨김)
- ✅ Session - 110px
- ✅ Confirmed - 90px

**Analyst Rating 탭 컬럼** (기본값):
- ✅ Date Announcement - 130px
- ✅ Time - 80px
- ✅ Symbol - 80px
- ❌ Name - 150px (기본 숨김)
- ❌ Event - 180px (기본 숨김)
- ✅ Analyst Firm (증권사) - 130px
- ✅ Analyst Name (애널리스트) - 130px
- ✅ Action (액션) - 110px
- ✅ Prior Rating (이전 등급) - 110px
- ✅ Rating (현재 등급) - 100px
- ✅ Prior PT (이전 목표가) - 100px
- ✅ Price Target (목표가) - 110px
- ✅ Confirmed - 90px

**용어 설명 (주석)**:
```typescript
// 'date' = Date Announcement (회사가 실제로 earnings 발표를 하는 날짜)
// 'time' = Time of Announcement (회사가 earnings 발표를 하는 시각)
// 'session' = Market Session (pre-market: 장전, market-hours: 정규장, after-market: 장후)
```

#### 5.3 컬럼 조작 기능

**컬럼 드래그 앤 드롭**:
- 각 컬럼 헤더 왼쪽에 `GripVertical` 아이콘 표시
- 컬럼 헤더를 드래그하여 순서 변경
- 드래그 중인 컬럼은 `opacity-50`으로 표시
- 드롭 시 대상 컬럼 위치에 삽입

**컬럼 리사이즈**:
- 각 컬럼 헤더 오른쪽 끝에 리사이즈 핸들 (1px 너비)
- 마우스 호버 시 파란색으로 하이라이트
- 드래그하여 컬럼 너비 조절 (최소 60px)
- 마우스다운/무브/업 이벤트로 구현

**컬럼 표시/숨김**:
- "Columns" 버튼 클릭 시 드롭다운 메뉴
- 체크박스로 각 컬럼 표시/숨김 토글
- 변경사항 즉시 적용

#### 5.4 필터링 시스템

**공통 필터**:
- **검색**: Symbol, Name, Event, Analyst 검색
- **날짜 범위**: From/To DatePicker
- **Session 필터**: Pre-market, Market-hours, After-market 다중 선택
- **Confirmed 필터**: All, Confirmed, Unconfirmed 라디오 선택

**탭별 전용 필터**:
- **Earnings**: Period 필터 (Q1, Q2, Q3, Q4, Annual)
- **Analyst Rating**: Action 필터 (Buy, Sell, Hold, Outperform 등)

**필터 UI**:
- 버튼 형태의 필터 토글
- 활성 필터는 파란색 배경 + 카운트 표시
- 클릭 시 드롭다운으로 옵션 선택
- "Reset" 버튼으로 모든 필터 일괄 초기화

#### 5.5 정렬 기능
- 모든 컬럼 헤더 클릭으로 정렬
- 1차 클릭: 오름차순 (ChevronUp 아이콘)
- 2차 클릭: 내림차순 (ChevronDown 아이콘)
- 3차 클릭: 정렬 해제
- 현재 정렬 컬럼 시각적 표시

#### 5.6 데이터 표시 및 스타일링

**값 포맷팅**:
- Date: `02/21/2026` 형식
- Confirmed: ✓ (체크마크) / ○ (원)
- Price Target: `$150` 달러 표시
- Revenue: `$1,234.5M` 백만 단위
- EPS: `1.23` 소수점 2자리
- Surprise %: `5.67%` 퍼센트 표시
- Session: `Pre Market`, `Market Hours` 등 대문자 변환

**색상 코딩**:
- **Action 배지**:
  - Buy/Outperform/Overweight: 초록색 배경
  - Sell/Underperform: 빨강색 배경
  - Hold/Neutral/Market Perform: 회색 배경
- **Surprise %**: 양수는 초록색, 음수는 빨강색
- **Confirmed**: 확정은 초록색, 미확정은 회색

**티커 클릭**:
- 티커 셀 클릭 시 연동된 뉴스 윈도우에 자동 검색
- 파란색 배지 스타일로 강조

#### 5.7 Footer
- 하단에 필터링된 결과 카운트 표시
- 예: "Showing 45 of 120 events"

### 6. 윈도우 간 연동 (Linking System)
- **linkId 개념**:
  - 각 윈도우는 `linkId`를 가짐 (기본값: 1)
  - 같은 linkId를 가진 윈도우끼리 연동
  
- **연동 동작**:
  - Watchlist에서 티커 클릭 → 같은 linkId의 News 윈도우에서 해당 티커 검색
  - Calendar에서 티커 클릭 → 같은 linkId의 News 윈도우에서 해당 티커 검색
  - 전역 상태(`linkedTicker`)로 관리

### 7. 다크모드/라이트모드
- **테마 전환**:
  - 상단 헤더에 Sun/Moon 아이콘 버튼
  - 클릭 시 `isDarkMode` 상태 토글
  - `document.documentElement`에 `dark` 클래스 추가/제거
  
- **다크모드 스타일**:
  - 배경: `bg-white dark:bg-gray-900`
  - 텍스트: `text-gray-900 dark:text-gray-100`
  - 보더: `border-gray-200 dark:border-gray-700`
  - 호버: `hover:bg-gray-100 dark:hover:bg-gray-800`
  - 모든 컴포넌트에 일관된 다크모드 스타일 적용

## 파일 구조

```
/src
  /app
    App.tsx                      # 메인 앱 컴포넌트
    types.ts                     # TypeScript 타입 정의
    mockData.ts                  # Mock 데이터
    /components
      AddTabModal.tsx            # 탭 추가 모달
      DraggableWindow.tsx        # 드래그 가능한 윈도우 래퍼
      NewsWindow.tsx             # 뉴스 윈도우
      WatchlistWindow.tsx        # 워치리스트 윈도우
      CalendarWindow.tsx         # 캘린더 윈도우 (완전 재설계)
  /styles
    index.css                    # 글로벌 스타일
    tailwind.css                 # Tailwind 설정
    theme.css                    # 테마 변수
```

## 주요 타입 정의 (types.ts)

```typescript
export type WindowType = 'news' | 'watchlist' | 'calendar';

export interface NewsItem {
  id: string;
  time: string;
  ticker: string[];
  title: string;
  source: string;
  date: string;
  content?: string;
}

export interface WatchlistItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export interface CalendarEvent {
  id: string;
  date: string;
  time: string;
  ticker: string;
  name: string;
  event: string;
  type: 'earnings' | 'dividend' | 'conference' | 'ipo' | 'analyst_rating';
  session?: 'pre-market' | 'market-hours' | 'after-market';
  period?: 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'Annual';
  confirmed?: boolean;
  analystFirm?: string;
  analystName?: string;
  action?: 'Buy' | 'Sell' | 'Hold' | 'Outperform' | 'Underperform' | 'Neutral' | 'Market Perform' | 'Overweight';
  priorRating?: string;
  rating?: string;
  priorPriceTarget?: number;
  priceTarget?: number;
  eps?: number;
  estimatedEps?: number;
  surprisePercent?: number;
  revenue?: number;
  estimatedRevenue?: number;
}

export interface WindowInstance {
  id: string;
  type: WindowType;
  title: string;
  linkId?: number;
  position?: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export interface TabData {
  id: string;
  name: string;
  windows: WindowInstance[];
}
```

## Mock 데이터 (mockData.ts)
- **뉴스 데이터**: 최소 20개 항목, 다양한 티커, 소스, 섹터
- **워치리스트 데이터**: 주요 테크 종목 (AAPL, TSLA, GOOGL 등)
- **캘린더 데이터**: 
  - Earnings: EPS, Revenue, Surprise % 포함
  - Conference: 이벤트 정보
  - Dividend: 배당 정보
  - Analyst Rating: 애널리스트, 목표가, 등급 정보
  - 각 타입별 최소 10개 이상의 다양한 데이터

## UI/UX 가이드라인

### 색상 시스템
- **Primary**: Blue-500/600 (액션 버튼, 링크)
- **Success**: Green-500/600 (상승, 긍정)
- **Danger**: Red-500/600 (하락, 부정)
- **Neutral**: Gray-500 (비활성, 보조)
- **Background (Light)**: White, Gray-50/100
- **Background (Dark)**: Gray-900/950, Gray-800

### 타이포그래피
- **헤더**: text-lg font-medium
- **본문**: text-sm
- **보조 텍스트**: text-xs text-gray-500

### 간격 및 레이아웃
- **윈도우 패딩**: px-4 py-3
- **섹션 간격**: mb-3, gap-2
- **버튼 패딩**: px-3 py-2 (small), px-4 py-2 (medium)
- **보더 반경**: rounded (4px), rounded-lg (8px)

### 애니메이션
- **전환**: transition-colors, transition-opacity
- **호버 효과**: hover:bg-gray-100, hover:scale-105
- **드래그**: cursor-move, opacity 변경

## 반응형 디자인
- 최소 화면 크기: 1280×720 (데스크톱 중심)
- 윈도우 리사이즈 시 콘텐츠 자동 조정
- 테이블 가로 스크롤 (overflow-x-auto)

## 성능 최적화
- `useMemo`로 필터링/정렬 결과 캐싱
- 컴포넌트별 상태 격리
- 불필요한 리렌더링 방지

## 접근성 (Accessibility)
- 키보드 내비게이션 지원
- 적절한 aria-label 사용
- 색상 대비 충분히 확보 (WCAG AA 기준)

## 추가 기능 제안 (향후 확장)
- [ ] 윈도우 최소화/최대화
- [ ] 레이아웃 저장/불러오기
- [ ] 실시간 데이터 연동 (WebSocket)
- [ ] 차트 윈도우 추가 (TradingView 스타일)
- [ ] 사용자 설정 저장 (Firebase/Supabase)
- [ ] CSV 내보내기
- [ ] 알림/Alert 시스템

## 구현 시 주의사항
1. **컴포넌트 분리**: 각 윈도우는 독립적인 파일로 관리
2. **타입 안정성**: 모든 props와 상태에 TypeScript 타입 명시
3. **코드 가독성**: 명확한 함수명, 적절한 주석
4. **일관성**: 네이밍 컨벤션, 스타일 패턴 통일
5. **에러 처리**: 빈 데이터, 검색 결과 없음 등 예외 상황 처리
6. **다크모드**: 모든 UI 요소에 dark: 클래스 적용

## 최종 체크리스트
- [x] 다중 탭 시스템 (생성, 수정, 삭제, 전환)
- [x] 드래그 가능한 윈도우 (react-dnd)
- [x] 리사이즈 가능한 윈도우 (re-resizable)
- [x] 뉴스 윈도우 (불리언 검색, 필터, 저장된 검색)
- [x] 워치리스트 윈도우 (정렬, 검색, 티커 클릭 연동)
- [x] 캘린더 윈도우 (4개 탭, 컬럼 드래그/리사이즈/선택, 필터, 정렬)
- [x] 윈도우 간 연동 (linkId 시스템)
- [x] 다크모드/라이트모드 전환
- [x] 반응형 레이아웃
- [x] TypeScript 타입 정의
- [x] Mock 데이터

---

**마지막 업데이트**: 2026-02-21
**프로젝트 상태**: 모든 핵심 기능 완성, 캘린더 윈도우 완전 재설계 완료
