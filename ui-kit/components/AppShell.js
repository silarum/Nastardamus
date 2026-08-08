import { h } from "../core/dom.js";
import CosmicBackground from "./CosmicBackground.js";
export default function AppShell({ children = [], className = "", backgroundUrl = "" } = {}) {
  return h("div", { className: `n-app-shell ${className}`.trim() }, CosmicBackground({ backgroundUrl }), children);
}
