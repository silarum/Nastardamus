import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
import { premiumArtUrl } from "../core/assets.js";
import ShortcutBadge from "./ShortcutBadge.js";
export default function ShortcutCard({ icon="heart", art="", title="", badge="", onClick } = {}) {
 const artwork=art?h("img",{className:"n-shortcut-card__art",attrs:{src:premiumArtUrl(art),alt:"",draggable:"false"}}):Icon(icon,{size:35});
 return h("button",{className:"n-shortcut-card",attrs:{type:"button"},on:{click:onClick||(()=>{})}},badge?ShortcutBadge({text:badge}):null,artwork,h("span",{text:title}));
}
