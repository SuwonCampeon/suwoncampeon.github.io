/* ============================================
   googleAuth.js — Google OAuth 2.0 인증 모듈
   Google Identity Services (GIS) 기반
   ============================================ */

const GoogleAuth = (() => {

  // ── 설정 ──
  const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email';

  // ── 상태 ──
  let _tokenClient = null;
  let _accessToken = null;
  let _expiresAt   = 0;       // 토큰 만료 시각 (ms)
  let _userEmail   = null;
  let _onSignIn    = null;    // 콜백: (accessToken, email) => void
  let _onSignOut   = null;    // 콜백: () => void
  let _clientId    = '';

  /**
   * Google Identity Services 초기화
   * @param {string}   clientId  - Google Cloud OAuth 2.0 Client ID
   * @param {Function} onSignIn  - 로그인 성공 콜백 (accessToken, email)
   * @param {Function} onSignOut - 로그아웃 콜백
   */
  function init(clientId, onSignIn, onSignOut) {
    _clientId  = clientId;
    _onSignIn  = onSignIn;
    _onSignOut = onSignOut;

    // 초기화 시 로컬 스토리지에서 유효한 토큰 확인
    const savedToken = localStorage.getItem('g_token');
    const savedExpires = localStorage.getItem('g_expires');
    const savedEmail = localStorage.getItem('g_email');

    if (savedToken && savedExpires && Date.now() < parseInt(savedExpires, 10)) {
      _accessToken = savedToken;
      _expiresAt = parseInt(savedExpires, 10);
      _userEmail = savedEmail || null;
      
      // 메인 앱 초기화가 끝난 직후에 로그인 콜백이 실행되도록 지연
      setTimeout(() => {
        if (_onSignIn) _onSignIn(_accessToken, _userEmail);
      }, 50);
    }

    // GIS 라이브러리 로드 대기
    _waitForGIS(() => {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: _clientId,
        scope: SCOPES,
        callback: _handleTokenResponse,
        error_callback: _handleTokenError
      });
    });
  }

  /**
   * 로그인 팝업을 표시한다.
   */
  function signIn() {
    if (!_tokenClient) {
      console.warn('[GoogleAuth] 토큰 클라이언트가 초기화되지 않았습니다.');
      return;
    }

    // 토큰이 유효하면 바로 콜백
    if (_accessToken && Date.now() < _expiresAt) {
      if (_onSignIn) _onSignIn(_accessToken, _userEmail);
      return;
    }

    _tokenClient.requestAccessToken({ prompt: '' });
  }

  /**
   * 로그아웃 처리
   * @param {boolean} isManual - 사용자가 직접 로그아웃 버튼을 눌렀는지 여부
   */
  function signOut(isManual = true) {
    if (_accessToken) {
      google.accounts.oauth2.revoke(_accessToken, () => {
        console.log('[GoogleAuth] 토큰이 폐기되었습니다.');
      });
    }

    _accessToken = null;
    _expiresAt   = 0;
    _userEmail   = null;

    localStorage.removeItem('g_token');
    localStorage.removeItem('g_expires');
    
    if (isManual) {
      localStorage.removeItem('g_email');
    }

    if (_onSignOut) _onSignOut(isManual);
  }

  /**
   * 현재 로그인 상태를 반환한다.
   * @returns {boolean}
   */
  function isSignedIn() {
    return !!_accessToken && Date.now() < _expiresAt;
  }

  /**
   * 현재 유효한 Access Token을 반환한다.
   * @returns {string|null}
   */
  function getAccessToken() {
    if (_accessToken && Date.now() < _expiresAt) {
      return _accessToken;
    }
    return null;
  }

  /**
   * 현재 로그인된 사용자 이메일을 반환한다.
   * @returns {string|null}
   */
  function getUserEmail() {
    return _userEmail;
  }

  /**
   * 토큰이 만료되었으면 갱신을 시도한다.
   * @returns {Promise<string>} 유효한 Access Token
   */
  function ensureValidToken() {
    return new Promise((resolve, reject) => {
      if (_accessToken && Date.now() < _expiresAt) {
        resolve(_accessToken);
        return;
      }

      if (!_tokenClient) {
        reject(new Error('토큰 클라이언트가 초기화되지 않았습니다.'));
        return;
      }

      // 일시적으로 콜백을 교체하여 Promise 해결
      const originalCallback = _tokenClient.callback;
      _tokenClient.callback = (response) => {
        _tokenClient.callback = originalCallback;
        if (response.error) {
          reject(new Error(response.error));
        } else {
          _processToken(response);
          resolve(_accessToken);
        }
      };

      _tokenClient.requestAccessToken({ prompt: '' });
    });
  }

  // ── 내부 함수 ──

  /**
   * GIS 라이브러리 로드를 기다린다.
   */
  function _waitForGIS(callback) {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
      callback();
      return;
    }

    // 100ms 간격으로 재시도 (최대 30초)
    let attempts = 0;
    const maxAttempts = 300;
    const interval = setInterval(() => {
      attempts++;
      if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
        clearInterval(interval);
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error('[GoogleAuth] GIS 라이브러리 로드 시간 초과.');
      }
    }, 100);
  }

  /**
   * 토큰 응답 처리
   */
  function _handleTokenResponse(response) {
    if (response.error) {
      console.error('[GoogleAuth] 토큰 오류:', response.error);
      return;
    }
    _processToken(response);

    // 사용자 이메일 가져오기
    _fetchUserEmail(_accessToken).then(email => {
      _userEmail = email;
      if (email) localStorage.setItem('g_email', email);
      if (_onSignIn) _onSignIn(_accessToken, _userEmail);
    });
  }

  /**
   * 토큰 데이터를 내부 상태에 저장
   */
  function _processToken(response) {
    _accessToken = response.access_token;
    // expires_in은 초 단위 → ms로 변환, 1분 마진
    const expiresInMs = (response.expires_in - 60) * 1000;
    _expiresAt = Date.now() + expiresInMs;

    localStorage.setItem('g_token', _accessToken);
    localStorage.setItem('g_expires', _expiresAt.toString());
  }

  /**
   * 토큰 에러 핸들러
   */
  function _handleTokenError(error) {
    console.error('[GoogleAuth] 인증 오류:', error);
  }

  /**
   * Access Token으로 사용자 이메일을 가져온다.
   * @param {string} token
   * @returns {Promise<string>}
   */
  async function _fetchUserEmail(token) {
    try {
      const res = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.email || null;
    } catch {
      return null;
    }
  }

  // Public API
  return {
    init,
    signIn,
    signOut,
    isSignedIn,
    getAccessToken,
    getUserEmail,
    ensureValidToken
  };

})();
