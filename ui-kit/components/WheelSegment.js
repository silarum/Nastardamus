import { h } from "../core/dom.js";
export default function WheelSegment({ value=0, angle=0 } = {}) {
 return h("div",{className:"n-wheel-segment",style:{"--angle":`${angle}deg`}},h("span",{text:value}));
}
