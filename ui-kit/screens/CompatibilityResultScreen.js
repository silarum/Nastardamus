import { AppShell, ScreenContainer, AppHeader, CompatibilityHero, Tabs, MetricsList, SectionTitle, ForecastGrid, FinalScoreCard, ShareActions, BottomNavigation } from "../components/index.js";
export default function CompatibilityResultScreen() {
 return AppShell({children:[ScreenContainer({children:[
  AppHeader({title:"Путь двух судеб",subtitle:"Ваш совместный отчёт"}),
  CompatibilityHero(),
  Tabs({active:0}),
  MetricsList(),
  SectionTitle({text:"Прогноз по сферам"}),
  ForecastGrid(),
  FinalScoreCard(),
  ShareActions()
 ]}),BottomNavigation({active:"magic"})]});
}
