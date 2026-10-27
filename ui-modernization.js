/* Presentation and accessibility only: reuse existing data and event handlers. */
(() => {
  const dashboard = document.getElementById('panel-dashboard');
  const snapshot = document.getElementById('mgmt-snapshot');
  if (dashboard && snapshot) {
    const attention = document.createElement('section');
    attention.className = 'opexa-attention-grid';
    attention.setAttribute('aria-label', 'Sites and priority concerns needing review');
    ['mgmt-site-risk', 'mgmt-critical-list'].forEach(id => {
      const card = document.getElementById(id)?.closest('.chart-card');
      if (card) attention.append(card);
    });
    snapshot.after(attention);
  }

  // Associate existing visual labels without replacing controls or listeners.
  document.querySelectorAll('.field > label').forEach(label => {
    if (label.htmlFor || label.querySelector('input,select,textarea')) return;
    const control = label.parentElement.querySelector('input:not([type=hidden]),select,textarea');
    if (control?.id && !control.hidden && control.getAttribute('aria-hidden') !== 'true') label.htmlFor = control.id;
  });
  document.querySelectorAll('.err,.login-error,#visit-step-error').forEach(error => {
    error.setAttribute('role', 'alert');
    if (!error.id) return;
    const control = error.parentElement.querySelector('input:not([type=hidden]),select,textarea');
    if (!control) return;
    const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(error.id);
    control.setAttribute('aria-describedby', [...ids].join(' '));
  });
  const client = document.getElementById('location-combobox');
  const clientError = document.getElementById('site-err');
  if (client && clientError) {
    document.querySelector('label[for="f-site"]')?.setAttribute('for', client.id);
    client.setAttribute('aria-describedby', clientError.id);
    client.setAttribute('aria-required', 'true');
    const sync = () => client.setAttribute('aria-invalid', String(clientError.style.display === 'block'));
    new MutationObserver(sync).observe(clientError, {attributes:true,attributeFilter:['style']});
    sync();
  }
  document.querySelectorAll('.app-nav .tab[data-tab]').forEach(tab => {
    tab.setAttribute('role', 'button');
    tab.tabIndex = 0;
    tab.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();tab.click();}
    });
    const sync = () => {
      if (tab.classList.contains('active')) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    };
    new MutationObserver(sync).observe(tab, {attributes:true, attributeFilter:['class']});
    sync();
  });
  const content = document.querySelector('.app-content');
  if (content) {
    content.id = 'main-content';
    content.tabIndex = -1;
    const skip = document.createElement('a');
    skip.className = 'opexa-skip-link';skip.href = '#main-content';skip.textContent = 'Skip to content';
    document.getElementById('app-shell').prepend(skip);
  }

  // Retain the drawer controller; add focus containment and Escape dismissal.
  const drawer = document.getElementById('mobile-nav-drawer');
  const opener = document.getElementById('mobile-menu-btn');
  const closer = document.getElementById('mobile-menu-close');
  if (drawer && opener && closer) {
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-label', 'Navigation');
    opener.setAttribute('aria-controls', drawer.id);
    let wasOpen = false;
    const sync = () => {
      const open = drawer.classList.contains('open');
      drawer.inert = !open;
      opener.setAttribute('aria-expanded', String(open));
      if (open) {drawer.setAttribute('aria-modal', 'true');if (!wasOpen) closer.focus();}
      else {drawer.removeAttribute('aria-modal');if (wasOpen && drawer.contains(document.activeElement)) opener.focus();}
      wasOpen = open;
    };
    new MutationObserver(sync).observe(drawer, {attributes:true, attributeFilter:['class']});
    sync();
    document.addEventListener('keydown', event => {
      if (!drawer.classList.contains('open')) return;
      if (event.key === 'Escape') {event.preventDefault();closer.click();return;}
      if (event.key !== 'Tab') return;
      const items = [...drawer.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {event.preventDefault();last?.focus();}
      else if (!event.shiftKey && document.activeElement === last) {event.preventDefault();first?.focus();}
    });
    window.matchMedia('(max-width:900px)').addEventListener('change', event => {
      if (!event.matches && drawer.classList.contains('open')) closer.click();
    });
  }

  // Mobile Save mirrors the real submit button's busy state, including failures.
  const submit = document.getElementById('submit-btn');
  const mobileSave = document.getElementById('mobile-save-fab');
  if (submit && mobileSave) {
    const sync = () => {
      mobileSave.disabled = submit.disabled;
      mobileSave.setAttribute('aria-busy', String(submit.disabled));
      const label = mobileSave.querySelector('span');
      if (label) label.textContent = submit.disabled ? 'Saving visit…' : (/save changes/i.test(submit.textContent) ? 'Save Changes' : 'Save Field Visit');
    };
    new MutationObserver(sync).observe(submit, {attributes:true, attributeFilter:['disabled'],childList:true,subtree:true,characterData:true});
    sync();
  }
})();
