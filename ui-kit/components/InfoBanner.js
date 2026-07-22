import MysticCard from "./MysticCard.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function InfoBanner({ text="", tone="gold" } = {}) {
 return MysticCard({className:"n-info-banner",children:[Icon("info",{size:22}),h("span",{text,attrs:{"data-tone":tone}})]});
}
