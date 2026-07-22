import {
  AppShell, ScreenContainer, BrandLogo, AppHeader,
  GreetingCard, BalanceCard, FortuneWheelCard, SectionTitle, QuickAccessGrid,
  BottomNavigation, UploadCard, GoalSelector, EnergyHandsScene, InfoBanner,
  MysticButton, PriceLine, ServiceCard, DataStatusCard, ActionGroup,
  CompatibilityHero, Tabs, MetricsList, ForecastGrid, FinalScoreCard,
  ShareActions, MysticCard
} from './components/index.js';
import { h } from './core/dom.js';
import { Icon } from './core/icon.js';

const tg = window.Telegram?.WebApp;
tg?.ready?.();
tg?.expand?.();
tg?.setHeaderColor?.('#070913');
tg?.setBackgroundColor?.('#070913');

const mount = document.querySelector('#premium-app');
const toast = document.querySelector('#premium-toast');
const STORAGE = {
  wallet: 'nastardamus-wallet-v4',
  palm: 'nastardamus-premium-palm',
  goal: 'nastardamus-premium-goal',
  result: 'nastardamus-premium-result'
};
const state = {
  screen: new URLSearchParams(location.search).get('screen') || 'home',
  palmImage: localStorage.getItem(STORAGE.palm) || '',
  goal: localStorage.getItem(STORAGE.goal) || 'love',
  partnerReady: false,
  result: readJSON(STORAGE.result, null)
};
let toastTimer;

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function wallet() {
  const value = readJSON(STORAGE.wallet, null);
  return value && typeof value === 'object' ? value : { balance: 1250, available: 1250, freeSpins: 1, transactions: [] };
}
function notify(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('is-visible');
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
}
function pulse(type='light') {
  tg?.HapticFeedback?.impactOccurred?.(type);
  if (!tg) navigator.vibrate?.(type === 'medium' ? 35 : 16);
}
function navigate(screen) {
  state.screen = screen;
  const url = new URL(location.href);
  url.searchParams.set('screen', screen);
  history.replaceState({}, '', url);
  render();
}
function shell(content, active='magic') {
  return AppShell({className:'premium-shell',children:[
    ScreenContainer({className:'premium-screen premium-screen-transition',children:[h('div',{className:'premium-stack'},content)]}),
    BottomNavigation({active,onNavigate:(target)=>{
      if (target === 'home') navigate('home');
      else if (target === 'magic') navigate('palm');
      else if (target === 'profile') notify('Профиль и счёт подключаются к рабочему приложению');
      else notify(target === 'history' ? 'История откроется после сохранения результата' : 'Каталог услуг готовится');
    }})
  ]});
}

function homeScreen() {
  const w = wallet();
  const firstName = tg?.initDataUnsafe?.user?.first_name || 'Искатель';
  const header = h('header',{className:'premium-home-header'},BrandLogo(),h('button',{className:'premium-avatar-button',attrs:{type:'button','aria-label':'Профиль'},on:{click:()=>notify('Открываем профиль и лицевой счёт')}},Icon('bell',{size:23})));
  const balance = BalanceCard({amount:Number(w.balance || 0),currency:'SILARUM'});
  balance.classList.add('premium-balance');
  balance.addEventListener('click',()=>notify(`Доступно: ${Number(w.available ?? w.balance ?? 0).toFixed(2)} SILARUM`));

  const wheelCard = FortuneWheelCard({caption:`Доступно вращений: ${Number(w.freeSpins || 0)}`});
  const wheelWrap = h('div',{className:'premium-wheel-wrap'},wheelCard,h('button',{className:'premium-wheel-action',attrs:{type:'button','aria-label':'Вращать колесо'}}),h('div',{className:'premium-wheel-result',text:'Коснитесь колеса'}));
  wheelWrap.querySelector('.premium-wheel-action').addEventListener('click',()=>spinWheel(wheelWrap));

  const shortcuts = QuickAccessGrid({items:[
    {icon:'heart',title:'Путь двух судеб',onClick:()=>navigate('palm')},
    {icon:'tarot',title:'Таро расклад',onClick:()=>notify('Откроется рабочий каталог раскладов')},
    {icon:'orbit',title:'Астро прогноз',onClick:()=>notify('Откроется натальная подсказка')},
    {icon:'wheel',title:'Колесо Фортуны',badge:'+1',onClick:()=>wheelWrap.scrollIntoView({behavior:'smooth',block:'center'})}
  ]});
  shortcuts.classList.add('premium-shortcuts');

  return shell([
    header,
    GreetingCard({username:firstName,message:'Слушай знаки. Доверься интуиции.'}),
    balance,
    wheelWrap,
    SectionTitle({text:'Быстрый доступ'}),
    shortcuts,
    h('div',{className:'premium-secondary-grid'},
      serviceTile('hand','Анализ ладони','Линии, энергия и совместимость',()=>navigate('palm')),
      serviceTile('tarot','Совместный ритуал','Приглашение и разделение стоимости',()=>navigate('ritual')),
      serviceTile('sparkle','Энергетический след','Символическое чтение по фотографии',()=>notify('Фото-чтение подключено в рабочем приложении')),
      serviceTile('users','Совместимость','Подробный отчёт по сферам',()=>navigate('result'))
    )
  ],'home');
}
function serviceTile(icon,title,description,onClick) {
  return h('button',{className:'premium-service-tile',attrs:{type:'button'},on:{click:onClick}},Icon(icon,{size:31}),h('span',{},h('strong',{text:title}),h('small',{text:description})));
}
function spinWheel(wrap) {
  if (wrap.classList.contains('is-spinning')) return;
  const result = wrap.querySelector('.premium-wheel-result');
  const values = [5,10,15,50,75,100,250,500,1000];
  result.textContent = 'Колесо читает знак…';
  wrap.classList.add('is-spinning');
  pulse('medium');
  setTimeout(()=>{
    const value = values[Math.floor(Math.random()*values.length)];
    wrap.classList.remove('is-spinning');
    result.textContent = `Ваш сектор: ${value} SILARUM`;
    notify('Это Preview-вращение: баланс не изменён');
  },3500);
}

