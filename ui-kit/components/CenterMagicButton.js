import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function CenterMagicButton({ onClick } = {}) {
 return h("button",{className:"n-center-magic-button",attrs:{type:"button","aria-label":"Главное магическое действие"},on:{click:onClick||(()=>{})}},Icon("compass",{size:38}));
}
