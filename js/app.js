/* ============================================
   app.js — 앱 메인 컨트롤러
   초기화, 이벤트 바인딩, 일정 목록 표시,
   3D 모션 모드 관리 (cube / door),
   Google Calendar 연동 관리
   ============================================ */

const App = (() => {

  // ── 모션 모드 상태 ('cube' | 'door') ──
  let _motionMode = 'cube';
  let _themeMode = 'vintage';

  // ── Google OAuth Client ID ──
  const GOOGLE_CLIENT_ID = '335180485291-dujcjg64kdftu5uo04nheqflsg0jus01.apps.googleusercontent.com';

  // ── DOM 참조 (init 시 바인딩) ──
  let _eventList = null;

  // ── 하단 탭 상태 ('schedule' | 'diary' | 'todo') ──
  let _activeBottomTab = 'schedule';

  /** 앱 초기화 */
  function init() {
    // DOM 참조
    const elements = {
      yearEl:  document.getElementById('header-year'),
      monthEl: document.getElementById('header-month'),
      grid:    document.getElementById('date-grid')
    };

    _eventList     = document.getElementById('event-list');

    // ── 이벤트 모달 초기화 ──
    if (typeof EventModal !== 'undefined') {
      EventModal.init(_onSaveEvent, _onDeleteEvent);
    }

    // ── 하단 탭 컨트롤러 초기화 ──
    _initBottomTabs();

    // ── 일기장 초기화 ──
    if (typeof DiaryView !== 'undefined') {
      DiaryView.init(() => {
        _refreshCalendar();
      });
    }

    // ── 할일 리스트 초기화 ──
    if (typeof TodoView !== 'undefined') {
      TodoView.init(() => {
        _refreshCalendar();
      });
      // 할일 리스트 최초 1회 렌더링
      TodoView.render();
    }

    // FAB 버튼: 활성 탭에 따라 다른 모달 열기
    const btnAdd = document.getElementById('btn-add-event');
    if (btnAdd) {
      btnAdd.addEventListener('click', () => {
        switch (_activeBottomTab) {
          case 'diary':
            if (typeof DiaryView !== 'undefined') {
              DiaryView.openEditor(CalendarRenderer.getSelectedDate());
            }
            break;
          case 'todo':
            if (typeof TodoView !== 'undefined') {
              TodoView.openModal();
            }
            break;
          case 'schedule':
          default:
            EventModal.open(CalendarRenderer.getSelectedDate());
            break;
        }
      });
    }

    // 캘린더 초기화
    CalendarRenderer.init(elements, (dateStr) => {
      _renderEventList(dateStr, _eventList);
      if (typeof DiaryView !== 'undefined') {
        DiaryView.render(dateStr);
      }
      _updateHeaderUI();
    });

    // 오늘 날짜의 일정 및 일기 렌더링
    const initialDate = CalendarRenderer.getSelectedDate();
    _renderEventList(initialDate, _eventList);
    if (typeof DiaryView !== 'undefined') {
      DiaryView.render(initialDate);
    }

    // ── 네비게이션 버튼 (월 이동) ──
    document.getElementById('btn-prev').addEventListener('click', () => {
      CalendarRenderer.prevMonth(_motionMode);
      _onMonthChanged();
    });

    document.getElementById('btn-next').addEventListener('click', () => {
      CalendarRenderer.nextMonth(_motionMode);
      _onMonthChanged();
    });

    document.getElementById('btn-today').addEventListener('click', () => {
      CalendarRenderer.goToToday();
      const todayStr = CalendarRenderer.getSelectedDate();
      _renderEventList(todayStr, _eventList);
      if (typeof DiaryView !== 'undefined') {
        DiaryView.render(todayStr);
      }
      _updateHeaderUI();
    });

    // 초기 테마 및 전환효과 로드
    const savedTheme = localStorage.getItem('app_theme') || 'vintage';
    _setThemeMode(savedTheme);

    const savedMotion = localStorage.getItem('app_motion') || 'cube';
    _setMotionMode(savedMotion);

    // ── 모션 토글 버튼 ──
    document.querySelectorAll('.motion-btn:not(.theme-btn)').forEach(btn => {
      btn.addEventListener('click', () => {
        _setMotionMode(btn.dataset.motion);
      });
    });

    // ── 테마 토글 버튼 ──
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        _setThemeMode(btn.dataset.theme);
      });
    });

    // ── 설정 메뉴 토글 ──
    const btnMenu = document.getElementById('btn-menu');
    const settingsMenu = document.getElementById('settings-menu');

    btnMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = settingsMenu.getAttribute('aria-hidden') === 'true';
      settingsMenu.setAttribute('aria-hidden', !isHidden);
      btnMenu.setAttribute('aria-expanded', isHidden);
    });

    // 외부 클릭 시 메뉴 닫기
    document.addEventListener('click', (e) => {
      if (settingsMenu.getAttribute('aria-hidden') === 'false' && !settingsMenu.contains(e.target) && !btnMenu.contains(e.target)) {
        settingsMenu.setAttribute('aria-hidden', 'true');
        btnMenu.setAttribute('aria-expanded', 'false');
      }
    });

    // ── 터치 스와이프 ──
    _initSwipeGesture(document.getElementById('calendar-viewport'));

    // ── Google 인증 초기화 ──
    _initGoogleAuth();
  }

  // ==============================
  // Google Calendar 연동
  // ==============================

  /** Google Auth 초기화 */
  function _initGoogleAuth() {
    GoogleAuth.init(GOOGLE_CLIENT_ID, _onGoogleSignIn, _onGoogleSignOut);

    // 로그인 버튼
    const btnLogin = document.getElementById('btn-google-login');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        GoogleAuth.signIn();
      });
    }

    // 로그아웃 버튼
    const btnLogout = document.getElementById('btn-google-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        GoogleAuth.signOut(true);
      });
    }

    // 자동 로그인 설정
    const autoLoginCheckbox = document.getElementById('auto-login-checkbox');
    if (autoLoginCheckbox) {
      // 초기 상태 로드
      const isAutoLogin = localStorage.getItem('g_autologin') === 'true';
      autoLoginCheckbox.checked = isAutoLogin;

      // 상태 변경 시 저장
      autoLoginCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('g_autologin', e.target.checked);
      });

      // 앱 켰을 때 자동 로그인이 체크되어 있고 로그아웃 상태라면 로그인 시도
      if (isAutoLogin) {
        const tryAutoLogin = () => {
          if (GoogleAuth.isSignedIn()) return;
          if (!GoogleAuth.isClientReady()) {
            setTimeout(tryAutoLogin, 200);
            return;
          }
          console.log('[App] 자동 로그인 활성화됨 - 로그인을 시도합니다.');
          GoogleAuth.signIn();
        };
        // 초기 토큰 확인을 위해 약간의 지연 후 실행
        setTimeout(tryAutoLogin, 100);
      }
    }
  }

  /**
   * Google 로그인 성공 콜백
   * @param {string} accessToken
   * @param {string} email
   */
  async function _onGoogleSignIn(accessToken, email) {
    // UI 상태 전환: 로그인 버튼 → 사용자 정보
    _updateAuthUI(true, email);
    _showSyncIndicator(true);

    try {
      // 현재 표시 중인 월의 일정을 가져온다.
      const currentMonth = CalendarRenderer.getCurrentMonth();
      const events = await GoogleCalendarAPI.fetchMonthEvents(
        accessToken,
        currentMonth.year,
        currentMonth.month
      );

      // DataManager에 주입
      DataManager.setEvents(events);

      // 화면 재렌더링
      _refreshCalendar();

    } catch (error) {
      console.error('[App] Google 일정 로드 실패:', error);
      
      if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('오프라인 상태이거나 네트워크에 연결할 수 없습니다.\n기기에 저장된 과거 일정을 표시합니다.');
      } else {
        alert(`일정 동기화 실패: ${error.message}\n(권한 체크박스를 모두 선택했는지 확인해주세요.)`);

        if (error.status === 401 || error.status === 403) {
          // 토큰 만료 또는 권한 부족 → 재인증 시도 유도 (자동 로그아웃)
          GoogleAuth.signOut(false);
        }
      }
    } finally {
      _showSyncIndicator(false);
    }
  }

  /**
   * Google 로그아웃 콜백
   * @param {boolean} isManual - 사용자가 직접 로그아웃했는지 여부
   */
  function _onGoogleSignOut(isManual = true) {
    // UI 상태 전환: 사용자 정보 → 로그인 버튼
    _updateAuthUI(false, null);

    if (isManual) {
      // 수동 로그아웃 시에만 캐시 삭제 및 Mock 데이터로 복원
      DataManager.resetToMock();
      // 화면 재렌더링
      _refreshCalendar();
    } else {
      // 자동 로그아웃 시에는 캐시된 구글 캘린더 데이터를 화면에 그대로 유지
      console.log('[App] 자동 로그아웃 됨. 캐시된 일정을 화면에 유지합니다.');
    }
  }

  /**
   * 월이 변경되었을 때 호출 — Google 로그인 상태이면 해당 월 일정을 fetch
   */
  async function _onMonthChanged() {
    if (!GoogleAuth.isSignedIn()) return;

    _showSyncIndicator(true);

    try {
      const token = await GoogleAuth.ensureValidToken();
      const currentMonth = CalendarRenderer.getCurrentMonth();
      const events = await GoogleCalendarAPI.fetchMonthEvents(
        token,
        currentMonth.year,
        currentMonth.month
      );

      // 기존 데이터에 추가 (다른 월 데이터는 유지)
      DataManager.appendEvents(events);

      // 화면 재렌더링
      _refreshCalendar();

    } catch (error) {
      console.error('[App] 월별 일정 로드 실패:', error);
      if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
        alert('오프라인 상태이거나 네트워크에 연결할 수 없습니다.\n기기에 저장된 과거 일정을 표시합니다.');
      } else {
        alert(`월별 일정 로드 실패: ${error.message}`);
      }
    } finally {
      _showSyncIndicator(false);
      _updateHeaderUI();
    }
  }

  /**
   * 캘린더 화면을 재렌더링한다.
   */
  function _refreshCalendar() {
    const currentMonth = CalendarRenderer.getCurrentMonth();
    CalendarRenderer.renderMonth(currentMonth.year, currentMonth.month, null, null);
    _renderEventList(
      CalendarRenderer.getSelectedDate(),
      _eventList
    );
    _updateHeaderUI();
  }

  /**
   * 인증 UI 상태를 업데이트한다.
   * @param {boolean} isSignedIn
   * @param {string|null} email
   */
  function _updateAuthUI(isSignedIn, email) {
    const btnLogin  = document.getElementById('btn-google-login');
    const userInfo  = document.getElementById('google-user-info');
    const emailEl   = document.getElementById('google-user-email');
    const autoLoginWrap = document.getElementById('auto-login-wrapper');

    if (isSignedIn) {
      if (btnLogin)  btnLogin.style.display = 'none';
      if (autoLoginWrap) autoLoginWrap.style.display = 'none';
      if (userInfo)  userInfo.style.display = 'flex';
      if (emailEl)   emailEl.textContent = email || '로그인 완료';
    } else {
      if (btnLogin)  btnLogin.style.display = 'flex';
      if (autoLoginWrap) autoLoginWrap.style.display = 'flex';
      if (userInfo)  userInfo.style.display = 'none';
      if (emailEl)   emailEl.textContent = '';
    }
  }

  /**
   * 동기화 인디케이터를 표시/숨긴다.
   * @param {boolean} show
   */
  function _showSyncIndicator(show) {
    const indicator = document.getElementById('sync-indicator');
    if (indicator) {
      indicator.style.display = show ? 'flex' : 'none';
    }
  }

  // ==============================
  // ── 하단 패널 탭 처리 ──
  // ==============================

  function _initBottomTabs() {
    document.querySelectorAll('.bottom-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.bottomTab;
        if (tabName === _activeBottomTab) return;

        // 버튼 활성 상태 토글
        document.querySelectorAll('.bottom-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // 패널 뷰 전환
        document.querySelectorAll('.panel-view').forEach(panel => {
          if (panel.id === `panel-${tabName}`) {
            panel.classList.add('active');
            panel.style.animation = 'tabFadeIn 0.25s ease';
            panel.addEventListener('animationend', () => {
              panel.style.animation = '';
            }, { once: true });
          } else {
            panel.classList.remove('active');
          }
        });

        _activeBottomTab = tabName;

        // 탭에 맞는 콘텐츠 렌더링 갱신
        const selectedDate = CalendarRenderer.getSelectedDate();
        if (tabName === 'schedule') {
          _renderEventList(selectedDate, _eventList);
        } else if (tabName === 'diary') {
          if (typeof DiaryView !== 'undefined') DiaryView.render(selectedDate);
        } else if (tabName === 'todo') {
          if (typeof TodoView !== 'undefined') TodoView.render();
        }
      });
    });
  }

  function _updateHeaderUI() {
    const yearEl = document.getElementById('header-year');
    const monthEl = document.getElementById('header-month');
    const btnToday = document.getElementById('btn-today');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');

    yearEl.style.display = '';
    const { year, month } = CalendarRenderer.getCurrentMonth();
    yearEl.textContent = `${year}`;
    const MONTHS_KR = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    monthEl.textContent = MONTHS_KR[month];
    
    btnToday.style.display = '';
    btnPrev.style.display = '';
    btnNext.style.display = '';
  }

  // ==============================
  // 기존 기능
  // ==============================

  /**
   * 모션 모드를 변경한다.
   * @param {string} mode - 'cube' | 'door'
   */
  function _setMotionMode(mode) {
    _motionMode = mode;
    localStorage.setItem('app_motion', mode);

    // 버튼 상태 동기화
    document.querySelectorAll('.motion-btn:not(.theme-btn)').forEach(btn => {
      const isActive = btn.dataset.motion === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /**
   * 테마 모드를 변경한다.
   * @param {string} mode - 'vintage' | 'pctel'
   */
  function _setThemeMode(mode) {
    _themeMode = mode;
    localStorage.setItem('app_theme', mode);
    document.documentElement.setAttribute('data-theme', mode);

    // 버튼 상태 동기화
    document.querySelectorAll('.theme-btn').forEach(btn => {
      const isActive = btn.dataset.theme === mode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }

  /**
   * 지정된 날짜의 이벤트를 렌더링한다.
   * @param {string} dateStr - YYYY-MM-DD
   * @param {HTMLElement} listEl
   */
  function _renderEventList(dateStr, listEl) {
    const events = DataManager.getEventsByDate(dateStr);

    if (events.length === 0) {
      listEl.innerHTML = `
        <div class="event-empty">
          <div class="event-empty__icon">📭</div>
          <div class="event-empty__text">일정이 없습니다</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = events.map(evt => {
      const timeHTML = evt.allDay
        ? `<span class="event-card__time-start">종일</span>`
        : `<span class="event-card__time-start">${evt.startTime}</span>
           <span class="event-card__time-end">${evt.endTime}</span>`;

      const locationHTML = evt.location
        ? `<div class="event-card__location">${evt.location}</div>`
        : '';

      const alldayClass = evt.allDay ? ' event-card--allday' : '';

      return `
        <div class="event-card event-card--${evt.color}${alldayClass}" data-id="${evt.id}">
          <div class="event-card__time">${timeHTML}</div>
          <div class="event-card__info">
            <div class="event-card__title">${evt.title}</div>
            ${locationHTML}
          </div>
          <button class="btn-share-event" data-id="${evt.id}" aria-label="일정 공유" title="공유하기">🔗</button>
        </div>
      `;
    }).join('');

    // 이벤트 카드 클릭 시 편집 모달 열기
    listEl.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const eventId = card.dataset.id;
        const events = DataManager.getEventsByDate(dateStr);
        const evt = events.find(event => event.id === eventId);
        
        // 공유 버튼 클릭 시 수정 모달 띄우지 않고 공유 모달 띄우기
        if (e.target.closest('.btn-share-event')) {
          e.stopPropagation();
          if (evt && typeof ShareConfig !== 'undefined') {
            ShareConfig.open(evt);
          }
          return;
        }

        if (evt && typeof EventModal !== 'undefined') {
          EventModal.open(dateStr, evt);
        }
      });
    });
  }

  /**
   * 터치 스와이프로 월 이동 지원
   */
  function _initSwipeGesture(el) {
    let startX = 0;
    let startY = 0;

    el.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].clientX - startX;
      const diffY = e.changedTouches[0].clientY - startY;

      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX < 0) {
          CalendarRenderer.nextMonth(_motionMode);
        } else {
          CalendarRenderer.prevMonth(_motionMode);
        }
        _onMonthChanged();
      }
    }, { passive: true });
  }

  /**
   * 일정 저장 콜백
   */
  async function _onSaveEvent(eventData, isEdit) {
    if (GoogleAuth.isSignedIn()) {
      _showSyncIndicator(true);
      try {
        const token = await GoogleAuth.ensureValidToken();
        if (isEdit) {
          await GoogleCalendarAPI.updateEvent(token, eventData.id, eventData);
        } else {
          await GoogleCalendarAPI.insertEvent(token, eventData);
        }
        
        // 다중 날짜 일정 등 복잡한 변화가 있을 수 있으므로 현재 월 데이터 다시 불러오기
        const currentMonth = CalendarRenderer.getCurrentMonth();
        const events = await GoogleCalendarAPI.fetchMonthEvents(
          token,
          currentMonth.year,
          currentMonth.month
        );
        DataManager.setEvents(events);
        _refreshCalendar();
      } catch (error) {
        console.error('[App] 일정 저장 실패:', error);
        alert(`일정 저장에 실패했습니다.\n${error.message}`);
      } finally {
        _showSyncIndicator(false);
      }
    } else {
      // 로컬에만 저장: 다중 날짜 지원을 위해 시작일부터 종료일까지 각 날짜별로 분할해서 저장
      const startDate = new Date(eventData.startDate || eventData.date);
      const endDate = new Date(eventData.endDate || eventData.date);
      const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
      
      const current = new Date(startDate);
      
      // 기존 이벤트 삭제 후 다시 추가 (편집의 경우)
      if (isEdit) {
        // 기존 ID와 연결된 다중 날짜 이벤트들을 모두 찾기 위해
        // 동일 base ID로 생성된 항목들을 지웁니다.
        const baseId = eventData.id.split('-')[1] || eventData.id;
        const allEvts = DataManager.getAllEvents();
        allEvts.forEach(e => {
          if (e.id === eventData.id || e.id.includes(`-${baseId}-`)) {
            DataManager.removeEvent(e.id);
          }
        });
      }
      
      const baseId = isEdit ? (eventData.id.split('-')[1] || eventData.id) : Date.now();
      
      for (let dayCount = 0; dayCount < totalDays; dayCount++) {
        let multiDayState = 'single';
        if (totalDays > 1) {
          if (dayCount === 0) multiDayState = 'start';
          else if (dayCount === totalDays - 1) multiDayState = 'end';
          else multiDayState = 'middle';
        }
        
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        let st = eventData.startTime;
        let et = eventData.endTime;
        
        if (!eventData.allDay && totalDays > 1) {
          if (multiDayState === 'start') { et = '23:59'; }
          else if (multiDayState === 'end') { st = '00:00'; }
          else if (multiDayState === 'middle') { st = '00:00'; et = '23:59'; }
        }

        DataManager.addEvent({
          ...eventData,
          id: `local-${baseId}-${dateStr}`,
          date: dateStr,
          startTime: st,
          endTime: et,
          multiDayState: multiDayState
        });
        
        current.setDate(current.getDate() + 1);
      }
      
      _refreshCalendar();
    }
  }

  /**
   * 일정 삭제 콜백
   */
  async function _onDeleteEvent(eventId) {
    if (GoogleAuth.isSignedIn()) {
      _showSyncIndicator(true);
      try {
        const token = await GoogleAuth.ensureValidToken();
        await GoogleCalendarAPI.deleteEvent(token, eventId);
        DataManager.removeEvent(eventId);
        
        // Refresh the whole month to ensure any multi-day events are correctly synchronized
        const currentMonth = CalendarRenderer.getCurrentMonth();
        const events = await GoogleCalendarAPI.fetchMonthEvents(
          token,
          currentMonth.year,
          currentMonth.month
        );
        DataManager.setEvents(events);
        _refreshCalendar();
      } catch (error) {
        console.error('[App] 일정 삭제 실패:', error);
        alert(`일정 삭제에 실패했습니다.\n${error.message}`);
      } finally {
        _showSyncIndicator(false);
      }
    } else {
      const baseId = eventId.split('-')[1] || eventId;
      const allEvts = DataManager.getAllEvents();
      allEvts.forEach(e => {
        if (e.id === eventId || e.id.includes(`-${baseId}-`)) {
          DataManager.removeEvent(e.id);
        }
      });
      _refreshCalendar();
    }
  }

  return { init };

})();

document.addEventListener('DOMContentLoaded', App.init);

