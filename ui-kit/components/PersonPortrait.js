import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function PersonPortrait({ gender="female", src } = {}) {
 const asset = gender === "male" ? "portrait-man" : "portrait-woman";
 return h("div",{className:"n-person-portrait"},h("img",{attrs:{src:src||premiumArtUrl(asset),alt:""}}));
}
