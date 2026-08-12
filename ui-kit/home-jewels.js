const JEWELS = {
  compass: `
    <svg viewBox="0 0 240 144" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false">
      <defs>
        <radialGradient id="hj-compass-core" cx="50%" cy="42%" r="58%">
          <stop offset="0" stop-color="#9d5cff" stop-opacity=".62"/>
          <stop offset=".42" stop-color="#3e185f" stop-opacity=".54"/>
          <stop offset="1" stop-color="#090616" stop-opacity=".08"/>
        </radialGradient>
        <linearGradient id="hj-compass-gold" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff0ad"/>
          <stop offset=".25" stop-color="#d9a84f"/>
          <stop offset=".56" stop-color="#fff1b5"/>
          <stop offset="1" stop-color="#8d5423"/>
        </linearGradient>
        <filter id="hj-compass-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="3.4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="121" cy="73" rx="77" ry="57" fill="url(#hj-compass-core)"/>
      <g class="home-jewel__orbit" fill="none" stroke="url(#hj-compass-gold)">
        <ellipse cx="121" cy="73" rx="72" ry="52" stroke-width="1.2" opacity=".78"/>
        <ellipse cx="121" cy="73" rx="60" ry="43" stroke-width=".7" stroke-dasharray="2 6" opacity=".7"/>
        <circle cx="121" cy="73" r="34" stroke-width="1" opacity=".48"/>
        <path d="M49 73h144M121 21v104M70 36l102 74M70 110l102-74" stroke-width=".55" opacity=".35"/>
      </g>
      <g fill="url(#hj-compass-gold)" filter="url(#hj-compass-glow)">
        <circle cx="121" cy="17" r="2.4"/><circle cx="121" cy="129" r="2.4"/>
        <circle cx="43" cy="73" r="2.4"/><circle cx="199" cy="73" r="2.4"/>
        <circle cx="66" cy="34" r="1.7"/><circle cx="176" cy="34" r="1.7"/>
        <circle cx="66" cy="112" r="1.7"/><circle cx="176" cy="112" r="1.7"/>
      </g>
      <g class="home-jewel__spin" transform-origin="121px 73px">
        <path d="M121 29 130 63 164 73 130 83 121 117 112 83 78 73 112 63Z" fill="rgba(9,5,22,.72)" stroke="url(#hj-compass-gold)" stroke-width="1.4"/>
        <path d="m121 36 6 31-6 6-6-6Z" fill="url(#hj-compass-gold)"/>
        <path d="m121 110-6-31 6-6 6 6Z" fill="#7541a1" stroke="#e7bf67" stroke-width=".65"/>
        <path d="m86 73 29-6 6 6-6 6Z" fill="#b27a35" opacity=".86"/>
        <path d="m156 73-29 6-6-6 6-6Z" fill="#f8dea0" opacity=".9"/>
        <circle cx="121" cy="73" r="8.5" fill="#140b25" stroke="url(#hj-compass-gold)" stroke-width="1.3"/>
        <circle cx="121" cy="73" r="3" fill="#eac466" filter="url(#hj-compass-glow)"/>
      </g>
      <path d="M113 16q8-9 16 0M113 130q8 9 16 0M42 65q-9 8 0 16M200 65q9 8 0 16" fill="none" stroke="url(#hj-compass-gold)" stroke-width="1.1" opacity=".8"/>
    </svg>`,

  tarot: `
    <svg viewBox="0 0 188 122" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false">
      <defs>
        <linearGradient id="hj-tarot-edge" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff0b0"/><stop offset=".32" stop-color="#c78835"/><stop offset=".7" stop-color="#f3cf76"/><stop offset="1" stop-color="#71431d"/>
        </linearGradient>
        <radialGradient id="hj-tarot-face" cx="50%" cy="38%" r="75%">
          <stop stop-color="#4f247a"/><stop offset=".54" stop-color="#19102e"/><stop offset="1" stop-color="#080713"/>
        </radialGradient>
        <filter id="hj-tarot-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5"/>
        </filter>
      </defs>
      <ellipse class="home-jewel__pulse" cx="100" cy="91" rx="60" ry="20" fill="#8c43ef" opacity=".36" filter="url(#hj-tarot-glow)"/>
      <g class="home-jewel__float">
        <g transform="translate(34 22) rotate(-17 50 43)">
          <rect x="2" y="8" width="89" height="83" rx="8" fill="#070711" stroke="#6d481f" stroke-width="4"/>
          <path d="M8 85 86 17v69H8Z" fill="#171022" opacity=".82"/>
        </g>
        <g transform="translate(46 15) rotate(-7 48 46)">
          <rect x="2" y="7" width="88" height="86" rx="8" fill="#0a0915" stroke="#a8732f" stroke-width="4"/>
          <path d="M9 16h74v69H9Z" fill="none" stroke="#e5bd61" stroke-width=".7" opacity=".6"/>
        </g>
        <g transform="translate(60 8) rotate(8 44 47)">
          <rect x="1" y="5" width="86" height="91" rx="9" fill="url(#hj-tarot-face)" stroke="url(#hj-tarot-edge)" stroke-width="3"/>
          <rect x="7" y="11" width="74" height="79" rx="6" fill="none" stroke="#e7c269" stroke-width=".85" opacity=".78"/>
          <path d="M15 19q6 0 6-6M73 19q-6 0-6-6M15 82q6 0 6 6M73 82q-6 0-6 6" fill="none" stroke="#d9ad54" stroke-width="1"/>
          <circle cx="44" cy="50" r="23" fill="none" stroke="#d7ac56" stroke-width=".75" opacity=".72"/>
          <path d="M44 22 48 44 69 50 48 56 44 78 40 56 19 50 40 44Z" fill="none" stroke="url(#hj-tarot-edge)" stroke-width="1.25"/>
          <path d="M48 36a13 13 0 1 0 0 27 15 15 0 0 1 0-27Z" fill="#f2cc6f" opacity=".9"/>
          <circle cx="58" cy="31" r="1.5" fill="#fff2b4"/><circle cx="27" cy="66" r="1.2" fill="#d69aff"/>
          <circle cx="64" cy="70" r="1" fill="#fff2b4"/><circle cx="26" cy="33" r=".9" fill="#fff2b4"/>
        </g>
      </g>
    </svg>`,

  runes: `
    <svg viewBox="0 0 188 122" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false">
      <defs>
        <radialGradient id="hj-rune-stone" cx="36%" cy="28%" r="74%">
          <stop stop-color="#3a3840"/><stop offset=".4" stop-color="#171722"/><stop offset="1" stop-color="#070810"/>
        </radialGradient>
        <linearGradient id="hj-rune-gold" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff0a9"/><stop offset=".38" stop-color="#c58a37"/><stop offset=".68" stop-color="#f2ca6b"/><stop offset="1" stop-color="#71451d"/>
        </linearGradient>
        <filter id="hj-rune-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="2.4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="94" cy="64" rx="56" ry="48" fill="#7d3fc4" opacity=".2" filter="url(#hj-rune-glow)"/>
      <path d="M42 51C46 20 72 7 103 12c34 5 54 27 48 59-5 31-31 45-65 41-32-4-50-27-44-61Z" fill="url(#hj-rune-stone)" stroke="#4b443b" stroke-width="2.2"/>
      <path d="M52 43c13-20 45-27 69-16M48 82c13 21 43 28 69 17" fill="none" stroke="#79717d" stroke-width=".65" opacity=".34"/>
      <g class="home-jewel__rune-glow" fill="none" stroke="#f0cf79" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" filter="url(#hj-rune-glow)">
        <path d="M74 40v36m0-19 16-17m-16 17 17 18"/>
        <path d="M104 37v39m0-38 17 11-17 10"/>
        <path d="m74 88 13-11 12 11 13-11"/>
      </g>
      <g class="home-jewel__orbit" fill="none" stroke="url(#hj-rune-gold)" stroke-linecap="round">
        <path d="M32 74C13 44 51 16 79 13c35-4 71 11 82 37 11 27-14 54-48 60" stroke-width="1.1"/>
        <path d="M26 83c24-16 31-37 23-63M159 40c-19 12-28 36-21 59" stroke-width=".75" opacity=".76"/>
        <path d="m29 74 6-1-2 6M48 22l5 3-5 3M137 99l5 3-5 3" stroke-width="1.2"/>
      </g>
      <circle cx="32" cy="74" r="2.2" fill="#f0ca71"/><circle cx="160" cy="40" r="1.8" fill="#f8dea0"/>
    </svg>`,

  astrology: `
    <svg viewBox="0 0 188 122" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false">
      <defs>
        <linearGradient id="hj-astro-gold" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff3b2"/><stop offset=".34" stop-color="#c68e3b"/><stop offset=".68" stop-color="#f2ce76"/><stop offset="1" stop-color="#75461d"/>
        </linearGradient>
        <radialGradient id="hj-astro-core" cx="50%" cy="50%" r="50%">
          <stop stop-color="#a36aff" stop-opacity=".7"/><stop offset=".2" stop-color="#6335a4" stop-opacity=".35"/><stop offset="1" stop-color="#170e2a" stop-opacity="0"/>
        </radialGradient>
        <filter id="hj-astro-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <circle cx="94" cy="61" r="39" fill="url(#hj-astro-core)"/>
      <g class="home-jewel__orbit--slow" transform-origin="94px 61px" fill="none" stroke="url(#hj-astro-gold)" stroke-linecap="round">
        <path d="M94 12a49 49 0 0 1 43 25M146 57a49 49 0 0 1-15 39M112 107a49 49 0 0 1-44-7M48 86a49 49 0 0 1 4-51M68 19a49 49 0 0 1 15-6" stroke-width="1.25"/>
        <path d="M94 23a38 38 0 0 1 35 23M130 69a38 38 0 0 1-22 28M81 97a38 38 0 0 1-24-27M58 48a38 38 0 0 1 19-21" stroke-width=".72" opacity=".72"/>
      </g>
      <g fill="none" stroke="url(#hj-astro-gold)" stroke-width=".72" opacity=".82">
        <path d="M94 17 118 94 53 47 135 47 70 94Z"/>
        <path d="M54 62h80M94 22v79M65 35l58 52M65 87l58-52"/>
        <circle cx="94" cy="61" r="24" stroke-dasharray="2 4"/>
      </g>
      <g filter="url(#hj-astro-glow)">
        <circle cx="94" cy="61" r="4" fill="#f4d47d"/>
        <circle class="home-jewel__planet" cx="94" cy="12" r="3.2" fill="#fff0aa"/>
        <circle cx="146" cy="57" r="4.3" fill="#9e65e8" stroke="#f1c96d" stroke-width="1"/>
        <circle cx="68" cy="19" r="2.7" fill="#d898ff"/>
        <circle cx="48" cy="86" r="3.5" fill="#e4b55b"/>
        <circle cx="112" cy="107" r="2.7" fill="#fff1b0"/>
      </g>
      <path d="M139 31a9 9 0 1 0 0 17 11 11 0 0 1 0-17Z" fill="#e8bd63" opacity=".9"/>
    </svg>`,

  palm: `
    <svg viewBox="0 0 188 122" xmlns="http://www.w3.org/2000/svg" role="presentation" focusable="false">
      <defs>
        <linearGradient id="hj-palm-line" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#fff1af"/><stop offset=".35" stop-color="#d49d45"/><stop offset=".72" stop-color="#f6d77f"/><stop offset="1" stop-color="#8b5122"/>
        </linearGradient>
        <linearGradient id="hj-palm-skin" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#f4d9cb" stop-opacity=".2"/><stop offset=".55" stop-color="#9a5b87" stop-opacity=".14"/><stop offset="1" stop-color="#34203f" stop-opacity=".08"/>
        </linearGradient>
        <filter id="hj-palm-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="99" cy="72" rx="48" ry="39" fill="#8244c4" opacity=".18" filter="url(#hj-palm-glow)"/>
      <g class="home-jewel__float" fill="url(#hj-palm-skin)" stroke="url(#hj-palm-line)" stroke-linecap="round" stroke-linejoin="round">
        <path d="M73 111c2-15-1-24-9-35-7-10-11-19-6-23 5-4 11 7 18 14l1-43c0-7 4-11 8-9 3 1 4 5 4 10v26l4-39c1-6 5-9 9-7 3 2 3 6 2 11l-3 36 10-36c2-6 6-8 10-5 3 2 2 7 1 11l-7 35 13-27c3-5 7-7 10-4 3 3 1 7-1 12l-12 32c-4 12-2 24-10 42Z" stroke-width="1.35"/>
        <path class="home-jewel__trace" d="M77 72c13-11 32-13 47-4M84 92c9-20 22-27 34-27M91 104c2-14 3-28-5-39M102 88c7-10 13-18 19-22" fill="none" stroke-width="1.15" filter="url(#hj-palm-glow)"/>
      </g>
      <g class="home-jewel__orbit" fill="none" stroke="url(#hj-palm-line)" stroke-linecap="round" filter="url(#hj-palm-glow)">
        <path d="M43 75c5-31 27-55 56-65M50 88c-20-8-22-30-9-43M129 18c20 11 28 30 24 51" stroke-width=".8"/>
        <path d="m41 45 4 5 6-3M97 10l3 5 6-1M153 69l-5 3 2 6" stroke-width="1.1"/>
      </g>
      <g fill="#f4d376" filter="url(#hj-palm-glow)">
        <circle cx="42" cy="45" r="2.2"/><circle cx="99" cy="10" r="2"/><circle cx="153" cy="69" r="2.2"/>
        <path d="m48 22 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z"/>
      </g>
    </svg>`
};

export function homeJewelSvg(kind) {
  return JEWELS[kind] || '';
}
