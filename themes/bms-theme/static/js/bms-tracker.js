/**
 * BMS Visitor Tracking Module
 *
 * Lightweight visitor tracking with:
 * - Session-scoped ID (sessionStorage, always active — no consent needed)
 * - Persistent visitor ID cookie (bms_vid, 180 days — requires consent)
 * - UTM capture from URL params
 * - Email link token detection (bms_ref from CRM emails)
 * - Event tracking to Supabase REST API
 *
 * Tracking behaviour:
 *   - ALL visitors get a session ID and have activity tracked (page views,
 *     tool usage, CTA clicks). This uses sessionStorage only — no cookies,
 *     no persistent identifiers. Data is linked by session_id.
 *   - When cookies are ACCEPTED, a persistent bms_vid cookie is also set.
 *     This links activity across multiple sessions/visits.
 *   - When cookies are DECLINED, tracking still works for the current session
 *     using the session ID as the visitor_id. The ID is lost when the browser
 *     closes — no persistent tracking occurs.
 *
 * Employer UTM convention:
 *   https://bmortgageservices.co.uk/financial-wellness?utm_source=employer&utm_campaign=acme_corp
 * The utm_campaign value is the employer slug used for engagement reporting.
 */

/* global BMSTracker */
/* eslint-disable no-unused-vars */

var BMS_CONFIG = {
  supabaseUrl: 'https://wrygwbqhhqsqjsabrnlr.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndyeWd3YnFoaHFzcWpzYWJybmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNzMxNDYsImV4cCI6MjA4Njg0OTE0Nn0.TZ2M682nFYaybhUJ0KFYLwC7j0zgT_W4UBgmtTt8TG0',
  crmApiUrl: '',                                       // Optional: external CRM URL (leave empty if CRM shares Supabase)
  cookieExpiry: 180,
  debug: false
};

