import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function IconButton({ icon = "sparkle", label = "", onClick } = {}) {
  return h("button", { className:"n-icon-button", attrs:{type:"button","aria-label":label}, on:{click:onClick || (()=>{})} }, Icon(icon,{size:23}));
}
