import { h } from "../core/dom.js";
import MetricRow from "./MetricRow.js";
export default function MetricsList({ items } = {}) {
 const data=items||[{icon:"hand",title:"Резонанс ладоней",description:"Появится после чтения",score:0},{icon:"tarot",title:"Таро для двоих",description:"Появится после чтения",score:0},{icon:"emotion",title:"Эмоциональная совместимость",description:"Появится после чтения",score:0}];
 return h("div",{className:"n-metrics-list"},data.map(MetricRow));
}
