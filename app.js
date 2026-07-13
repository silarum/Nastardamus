const tg = window.Telegram?.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const PROXY_URL = 'https://nastardamus.vercel.app/api/proxy';

const CARD_IMAGES = {
    'Шут':'fool.png','Маг':'magician.png','Верховная Жрица':'high-priestess.png',
    'Императрица':'empress.png','Император':'emperor.png','Иерофант':'hierophant.png',
    'Влюблённые':'lovers.png','Колесница':'chariot.png','Сила':'strength.png',
    'Отшельник':'hermit.png','Колесо Фортуны':'wheel-of-fortune.png','Справедливость':'justice.png',
    'Повешенный':'hanged-man.png','Смерть':'death.png','Умеренность':'temperance.png',
    'Дьявол':'devil.png','Башня':'tower.png','Звезда':'star.png',
    'Луна':'moon.png','Солнце':'sun.png','Суд':'judgement.png','Мир':'world.png'
};

const screens = {
    welcome: document.getElementById('welcome-screen'),
    video: document.getElementById('video-screen'),
    menu: document.getElementById('menu-screen'),
    tarotInput: document.getElementById('tarot-input-screen'),
    tarotCards: document.getElementById('tarot-cards-screen'),
    tarotResult: document.getElementById('tarot-result-screen'),
    natalInput: document.getElementById('natal-input-screen'),
    natalResult: document.getElementById('natal-result-screen'),
    compatInput: document.getElementById('compat-input-screen'),
    compatResult: document.getElementById('compat-result-screen'),
    walletScreen: document.getElementById('wallet-screen'),
    buySilarumScreen: document.getElementById('buy-silarum-screen'),
    paymentInstructionScreen: document.getElementById('payment-instruction-screen'),
    exchangeScreen: document.getElementById('exchange-screen')
};

function showScreen(s) {
    Object.values(screens).forEach(el => el.classList.remove('active'));
    if (screens[s]) screens[s].classList.add('active');
}

// Анимация букв
function animateTitle() {
    const el = document.getElementById('title-animated');
    if (!el) return;
    const text = el.textContent; el.innerHTML = '';
    text.split('').forEach((l,i) => {
        const s = document.createElement('span'); s.textContent = l;
        s.style.opacity = '0'; s.style.display = 'inline-block';
        s.style.animation = `flyIn 0.5s ${i*0.1}s forwards`;
        el.appendChild(s);
    });
}
animateTitle();

// Приветствие
document.getElementById('continue-btn').addEventListener('click', () => { updateCreditsBadge(); showScreen('menu'); });

// Навигация
document.querySelectorAll('.back-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const t = btn.dataset.target;
        if (t && screens[t]) showScreen(t);
    });
});

// Меню
document.getElementById('go-tarot').addEventListener('click', () => playMageVideo());
document.getElementById('go-natal').addEventListener('click', () => showScreen('natalInput'));
document.getElementById('go-compat').addEventListener('click', () => showScreen('compatInput'));
document.getElementById('go-wallet').addEventListener('click', () => { updateWalletDisplay(); showScreen('walletScreen'); });

// Помощь
const helpTexts = {
    'tarot-question':'Задайте вопрос — мысленно или письменно.',
    'tarot-shuffle':'Сдвиньте карту — колода разлетится. Выберите двойным касанием.',
    'natal':'Введите дату и время рождения.',
    'compat':'Введите данные двух людей.',
    'welcome':'Nastardamus — ваш проводник в мир Таро и астрологии.'
};
function showHelp(k) {
    document.getElementById('help-title').textContent = 'Справка';
    document.getElementById('help-text').textContent = helpTexts[k] || '';
    document.getElementById('help-modal').classList.add('active');
}
document.getElementById('help-btn-welcome').addEventListener('click', () => showHelp('welcome'));
document.getElementById('help-btn-menu').addEventListener('click', () => showHelp('welcome'));
document.querySelectorAll('.help-icon-small').forEach(b => b.addEventListener('click', () => showHelp(b.dataset.help)));
document.getElementById('close-help').addEventListener('click', () => document.getElementById('help-modal').classList.remove('active'));

// Кредиты
let freeUsed = false, paid = 0;
function updateCreditsBadge() {
    document.getElementById('credit-count').textContent = freeUsed ? '0' : '1';
    document.getElementById('paid-count').textContent = paid;
}

