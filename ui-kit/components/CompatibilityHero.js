import { h } from "../core/dom.js";
import PersonPortrait from "./PersonPortrait.js";
import PersonMeta from "./PersonMeta.js";
import HeartCore from "./HeartCore.js";
export default function CompatibilityHero({ left={name:"Алиса",birthDate:"18.07.1994",gender:"female"}, right={name:"Максим",birthDate:"05.03.1992",gender:"male"} } = {}) {
 return h("div",{className:"n-compatibility-hero"},h("div",{},PersonPortrait(left),PersonMeta(left)),HeartCore(),h("div",{},PersonPortrait(right),PersonMeta(right)));
}
