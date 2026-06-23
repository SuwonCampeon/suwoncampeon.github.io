/* ============================================
   tabController.js — 탭 전환 관리
   캘린더 / 일기장 / 할일 뷰 전환
   ============================================ */

const TabController = (() => {

  let _activeTab = 'calendar';
  let _onTabChange = null;
  let _tabBar = null;

  /**
   * 초기화
   * @param {Function} onTabChange - 탭 변경 시 콜백 (tabName)
   */
  function init(onTabChange) {
    _onTabChange = onTabChange;
    _tabBar = document.getElementById('tab-bar');

    if (!_tabBar) return;

    // 탭 버튼 클릭 이벤트
    _tabBar.querySelectorAll('.tab-bar__item').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset.tab;
        if (tabName && tabName !== _activeTab) {
          switchTab(tabName);
        }
      });
    });

    // 저장된 탭 복원 (선택사항)
    const savedTab = localStorage.getItem('app_active_tab');
    if (savedTab && ['calendar', 'diary', 'todo'].includes(savedTab)) {
      switchTab(savedTab, false);
    }
  }

  /**
   * 탭을 전환한다.
   * @param {string} tabName - 'calendar' | 'diary' | 'todo'
   * @param {boolean} animate - 애니메이션 여부
   */
  function switchTab(tabName, animate = true) {
    if (_activeTab === tabName) return;

    const prevTab = _activeTab;
    _activeTab = tabName;
    localStorage.setItem('app_active_tab', tabName);

    // 탭 버튼 활성 상태 업데이트
    if (_tabBar) {
      _tabBar.querySelectorAll('.tab-bar__item').forEach(btn => {
        const isActive = btn.dataset.tab === tabName;
        btn.classList.toggle('tab-bar__item--active', isActive);
        btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
    }

    // 뷰 전환
    document.querySelectorAll('.tab-view').forEach(view => {
      const isTarget = view.id === `tab-${tabName}`;
      if (isTarget) {
        view.classList.add('tab-view--active');
        if (animate) {
          view.style.animation = 'tabFadeIn 0.25s ease';
          view.addEventListener('animationend', () => {
            view.style.animation = '';
          }, { once: true });
        }
      } else {
        view.classList.remove('tab-view--active');
      }
    });

    // 콜백 호출
    if (_onTabChange) _onTabChange(tabName, prevTab);
  }

  /**
   * 현재 활성 탭을 반환한다.
   * @returns {string}
   */
  function getActiveTab() {
    return _activeTab;
  }

  return { init, switchTab, getActiveTab };
})();
