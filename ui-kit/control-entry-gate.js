(() => {
  const tg = window.Telegram?.WebApp;
  const returnToEzoterium = () => window.location.replace('/?screen=home');

  tg?.ready();
  tg?.expand();

  if (!tg?.initData) {
    returnToEzoterium();
    return;
  }

  if (window.sessionStorage.getItem('ezoterium-control-check') === 'done') {
    window.sessionStorage.removeItem('ezoterium-control-check');
    returnToEzoterium();
    return;
  }
  window.sessionStorage.setItem('ezoterium-control-check', 'done');

  fetch('/api/admin?control=session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': tg.initData
    },
    body: '{}',
    credentials: 'same-origin'
  })
    .then((response) => {
      if (!response.ok) throw new Error('entry_unavailable');
      window.location.reload();
    })
    .catch(returnToEzoterium);
})();
