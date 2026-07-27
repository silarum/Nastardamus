import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function ForecastCard({ icon="heart", label="", score=null } = {}) {
 const hasScore=score!==null&&score!==undefined&&Number.isFinite(Number(score));
 return h("div",{className:`n-forecast-card${hasScore?"":" is-pending"}`},Icon(icon,{size:28}),h("small",{text:label}),h("strong",{text:hasScore?`${score}%`:"—"}));
}
