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
    '1':  'purple',   // Lavender
    '2':  'green',    // Sage
    '3':  'purple',   // Grape
    '4':  'pink',     // Flamingo
    '5':  'orange',   // Banana
    '6':  'orange',   // Tangerine
    '7':  'teal',     // Peacock
    '8':  'gray',     // Graphite
    '9':  'blue',     // Blueberry
    '10': 'green',    // Basil
    '11': 'red',      // Tomato
  };

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
      const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));

      for (let dayCount = 0; dayCount < totalDays; dayCount++) {
        let multiDayState = 'single';
        if (totalDays > 1) {
          if (dayCount === 0) multiDayState = 'start';
          else if (dayCount === totalDays - 1) multiDayState = 'end';
          else multiDayState = 'middle';
        }

        events.push({
          id:        `g-${gEvent.id}-${_formatDate(current)}`,
          title:     title,
          date:      _formatDate(current),
          startTime: null,
          endTime:   null,
          location:  location,
          color:     color,
          allDay:    true,
          multiDayState: multiDayState
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
        allDay:    false,
        multiDayState: 'start'
      });
      events.push({
        id:        `g-${gEvent.id}-${endDateStr}`,
        title:     title,
        date:      endDateStr,
        startTime: '00:00',
        endTime:   _formatTime(endDT),
        location:  location,
        color:     color,
        allDay:    false,
        multiDayState: 'end'
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
      allDay:    false,
      multiDayState: 'single'
    }];
  }

  /**
   * Google colorId를 앱 내부 색상으로 변환한다.
   */
  function _resolveColor(colorId) {
    if (colorId && COLOR_MAP[colorId]) {
      return COLOR_MAP[colorId];
    }
    // 사용자가 구글 캘린더에서 지정하지 않은 기본 색상
    return 'default';
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

  const REVERSE_COLOR_MAP = {
    'purple': '3',
    'green': '2',
    'pink': '4',
    'orange': '6',
    'teal': '7',
    'gray': '8',
    'blue': '9',
    'red': '11',
    'default': null
  };

  /**
   * 새 일정을 Google Calendar에 추가한다.
   * @param {string} accessToken
   * @param {Object} eventData 앱 내부 이벤트 포맷
   * @returns {Promise<Object>} 추가된 이벤트를 앱 내부 포맷으로 반환
   */
  async function insertEvent(accessToken, eventData) {
    const url = `${BASE_URL}/calendars/primary/events`;
    const gEvent = _convertToGEvent(eventData);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gEvent)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return _convertEvent(data)[0];
  }

  /**
   * 기존 일정을 업데이트한다.
   * @param {string} accessToken
   * @param {string} eventId
   * @param {Object} eventData
   * @returns {Promise<Object>}
   */
  async function updateEvent(accessToken, eventId, eventData) {
    const realId = eventId.startsWith('g-') ? eventId.split('-')[1] : eventId;
    const url = `${BASE_URL}/calendars/primary/events/${realId}`;
    const gEvent = _convertToGEvent(eventData);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(gEvent)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    return _convertEvent(data)[0];
  }

  /**
   * 일정을 삭제한다.
   * @param {string} accessToken
   * @param {string} eventId
   * @returns {Promise<boolean>}
   */
  async function deleteEvent(accessToken, eventId) {
    const realId = eventId.startsWith('g-') ? eventId.split('-')[1] : eventId;
    const url = `${BASE_URL}/calendars/primary/events/${realId}`;

    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok && response.status !== 204) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${response.status}`);
    }

    return true;
  }

  /**
   * 앱 내부 이벤트 포맷을 Google Calendar API 포맷으로 변환한다.
   */
  function _convertToGEvent(eventData) {
    const gEvent = {
      summary: eventData.title,
      location: eventData.location || undefined,
      start: {},
      end: {}
    };

    const colorId = REVERSE_COLOR_MAP[eventData.color];
    if (colorId) {
      gEvent.colorId = colorId;
    }

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    if (eventData.allDay) {
      gEvent.start.date = eventData.date;
      
      const [y, m, d] = eventData.date.split('-').map(Number);
      const endDate = new Date(y, m - 1, d + 1); // next day
      gEvent.end.date = _formatDate(endDate);
    } else {
      gEvent.start.dateTime = `${eventData.date}T${eventData.startTime}:00`;
      gEvent.start.timeZone = timeZone;
      gEvent.end.dateTime = `${eventData.date}T${eventData.endTime}:00`;
      gEvent.end.timeZone = timeZone;
    }

    return gEvent;
  }

  // Public API
  return {
    fetchEvents,
    fetchMonthEvents,
    insertEvent,
    updateEvent,
    deleteEvent
  };

})();
