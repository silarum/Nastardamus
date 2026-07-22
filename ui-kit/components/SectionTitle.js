import { h } from "../core/dom.js";
export default function SectionTitle({ text = "" } = {}) { return h("h2",{className:"n-section-title",text}); }