function palmScreen() {
  const upload = UploadCard({title:state.palmImage?'Ладонь загружена':'Загрузите фото своей ладони',subtitle:state.palmImage?'Готово к поиску связи':'Чётко, при хорошем освещении',status:state.palmImage?'ready':'empty'});
  upload.classList.add('premium-upload-card');
  if (state.palmImage) upload.prepend(h('img',{className:'premium-upload-preview',attrs:{src:state.palmImage,alt:''}}));
  const file = h('input',{attrs:{type:'file',accept:'image/jpeg,image/png,image/webp',hidden:true}});
  upload.addEventListener('click',()=>file.click());
  file.addEventListener('change',()=>loadPalm(file.files?.[0]));
  const selector = GoalSelector({value:state.goal,onChange:(goal)=>{state.goal=goal;localStorage.setItem(STORAGE.goal,goal);render();}});
  const find = MysticButton({text:'Найти связь',variant:'primary'});
  find.addEventListener('click',()=>{
    if (!state.palmImage) return notify('Сначала загрузите фото ладони');
    pulse('medium'); navigate('ritual');
  });
  return shell([
    AppHeader({title:'Путь двух судеб',subtitle:'Найди свою связь через ладони',onBack:()=>navigate('home')}),
    file, upload,
    SectionTitle({text:'Цель поиска'}), selector,
    EnergyHandsScene(),
    InfoBanner({text:'Ищем энергетическую совместимость, соединяя линии судьбы.'}),
    find, PriceLine({price:250})
  ]);
}
function loadPalm(file) {
  if (!file) return;
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return notify('Используйте JPG, PNG или WEBP');
  if (file.size > 10*1024*1024) return notify('Файл слишком большой');
  const reader = new FileReader();
  reader.onload=()=>{state.palmImage=String(reader.result);localStorage.setItem(STORAGE.palm,state.palmImage);pulse('medium');render();};
  reader.readAsDataURL(file);
}

