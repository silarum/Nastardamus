import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function MysticButton({ text="", icon, variant="outline", disabled=false, onClick } = {}) {
 return h("button",{className:`n-mystic-button n-mystic-button--${variant}`,attrs:{type:"button",disabled},on:{click:onClick||(()=>{})}},
   icon ? Icon(icon,{size:23}) : null, h("span",{text})
 );
}