var BMSTracker = (function() {
  'use strict';

  var _consent = null;
  var _visitorId = null;   // Persistent cookie ID (only when consented)
  var _sessionId = null;   // Session-scoped ID (always available)
  var _utmParams = {};
  var _initialized = false;

  // ─── Utilities ───────────────────────────────────────────

  function generateUUID() {
    var buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    var hex = [];
    for (var i = 0; i < 16; i++) {
      var h = buf[i].toString(16);
      hex.push(h.length === 1 ? '0' + h : h);
    }
    return (
      hex[0] + hex[1] + hex[2] + hex[3] + '-' +
      hex[4] + hex[5] + '-' +
      hex[6] + hex[7] + '-' +
      hex[8] + hex[9] + '-' +
      hex[10] + hex[11] + hex[12] + hex[13] + hex[14] + hex[15]
    );
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    var secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = name + '=' + encodeURIComponent(value) +
      '; expires=' + d.toUTCString() +
      '; path=/' +
      '; SameSite=Lax' +
      secure;
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
  }

  function log() {
    if (BMS_CONFIG.debug && typeof console !== 'undefined') {
      var args = ['[BMSTracker]'];
      for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
      console.log.apply(console, args);
    }
  }

  // ─── Consent ─────────────────────────────────────────────

  function checkConsent() {
    var c = getCookie('bms_consent');
    if (c === '1') return true;
    if (c === '0') return false;
    return null;
  }

  // ─── Cookie & Session Management ────────────────────────

  function initVisitorId() {
    _visitorId = getCookie('bms_vid');
    if (!_visitorId) {
      _visitorId = generateUUID();
      setCookie('bms_vid', _visitorId, BMS_CONFIG.cookieExpiry);
      log('New visitor ID:', _visitorId);
    }
  }

  function initSessionId() {
    try {
      _sessionId = sessionStorage.getItem('bms_sid');
      if (!_sessionId) {
        _sessionId = generateUUID();
        sessionStorage.setItem('bms_sid', _sessionId);
        log('New session ID:', _sessionId);
      }
    } catch (e) {
      _sessionId = generateUUID();
    }
  }

  /**
   * Returns the best available ID for linking records.
   * Persistent visitor ID (cookie) when consented, otherwise session ID.
   */
  function getEffectiveVisitorId() {
    return _visitorId || _sessionId;
  }

  // ─── UTM Capture ─────────────────────────────────────────

  function captureUTMs() {
    try {
      var params = new URLSearchParams(window.location.search);
      var keys = ['utm_source', 'utm_medium', 'utm_campaign'];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var val = params.get(key);
        if (val) {
          _utmParams[key] = val;
          sessionStorage.setItem('bms_' + key, val);
        } else {
          _utmParams[key] = sessionStorage.getItem('bms_' + key) || '';
        }
      }
    } catch (e) {
      log('UTM capture error:', e);
    }
  }

  // ─── Email Link Token ───────────────────────────────────

  function checkEmailToken() {
    try {
      var params = new URLSearchParams(window.location.search);
      var token = params.get('bms_ref');
      if (!token) return;

      log('Email token detected:', token);
      setCookie('bms_ref', token, BMS_CONFIG.cookieExpiry);

      // Store the link click as an activity event with the token in metadata
      sendEvent({
        event_type: 'email_link_click',
        page_url: window.location.pathname,
        metadata: { bms_ref: token }
      });

      // Optionally notify external CRM
      if (BMS_CONFIG.crmApiUrl) {
        try {
          fetch(BMS_CONFIG.crmApiUrl + '/api/track/link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitor_id: getEffectiveVisitorId(), token: token })
          }).catch(function() { log('CRM link tracking failed (expected if CRM not deployed)'); });
        } catch (e) { /* silently fail */ }
      }

      // Strip bms_ref from URL so it doesn't get bookmarked/shared
      params.delete('bms_ref');
      var newUrl = window.location.pathname;
      var remaining = params.toString();
      if (remaining) newUrl += '?' + remaining;
      if (window.location.hash) newUrl += window.location.hash;
      history.replaceState(null, '', newUrl);
    } catch (e) {
      log('Email token error:', e);
    }
  }

  // ─── Data Sending ───────────────────────────────────────

  function sendEvent(eventData) {
    var vid = getEffectiveVisitorId();
    if (!vid) return;

    var payload = {
      visitor_id: vid,
      session_id: _sessionId || '',
      utm_source: _utmParams.utm_source || null,
      utm_medium: _utmParams.utm_medium || null,
      utm_campaign: _utmParams.utm_campaign || null
    };

    for (var key in eventData) {
      if (eventData.hasOwnProperty(key)) {
        payload[key] = eventData[key];
      }
    }

    var url = BMS_CONFIG.supabaseUrl + '/rest/v1/visitor_activity';
    var headers = {
      'apikey': BMS_CONFIG.supabaseAnonKey,
      'Authorization': 'Bearer ' + BMS_CONFIG.supabaseAnonKey,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };

    try {
      fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        keepalive: true
      }).then(function(r) {
        if (!r.ok) r.text().then(function(t) { log('Event error (' + r.status + '):', t); });
      }).catch(function() {});
    } catch (e) { /* silently fail */ }

    log('Event sent:', eventData.event_type, payload);
  }

  function sendToolResult(toolType, resultData, resultSummary) {
    var vid = getEffectiveVisitorId();
    if (!vid) return;

    var payload = {
      visitor_id: vid,
      session_id: _sessionId || '',
      tool_type: toolType,
      result_data: typeof resultData === 'string' ? JSON.parse(resultData) : resultData,
      result_summary: resultSummary || '',
      completed: true
    };

    var url = BMS_CONFIG.supabaseUrl + '/rest/v1/visitor_tool_results';

    try {
      fetch(url, {
        method: 'POST',
        headers: {
          'apikey': BMS_CONFIG.supabaseAnonKey,
          'Authorization': 'Bearer ' + BMS_CONFIG.supabaseAnonKey,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(payload)
      }).then(function(r) {
        if (!r.ok) r.text().then(function(t) { log('Tool result error (' + r.status + '):', t); });
        else log('Tool result saved OK');
      }).catch(function() {});
    } catch (e) { /* silently fail */ }

    log('Tool result sent:', toolType, resultSummary);
  }

  // ─── Public API ─────────────────────────────────────────

  return {
    init: function() {
      if (_initialized) return;
      _initialized = true;

      _consent = checkConsent();

      // Always init session ID and UTMs (sessionStorage, no cookies needed)
      initSessionId();
      captureUTMs();

      // Persistent visitor ID + email token only when consented
      if (_consent) {
        initVisitorId();
        checkEmailToken();
      }

      // Always track page view (uses session ID if no cookie consent)
      this.trackPageView();

      log('Initialized. Consent:', _consent, 'Visitor:', getEffectiveVisitorId(), 'Session:', _sessionId);
    },

    setConsent: function(granted) {
      _consent = granted;
      if (granted) {
        initVisitorId();
        checkEmailToken();
        // Re-track page view with persistent visitor ID
        this.trackPageView();
      } else {
        deleteCookie('bms_vid');
        deleteCookie('bms_ref');
        _visitorId = null;
        // Session-scoped tracking continues via _sessionId
      }
      log('Consent updated:', granted, 'Visitor:', getEffectiveVisitorId());
    },

    trackPageView: function() {
      sendEvent({
        event_type: 'page_view',
        page_url: window.location.pathname + window.location.search,
        page_title: document.title,
        referrer: document.referrer || null
      });
    },

    trackToolStart: function(toolType) {
      sendEvent({
        event_type: 'tool_start',
        tool_type: toolType,
        page_url: window.location.pathname
      });
    },

    trackToolComplete: function(toolType, resultData, resultSummary) {
      sendEvent({
        event_type: 'tool_complete',
        tool_type: toolType,
        page_url: window.location.pathname
      });
      sendToolResult(toolType, resultData, resultSummary);
    },

    trackCTA: function(ctaName) {
      sendEvent({
        event_type: 'cta_click',
        cta_name: ctaName,
        page_url: window.location.pathname
      });
    },

    getVisitorId: function() {
      return getEffectiveVisitorId();
    },

    getSessionId: function() {
      return _sessionId;
    },

    getUTMs: function() {
      return {
        utm_source: _utmParams.utm_source || '',
        utm_medium: _utmParams.utm_medium || '',
        utm_campaign: _utmParams.utm_campaign || ''
      };
    }
  };
})();
