import MysticCard from "./MysticCard.js";
import UserAvatar from "./UserAvatar.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
import { premiumArtUrl } from "../core/assets.js";
export default function GreetingCard({ username="Искатель", message="Слушай знаки. Доверься интуиции.", avatar } = {}) {
 return MysticCard({className:"n-greeting-card",children:[
  UserAvatar({src:avatar}),
  h("div",{},h("strong",{className:"n-greeting-card__name"},h("span",{text:`Привет, ${username}`}),Icon("sparkle",{size:16})),h("small",{text:message})),
  h("img",{className:"n-greeting-card__compass",attrs:{src:premiumArtUrl("greeting-compass"),alt:"",draggable:"false"}}),
  h("span",{text:"›",attrs:{"aria-hidden":"true"}})
 ]});
}
