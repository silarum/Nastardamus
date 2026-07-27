import { h } from "../core/dom.js";
export default function PersonMeta({ name="", birthDate="" } = {}) {
 return h("div",{className:"n-person-meta"},h("strong",{text:name}),h("small",{text:birthDate}));
}
