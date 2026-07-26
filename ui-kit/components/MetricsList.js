import { h } from "../core/dom.js";
import MetricRow from "./MetricRow.js";
export default function MetricsList({ items } = {}) {
 const data=items||[
  {art:"metric-palm-seal",title:"Резонанс ладоней",description:"Раскрыто в символическом чтении",score:null},
  {art:"metric-tarot-seal",title:"Таро для двоих",description:"Энергии и пути, ведущие вас",score:null},
  {art:"metric-heart-seal",title:"Эмоциональная совместимость",description:"Чувства, близость и доверие",score:null}
 ];
 return h("div",{className:"n-metrics-list"},data.map(MetricRow));
}
