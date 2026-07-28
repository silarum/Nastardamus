import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
import WheelPointer from "./WheelPointer.js";
export default function FortuneWheel() {
 const wrap=h("div",{className:"n-fortune-wheel"});
 wrap.append(
  h("img",{className:"n-fortune-wheel__art",attrs:{src:premiumArtUrl("fortune-wheel"),alt:"",draggable:"false"}}),
  WheelPointer()
 );
 return wrap;
}
