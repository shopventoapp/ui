(() => {
  let saved;
  try { saved = localStorage.getItem('shopvento-docs-theme'); } catch {}
  const theme = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('[data-theme-toggle]');
    const update = () => { if (button) button.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light theme' : 'Dark theme'; };
    update();
    button?.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('shopvento-docs-theme', next); } catch {}
      // TypeDoc also reads this preference for its built-in controls.
      try { localStorage.setItem('tsd-theme', next); } catch {}
      update();
    });
  });
})();
