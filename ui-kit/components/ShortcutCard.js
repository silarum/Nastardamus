import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
import ShortcutBadge from "./ShortcutBadge.js";
export default function ShortcutCard({ icon="heart", title="", badge="", onClick } = {}) {
 return h("button",{className:"n-shortcut-card",attrs:{type:"button"},on:{click:onClick||(()=>{})}},badge?ShortcutBadge({text:badge}):null,Icon(icon,{size:35}),h("span",{text:title}));
}
