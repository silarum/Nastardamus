import MysticCard from "./MysticCard.js";
import UserAvatar from "./UserAvatar.js";
import { h } from "../core/dom.js";
export default function GreetingCard({ username="Искатель", message="Слушай знаки. Доверься интуиции.", avatar } = {}) {
 return MysticCard({className:"n-greeting-card",children:[UserAvatar({src:avatar}),h("div",{},h("strong",{text:`Привет, ${username} ✨`}),h("small",{text:message})),h("span",{text:"›",attrs:{"aria-hidden":"true"}})]});
}
