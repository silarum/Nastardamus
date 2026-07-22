import { h } from "../core/dom.js";
import { artUrl } from "../core/assets.js";
export default function UserAvatar({ src=artUrl("avatar-seeker"), alt="" } = {}) {
 return h("div",{className:"n-user-avatar"},h("img",{attrs:{src,alt,draggable:"false"}}));
}
