import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function BottomNavItem({ icon="home", label="", active=false, onClick } = {}) {
 return h("button",{className:`n-bottom-nav-item ${active?"is-active":""}`,attrs:{type:"button"},on:{click:onClick||(()=>{})}},Icon(icon,{size:22}),h("span",{text:label}));
}
