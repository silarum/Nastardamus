(function redirectLegacyTelegramEntry(global) {
  const canonicalOrigin = 'https://nastardamus.vercel.app';
  const current = new URL(global.location.href);
  const scriptSource = String(global.document?.currentScript?.src || '');
  const legacyGithubPages = current.hostname.toLowerCase() === 'silarum.github.io';
  const legacyProjectPath = /^\/Nastardamus(?:\/|$)/iu.test(current.pathname)
    || /\/Nastardamus\/ui-kit\/canonical-entry\.js(?:$|\?)/iu.test(scriptSource);

  if (!legacyGithubPages && !legacyProjectPath) return;

  let pathname = current.pathname.replace(/^\/Nastardamus(?=\/|$)/iu, '') || '/';
  if (pathname === '/index.html') pathname = '/';

  const target = new URL(pathname, canonicalOrigin);
  target.search = current.search;
  target.hash = current.hash;

  global.document.documentElement.dataset.canonicalRedirect = 'pending';
  global.stop?.();
  global.location.replace(target.toString());
})(window);
