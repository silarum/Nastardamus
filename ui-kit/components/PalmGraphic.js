import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function PalmGraphic({ side="left" } = {}) {
 return h("img",{className:`n-palm-graphic n-palm-graphic--${side}`,attrs:{src:premiumArtUrl(`palm-${side}`),alt:"",draggable:"false"}});
}
