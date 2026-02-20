/**
 * BMS Cookie Consent Banner
 * GDPR-compliant, two-button (Accept/Decline), no third-party dependencies.
 * Exposes window.BMSShowCookieBanner() for the footer "Manage Cookies" link.
 */
(function() {
  'use strict';

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
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

  function createBanner() {
    var banner = document.createElement('div');
    banner.id = 'bms-cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');

    var inner = document.createElement('div');
    inner.className = 'cookie-banner__inner';

    var text = document.createElement('p');
    text.className = 'cookie-banner__text';
    text.innerHTML = 'We use cookies to improve your experience and understand how our tools are used. ' +
      'See our <a href="/cookie-policy/">Cookie Policy</a> and ' +
      '<a href="/images/privacy-policy.pdf" target="_blank">Privacy Policy</a>.';

    var actions = document.createElement('div');
    actions.className = 'cookie-banner__actions';

    var acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn btn--primary cookie-banner__btn';
    acceptBtn.textContent = 'Accept';
    acceptBtn.addEventListener('click', function() {
      setCookie('bms_consent', '1', 365);
      dismissBanner(banner);
      if (typeof BMSTracker !== 'undefined') BMSTracker.setConsent(true);
    });

    var declineBtn = document.createElement('button');
    declineBtn.className = 'btn btn--outline cookie-banner__btn';
    declineBtn.textContent = 'Decline';
    declineBtn.addEventListener('click', function() {
      setCookie('bms_consent', '0', 365);
      dismissBanner(banner);
      if (typeof BMSTracker !== 'undefined') BMSTracker.setConsent(false);
    });

    actions.appendChild(acceptBtn);
    actions.appendChild(declineBtn);
    inner.appendChild(text);
    inner.appendChild(actions);
    banner.appendChild(inner);
    document.body.appendChild(banner);

    return banner;
  }

  function dismissBanner(banner) {
    banner.classList.add('cookie-banner--hidden');
    setTimeout(function() {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 400);
  }

  // Show banner on first visit (no consent cookie set)
  document.addEventListener('DOMContentLoaded', function() {
    var consent = getCookie('bms_consent');
    if (consent === null) {
      createBanner();
    }
  });

  // Expose for footer "Manage Cookies" link
  window.BMSShowCookieBanner = function() {
    var existing = document.getElementById('bms-cookie-banner');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    createBanner();
  };
})();