// Видео
let videoPlayed = false;
function playMageVideo() {
    showScreen('video');
    const v = document.getElementById('mage-video');
    const l = document.getElementById('video-loader');
    const s = document.getElementById('skip-video-btn');
    v.classList.remove('ready'); l.classList.remove('hidden'); s.classList.remove('visible');
    v.currentTime = 0; videoPlayed = false;
    setTimeout(() => s.classList.add('visible'), 2000);
    const t = setTimeout(() => { if(!videoPlayed){videoPlayed=true;showScreen('tarotInput');} }, 5000);
    v.onloadeddata = () => { l.classList.add('hidden'); v.classList.add('ready'); v.play().catch(() => s.classList.add('visible')); };
    v.onended = () => { if(!videoPlayed){videoPlayed=true;clearTimeout(t);showScreen('tarotInput');} };
    v.onerror = () => { if(!videoPlayed){videoPlayed=true;clearTimeout(t);showScreen('tarotInput');} };
    s.onclick = () => { if(!videoPlayed){videoPlayed=true;clearTimeout(t);v.pause();showScreen('tarotInput');} };
    v.onclick = () => { if(!videoPlayed){videoPlayed=true;clearTimeout(t);v.pause();showScreen('tarotInput');} };
}

// Частицы
const pC = document.getElementById('particles-canvas'), pCtx = pC.getContext('2d');
let bgP = [];
function rC() { pC.width = innerWidth; pC.height = innerHeight; }
window.addEventListener('resize', rC); rC();
for(let i=0;i<60;i++) bgP.push({x:Math.random()*pC.width,y:Math.random()*pC.height,s:Math.random()*2+.5,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,o:Math.random()*.5+.2});
(function a() {
    pCtx.clearRect(0,0,pC.width,pC.height);
    bgP.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=pC.width;if(p.x>pC.width)p.x=0;if(p.y<0)p.y=pC.height;if(p.y>pC.height)p.y=0;pCtx.fillStyle=`rgba(255,215,0,${p.o})`;pCtx.beginPath();pCtx.arc(p.x,p.y,p.s,0,Math.PI*2);pCtx.fill();});
    requestAnimationFrame(a);
})();

// Тасовка
const deckNames = Object.keys(CARD_IMAGES);
let selCards = [], cardsToSelect = 3, curRound = 0, availCards = [];
window._selectedCards = selCards;

document.querySelectorAll('.spread-option').forEach(b => {
    b.addEventListener('click', () => {
        document.querySelectorAll('.spread-option').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        cardsToSelect = parseInt(b.dataset.cards);
    });
});

document.getElementById('start-tarot').addEventListener('click', () => {
    window.tarotQuestion = document.getElementById('tarot-question').value.trim() || 'Что ждёт меня?';
    if(!freeUsed){freeUsed=true;updateCreditsBadge();startRitual();}
    else if(paid>0){paid--;updateCreditsBadge();startRitual();}
    else{if(confirm('Нет вопросов. Добавить тестовый?')){paid++;updateCreditsBadge();startRitual();}}
});

function startRitual() {
    selCards=[];curRound=0;availCards=[...deckNames];
    document.getElementById('selected-cards-preview').innerHTML='';
    document.getElementById('cards-left').textContent='Выбрано: 0 из '+cardsToSelect;
    document.getElementById('progress-fill').style.width='0%';
    showScreen('tarotCards');
    document.getElementById('deck-stack').style.display='block';
    document.getElementById('spread-area').innerHTML='';
}

document.getElementById('deck-stack').addEventListener('click', () => {
    if(curRound>=cardsToSelect||document.querySelectorAll('.spread-card').length>0) return;
    spreadCards();
});

function spreadCards() {
    const area = document.getElementById('spread-area');
    area.innerHTML = '';
    const w = area.offsetWidth||350, h = area.offsetHeight||400;
    [...availCards].sort(()=>Math.random()-.5).forEach(name => {
        const c = document.createElement('div');
        c.className='spread-card'; c.dataset.name=name;
        c.style.left=(20+Math.random()*(w-120))+'px';
        c.style.top=(20+Math.random()*(h-170))+'px';
        c.style.transform=`rotate(${(Math.random()-.5)*50}deg)`;
        let tt=null;
        c.addEventListener('click',ev=>{ev.stopPropagation();if(tt){clearTimeout(tt);tt=null;selectCard(c,name);}else{tt=setTimeout(()=>{tt=null;},300);}});
        area.appendChild(c);
    });
    enableDrag(area);
}

