/* ============================================
   googleCalendarAPI.js — Google Calendar API 통신 모듈
   REST 엔드포인트 호출 및 데이터 변환
   ============================================ */

const GoogleCalendarAPI = (() => {

  // ── 상수 ──
  const BASE_URL = 'https://www.googleapis.com/calendar/v3';
  const MAX_RESULTS = 250;

  // ── Google colorId → 앱 내부 색상 매핑 ──
  const COLOR_MAP = {
    '1':  'blue',     // Lavender   → blue
    '2':  'green',    // Sage       → green
    '3':  'purple',   // Grape      → purple
    '4':  'pink',     // Flamingo   → pink
    '5':  'orange',   // Banana     → orange
    '6':  'orange',   // Tangerine  → orange
    '7':  'teal',     // Peacock    → teal
    '8':  'blue',     // Blueberry  → blue
    '9':  'blue',     // Basil      → blue
    '10': 'green',    // Tomato     → green
    '11': 'pink',     // Calender   → pink
  };

  // ── 기본 색상 순환 (colorId 없는 경우) ──
  const DEFAULT_COLORS = ['blue', 'green', 'orange', 'purple', 'teal', 'pink'];
  let _colorIndex = 0;

  /**
   * 특정 기간의 이벤트를 가져온다.
   * @param {string} accessToken - OAuth Access Token
   * @param {Date}   timeMin     - 조회 시작일
   * @param {Date}   timeMax     - 조회 종료일
   * @returns {Promise<Array>} 앱 내부 형식의 이벤트 배열
   */
  async function fetchEvents(accessToken, timeMin, timeMax) {
    const params = new URLSearchParams({
      timeMin:      timeMin.toISOString(),
      timeMax:      timeMax.toISOString(),
      singleEvents: 'true',     // 반복 이벤트를 개별 인스턴스로 확장
      orderBy:      'startTime',
      maxResults:   MAX_RESULTS.toString()
    });

    const url = `${BASE_URL}/calendars/primary/events?${params}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const error = new Error(errData.error?.message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    const items = data.items || [];

    return items
      .filter(item => item.status !== 'cancelled')
      .flatMap(item => _convertEvent(item));
  }

  /**
   * 특정 월의 이벤트를 가져온다. (편의 함수)
   * @param {string} accessToken
   * @param {number} year
   * @param {number} month - 0~11
   * @returns {Promise<Array>}
   */
  async function fetchMonthEvents(accessToken, year, month) {
    const timeMin = new Date(year, month, 1);
    const timeMax = new Date(year, month + 1, 0, 23, 59, 59);
    return fetchEvents(accessToken, timeMin, timeMax);
  }

  // ── 내부 함수 ──

  /**
   * Google Calendar 이벤트를 앱 내부 형식으로 변환한다.
   * 다중 날짜 이벤트는 각 날짜별로 복제된다.
   * @param {Object} gEvent - Google Calendar API 이벤트 객체
   * @returns {Array} 변환된 이벤트 배열
   */
  function _convertEvent(gEvent) {
    const color = _resolveColor(gEvent.colorId);
    const location = gEvent.location || null;
    const title = gEvent.summary || '(제목 없음)';

    // ── 종일 이벤트 (date 필드 사용) ──
    if (gEvent.start.date) {
      const startDate = new Date(gEvent.start.date);
      const endDate   = new Date(gEvent.end.date);
      const events = [];

      // endDate는 exclusive이므로 하루 전까지 생성
      const current = new Date(startDate);
      while (current < endDate) {
        events.push({
          id:        `g-${gEvent.id}-${_formatDate(current)}`,
          title:     title,
          date:      _formatDate(current),
          startTime: null,
          endTime:   null,
          location:  location,
          color:     color,
          allDay:    true
        });
        current.setDate(current.getDate() + 1);
      }

      return events;
    }

    // ── 시간 지정 이벤트 (dateTime 필드 사용) ──
    const startDT = new Date(gEvent.start.dateTime);
    const endDT   = new Date(gEvent.end.dateTime);

    // 날짜가 다른 경우 (자정을 넘기는 이벤트)
    const startDateStr = _formatDate(startDT);
    const endDateStr   = _formatDate(endDT);

    if (startDateStr !== endDateStr) {
      // 시작일: 시작 시간 ~ 23:59, 종료일: 00:00 ~ 종료 시간
      const events = [];
      events.push({
        id:        `g-${gEvent.id}-${startDateStr}`,
        title:     title,
        date:      startDateStr,
        startTime: _formatTime(startDT),
        endTime:   '23:59',
        location:  location,
        color:     color,
        allDay:    false
      });
      events.push({
        id:        `g-${gEvent.id}-${endDateStr}`,
        title:     title,
        date:      endDateStr,
        startTime: '00:00',
        endTime:   _formatTime(endDT),
        location:  location,
        color:     color,
        allDay:    false
      });
      return events;
    }

    return [{
      id:        `g-${gEvent.id}`,
      title:     title,
      date:      startDateStr,
      startTime: _formatTime(startDT),
      endTime:   _formatTime(endDT),
      location:  location,
      color:     color,
      allDay:    false
    }];
  }

  /**
   * Google colorId를 앱 내부 색상으로 변환한다.
   */
  function _resolveColor(colorId) {
    if (colorId && COLOR_MAP[colorId]) {
      return COLOR_MAP[colorId];
    }
    // colorId가 없으면 순환 배정
    const color = DEFAULT_COLORS[_colorIndex % DEFAULT_COLORS.length];
    _colorIndex++;
    return color;
  }

  /**
   * Date → YYYY-MM-DD
   */
  function _formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Date → HH:MM
   */
  function _formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  // Public API
  return {
    fetchEvents,
    fetchMonthEvents
  };

})();
