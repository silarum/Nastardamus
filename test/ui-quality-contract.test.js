import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

const components = readFileSync(new URL('../ui-kit/components.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../ui-kit/app.css', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../ui-kit/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = `${components}\n${app}`;
const artV2 = new URL('../ui-kit/assets/art-v2/', import.meta.url);
const legacyArt = new URL('../ui-kit/assets/art/', import.meta.url);
const invites = new URL('../images/invites/', import.meta.url);

test('premium UI keeps readable text and complete mobile headers', () => {
  const pixelFontSizes = [...css.matchAll(/font-size\s*:\s*([0-9.]+)px/g)]
    .map((match) => Number(match[1]));

  assert.ok(pixelFontSizes.length > 0);
  assert.ok(pixelFontSizes.every((size) => size >= 10), 'UI contains text smaller than 10px');
  assert.match(components, /\.n-app-header__title strong\s*\{[^}]*white-space:\s*normal/s);
  assert.doesNotMatch(components, /\.n-app-header__title strong\s*\{[^}]*text-overflow:\s*ellipsis/s);
  assert.match(app, /\.premium-wallet-state\s*\{[^}]*white-space:\s*normal/s);
  assert.doesNotMatch(app, /\.premium-wallet-state\s*\{[^}]*text-overflow:\s*ellipsis/s);
});

test('gift wheel and compact five-slot navigation preserve their geometry', () => {
  const wheelComponent = readFileSync(new URL('../ui-kit/components/FortuneWheel.js', import.meta.url), 'utf8');
  const navigation = readFileSync(new URL('../ui-kit/components/BottomNavigation.js', import.meta.url), 'utf8');
  assert.doesNotMatch(wheelComponent, /WheelSegment|values=/);
  assert.match(wheelComponent, /WheelPointer/);
  assert.match(components, /\.n-wheel-pointer\s*\{[^}]*left:\s*50%/s);
  assert.match(components, /\.n-bottom-navigation\s*\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/s);
  assert.match(components, /\.n-bottom-nav-item\s*\{[^}]*min-height:\s*50px/s);
  assert.equal((navigation.match(/\bitem\("/g) || []).length, 5);
  assert.doesNotMatch(navigation, /CenterMagicButton/);
  assert.match(components, /\.n-icon-button\s*\{[^}]*width:\s*44px;\s*height:\s*44px/s);
  assert.match(appSource, /SectionTitle\(\{\s*text:\s*'Ваши практики'/);
  assert.match(appSource, /homePracticeCard\('palm-oracle'[\s\S]*homePracticeCard\('rune-sanctum'[\s\S]*homePracticeCard\('tarot-deck'[\s\S]*homePracticeCard\('amur-dice'/);
});

test('Amur and palm journeys keep their artwork and controls aligned', () => {
  assert.match(components, /\.n-goal-chip\s*\{[^}]*height:\s*72px/s);
  assert.match(components, /\.n-energy-hands-scene\s*\{[^}]*overflow:\s*visible/s);
  assert.match(components, /\.n-palm-graphic--left\s*\{[^}]*left:\s*0/s);
  assert.match(components, /\.n-palm-graphic--right\s*\{[^}]*right:\s*0/s);
  assert.match(app, /\.premium-screen\s*\{[^}]*calc\(94px \+ max\(env\(safe-area-inset-bottom/s);
  assert.match(appSource, /function amurScreen\(\)/);
  assert.match(appSource, /serviceTile\('partner-invite-emblem',\s*'Личное приглашение'/);
  assert.match(appSource, /function palmReadingScreen\(\)/);
  assert.match(appSource, /Реальный диалог перед толкованием/);
});

test('reading mode removes navigation overlays and uses natural page scrolling', () => {
  assert.match(
    appSource,
    /tabs\s*&&\s*!reading\s*\?\s*BottomNavigation/
  );
  assert.match(
    appSource,
    /function resultScreen[\s\S]*\{\s*tabs:\s*false,\s*reading:\s*true\s*\}/
  );
  assert.match(
    app,
    /\.premium-screen--reading\s*\{[^}]*padding-bottom:\s*calc\(32px \+ env\(safe-area-inset-bottom/s
  );
  assert.match(
    app,
    /\.premium-shell--reading \.premium-result-reading\s*\{[^}]*max-height:\s*none;[^}]*overflow:\s*visible/s
  );
});

test('profile exposes a voluntary grammatical gender preference', () => {
  assert.match(appSource, /female:\s*\{\s*label:\s*'Женщина'/s);
  assert.match(appSource, /male:\s*\{\s*label:\s*'Мужчина'/s);
  assert.match(appSource, /unspecified:\s*\{\s*label:\s*'Не указывать'/s);
  assert.match(appSource, /не угадываем пол по имени или фотографии/i);
});

test('startup renders the branded elder splash without waiting for Telegram', () => {
  const appBundleIndex = html.indexOf('/ui-kit/app.bundle.js');
  const telegramSdkIndex = html.indexOf('telegram-web-app.js');

  assert.ok(appBundleIndex >= 0);
  assert.ok(telegramSdkIndex > appBundleIndex, 'Local application must start before the Telegram SDK');
  assert.match(html, /<script async id="telegram-web-app-sdk"/);
  assert.match(html, /splash-v2\.webp/);
  assert.match(html, />Nastardamus</);
  assert.doesNotMatch(html, /setTimeout\(window\.hideNastardamusBoot/);
  assert.match(
    appSource,
    /screen:\s*requestedScreen\s*\|\|\s*\(requestedInvitationToken\s*\?\s*'invitation'\s*:\s*\(storedProfile\.completed\s*\?\s*'home'\s*:\s*'welcome'\)\)/
  );
  assert.match(appSource, /function hideBootScreen\(\)/);
});

test('public services use neutral badges and language', () => {
  assert.match(appSource, /function serviceBadge\(id, fallback = ''\)/);
  assert.doesNotMatch(appSource, /[«"'`\s>]AI[»"'`<\s]/);
  assert.doesNotMatch(appSource, /нейросет|искусственн(?:ый|ого) интеллект/i);
});

test('every illustrated module uses the approved optimized asset set', () => {
  const files = readdirSync(artV2);
  const expected = [
    'astrology-forecast.png', 'avatar-seeker.png', 'brand-sun.png', 'connection-heart.png',
    'cosmic-background.png', 'cosmic-card.png', 'cosmic-footer-divider.png', 'energy-hands.png',
    'fortune-wheel.png', 'greeting-compass.png', 'laurel-left.png', 'laurel-right.png',
    'metric-heart-seal.png', 'metric-palm-seal.png', 'metric-tarot-seal.png',
    'nav-magic-sun.png', 'palm-left.png', 'palm-right.png', 'partner-invite-emblem.png', 'photo-energy-imprint.png',
    'photo-palm.png', 'portrait-man.png', 'portrait-woman.png',
    'result-magic-seal.png', 'ritual-tarot-spread.png', 'silarum-coin.png',
    'shortcut-astro-orbit.png', 'shortcut-destiny-hearts.png', 'shortcut-fortune-compass.png', 'tarot-deck.png',
    'two-photo-compatibility.png', 'sports-prophecy-banner.png',
    'amur-dice.webp', 'palm-oracle.webp', 'rune-sanctum.webp'
  ];

  assert.deepEqual(files.sort(), expected.sort());
  assert.equal(existsSync(legacyArt), false, 'Legacy illustrated SVG placeholders must not return');

  let totalBytes = 0;
  for (const name of files) {
    const data = readFileSync(new URL(name, artV2));
    totalBytes += data.length;
    assert.ok(data.length > 10_000, `${name} looks like an empty placeholder`);
    assert.ok(data.length < 2_500_000, `${name} exceeds the per-asset delivery budget`);
    if (name.endsWith('.webp')) {
      assert.equal(data.subarray(0, 4).toString('ascii'), 'RIFF', `${name} is not a WebP`);
      assert.equal(data.subarray(8, 12).toString('ascii'), 'WEBP', `${name} is not a WebP`);
    } else {
      const width = data.readUInt32BE(16);
      const height = data.readUInt32BE(20);
      const colorType = data[25];
      assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG', `${name} is not a PNG`);
      assert.ok(width <= 960 && height <= 1_700, `${name} exceeds the Retina delivery dimensions`);
      assert.equal(
        colorType,
        name === 'cosmic-background.png' ? 2 : 6,
        `${name} does not use the expected ${name === 'cosmic-background.png' ? 'RGB' : 'RGBA'} format`
      );
    }
  }

  assert.ok(totalBytes < 16_000_000, 'Illustrated asset bundle exceeds the 16 MB delivery budget');
});

test('paired invitations have an original image for every category', () => {
  assert.deepEqual(
    readdirSync(invites).sort(),
    ['business.png', 'creative.png', 'friendship.png', 'love.png']
  );
  for (const name of readdirSync(invites)) {
    const data = readFileSync(new URL(name, invites));
    assert.ok(data.length > 100_000, `${name} is too small to be a finished invitation`);
    assert.equal(data.readUInt32BE(16), 720);
    assert.equal(data.readUInt32BE(20), 720);
  }
});
