import './build-client.mjs';

const profileSyncRequested = /\[sync-telegram-profile\]/iu.test(
  process.env.VERCEL_GIT_COMMIT_MESSAGE || ''
);

if (process.env.VERCEL_ENV === 'production' && profileSyncRequested) {
  await import('./configure-telegram.mjs');
} else {
  console.log('Telegram profile sync was not requested for this deployment.');
}
