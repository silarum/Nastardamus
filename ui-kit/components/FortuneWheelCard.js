import MysticCard from "./MysticCard.js";
import FortuneWheel from "./FortuneWheel.js";
import { h } from "../core/dom.js";
export default function FortuneWheelCard({ values, caption="Каждый платный сервис — +1 бесплатное вращение" } = {}) {
 return MysticCard({className:"n-fortune-wheel-card",children:[h("h3",{text:"Колесо Фортуны"}),h("p",{text:"Испытай удачу сегодня"}),FortuneWheel({values}),h("p",{text:`✦ ${caption}`})]});
}
