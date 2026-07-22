import { h } from "../core/dom.js";
export default function MysticCard({ children = [], className = "", as = "section" } = {}) {
  return h(as, { className: `n-mystic-card ${className}`.trim() }, children);
}
