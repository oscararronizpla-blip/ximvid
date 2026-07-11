(function () {
  try {
    if (window.Capacitor) return;
    if (location.pathname.indexOf('desktop') !== -1) return;
    var ua = navigator.userAgent || '';
    var isMobileUA = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
    var hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    if (!isMobileUA && !hasTouch) {
      location.replace('/desktop.html');
    }
  } catch (e) {}
})();
