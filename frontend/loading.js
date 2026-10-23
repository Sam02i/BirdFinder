(() => {
  const screen = document.getElementById('page-loader');
  const started = performance.now();
  let finished = false;
  const regions = document.querySelectorAll('.site-header, #content');
  regions.forEach(region => { region.inert = true; });

  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(fallback);
    setTimeout(() => {
      regions.forEach(region => { region.inert = false; });
      screen.classList.add('loader-finished');
      setTimeout(() => screen.remove(), 250);
    }, Math.max(0, 450 - (performance.now() - started)));
  }

  // Never hold the page hostage to a slow image or a failed network request.
  const fallback = setTimeout(finish, 8000);
  screen.querySelector('button').addEventListener('click', finish);
  if (document.readyState === 'complete') finish();
  else window.addEventListener('load', finish, { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) finish(); });
})();
