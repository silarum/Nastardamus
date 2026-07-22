import { h } from "../core/dom.js";
import ForecastCard from "./ForecastCard.js";
export default function ForecastGrid({ items } = {}) {
 const data=items||[{icon:"heart",label:"Любовь",score:0},{icon:"users",label:"Дружба",score:0},{icon:"briefcase",label:"Бизнес",score:0},{icon:"sparkle",label:"Творческий союз",score:0}];
 return h("div",{className:"n-forecast-grid"},data.map(ForecastCard));
}
