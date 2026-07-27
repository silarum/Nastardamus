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

test('gift wheel and primary navigation preserve their geometry', () => {
  const wheelComponent = readFileSync(new URL('../ui-kit/components/FortuneWheel.js', import.meta.url), 'utf8');
  assert.doesNotMatch(wheelComponent, /WheelSegment|values=/);
  assert.doesNotMatch(wheelComponent, /WheelPointer|n-wheel-pointer/);
  assert.match(components, /\.n-bottom-navigation::before\s*\{/s);
  assert.match(components, /\.n-bottom-nav-item\s*\{[^}]*min-height:\s*52px/s);
  assert.match(components, /\.n-icon-button\s*\{[^}]*width:\s*44px;\s*height:\s*44px/s);
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
  assert.match(appSource, /screen:\s*requestedScreen\s*\|\|\s*'welcome'/);
  assert.match(appSource, /function hideBootScreen\(\)/);
});

test('every illustrated module uses the approved PNG asset set', () => {
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
    'two-photo-compatibility.png'
  ];

  assert.deepEqual(files.sort(), expected.sort());
  assert.equal(existsSync(legacyArt), false, 'Legacy illustrated SVG placeholders must not return');

  let totalBytes = 0;
  for (const name of files) {
    const data = readFileSync(new URL(name, artV2));
    const width = data.readUInt32BE(16);
    const height = data.readUInt32BE(20);
    const colorType = data[25];

    totalBytes += data.length;
    assert.equal(data.subarray(1, 4).toString('ascii'), 'PNG', `${name} is not a PNG`);
    assert.ok(data.length > 10_000, `${name} looks like an empty placeholder`);
    assert.ok(data.length < 2_500_000, `${name} exceeds the per-asset delivery budget`);
    assert.ok(width <= 960 && height <= 1_700, `${name} exceeds the Retina delivery dimensions`);
    assert.equal(
      colorType,
      name === 'cosmic-background.png' ? 2 : 6,
      `${name} does not use the expected ${name === 'cosmic-background.png' ? 'RGB' : 'RGBA'} format`
    );
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
