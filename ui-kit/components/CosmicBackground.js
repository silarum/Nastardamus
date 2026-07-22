import { h } from "../core/dom.js";
import StarField from "./StarField.js";
import NebulaGlow from "./NebulaGlow.js";
export default function CosmicBackground() {
  return h("div", { className: "n-cosmic-background", attrs: { "aria-hidden": "true" } }, StarField(), NebulaGlow());
}
