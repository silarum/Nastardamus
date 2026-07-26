import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";

const ARTWORKS = new Set(["tarot-deck", "ritual-tarot-spread", "energy-hands", "cosmic-card", "photo-palm"]);

export default function ServiceArtwork({ kind="tarot-deck" } = {}) {
 const artwork = ARTWORKS.has(kind) ? kind : "tarot-deck";
 return h("div",{className:"n-service-artwork"},h("img",{attrs:{src:premiumArtUrl(artwork),alt:"",width:"76",height:"76",draggable:"false"}}));
}
