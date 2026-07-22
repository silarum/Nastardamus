import { h } from "../core/dom.js";
export default function ShortcutBadge({ text="+1" } = {}) { return h("span",{className:"n-shortcut-badge",text}); }
