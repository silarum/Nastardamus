import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function BrandLogo({ title = "Nastardamus" } = {}) {
  return h("div", { className: "n-brand-logo" }, h("img",{className:"n-brand-logo__mark",attrs:{src:premiumArtUrl("brand-sun"),alt:"",width:"30",height:"30"}}), h("span",{text:title}));
}
