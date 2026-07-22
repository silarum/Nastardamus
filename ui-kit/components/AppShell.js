import { h } from "../core/dom.js";
import CosmicBackground from "./CosmicBackground.js";
export default function AppShell({ children = [], className = "" } = {}) {
  return h("div", { className: `n-app-shell ${className}`.trim() }, CosmicBackground(), children);
}
