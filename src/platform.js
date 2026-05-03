// Платформенные признаки для web/Android-обертки.
(function () {
  const G = (window.G = window.G || {});

  function hasCoarsePointer() {
    try {
      return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (e) {
      return false;
    }
  }

  function isCapacitorAndroid() {
    try {
      if (window.Capacitor && window.Capacitor.getPlatform) {
        return window.Capacitor.getPlatform() === 'android';
      }
    } catch (e) {}
    return false;
  }

  const ua = navigator.userAgent || '';
  const capacitorLocalAndroid = /Android/i.test(ua) && /\bwv\b/i.test(ua) && window.location.hostname === 'localhost';
  const android = isCapacitorAndroid() || window.location.protocol === 'capacitor:' || capacitorLocalAndroid;
  const touch = hasCoarsePointer() || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;

  G.platform = {
    android,
    capacitor: !!window.Capacitor,
    touch,
  };

  function markBody() {
    if (!document.body) return;
    if (android) document.body.classList.add('android-app');
    if (touch) document.body.classList.add('touch-device');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markBody, { once: true });
  } else {
    markBody();
  }
})();