function ritualScreen() {
  const own = DataStatusCard({title:'Ваши данные',status:state.palmImage?'ready':'waiting',description:state.palmImage?'Ваша ладонь загружена':'Фото ладони ещё не добавлено',meta:state.palmImage?new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}).format(new Date()):'Вернитесь к предыдущему шагу',empty:!state.palmImage});
  const partner = DataStatusCard({title:'Данные партнёра',status:state.partnerReady?'ready':'waiting',description:state.partnerReady?'Ладонь партнёра добавлена':'Партнёр ещё не загрузил свою ладонь',meta:state.partnerReady?'Данные готовы к соединению':'Отправьте ссылку-приглашение',empty:!state.partnerReady});
  const actions = ActionGroup({actions:[
    {text:'Отправить партнёру',icon:'send',variant:'primary',onClick:shareInvite},
    {text:'Попросить оплатить',icon:'payment',variant:'gold',onClick:()=>notify('Запрос на оплату будет доступен после подключения платёжного контура')},
    {text:'Разделить стоимость',icon:'split',variant:'outline',onClick:()=>notify('Стоимость будет разделена после подтверждения партнёра')}
  ]});
  const demoReady = MysticButton({text:'Показать результат Preview',icon:'sparkle',variant:'primary'});
  demoReady.addEventListener('click',()=>{state.partnerReady=true;calculateResult();navigate('result');});
  return shell([
    AppHeader({title:'Совместный ритуал',subtitle:'Данные готовы к соединению',onBack:()=>navigate('palm')}),
    ServiceCard(), own, partner,
    InfoBanner({text:'Партнёр получит ссылку и сможет добавить свои данные. Он также может оплатить услугу за вас обоих.'}),
    SectionTitle({text:'Что дальше?'}), actions, demoReady
  ]);
}
async function shareInvite() {
  const text='Nastardamus: присоединитесь к совместному ритуалу «Путь двух судеб».';
  try { if (navigator.share) await navigator.share({title:'Nastardamus',text}); else await navigator.clipboard.writeText(text); notify('Приглашение готово'); }
  catch(error){ if(error?.name!=='AbortError') notify('Не удалось поделиться'); }
}
function deterministicScore(seed,min,max){let hash=2166136261;for(const c of seed){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619)}return min+(hash>>>0)%(max-min+1)}
function calculateResult() {
  const user=tg?.initDataUnsafe?.user?.first_name||'Алиса';
  const seed=`${user}:${state.goal}:${state.palmImage.length}`;
  const metrics=[
    {icon:'hand',title:'Резонанс ладоней',description:'Схожесть линий и энергетики',score:deterministicScore(seed+'p',84,96)},
    {icon:'tarot',title:'Таро для двоих',description:'Энергии и пути, ведущие вас',score:deterministicScore(seed+'t',80,94)},
    {icon:'emotion',title:'Эмоциональная совместимость',description:'Чувства, близость, доверие',score:deterministicScore(seed+'e',82,96)}
  ];
  const forecast=[
    {icon:'heart',label:'Любовь',score:deterministicScore(seed+'l',82,97)},
    {icon:'users',label:'Дружба',score:deterministicScore(seed+'f',78,95)},
    {icon:'briefcase',label:'Бизнес',score:deterministicScore(seed+'b',72,92)},
    {icon:'sparkle',label:'Творческий союз',score:deterministicScore(seed+'c',80,97)}
  ];
  const score=Math.round(metrics.reduce((sum,item)=>sum+item.score,0)/metrics.length);
  state.result={score,metrics,forecast,left:{name:user,birthDate:'Ваша энергия',gender:'female'},right:{name:'Партнёр',birthDate:'Энергия партнёра',gender:'male'}};
  writeJSON(STORAGE.result,state.result);
}

function resultScreen() {
  if(!state.result) calculateResult();
  const r=state.result;
  const tabPanels=[
    h('div',{className:'premium-tab-panel'},MetricsList({items:r.metrics}),SectionTitle({text:'Прогноз по сферам'}),ForecastGrid({items:r.forecast})),
    h('div',{className:'premium-tab-panel',attrs:{hidden:true}},h('div',{className:'premium-detail-grid'},...r.metrics.map(item=>MysticCard({className:'premium-detail-card',children:[h('strong',{text:`${item.score}%`}),h('small',{text:item.title})]}))),MysticCard({className:'premium-result-reading',children:['Показатели являются символической визуализацией для размышления, а не объективной оценкой отношений.']})),
    h('div',{className:'premium-tab-panel',attrs:{hidden:true}},MysticCard({className:'premium-recommendations',children:[h('p',{text:'Говорите о потребностях прямо, не ожидая чтения мыслей.'}),h('p',{text:'Сохраняйте отдельное пространство каждого человека.'}),h('p',{text:'Возвращайтесь к общим планам и маленьким совместным ритуалам.'})]}))
  ];
  const tabs=Tabs({active:0,onChange:(index)=>{tabs.querySelectorAll('.n-tab').forEach((b,i)=>b.classList.toggle('is-active',i===index));tabPanels.forEach((p,i)=>p.hidden=i!==index);}});
  const share=ShareActions();
  share.querySelectorAll('button')[0].addEventListener('click',()=>notify('Результат сохранён в Preview'));
  share.querySelectorAll('button')[1].addEventListener('click',shareResult);
  return shell([
    AppHeader({title:'Путь двух судеб',subtitle:'Ваш совместный отчёт',onBack:()=>navigate('ritual')}),
    CompatibilityHero({left:r.left,right:r.right}),tabs,...tabPanels,
    FinalScoreCard({score:r.score,message:r.score>=90?'Сильная связь душ':'Гармоничный потенциал'}),share
  ]);
}
async function shareResult(){const text=`Nastardamus — итоговая совместимость: ${state.result.score}%.`;try{if(navigator.share)await navigator.share({title:'Путь двух судеб',text});else await navigator.clipboard.writeText(text);notify('Результат готов к отправке');}catch(error){if(error?.name!=='AbortError')notify('Не удалось поделиться')}}

function render(){mount.replaceChildren(state.screen==='palm'?palmScreen():state.screen==='ritual'?ritualScreen():state.screen==='result'?resultScreen():homeScreen());}
window.addEventListener('popstate',()=>{state.screen=new URLSearchParams(location.search).get('screen')||'home';render();});
render();
