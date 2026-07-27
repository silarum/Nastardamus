import { h } from "../core/dom.js";
export default function ScreenContainer({ children = [], className = "" } = {}) {
  return h("main", { className: `n-screen-container ${className}`.trim() }, children);
}
