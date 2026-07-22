import { h } from "../core/dom.js";
import PalmGraphic from "./PalmGraphic.js";
import EnergyLink from "./EnergyLink.js";
import HeartCore from "./HeartCore.js";
import MagicParticleField from "./MagicParticleField.js";
export default function EnergyHandsScene(){ return h("div",{className:"n-energy-hands-scene"},MagicParticleField(),PalmGraphic({side:"left"}),PalmGraphic({side:"right"}),EnergyLink(),HeartCore()); }
