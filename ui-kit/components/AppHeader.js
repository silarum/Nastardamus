import { h } from "../core/dom.js";
import BrandLogo from "./BrandLogo.js";
import IconButton from "./IconButton.js";
export default function AppHeader({ title, subtitle = "", home = false, rightIcon = "sparkle", onBack, onRight } = {}) {
  return h("header",{className:"n-app-header"},
    home ? h("span") : IconButton({icon:"arrow-left",label:"Назад",onClick:onBack}),
    h("div",{className:"n-app-header__title"}, home ? BrandLogo({title:title || "Nastardamus"}) : [h("strong",{text:title || ""}), subtitle ? h("small",{text:subtitle}) : null]),
    IconButton({icon:home ? "bell" : rightIcon,label:"Действие",onClick:onRight})
  );
}
