import { h } from "../core/dom.js";
import GoalChip from "./GoalChip.js";
export default function GoalSelector({ value="love", onChange } = {}) {
 const items=[["love","heart","Любовь"],["friendship","users","Дружба"],["business","briefcase","Бизнес"],["creative","sparkle","Творческий союз"]];
 return h("div",{className:"n-goal-selector"},items.map(([id,icon,label])=>GoalChip({icon,label,active:id===value,onClick:()=>onChange?.(id)})));
}
