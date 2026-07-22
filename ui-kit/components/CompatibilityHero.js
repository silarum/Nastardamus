import { h } from "../core/dom.js";
import PersonPortrait from "./PersonPortrait.js";
import PersonMeta from "./PersonMeta.js";
import HeartCore from "./HeartCore.js";
export default function CompatibilityHero({ left={name:"Вы",birthDate:"Первый образ",gender:"female"}, right={name:"Партнёр",birthDate:"Второй образ",gender:"male"} } = {}) {
 return h("div",{className:"n-compatibility-hero"},h("div",{},PersonPortrait(left),PersonMeta(left)),HeartCore(),h("div",{},PersonPortrait(right),PersonMeta(right)));
}
