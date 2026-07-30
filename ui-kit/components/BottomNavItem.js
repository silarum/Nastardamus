import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function BottomNavItem({ icon="home", label="", active=false, onClick } = {}) {
 return h("button",{
  className:`n-bottom-nav-item ${active?"is-active":""}`,
  attrs:{type:"button","aria-current":active?"page":undefined,"aria-label":label},
  on:{click:onClick||(()=>{})}
 },h("span",{className:"n-bottom-nav-item__icon"},Icon(icon,{size:21})),h("span",{text:label}));
}
