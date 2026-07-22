import { AppShell, ScreenContainer, AppHeader, ServiceCard, DataStatusCard, InfoBanner, SectionTitle, ActionGroup, BottomNavigation } from "../components/index.js";
export default function RitualScreen() {
 return AppShell({children:[ScreenContainer({children:[
  AppHeader({title:"Совместный ритуал",subtitle:"Данные готовы к соединению"}),
  ServiceCard(),
  DataStatusCard(),
  DataStatusCard({title:"Данные партнёра",status:"waiting",description:"Партнёр ещё не загрузил свою ладонь",meta:"Отправьте ссылку-приглашение",empty:true}),
  InfoBanner({text:"Партнёр получит ссылку и сможет добавить свои данные. Он также может оплатить услугу за вас обоих."}),
  SectionTitle({text:"Что дальше?"}),
  ActionGroup()
 ]}),BottomNavigation({active:"magic"})]});
}
