import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function CosmicBackground() {
  return h("div", { className: "n-cosmic-background", attrs: { "aria-hidden": "true" } },
    h("img", { className: "n-cosmic-background__art", attrs: { src: premiumArtUrl("cosmic-background"), alt: "", draggable: "false" } })
  );
}
