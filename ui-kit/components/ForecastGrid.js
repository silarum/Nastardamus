import { h } from "../core/dom.js";
import ForecastCard from "./ForecastCard.js";
export default function ForecastGrid({ items } = {}) {
 const data=items||[{icon:"heart",label:"Любовь",score:null},{icon:"users",label:"Дружба",score:null},{icon:"briefcase",label:"Бизнес",score:null},{icon:"sparkle",label:"Творческий союз",score:null}];
 return h("div",{className:"n-forecast-grid"},data.map(ForecastCard));
}
