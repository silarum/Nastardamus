import MysticCard from "./MysticCard.js";
import ProgressBar from "./ProgressBar.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
import { premiumArtUrl } from "../core/assets.js";
export default function MetricRow({ icon="heart", art="", title="", description="", score=null } = {}) {
 const hasScore=score!==null&&score!==undefined&&Number.isFinite(Number(score));
 const visual=art?h("img",{attrs:{src:premiumArtUrl(art),alt:"",draggable:"false"}}):Icon(icon,{size:29});
 return MysticCard({className:`n-metric-row${hasScore?"":" is-pending"}`,children:[h("div",{className:"n-metric-row__icon"},visual),h("div",{},h("strong",{text:title}),h("small",{text:description}),ProgressBar({value:hasScore?score:0})),h("div",{className:"n-metric-row__score",text:hasScore?`${score}%`:"—"})]});
}
