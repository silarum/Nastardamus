import { AppShell, ScreenContainer, AppHeader, UploadCard, SectionTitle, GoalSelector, EnergyHandsScene, InfoBanner, MysticButton, PriceLine, BottomNavigation } from "../components/index.js";
export default function PalmLinkScreen() {
 return AppShell({children:[ScreenContainer({children:[
  AppHeader({title:"Путь двух судеб",subtitle:"Найди свою связь через ладони"}),
  UploadCard(),
  SectionTitle({text:"Цель поиска"}),
  GoalSelector({value:"love"}),
  EnergyHandsScene(),
  InfoBanner({text:"Ищем энергетическую совместимость, соединяя линии судьбы."}),
  MysticButton({text:"Найти связь",variant:"primary"}),
  PriceLine()
 ]}),BottomNavigation({active:"magic"})]});
}
