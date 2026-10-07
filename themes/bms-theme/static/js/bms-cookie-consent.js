/**
 * BMS Cookie Consent Banner
 * GDPR-compliant, two-button (Accept/Decline), no third-party dependencies.
 * Exposes window.BMSShowCookieBanner() for the footer "Manage Cookies" link.
 *
 * Third-party embeds
 * ------------------
 * Embeds that contact another domain must not load before consent, because the
 * request alone discloses the visitor's IP address. Mark such a script as:
 *
 *   <script type="text/plain" data-bms-consent-src="https://example.com/x.js"></script>
 *
 * A browser will not execute a script with a non-JavaScript type, so nothing
 * is requested until activateConsentedEmbeds() swaps in a real script tag.
 *
 * Alongside it, add a placeholder to show while the embed is blocked:
 *
 *   <div data-bms-consent-placeholder>…explain, offer an Accept button…</div>
 *
 * Any button inside carrying data-bms-consent-accept grants consent and loads
 * the embed in place, without the visitor hunting for the banner.
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

  /**
   * Replace every neutered embed script with a real one, and hide the
   * placeholders. Safe to call more than once — each script is swapped at
   * most once.
   */
  function activateConsentedEmbeds() {
    var pending = document.querySelectorAll('script[data-bms-consent-src]');
    for (var i = 0; i < pending.length; i++) {
      var placeholderScript = pending[i];
      var real = document.createElement('script');
      real.src = placeholderScript.getAttribute('data-bms-consent-src');
      real.async = true;
      // Carry over any other data- attributes the embed may rely on.
      for (var a = 0; a < placeholderScript.attributes.length; a++) {
        var attr = placeholderScript.attributes[a];
        if (attr.name.indexOf('data-') === 0 && attr.name !== 'data-bms-consent-src') {
          real.setAttribute(attr.name, attr.value);
        }
      }
      placeholderScript.parentNode.replaceChild(real, placeholderScript);
    }

    var placeholders = document.querySelectorAll('[data-bms-consent-placeholder]');
    for (var j = 0; j < placeholders.length; j++) {
      placeholders[j].hidden = true;
    }
  }

  function grantConsent() {
    setCookie('bms_consent', '1', 365);
    if (typeof BMSTracker !== 'undefined') BMSTracker.setConsent(true);
    activateConsentedEmbeds();
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
      dismissBanner(banner);
      grantConsent();
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

  document.addEventListener('DOMContentLoaded', function() {
    var consent = getCookie('bms_consent');

    // Show the banner on a first visit only.
    if (consent === null) {
      createBanner();
    }

    if (consent === '1') {
      // Already consented on a previous visit — load the embeds now.
      activateConsentedEmbeds();
    } else {
      // Let a placeholder grant consent in place, so the visitor doesn't have
      // to go looking for the banner to see what they clicked for.
      var buttons = document.querySelectorAll('[data-bms-consent-accept]');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', function() {
          var banner = document.getElementById('bms-cookie-banner');
          if (banner) dismissBanner(banner);
          grantConsent();
        });
      }
    }
  });

  // Expose for footer "Manage Cookies" link
  window.BMSShowCookieBanner = function() {
    var existing = document.getElementById('bms-cookie-banner');
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    createBanner();
  };
})();
