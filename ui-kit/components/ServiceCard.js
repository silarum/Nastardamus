import MysticCard from "./MysticCard.js";
import ServiceArtwork from "./ServiceArtwork.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function ServiceCard({ title="Совместный расклад", description="Глубокий анализ отношений, энергии и будущего.", price=750, currency="SILARUM" } = {}) {
 return MysticCard({className:"n-service-card",children:[ServiceArtwork(),h("div",{},h("strong",{text:title}),h("p",{text:description}),h("div",{className:"n-service-card__price"},Icon("coin",{size:20}),h("span",{text:`${price} ${currency}`}))),h("span",{text:"›"})]});
}
