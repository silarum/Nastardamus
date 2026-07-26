import { h } from "../core/dom.js";
import WheelSegment from "./WheelSegment.js";
import WheelPointer from "./WheelPointer.js";
import WheelCenter from "./WheelCenter.js";
import { premiumArtUrl } from "../core/assets.js";
export default function FortuneWheel({ values=[50,100,250,1000,500,75,10,5] } = {}) {
 const wrap=h("div",{className:"n-fortune-wheel"});
 wrap.append(h("img",{className:"n-fortune-wheel__art",attrs:{src:premiumArtUrl("fortune-wheel"),alt:"",draggable:"false"}}));
 values.forEach((value,index)=>wrap.append(WheelSegment({value,angle:index*(360/values.length)})));
 wrap.append(WheelPointer(),WheelCenter());
 return wrap;
}
