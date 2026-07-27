import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function PriceLine({ label="Стоимость анализа:", price=null, currency="SILARUM" } = {}) {
 if(price===null||price===undefined||price==="") return null;
 return h("div",{className:"n-price-line"},h("span",{text:label}),Icon("coin",{size:18}),h("strong",{text:`${price} ${currency}`}));
}
