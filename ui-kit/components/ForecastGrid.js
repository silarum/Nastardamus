import { h } from "../core/dom.js";
import ForecastCard from "./ForecastCard.js";
export default function ForecastGrid({ items } = {}) {
 const data=items||[{icon:"heart",label:"Любовь",score:94},{icon:"users",label:"Дружба",score:83},{icon:"briefcase",label:"Бизнес",score:82},{icon:"sparkle",label:"Творческий союз",score:91}];
 return h("div",{className:"n-forecast-grid"},data.map(ForecastCard));
}
