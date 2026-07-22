import MysticCard from "./MysticCard.js";
import MediaThumbnail from "./MediaThumbnail.js";
import StatusBadge from "./StatusBadge.js";
import { h } from "../core/dom.js";
export default function DataStatusCard({ title="Ваши данные", status="ready", description="Ваша ладонь загружена", meta="18 мая 2025, 14:32", empty=false } = {}) {
 return MysticCard({className:"n-data-status-card",children:[h("div",{className:"n-data-status-card__head"},h("strong",{text:title}),StatusBadge({text:status==="ready"?"Готово":"Ожидает заполнения",status})),h("div",{className:"n-data-status-card__body"},MediaThumbnail({empty}),h("div",{},h("div",{text:description}),h("small",{text:meta,style:{color:"var(--n-muted)"}})))]});
}
