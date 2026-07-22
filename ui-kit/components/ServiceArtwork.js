import { h } from "../core/dom.js";
import { artUrl } from "../core/assets.js";
export default function ServiceArtwork({ kind="tarot-deck" } = {}) {
 return h("div",{className:"n-service-artwork"},h("img",{attrs:{src:artUrl(kind),alt:"",width:"76",height:"76"}}));
}
