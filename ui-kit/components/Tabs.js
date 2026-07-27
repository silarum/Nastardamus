import { h } from "../core/dom.js";
export default function Tabs({ items=["Обзор","Детали","Рекомендации"], active=0, onChange } = {}) {
 const wrap=h("div",{className:"n-tabs",style:{"--tabs":items.length}});
 items.forEach((item,index)=>wrap.append(h("button",{className:`n-tab ${index===active?"is-active":""}`,text:item,attrs:{type:"button"},on:{click:()=>onChange?.(index)}})));
 return wrap;
}
