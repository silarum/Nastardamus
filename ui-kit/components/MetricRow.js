import MysticCard from "./MysticCard.js";
import ProgressBar from "./ProgressBar.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function MetricRow({ icon="heart", title="", description="", score=0 } = {}) {
 return MysticCard({className:"n-metric-row",children:[h("div",{className:"n-metric-row__icon"},Icon(icon,{size:29})),h("div",{},h("strong",{text:title}),h("small",{text:description}),ProgressBar({value:score})),h("div",{className:"n-metric-row__score",text:`${score}%`})]});
}
