import { h } from "../core/dom.js";
import ShortcutCard from "./ShortcutCard.js";
export default function QuickAccessGrid({ items } = {}) {
 const data=items||[{icon:"heart",title:"Путь двух судеб"},{icon:"tarot",title:"Таро расклад"},{icon:"orbit",title:"Астро прогноз"},{icon:"wheel",title:"Колесо Фортуны",badge:"+1"}];
 return h("div",{className:"n-quick-access-grid"},data.map(ShortcutCard));
}
