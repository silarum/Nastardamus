import { AppShell, ScreenContainer, AppHeader, GreetingCard, BalanceCard, GlowDivider, FortuneWheelCard, SectionTitle, QuickAccessGrid, BottomNavigation } from "../components/index.js";
export default function HomeScreen(data={}) {
  return AppShell({children:[ScreenContainer({children:[
    AppHeader({home:true,title:"Nastardamus"}),
    GreetingCard(data.user),
    BalanceCard(data.balance),
    GlowDivider(),
    FortuneWheelCard(data.wheel),
    SectionTitle({text:"Быстрый доступ"}),
    QuickAccessGrid({items:data.shortcuts})
  ]}),BottomNavigation({active:"home"})]});
}
