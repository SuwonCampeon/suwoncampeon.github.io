/* ============================================
   data.js — 일정 데이터 관리
   Mock / Google Calendar 데이터 제공 및 날짜별 필터링
   ============================================ */

/**
 * 일정 데이터 객체 형태:
 * {
 *   id:       string,
 *   title:    string,
 *   date:     string  (YYYY-MM-DD),
 *   startTime:string | null  (HH:MM, 종일이면 null),
 *   endTime:  string | null  (HH:MM),
 *   location: string | null,
 *   color:    string  (blue|green|orange|pink|purple|teal),
 *   allDay:   boolean
 * }
 */

const DataManager = (() => {

  // ── Mock 데이터 (현재 기준 2026년 6월) — 로그인 전 기본 표시용 ──
  const _mockEvents = [
    {
      id: 'evt-001',
      title: '팀 위클리 미팅',
      date: '2026-06-22',
      startTime: '10:00',
      endTime: '11:00',
      location: '회의실 A',
      color: 'blue',
      allDay: false
    },
    {
      id: 'evt-002',
      title: '점심 약속',
      date: '2026-06-22',
      startTime: '12:30',
      endTime: '13:30',
      location: '강남역 근처',
      color: 'green',
      allDay: false
    },
    {
      id: 'evt-003',
      title: '프로젝트 데드라인',
      date: '2026-06-25',
      startTime: null,
      endTime: null,
      location: null,
      color: 'red',
      allDay: true
    },
    {
      id: 'evt-004',
      title: '디자인 리뷰',
      date: '2026-06-25',
      startTime: '14:00',
      endTime: '15:30',
      location: '온라인 (Zoom)',
      color: 'default',
      allDay: false
    },
    {
      id: 'evt-005',
      title: '운동',
      date: '2026-06-23',
      startTime: '07:00',
      endTime: '08:00',
      location: '헬스장',
      color: 'teal',
      allDay: false
    },
    {
      id: 'evt-006',
      title: '치과 예약',
      date: '2026-06-27',
      startTime: '16:00',
      endTime: '17:00',
      location: '서울치과',
      color: 'pink',
      allDay: false
    },
    {
      id: 'evt-007',
      title: '제주도 워크샵',
      date: '2026-06-27',
      startTime: null,
      endTime: null,
      location: '제주도',
      color: 'orange',
      allDay: true,
      multiDayState: 'start'
    },
    {
      id: 'evt-008',
      title: '제주도 워크샵',
      date: '2026-06-28',
      startTime: null,
      endTime: null,
      location: '제주도',
      color: 'orange',
      allDay: true,
      multiDayState: 'middle'
    },
    {
      id: 'evt-008b',
      title: '제주도 워크샵',
      date: '2026-06-29',
      startTime: null,
      endTime: null,
      location: '제주도',
      color: 'orange',
      allDay: true,
      multiDayState: 'end'
    },
    {
      id: 'evt-009',
      title: '코드 리뷰',
      date: '2026-06-24',
      startTime: '11:00',
      endTime: '12:00',
      location: null,
      color: 'blue',
      allDay: false
    },
    {
      id: 'evt-010',
      title: '스프린트 회고',
      date: '2026-06-26',
      startTime: '15:00',
      endTime: '16:00',
      location: '회의실 B',
      color: 'purple',
      allDay: false
    },
    {
      id: 'evt-011',
      title: '월간 보고서 작성',
      date: '2026-06-30',
      startTime: '09:00',
      endTime: '10:00',
      location: null,
      color: 'orange',
      allDay: false
    },
    {
      id: 'evt-012',
      title: '1:1 미팅',
      date: '2026-06-22',
      startTime: '15:00',
      endTime: '15:30',
      location: null,
      color: 'purple',
      allDay: false
    }
  ];

  // ── 캐시 키 ──
  const CACHE_KEY = 'g_cached_events';

  // ── 활성 이벤트 배열 (동적 교체 가능) ──
  let _events = [..._mockEvents];

  // ── 데이터 소스 상태 ('mock' | 'google') ──
  let _source = 'mock';

  // ── 초기화 시 캐시 로드 ──
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    // 수동 로그아웃 시에만 캐시를 지우므로, 캐시가 있다면 이전 자동 로그아웃 상태이거나 로그인 상태임
    if (cached) {
      _events = JSON.parse(cached);
      _source = 'google';
    }
  } catch (e) {
    console.warn('[DataManager] 캐시된 일정을 불러오지 못했습니다.', e);
  }

  /**
   * 로컬 스토리지에 이벤트를 저장한다.
   */
  function _saveCache() {
    if (_source === 'google') {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(_events));
      } catch (e) {
        console.warn('[DataManager] 일정 캐싱 실패', e);
      }
    }
  }

  /**
   * 외부에서 이벤트 배열을 주입한다. (Google Calendar 연동용)
   * @param {Array} eventArray - 앱 내부 형식의 이벤트 배열
   */
  function setEvents(eventArray) {
    _events = [...eventArray];
    _source = 'google';
    _saveCache();
  }

  /**
   * Google 일정을 기존 목록에 추가한다. (월별 점진적 로드용)
   * 중복 ID는 제거한다.
   * @param {Array} eventArray - 추가할 이벤트 배열
   */
  function appendEvents(eventArray) {
    const existingIds = new Set(_events.map(e => e.id));
    const newEvents = eventArray.filter(e => !existingIds.has(e.id));
    _events = [..._events, ...newEvents];
    _source = 'google';
    _saveCache();
  }

  /**
   * 모든 일정을 초기화한다.
   */
  function clearEvents() {
    _events = [];
    _source = 'mock';
  }

  /**
   * Mock 데이터로 복원한다. (로그아웃 시 사용)
   */
  function resetToMock() {
    _events = [..._mockEvents];
    _source = 'mock';
    localStorage.removeItem(CACHE_KEY);
  }

  /**
   * 현재 데이터 소스를 반환한다.
   * @returns {'mock' | 'google'}
   */
  function getSource() {
    return _source;
  }

  /**
   * 전체 이벤트 목록을 반환한다.
   * @returns {Array} 이벤트 배열
   */
  function getAllEvents() {
    return [..._events];
  }

  /**
   * 특정 날짜(YYYY-MM-DD)의 이벤트를 반환한다.
   * 종일 일정을 먼저, 그 다음 시간순으로 정렬한다.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Array}
   */
  function getEventsByDate(dateStr) {
    return _events
      .filter(evt => evt.date === dateStr)
      .sort((a, b) => {
        // 종일 일정이 먼저
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        // 시간순 정렬
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        return 0;
      });
  }

  function getEventsMapForMonth(year, month) {
    const eventsMap = new Map();

    _events.forEach(evt => {
      if (!eventsMap.has(evt.date)) {
        eventsMap.set(evt.date, []);
      }
      eventsMap.get(evt.date).push(evt);
    });

    return eventsMap;
  }

  // Public API
  return {
    getAllEvents,
    getEventsByDate,
    getEventsMapForMonth,
    setEvents,
    appendEvents,
    clearEvents,
    resetToMock,
    getSource
  };

})();
