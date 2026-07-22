import { h } from "../core/dom.js";
import { artUrl } from "../core/assets.js";
export default function PersonPortrait({ gender="female", src } = {}) {
 return h("div",{className:"n-person-portrait"},h("img",{attrs:{src:src||artUrl(`portrait-${gender}`),alt:""}}));
}
