import MysticCard from "./MysticCard.js";
import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function UploadCard({ title="Загрузите фото своей ладони", subtitle="Чётко, при хорошем освещении", status="empty", onClick } = {}) {
 const card=MysticCard({as:"button",className:"n-upload-card",children:[h("img",{className:"n-upload-card__art",attrs:{src:premiumArtUrl("photo-palm"),alt:"",draggable:"false"}}),h("strong",{text:title}),h("small",{text:subtitle})]});
 card.type="button";
 if(typeof onClick==="function") card.addEventListener("click",onClick);
 return card;
}
