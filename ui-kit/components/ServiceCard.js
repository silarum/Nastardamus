import MysticCard from "./MysticCard.js";
import ServiceArtwork from "./ServiceArtwork.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function ServiceCard({ title="Совместный расклад", description="Глубокий анализ отношений, энергии и будущего.", price=null, currency="SILARUM", artwork="ritual-tarot-spread" } = {}) {
 const priceNode=price===null||price===undefined||price===""?null:h("div",{className:"n-service-card__price"},Icon("coin",{size:20}),h("span",{text:`${price} ${currency}`}));
 return MysticCard({className:"n-service-card",children:[ServiceArtwork({kind:artwork}),h("div",{},h("strong",{text:title}),h("p",{text:description}),priceNode),h("span",{text:"›"})]});
}
