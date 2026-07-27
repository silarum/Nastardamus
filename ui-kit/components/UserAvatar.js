import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function UserAvatar({ src=premiumArtUrl("avatar-seeker"), alt="" } = {}) {
 return h("div",{className:"n-user-avatar"},h("img",{attrs:{src,alt,draggable:"false"}}));
}
