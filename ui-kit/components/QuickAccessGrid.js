import { h } from "../core/dom.js";
import ShortcutCard from "./ShortcutCard.js";
export default function QuickAccessGrid({ items } = {}) {
 const data=items||[
  {art:"shortcut-destiny-hearts",title:"Путь двух судеб"},
  {art:"tarot-deck",title:"Таро расклад"},
  {art:"shortcut-astro-orbit",title:"Астро прогноз"},
  {art:"shortcut-fortune-compass",title:"Колесо Фортуны",badge:"+1"}
 ];
 return h("div",{className:"n-quick-access-grid"},data.map(ShortcutCard));
}
