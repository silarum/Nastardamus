import { h } from "../core/dom.js";
import MysticButton from "./MysticButton.js";
export default function ShareActions() {
 return h("div",{className:"n-share-actions"},MysticButton({text:"Сохранить",icon:"save",variant:"primary"}),MysticButton({text:"Поделиться партнёру",icon:"share",variant:"gold"}));
}
