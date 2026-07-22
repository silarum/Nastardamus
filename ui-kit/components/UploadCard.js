import MysticCard from "./MysticCard.js";
import { h } from "../core/dom.js";
import { Icon } from "../core/icon.js";
export default function UploadCard({ title="Загрузите фото своей ладони", subtitle="Чётко, при хорошем освещении", status="empty", onClick } = {}) {
 return MysticCard({as:"button",className:"n-upload-card",children:[Icon(status==="ready"?"hand":"upload-cloud",{size:46}),h("strong",{text:title}),h("small",{text:subtitle})]});
}
