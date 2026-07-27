import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function CenterMagicButton({ onClick } = {}) {
 return h("button",{className:"n-center-magic-button",attrs:{type:"button","aria-label":"Главное магическое действие"},on:{click:onClick||(()=>{})}},
  h("img",{attrs:{src:premiumArtUrl("nav-magic-sun"),alt:"",draggable:"false"}})
 );
}
