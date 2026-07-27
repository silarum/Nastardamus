import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function GoalChip({ icon="heart", label="", active=false, onClick } = {}) {
 return h("button",{className:`n-goal-chip ${active?"is-active":""}`,attrs:{type:"button"},on:{click:onClick||(()=>{})}},Icon(icon,{size:20}),h("span",{text:label}));
}
