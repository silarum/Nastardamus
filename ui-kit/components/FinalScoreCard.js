import MysticCard from "./MysticCard.js";
import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function FinalScoreCard({ score=null, message="Результат раскрыт в чтении" } = {}) {
 const hasScore=score!==null&&score!==undefined&&Number.isFinite(Number(score));
 return MysticCard({className:`n-final-score-card${hasScore?"":" is-pending"}`,children:[h("img",{className:"n-final-score-card__laurel",attrs:{src:premiumArtUrl("laurel-left"),alt:"",draggable:"false"}}),h("div",{},h("h3",{text:"Итоговая совместимость"}),h("strong",{text:hasScore?`${score}%`:"—"}),h("p",{text:message})),h("img",{className:"n-final-score-card__laurel",attrs:{src:premiumArtUrl("laurel-right"),alt:"",draggable:"false"}})]});
}