function enableDrag(area) {
    let dc=null,ox,oy;
    area.addEventListener('touchstart',e=>{
        const c=e.target.closest('.spread-card');
        if(!c||c.classList.contains('fly-out')) return;
        dc=c;const r=c.getBoundingClientRect();ox=e.touches[0].clientX-r.left;oy=e.touches[0].clientY-r.top;
        c.style.zIndex=50;c.classList.add('highlight');
    },{passive:false});
    area.addEventListener('touchmove',e=>{
        if(!dc) return;e.preventDefault();
        const ar=area.getBoundingClientRect();
        dc.style.left=(e.touches[0].clientX-ar.left-ox)+'px';
        dc.style.top=(e.touches[0].clientY-ar.top-oy)+'px';
    },{passive:false});
    area.addEventListener('touchend',()=>{if(dc){dc.classList.remove('highlight');dc.style.zIndex=5;dc=null;}});
}

function selectCard(el, name) {
    if(curRound>=cardsToSelect) return;
    if(navigator.vibrate) navigator.vibrate(30);
    availCards = availCards.filter(n=>n!==name);
    selCards.push({name}); window._selectedCards=selCards;
    curRound++;
    el.classList.add('fly-out');
    setTimeout(()=>{if(el.parentNode)el.remove();},500);
    const p = document.createElement('div');
    p.className='selected-card-preview';
    p.style.backgroundImage=`url('images/cards/${CARD_IMAGES[name]}')`;
    document.getElementById('selected-cards-preview').appendChild(p);
    document.getElementById('cards-left').textContent=`Выбрано: ${selCards.length} из ${cardsToSelect}`;
    document.getElementById('progress-fill').style.width=(curRound/cardsToSelect*100)+'%';
    if(curRound>=cardsToSelect){
        setTimeout(()=>{
            document.querySelectorAll('.spread-card').forEach(c=>c.classList.add('collecting'));
            setTimeout(()=>{document.getElementById('spread-area').innerHTML='';document.getElementById('deck-stack').style.display='none';getTarotPrediction();},500);
        },600);
    } else {
        setTimeout(()=>{
            document.querySelectorAll('.spread-card').forEach(c=>c.classList.add('collecting'));
            setTimeout(()=>{document.getElementById('spread-area').innerHTML='';document.getElementById('deck-stack').style.display='block';},500);
        },600);
    }
}

// API
async function callMage(sys, usr) {
    const ctrl = new AbortController();
    const t = setTimeout(()=>ctrl.abort(),15000);
    try {
        const r = await fetch(PROXY_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:sys},{role:'user',content:usr}]}),signal:ctrl.signal});
        clearTimeout(t);
        if(!r.ok) return null;
        const d = await r.json();
        return d?.choices?.[0]?.message?.content||null;
    } catch(e) { clearTimeout(t); return null; }
}

const MAGE = 'Ты — Маг Эзотериум, живой человек, маг и таролог. Не упоминай ИИ и технологии.';

async function getTarotPrediction() {
    showScreen('tarotResult'); updateCreditsBadge();
    document.getElementById('result-cards').innerHTML = selCards.map(c=>`<img src="images/cards/${CARD_IMAGES[c.name]}" alt="${c.name}">`).join('');
    const el = document.getElementById('prediction-text');
    el.innerHTML = '<span>Маг советуется со звёздами...</span>';
    const answer = await callMage(MAGE+' Начинай с "Маг Эзотериум видит..."', `Вопрос: "${window.tarotQuestion}". Карты: ${selCards.map(c=>c.name).join(', ')}.`);
    el.textContent = answer || 'Маг сегодня отдыхает. Попробуйте позже.';
}

document.getElementById('share-btn').addEventListener('click',()=>{
    const t = document.getElementById('prediction-text').textContent;
    if(navigator.share) navigator.share({title:'Nastardamus',text:t}).catch(()=>{});
    else navigator.clipboard?.writeText(t).then(()=>alert('Скопировано!'));
});

document.getElementById('save-result').addEventListener('click',()=>{
    const h = JSON.parse(localStorage.getItem('nastardamus-history')||'[]');
    h.push({type:'tarot',preview:document.getElementById('prediction-text').textContent.substring(0,50),date:new Date().toLocaleDateString()});
    localStorage.setItem('nastardamus-history',JSON.stringify(h));
    alert('Сохранено!');
});

// Натальная
document.getElementById('get-natal').addEventListener('click',async()=>{
    const d=document.getElementById('natal-date').value; if(!d) return alert('Введите дату');
    showScreen('natalResult'); document.getElementById('natal-text').innerHTML='<span>Рассчитываем...</span>';
    const a=await callMage(MAGE+' Начинай со "Звёзды поведали..."', `Натальная карта: ${d} ${document.getElementById('natal-time').value}.`);
    document.getElementById('natal-text').textContent=a||'Не удалось.';
});

