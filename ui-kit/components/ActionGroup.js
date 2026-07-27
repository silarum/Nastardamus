import { h } from "../core/dom.js";
import MysticButton from "./MysticButton.js";
export default function ActionGroup({ actions } = {}) {
 const list=actions||[{text:"Отправить партнёру",icon:"send",variant:"primary"},{text:"Попросить оплатить",icon:"payment",variant:"gold"},{text:"Разделить стоимость",icon:"split",variant:"outline"}];
 return h("div",{className:"n-action-group"},list.map(MysticButton));
}
