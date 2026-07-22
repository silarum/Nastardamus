import { h } from "../core/dom.js";
import MetricRow from "./MetricRow.js";
export default function MetricsList({ items } = {}) {
 const data=items||[{icon:"hand",title:"Резонанс ладоней",description:"Схожесть линий и энергетики",score:92},{icon:"tarot",title:"Таро для двоих",description:"Энергии и пути, ведущие вас",score:88},{icon:"emotion",title:"Эмоциональная совместимость",description:"Чувства, близость, доверие",score:90}];
 return h("div",{className:"n-metrics-list"},data.map(MetricRow));
}
