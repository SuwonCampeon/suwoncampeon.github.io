# 모바일 웹 캘린더 앱 개발 계획

이 문서(`PLAN.md`)는 HTML, CSS, JavaScript를 기반으로 모바일 환경에 최적화된 웹 캘린더 애플리케이션을 개발하기 위한 구조와 단계별 구현 목표를 담고 있습니다. 사용자 기기에서 일정/할 일을 가져와 표시하며, 초기 버전에서는 추가/수정 기능을 제외하고 조회(Read-only)에 집중합니다.

> [!WARNING]
> **웹 브라우저의 기기 캘린더 직접 접근 제한**
> 일반적인 웹 브라우저(Chrome, Safari 등)에서는 보안상의 이유로 사용자의 스마트폰 기본 캘린더 앱(iOS 캘린더, 안드로이드 캘린더 등) 데이터에 직접 접근하는 권한이나 API를 제공하지 않습니다.

## User Review Required

위의 브라우저 제한 사항을 해결하기 위해 어떤 방향으로 진행할지 결정이 필요합니다.
1. **Mock 데이터 활용 (초기 UI 개발용으로 권장):** 우선 프론트엔드 UI/UX와 레이아웃 개발에 집중하기 위해 가상의(Mock) 데이터를 사용하여 일정을 화면에 표시합니다.
2. **외부 API 연동:** Google Calendar API, Microsoft Graph API 등을 연동하여 로그인한 사용자의 일정을 가져옵니다.
3. **하이브리드 앱을 염두에 둔 개발:** 추후 Capacitor, React Native 등으로 웹을 감싸 네이티브 권한을 얻는 것을 전제로 코드를 작성합니다.

## Open Questions

- 기본적으로 화면에 가장 먼저 보여질 뷰는 어떤 형태가 좋으신가요? (예: 월간 달력, 주간 달력, 타임라인 등)
- 다크 모드를 기본으로 할지, 라이트 모드를 기본으로 할지 선호하시는 디자인 취향이 있으신가요? (예: 파스텔톤, 모노톤 등)

## Proposed Changes

코드의 유지보수성과 확장성을 높이기 위해 다음과 같은 디렉토리 및 파일 구조로 분류체계를 짭니다.

### 1. HTML (구조)
#### [NEW] [index.html](file:///Users/sonny/WebCalander/index.html)
- 모바일 화면 비율에 맞춘 `viewport` 메타 태그 설정.
- 헤더(월 표시), 요일 행, 날짜 그리드 영역 구성.

### 2. CSS (스타일링 분류)
#### [NEW] [css/variables.css](file:///Users/sonny/WebCalander/css/variables.css)
- 색상, 폰트 크기, 여백 등 디자인 토큰 정의.
#### [NEW] [css/layout.css](file:///Users/sonny/WebCalander/css/layout.css)
- 모바일 화면에 맞춘 전체 레이아웃 (플렉스박스/그리드 사용).
#### [NEW] [css/calendar.css](file:///Users/sonny/WebCalander/css/calendar.css)
- 캘린더 내부의 날짜 셀, 일정 표시 바(Bar) 등의 세부 스타일.

### 3. JavaScript (로직 분리)
#### [NEW] [js/app.js](file:///Users/sonny/WebCalander/js/app.js)
- 전체 앱 초기화 및 메인 컨트롤러 역할.
#### [NEW] [js/calendar.js](file:///Users/sonny/WebCalander/js/calendar.js)
- 날짜 계산 로직(윤년, 월별 일수) 및 달력 UI 렌더링.
#### [NEW] [js/data.js](file:///Users/sonny/WebCalander/js/data.js)
- 일정 데이터를 가져오고 관리하는 로직 (현재는 Mock 데이터 반환 용도).

## Verification Plan

### Manual Verification
1. 브라우저 개발자 도구의 '모바일 디바이스 모드'를 통해 모바일 화면 레이아웃이 깨지지 않는지 검증합니다.
2. Mock 데이터가 달력의 정확한 날짜 칸에 알맞게 배치되는지 시각적으로 확인합니다.
3. 이전/다음 달로 이동하는 버튼 클릭 시 달력이 정상적으로 다시 렌더링되는지 테스트합니다.
