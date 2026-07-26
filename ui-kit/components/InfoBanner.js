import MysticCard from "./MysticCard.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
import { premiumArtUrl } from "../core/assets.js";
export default function InfoBanner({ text="", tone="gold", art="" } = {}) {
 const visual=art?h("img",{className:"n-info-banner__art",attrs:{src:premiumArtUrl(art),alt:"",draggable:"false"}}):Icon("info",{size:22});
 return MysticCard({className:"n-info-banner",children:[visual,h("span",{text,attrs:{"data-tone":tone}})]});
}
