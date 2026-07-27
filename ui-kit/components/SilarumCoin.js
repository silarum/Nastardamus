import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function SilarumCoin({ size=70 } = {}) {
 return h("div",{className:"n-silarum-coin"},h("img",{attrs:{src:premiumArtUrl("silarum-coin"),alt:"",width:String(size),height:String(size),draggable:"false"}}));
}
