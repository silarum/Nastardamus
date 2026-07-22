import MysticCard from "./MysticCard.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function FinalScoreCard({ score=0, message="Результат появится после чтения" } = {}) {
 return MysticCard({className:"n-final-score-card",children:[Icon("laurel-left",{size:54}),h("div",{},h("h3",{text:"Итоговая совместимость"}),h("strong",{text:`${score}%`}),h("p",{text:message})),Icon("laurel-right",{size:54})]});
}
