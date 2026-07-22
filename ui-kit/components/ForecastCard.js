import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function ForecastCard({ icon="heart", label="", score=0 } = {}) {
 return h("div",{className:"n-forecast-card"},Icon(icon,{size:28}),h("small",{text:label}),h("strong",{text:`${score}%`}));
}
