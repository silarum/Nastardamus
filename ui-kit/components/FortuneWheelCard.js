import MysticCard from "./MysticCard.js";
import FortuneWheel from "./FortuneWheel.js";
import { h } from "../core/dom.js";
export default function FortuneWheelCard({ caption="Выберите свою таинственную коробку" } = {}) {
 return MysticCard({className:"n-fortune-wheel-card",children:[h("h3",{text:"Колесо Фортуны"}),h("p",{text:"Внутри — подарок Эзотериума"}),FortuneWheel(),h("p",{text:`✦ ${caption}`})]});
}