// Совместимость
document.getElementById('get-compat').addEventListener('click',async()=>{
    const n1=document.getElementById('person1-name').value.trim()||'А',d1=document.getElementById('person1-date').value;
    const n2=document.getElementById('person2-name').value.trim()||'Б',d2=document.getElementById('person2-date').value;
    if(!d1||!d2) return alert('Введите даты');
    showScreen('compatResult'); document.getElementById('compat-text').innerHTML='<span>Анализируем...</span>';
    const a=await callMage(MAGE+' Начинай с "Маг Эзотериум раскрывает..."', `Совместимость ${n1} (${d1}) и ${n2} (${d2}).`);
    document.getElementById('compat-text').textContent=a||'Не удалось.';
});

// ===== КОШЕЛЁК =====
let userBalance = parseInt(localStorage.getItem('nastardamus-balance')||'0');
function updateWalletDisplay() {
    const el = document.getElementById('wallet-balance');
    if(el) el.textContent = userBalance;
}

document.getElementById('go-buy-silarum').addEventListener('click',()=>showScreen('buySilarumScreen'));
document.getElementById('go-exchange-btn').addEventListener('click',()=>{updateWalletDisplay();showScreen('exchangeScreen');});

document.getElementById('buy-amount').addEventListener('input',function(){
    document.getElementById('buy-rub-amount').textContent=(parseInt(this.value)||1)*100;
});

document.getElementById('create-payment').addEventListener('click',async()=>{
    const amount=parseInt(document.getElementById('buy-amount').value)||1;
    const method=document.getElementById('payment-method').value;
    try{
        const r=await fetch('/api/payment?action=create-rub-payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({silurumAmount:amount})});
        const d=await r.json();
        if(d.error) return alert(d.error);
        localStorage.setItem('current-payment',JSON.stringify(d));
        const det=document.getElementById('payment-details');
        det.innerHTML = method==='sbp'
            ? `<p><b> СБП</b></p><p>Телефон: <b>${d.instructions.sbp.phone}</b></p><p>Банк: ${d.instructions.sbp.bank}</p><p>Получатель: ${d.instructions.sbp.name}</p><p>Сумма: <b>${d.rubAmount} </b></p><p>Код: <b style="color:var(--gold)">${d.paymentId}</b></p>`
            : `<p><b> Карта</b></p><p>Карта: <b>${d.instructions.card.number}</b></p><p>Банк: ${d.instructions.card.bank}</p><p>Получатель: ${d.instructions.card.name}</p><p>Сумма: <b>${d.rubAmount} </b></p><p>Код: <b style="color:var(--gold)">${d.paymentId}</b></p>`;
        showScreen('paymentInstructionScreen');
    }catch(e){alert('Ошибка соединения.');}
});

document.getElementById('payment-done').addEventListener('click',()=>{
    const p=JSON.parse(localStorage.getItem('current-payment')||'{}');
    alert(`Заявка #${p.paymentId} отправлена. Ожидайте подтверждения.`);
    showScreen('walletScreen');
});

document.getElementById('calculate-exchange').addEventListener('click',async()=>{
    const amount=parseInt(document.getElementById('exchange-amount').value)||50;
    const currency=document.getElementById('exchange-currency').value;
    if(amount>userBalance) return alert('Недостаточно силарумов!');
    try{
        const r=await fetch('/api/exchange?action=calculate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,currency})});
        const d=await r.json();
        if(d.error) return alert(d.error);
        const div=document.getElementById('exchange-result');
        div.style.display='block';
        div.innerHTML=`<p> Вы получите: <b>${d.output.amount} ${currency}</b></p><p> Комиссия: ${d.output.details.serviceFeePercent}%</p><button class="magic-btn small" onclick="confirmExchange(${amount},'${currency}')">Подтвердить обмен</button>`;
    }catch(e){alert('Ошибка.');}
});

async function confirmExchange(amount, currency) {
    const method=confirm('Способ: OK — чек, Отмена — прямой перевод')?'check':'direct';
    const wallet=prompt(`Адрес ${currency} кошелька:`);
    if(!wallet) return;
    try{
        const r=await fetch('/api/exchange?action=create-exchange',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({amount,currency,wallet,method})});
        const d=await r.json();
        if(d.error) return alert(d.error);
        userBalance-=amount;
        localStorage.setItem('nastardamus-balance',userBalance.toString());
        updateWalletDisplay();
        alert(`Заявка #${d.exchangeId} создана!`);
        showScreen('walletScreen');
    }catch(e){alert('Ошибка.');}
}
window.confirmExchange = confirmExchange;

updateWalletDisplay();
showScreen('welcome');
