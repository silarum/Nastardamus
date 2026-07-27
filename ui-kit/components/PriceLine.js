import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function PriceLine({ label="Стоимость анализа:", price=250, currency="SILARUM" } = {}) {
 return h("div",{className:"n-price-line"},h("span",{text:label}),Icon("coin",{size:18}),h("strong",{text:`${price} ${currency}`}));
}
