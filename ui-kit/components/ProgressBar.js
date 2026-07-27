import { h } from "../core/dom.js";
export default function ProgressBar({ value=0 } = {}) {
 const safe=Math.max(0,Math.min(100,Number(value)||0));
 return h("div",{className:"n-progress",attrs:{role:"progressbar","aria-valuemin":"0","aria-valuemax":"100","aria-valuenow":safe}},h("span",{style:{width:`${safe}%`}}));
}
