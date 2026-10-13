// Accessible disclosure menus (units, theme, day picker) following the
// WAI-ARIA menu-button pattern: Enter/Space/ArrowDown opens, arrows move,
// Escape closes and returns focus, click outside closes.

const items = (panel) => [...panel.querySelectorAll('[role^="menuitem"]')];

function open(trigger, panel, focus = 'first') {
  closeAll(trigger);
  panel.hidden = false;
  trigger.setAttribute('aria-expanded', 'true');
  const list = items(panel);
  const checked = list.find((el) => el.getAttribute('aria-checked') === 'true');
  const target = focus === 'last' ? list.at(-1) : focus === 'checked' && checked ? checked : list[0];
  target?.focus();
}

function close(trigger, panel, { restoreFocus = false } = {}) {
  if (panel.hidden) return;
  panel.hidden = true;
  trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger.focus();
}

function closeAll(except) {
  document.querySelectorAll('[data-menu] > .menu__trigger[aria-expanded="true"]').forEach((t) => {
    if (t !== except) close(t, document.getElementById(t.getAttribute('aria-controls')));
  });
}

export function initMenus() {
  document.querySelectorAll('[data-menu]').forEach((root) => {
    const trigger = root.querySelector('.menu__trigger');
    const panel = document.getElementById(trigger.getAttribute('aria-controls'));

    trigger.addEventListener('click', () => {
      panel.hidden ? open(trigger, panel, 'checked') : close(trigger, panel);
    });
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); open(trigger, panel, 'first'); }
      if (e.key === 'ArrowUp') { e.preventDefault(); open(trigger, panel, 'last'); }
    });

    panel.addEventListener('keydown', (e) => {
      const list = items(panel);
      const i = list.indexOf(document.activeElement);
      const move = (n) => { e.preventDefault(); list[(i + n + list.length) % list.length].focus(); };
      switch (e.key) {
        case 'ArrowDown': move(1); break;
        case 'ArrowUp': move(-1); break;
        case 'Home': e.preventDefault(); list[0].focus(); break;
        case 'End': e.preventDefault(); list.at(-1).focus(); break;
        case 'Escape': e.preventDefault(); close(trigger, panel, { restoreFocus: true }); break;
        case 'Tab': close(trigger, panel); break;
        default: break;
      }
    });

    // Selecting an item closes single-choice menus (marked data-close-on-select).
    panel.addEventListener('click', (e) => {
      if (e.target.closest('[role^="menuitem"]') && panel.dataset.closeOnSelect !== undefined) {
        close(trigger, panel, { restoreFocus: true });
      }
    });
  });

  document.addEventListener('pointerdown', (e) => {
    if (!e.target.closest('[data-menu]')) closeAll();
  });
}
