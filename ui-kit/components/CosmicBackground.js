import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function CosmicBackground({ backgroundUrl = "" } = {}) {
  return h("div", { className: "n-cosmic-background", attrs: { "aria-hidden": "true" } },
    h("img", { className: "n-cosmic-background__art", attrs: { src: backgroundUrl || premiumArtUrl("cosmic-background"), alt: "", draggable: "false" } }),
    h("span", { className: "n-world-light" }),
    h("span", { className: "n-world-particles" })
  );
}
