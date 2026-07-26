import { h } from "../core/dom.js";
import PersonPortrait from "./PersonPortrait.js";
import PersonMeta from "./PersonMeta.js";
import { premiumArtUrl } from "../core/assets.js";
export default function CompatibilityHero({ left={name:"Вы",birthDate:"Первый образ",gender:"female"}, right={name:"Партнёр",birthDate:"Второй образ",gender:"male"} } = {}) {
 return h("div",{className:"n-compatibility-hero"},h("div",{},PersonPortrait(left),PersonMeta(left)),h("img",{className:"n-connection-heart",attrs:{src:premiumArtUrl("connection-heart"),alt:"",draggable:"false"}}),h("div",{},PersonPortrait(right),PersonMeta(right)));
}
