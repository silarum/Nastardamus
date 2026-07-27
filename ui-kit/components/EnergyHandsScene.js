import { h } from "../core/dom.js";
import { premiumArtUrl } from "../core/assets.js";
export default function EnergyHandsScene(){
 return h("div",{className:"n-energy-hands-scene"},
  h("img",{className:"n-palm-graphic n-palm-graphic--left",attrs:{src:premiumArtUrl("palm-left"),alt:"Левая ладонь",draggable:"false"}}),
  h("img",{className:"n-energy-hands-heart",attrs:{src:premiumArtUrl("connection-heart"),alt:"Энергетическая связь",draggable:"false"}}),
  h("img",{className:"n-palm-graphic n-palm-graphic--right",attrs:{src:premiumArtUrl("palm-right"),alt:"Правая ладонь",draggable:"false"}})
 );
}
