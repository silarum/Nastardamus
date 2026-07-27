import MysticCard from "./MysticCard.js";
import UserAvatar from "./UserAvatar.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
import { premiumArtUrl } from "../core/assets.js";
export default function GreetingCard({ username="Искатель", message="Слушай знаки. Доверься интуиции.", avatar, balance=null, currency="SILARUM" } = {}) {
 return MysticCard({className:"n-greeting-card",children:[
  UserAvatar({src:avatar}),
  h("div",{},h("strong",{className:"n-greeting-card__name"},h("span",{text:`Привет, ${username}`}),Icon("sparkle",{size:16})),h("small",{text:message}),balance!==null?h("div",{className:"n-greeting-card__balance"},Icon("coin",{size:16}),h("b",{text:`${balance} ${currency}`})):null),
  h("img",{className:"n-greeting-card__compass",attrs:{src:premiumArtUrl("greeting-compass"),alt:"",draggable:"false"}}),
  h("span",{text:"›",attrs:{"aria-hidden":"true"}})
 ]});
}
