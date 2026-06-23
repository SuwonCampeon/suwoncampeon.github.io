# 일정 공유 기능 (웹 링크 기반) 구현 계획

사용자가 개별 일정을 웹 링크(URL) 형태로 공유할 수 있고, 공유 전 닉네임과 초대장 테마(빈티지, PC통신)를 선택할 수 있도록 구현합니다. 수신자는 별도 서버 가입이나 로그인 없이 웹 링크에서 일정을 확인하고 본인의 캘린더(.ics 다운로드)에 추가할 수 있습니다.

## User Review Required

> [!IMPORTANT]
> **데이터 압축 및 암호화 방식 (서버리스)**:
> 사용자의 일정 정보와 선택한 테마/닉네임을 별도의 백엔드 서버 없이 브라우저 단에서 Base64로 인코딩하여 URL에 직접 포함시킵니다. 데이터 길이 제한은 브라우저 스펙 내에서 처리되므로 일반적인 일정 텍스트는 모두 문제없이 포함됩니다. 카카오톡 등에서 표시되는 썸네일 제목은 고정 텍스트("💌 누군가의 초대장이 도착했어요!")로 사용됩니다. 이 아키텍처에 동의하시나요?

## Open Questions

> [!TIP]
> 1. Web Share API(`navigator.share()`)를 사용하여 아이폰/안드로이드의 네이티브 공유 시트(에어드랍, 카톡 등)를 띄웁니다! 데스크탑 등 지원하지 않는 환경에서만 클립보드 복사(팝업 알림)로 대체합니다.
> 2. `share.html`(수신자용 초대장 페이지)의 URL은 호스팅 주소를 따르게 됩니다. 현재 로컬 환경에서는 파일 경로로 동작하지만, 최종 호스팅 시에는 `도메인.com/share.html?data=...` 형태가 됩니다. 괜찮으신가요?

## Proposed Changes

---

### UI / Front-end (Main App)

#### [MODIFY] [index.html](file:///Users/sonny/캘린더/index.html)
- 공유 설정용 모달(`share-config-modal-overlay`) 추가.
  - 역할: 공유 전 발신자의 닉네임 입력란, 테마 선택란(빈티지/PC통신), [공유하기] 버튼 포함.

#### [MODIFY] [css/layout.css](file:///Users/sonny/캘린더/css/layout.css)
- 추가되는 공유 설정 모달(`share-config-modal`)에 대한 스타일 작성.
- 기존 테마 CSS 변수를 해치지 않고, 설정 모달이 자연스럽게 앱 UI에 녹아들도록 구성.

#### [MODIFY] [js/app.js](file:///Users/sonny/캘린더/js/app.js)
- `_renderEventList` 함수 내 `event-card` 생성 HTML 템플릿 우측에 **공유(🔗) 아이콘 버튼**을 추가합니다.
- 이벤트 버블링을 막아(`e.stopPropagation()`) 일정 편집 모달 대신 공유 설정 모달(`ShareConfigModal`)이 뜨도록 클릭 이벤트를 바인딩합니다.

#### [NEW] [js/shareConfig.js](file:///Users/sonny/캘린더/js/shareConfig.js) (공유 기능 모듈)
- 공유 버튼 클릭 시 호출되어 선택된 일정 데이터(제목, 날짜, 시간, 위치 등)를 임시 보관하고 공유 설정 모달(`ShareConfigModal`)을 띄움.
- 닉네임, 테마 입력 완료 시 JSON 객체를 Base64로 인코딩(`btoa`)하여 URL을 생성합니다.
- **Web Share API(`navigator.share`)**를 호출하여 모바일 네이티브 공유 시트(카카오톡, 에어드랍, 퀵쉐어 등)를 띄웁니다.
- 만약 기기가 Web Share API를 지원하지 않는 경우(일부 데스크탑 등), 클립보드에 주소를 복사(`navigator.clipboard.writeText`)하고 알림을 띄우는 Fallback 로직을 적용합니다.

---

### Receiver Page (share.html)

#### [NEW] [share.html](file:///Users/sonny/캘린더/share.html)
- 수신자가 링크를 열었을 때 보여지는 단일 초대장 페이지.
- `index.html`과 독립적이지만 `variables.css`를 불러와서 빈티지/PC통신 테마를 모두 지원하도록 구성.
- 화면 구성:
  - 보낸사람(닉네임) 헤더
  - 일정 세부 정보 (제목, 날짜, 시간, 위치)
  - 액션 버튼 2개: `[삼성 캘린더에서 바로 열기]`, `[애플 캘린더에서 바로 열기]`
  - 하단 바이럴 링크: `[레트로랩 캘린더에서 나도 일정 공유해보기]`
- 하드코딩된 Open Graph 태그 삽입: `<meta property="og:title" content="💌 누군가의 초대장이 도착했어요!">`

#### [NEW] [js/share.html_script.js](file:///Users/sonny/캘린더/js/share.js) (또는 share.html 내 인라인 스크립트)
- URL 파라미터(`?data=`) 파싱 및 Base64 디코딩(`atob`).
- 읽어온 데이터에서 `theme` 값을 확인하여 최상단 `<html>` 요소에 `data-theme` 속성 부여 (테마 자동 적용).
- 디코딩된 정보를 바탕으로 초대장 UI 텍스트 채우기.
- **ICS 파일 생성 로직**: 사용자가 캘린더 추가 버튼 클릭 시, 자바스크립트가 `BEGIN:VCALENDAR` 규격의 `.ics` 파일을 동적으로 생성하고 다운로드 하도록 트리거 (Blob 활용).

## Verification Plan

### Manual Verification
1. **링크 생성 검증**: `index.html`에서 새 일정 작성 후 공유 버튼 클릭 -> 닉네임(테스트), 테마(PC통신) 선택 후 복사 -> 생성된 URL 길이 및 파라미터 정상 확인.
2. **수신자 페이지 렌더링 검증**: 복사된 주소(`share.html?data=...`)를 새 탭에서 열어, 선택했던 PC통신 테마와 닉네임, 일정 정보가 완벽하게 표시되는지 확인.
3. **캘린더 저장(ICS) 검증**: 수신자 페이지에서 캘린더 추가 버튼을 눌렀을 때 `.ics` 파일이 올바른 정보(시간, 제목 등)를 포함하여 다운로드되는지 테스트.
