import { h } from "../core/dom.js";
import BottomNavItem from "./BottomNavItem.js";
export default function BottomNavigation({ active="home", onNavigate } = {}) {
 const item=(key,icon,label)=>BottomNavItem({icon,label,active:key===active,onClick:()=>onNavigate?.(key)});
 return h("nav",{className:"n-bottom-navigation"},
  item("home","home","Главная"),
  item("services","sparkle","Практики"),
  item("amur","heart","Амур"),
  item("history","history","История"),
  item("profile","profile","Профиль")
 );
}
