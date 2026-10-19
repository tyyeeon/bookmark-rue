/* Presentation-only helper. No data, network, storage, dates or calendar writes. */
(function () {
  'use strict';
  let observer;
  function refresh() {
    const agenda = document.getElementById('agenda');
    const handle = document.getElementById('handle');
    if (agenda && handle) {
      const expanded = !agenda.classList.contains('collapsed');
      const value = String(expanded);
      if (handle.getAttribute('aria-expanded') !== value) handle.setAttribute('aria-expanded', value);
      const label = expanded ? '선택 날짜 일정 접기' : '선택 날짜 일정 펼치기';
      if (handle.getAttribute('aria-label') !== label) handle.setAttribute('aria-label', label);
    }
    document.querySelectorAll('#mobile-nav button, #desktop-nav button').forEach(button => {
      if (button.classList.contains('active')) {
        if (button.getAttribute('aria-current') !== 'page') button.setAttribute('aria-current', 'page');
      } else if (button.hasAttribute('aria-current')) button.removeAttribute('aria-current');
    });
  }
  function mount() {
    if (observer) return;
    observer = new MutationObserver(refresh);
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['class']});
    refresh();
  }
  window.HaruGlass = {mount, refresh, destroy() {if (observer) observer.disconnect(); observer = null;}};
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once: true});
  else mount();
})();
