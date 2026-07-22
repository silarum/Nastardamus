import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function SilarumCoin({ size=70 } = {}) { return h("div",{className:"n-silarum-coin"},Icon("coin",{size})); }
