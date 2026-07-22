import MysticCard from "./MysticCard.js";
import SilarumCoin from "./SilarumCoin.js";
import { h } from "../core/dom.js";
export default function BalanceCard({ amount=1250, currency="SILARUM" } = {}) {
 return MysticCard({className:"n-balance-card",children:[h("div",{className:"n-balance-card__copy"},h("small",{text:"Ваш баланс"}),h("div",{className:"n-balance-card__amount",text:new Intl.NumberFormat("ru-RU").format(amount)}),h("div",{className:"n-balance-card__currency",text:currency})),SilarumCoin({size:72})]});
}
