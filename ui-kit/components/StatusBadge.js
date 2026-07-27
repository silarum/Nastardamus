import { h } from "../core/dom.js";
export default function StatusBadge({ text="Готово", status="ready" } = {}) {
 return h("span",{className:"n-status-badge",text:`${status==="ready"?"✓":"◌"} ${text}`,dataset:{status}});
}
