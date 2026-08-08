const ZODIAC = Object.freeze([
  ['Овен', '♈'], ['Телец', '♉'], ['Близнецы', '♊'], ['Рак', '♋'],
  ['Лев', '♌'], ['Дева', '♍'], ['Весы', '♎'], ['Скорпион', '♏'],
  ['Стрелец', '♐'], ['Козерог', '♑'], ['Водолей', '♒'], ['Рыбы', '♓']
]);

// Mean orbital periods create a stable visual ephemeris offline. The UI calls
// this a calculated symbolic map, not a substitute for professional software.
const PLANETS = Object.freeze([
  ['Солнце', '☉', 365.256, 280.46], ['Луна', '☽', 27.322, 218.32],
  ['Меркурий', '☿', 87.969, 252.25], ['Венера', '♀', 224.701, 181.98],
  ['Марс', '♂', 686.98, 355.43], ['Юпитер', '♃', 4332.59, 34.35],
  ['Сатурн', '♄', 10759.22, 50.08], ['Уран', '♅', 30688.5, 314.05],
  ['Нептун', '♆', 60182, 304.35], ['Плутон', '♇', 90560, 238.93]
]);

const J2000 = Date.UTC(2000, 0, 1, 12);

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function parseMoment(date, time, timeKnown) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(String(date)) ? date : '2000-01-01';
  const safeTime = timeKnown && /^\d{2}:\d{2}$/.test(String(time)) ? time : '12:00';
  const moment = new Date(`${safeDate}T${safeTime}:00`);
  return Number.isNaN(moment.getTime()) ? new Date(J2000) : moment;
}

export function buildNatalChart({ date, time = '12:00', timeKnown = true, place = '' } = {}) {
  const moment = parseMoment(date, time, timeKnown);
  const days = (moment.getTime() - J2000) / 86_400_000;
  const hour = moment.getHours() + moment.getMinutes() / 60;
  const ascendant = timeKnown ? normalizeDegrees(hour * 15 + days * 0.985647) : 0;
  const planets = PLANETS.map(([name, glyph, period, epoch], index) => {
    const longitude = normalizeDegrees(epoch + (days / period) * 360 + Math.sin((days + index * 71) / period * Math.PI * 2) * (index < 5 ? 3.2 : 1.2));
    const signIndex = Math.floor(longitude / 30);
    return { name, glyph, longitude, degree: longitude % 30, sign: ZODIAC[signIndex][0], signGlyph: ZODIAC[signIndex][1] };
  });
  const houses = Array.from({ length: 12 }, (_, index) => ({
    number: index + 1,
    cusp: normalizeDegrees(ascendant + index * 30),
    sign: ZODIAC[Math.floor(normalizeDegrees(ascendant + index * 30) / 30)][0]
  }));
  const aspects = [];
  for (let a = 0; a < planets.length; a += 1) {
    for (let b = a + 1; b < planets.length; b += 1) {
      const delta = Math.min(Math.abs(planets[a].longitude - planets[b].longitude), 360 - Math.abs(planets[a].longitude - planets[b].longitude));
      const match = [[0, 'соединение', 7], [60, 'секстиль', 4], [90, 'квадрат', 5], [120, 'тригон', 5], [180, 'оппозиция', 7]].find(([angle, , orb]) => Math.abs(delta - angle) <= orb);
      if (match) aspects.push({ from: planets[a].name, to: planets[b].name, type: match[1], angle: match[0], orb: Math.abs(delta - match[0]) });
    }
  }
  return {
    calculatedAt: moment.toISOString(),
    accuracy: timeKnown && String(place).trim() && String(place).trim().toLocaleLowerCase('ru') !== 'не знаю' ? 'time-based' : 'partial',
    ascendant,
    zodiac: ZODIAC.map(([name, glyph], index) => ({ name, glyph, start: index * 30 })),
    houses,
    planets,
    aspects: aspects.sort((left, right) => left.orb - right.orb).slice(0, 12)
  };
}

export function polarPoint(angle, radius, center = 160) {
  const radians = (angle - 90) * Math.PI / 180;
  return { x: center + Math.cos(radians) * radius, y: center + Math.sin(radians) * radius };
}
