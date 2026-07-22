import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function BrandLogo({ title = "Nastardamus" } = {}) {
  return h("div", { className: "n-brand-logo" }, Icon("logo-sun",{size:27}), h("span",{text:title}));
}
