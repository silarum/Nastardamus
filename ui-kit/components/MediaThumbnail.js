import { h } from "../core/dom.js";
import { artUrl } from "../core/assets.js";
import { Icon } from "../core/icon.js";
export default function MediaThumbnail({ src, empty=false } = {}) {
 return h("div",{className:"n-media-thumbnail"},empty?Icon("upload-cloud",{size:30}):h("img",{attrs:{src:src||artUrl("photo-palm"),alt:""}}));
}
