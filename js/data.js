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
  const _mockEvents = [];

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
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(_events));
    } catch (e) {
      console.warn('[DataManager] 일정 캐싱 실패', e);
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
    _source = 'mock';
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

  function addEvent(event) {
    _events.push(event);
    _saveCache();
  }

  function updateEvent(eventId, updatedEvent) {
    const idx = _events.findIndex(e => e.id === eventId);
    if (idx !== -1) {
      _events[idx] = updatedEvent;
      _saveCache();
    }
  }

  function removeEvent(eventId) {
    _events = _events.filter(e => e.id !== eventId);
    _saveCache();
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
    getSource,
    addEvent,
    updateEvent,
    removeEvent
  };

})();

/* ============================================
   DiaryManager — 일기장 데이터 관리
   localStorage 기반 CRUD
   ============================================ */

const DiaryManager = (() => {

  const CACHE_KEY = 'diary_entries';
  let _entries = [];

  // ── 초기화: localStorage에서 로드 ──
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      _entries = JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[DiaryManager] 일기 데이터 로드 실패', e);
  }

  function _save() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(_entries));
    } catch (e) {
      console.warn('[DiaryManager] 일기 저장 실패', e);
    }
  }

  /**
   * 특정 날짜의 일기를 반환한다.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Object|null}
   */
  function getEntryByDate(dateStr) {
    return _entries.find(e => e.date === dateStr) || null;
  }

  /**
   * 일기를 저장한다 (upsert).
   * 같은 날짜의 일기가 있으면 업데이트, 없으면 추가한다.
   * @param {Object} entry
   */
  function saveEntry(entry) {
    const idx = _entries.findIndex(e => e.date === entry.date);
    const now = new Date().toISOString();

    if (idx !== -1) {
      _entries[idx] = { ..._entries[idx], ...entry, updatedAt: now };
    } else {
      _entries.push({
        id: `diary-${Date.now()}`,
        createdAt: now,
        updatedAt: now,
        photos: [],
        ...entry
      });
    }
    _save();
  }

  /**
   * 특정 날짜의 일기를 삭제한다.
   * @param {string} dateStr - YYYY-MM-DD
   */
  function deleteEntry(dateStr) {
    _entries = _entries.filter(e => e.date !== dateStr);
    _save();
  }

  /**
   * 특정 날짜에 일기가 있는지 확인한다.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {boolean}
   */
  function hasEntry(dateStr) {
    return _entries.some(e => e.date === dateStr);
  }

  /**
   * 특정 월의 일기가 있는 날짜 set을 반환한다.
   * @param {number} year
   * @param {number} month - 0~11
   * @returns {Set<string>}
   */
  function getEntriesForMonth(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const dateSet = new Set();
    _entries.forEach(e => {
      if (e.date.startsWith(prefix)) {
        dateSet.add(e.date);
      }
    });
    return dateSet;
  }

  return { getEntryByDate, saveEntry, deleteEntry, hasEntry, getEntriesForMonth };
})();


/* ============================================
   TodoManager — 할일 리스트 데이터 관리
   localStorage 기반 CRUD
   ============================================ */

const TodoManager = (() => {

  const CACHE_KEY = 'todo_items';
  let _items = [];

  // ── 초기화: localStorage에서 로드 ──
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      _items = JSON.parse(cached);
    }
  } catch (e) {
    console.warn('[TodoManager] 할일 데이터 로드 실패', e);
  }

  function _save() {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(_items));
    } catch (e) {
      console.warn('[TodoManager] 할일 저장 실패', e);
    }
  }

  /**
   * 전체 할일 목록을 반환한다.
   * @param {string} filter - 'all' | 'active' | 'done'
   * @returns {Array}
   */
  function getAll(filter = 'all') {
    let items = [..._items];
    if (filter === 'active') items = items.filter(i => !i.completed);
    if (filter === 'done') items = items.filter(i => i.completed);

    // 정렬: 미완료 → 우선순위순 → 마감일순
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    items.sort((a, b) => {
      // 완료된 것은 아래로
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      // 우선순위
      const pa = priorityOrder[a.priority] ?? 1;
      const pb = priorityOrder[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      // 마감일
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      // 생성일
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return items;
  }

  /**
   * 특정 마감일의 할일을 반환한다.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {Array}
   */
  function getByDueDate(dateStr) {
    return _items.filter(i => i.dueDate === dateStr);
  }

  /**
   * 할일을 추가한다.
   * @param {Object} item
   */
  function addItem(item) {
    const now = new Date().toISOString();
    _items.push({
      id: `todo-${Date.now()}`,
      completed: false,
      completedAt: null,
      createdAt: now,
      sortOrder: _items.length,
      ...item
    });
    _save();
  }

  /**
   * 할일을 업데이트한다.
   * @param {string} id
   * @param {Object} data
   */
  function updateItem(id, data) {
    const idx = _items.findIndex(i => i.id === id);
    if (idx !== -1) {
      _items[idx] = { ..._items[idx], ...data };
      _save();
    }
  }

  /**
   * 할일을 삭제한다.
   * @param {string} id
   */
  function removeItem(id) {
    _items = _items.filter(i => i.id !== id);
    _save();
  }

  /**
   * 완료 상태를 토글한다.
   * @param {string} id
   * @returns {boolean} 토글 후 완료 상태
   */
  function toggleComplete(id) {
    const item = _items.find(i => i.id === id);
    if (item) {
      item.completed = !item.completed;
      item.completedAt = item.completed ? new Date().toISOString() : null;
      _save();
      return item.completed;
    }
    return false;
  }

  /**
   * 진행률을 반환한다.
   * @returns {{ total: number, done: number, percent: number }}
   */
  function getCompletionRate() {
    const total = _items.length;
    const done = _items.filter(i => i.completed).length;
    return {
      total,
      done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100)
    };
  }

  /**
   * 특정 월의 마감일이 있는 할일을 날짜별로 그룹화한다.
   * @param {number} year
   * @param {number} month - 0~11
   * @returns {Map<string, Array>}
   */
  function getTodosForMonth(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const map = new Map();
    _items.forEach(item => {
      if (item.dueDate && item.dueDate.startsWith(prefix)) {
        if (!map.has(item.dueDate)) map.set(item.dueDate, []);
        map.get(item.dueDate).push(item);
      }
    });
    return map;
  }

  return { getAll, getByDueDate, addItem, updateItem, removeItem, toggleComplete, getCompletionRate, getTodosForMonth };
})();
