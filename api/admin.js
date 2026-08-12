import { getRequestHeader, validateTelegramInitData } from '../lib/telegram.js';
import {
  hasAdminPanelAccess,
  readAdminProfile
} from '../lib/admin-access.js';
import {
  adminSessionCookie,
  clearAdminSessionCookie,
  createAdminSessionToken,
  readAdminSession
} from '../lib/admin-session.js';

const ADMIN_STORE_URL = process.env.ADMIN_STORE_URL
  || 'https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-admin-store';

const CONTROL_FILES = Object.freeze({
  "page": {
    "body": "<!doctype html>\n<html lang=\"ru\">\n<head>\n  <meta charset=\"utf-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n  <meta name=\"theme-color\" content=\"#090713\">\n  <meta name=\"color-scheme\" content=\"dark\">\n  <title>Nastardamus Admin</title>\n  <link rel=\"stylesheet\" href=\"/admin/admin.css\">\n  <style>\n    .panel-copy{margin:-6px 0 14px;color:var(--muted);font-size:12px;line-height:1.5}\n    .service-price-list,.reward-list{display:grid;gap:10px}\n    .service-price-row,.reward-row{padding:13px;border:1px solid var(--line);border-radius:17px;background:rgba(7,5,15,.42)}\n    .service-price-row{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(130px,.7fr);align-items:end;gap:12px}\n    .service-price-row label{margin:0}\n    .reward-row>.switch-row{padding-top:0}\n    .reward-row .three-cols{grid-template-columns:repeat(3,1fr)}\n    @media(max-width:620px){.service-price-row,.reward-row .three-cols{grid-template-columns:1fr}}\n  </style>\n  <script src=\"https://telegram.org/js/telegram-web-app.js\"></script>\n</head>\n<body>\n  <div class=\"stars\" aria-hidden=\"true\"></div>\n  <main class=\"shell\">\n    <header class=\"hero\">\n      <div>\n        <p class=\"eyebrow\">Nastardamus Control</p>\n        <h1>Админ-панель</h1>\n        <p id=\"admin-subtitle\">Проверяем защищённый доступ…</p>\n      </div>\n      <div class=\"sigil\" aria-hidden=\"true\">✦</div>\n    </header>\n\n    <section id=\"access-card\" class=\"card access-card\">\n      <div class=\"loader\" aria-hidden=\"true\"></div>\n      <div class=\"access-copy-wrap\">\n        <strong id=\"access-title\">Подключение</strong>\n        <p id=\"access-copy\">Откройте панель из Telegram-бота администратора.</p>\n        <a id=\"admin-bot-link\" class=\"telegram-link\" href=\"#\" hidden>Открыть админ-бота</a>\n      </div>\n    </section>\n\n    <div id=\"dashboard\" hidden>\n      <section class=\"status-grid\" aria-label=\"Состояние системы\">\n        <article class=\"card stat\"><span>Бот</span><strong id=\"status-bot\">—</strong></article>\n        <article class=\"card stat\"><span>Центр ответов</span><strong id=\"status-ai\">—</strong></article>\n        <article class=\"card stat\"><span>Приложение</span><strong id=\"status-app\">—</strong></article>\n        <article class=\"card stat\"><span>Ваша роль</span><strong id=\"status-access\">—</strong></article>\n      </section>\n\n      <nav class=\"admin-tabs\" aria-label=\"Разделы админ-панели\">\n        <button type=\"button\" class=\"active\" data-tab=\"overview\">Настройки</button>\n        <button type=\"button\" data-tab=\"content\">Таро и практики</button>\n        <button type=\"button\" data-tab=\"payments\">Платежи</button>\n        <button type=\"button\" data-tab=\"team\">Команда</button>\n        <button type=\"button\" data-tab=\"support\">Поддержка</button>\n        <button type=\"button\" data-tab=\"ai\">Центр ответов</button>\n      </nav>\n\n      <section class=\"tab-panel active\" data-panel=\"overview\">\n        <form id=\"settings-form\">\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Оплата</p><h2>СБП и покупка SILARUM</h2></div><span class=\"badge\">Автопроверка</span></div>\n            <p class=\"panel-copy\">Подтверждённые провайдером платежи начисляются автоматически. Расхождения и резервные ручные переводы остаются в очереди администратора.</p>\n            <label class=\"switch-row\"><span><strong>Платные услуги включены</strong><small>Полный ответ выдаётся после списания цены услуги</small></span><input name=\"paymentsEnabled\" type=\"checkbox\" checked></label>\n            <label class=\"switch-row\"><span><strong>Пополнение по СБП</strong><small>Включайте только после заполнения реквизитов и курса</small></span><input name=\"sbpTopupsEnabled\" type=\"checkbox\"></label>\n            <label class=\"switch-row\"><span><strong>Автоматическая проверка оплаты</strong><small>Зачисление только после подтверждённого статуса платёжного провайдера</small></span><input name=\"sbpAutomationEnabled\" type=\"checkbox\" checked></label>\n            <div class=\"two-cols\">\n              <label>Минимум, SILARUM<input name=\"sbpMinimumSilarum\" type=\"number\" min=\"0.01\" max=\"1000000\" step=\"0.01\" value=\"10\"></label>\n              <label>Максимум, SILARUM<input name=\"sbpMaximumSilarum\" type=\"number\" min=\"0.01\" max=\"1000000\" step=\"0.01\" value=\"1000\"></label>\n            </div>\n            <label>Стоимость 1 SILARUM, ₽<input name=\"sbpRoublesPerSilarum\" type=\"number\" min=\"0\" max=\"1000000\" step=\"0.01\" value=\"0\"></label>\n            <div class=\"two-cols\">\n              <label>Получатель<input name=\"sbpRecipientName\" maxlength=\"160\" placeholder=\"Имя получателя\"></label>\n              <label>Банк<input name=\"sbpBankName\" maxlength=\"120\" placeholder=\"Название банка\"></label>\n            </div>\n            <label>Телефон СБП<input name=\"sbpPhone\" maxlength=\"40\" inputmode=\"tel\" placeholder=\"+7 900 000-00-00\"></label>\n            <label>Ссылка банка для оплаты, HTTPS<input name=\"sbpPaymentUrl\" type=\"url\" maxlength=\"1000\" placeholder=\"https://...\"></label>\n            <label>Ссылка на изображение QR СБП, HTTPS<input name=\"sbpQrImageUrl\" type=\"url\" maxlength=\"1000\" placeholder=\"https://...\"></label>\n            <label>Инструкция пользователю<textarea name=\"sbpInstructions\" rows=\"4\" maxlength=\"700\">Переведите точную сумму и укажите код заявки в сообщении к платежу. Начисление выполняется после проверки администратором.</textarea></label>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Экономика</p><h2>SILARUM</h2></div><span class=\"badge\">1 SILARUM = 100 ₽</span></div>\n            <label>Комиссия вывода, %<input name=\"withdrawalFee\" type=\"number\" min=\"0\" max=\"100\" step=\"1\" value=\"25\"></label>\n            <label>Минимальный вывод<input name=\"minimumWithdrawal\" type=\"number\" min=\"0\" step=\"1\" value=\"25\"></label>\n            <label class=\"switch-row\"><span><strong>Разрешить вывод</strong><small>Общий аварийный переключатель</small></span><input name=\"withdrawalsEnabled\" type=\"checkbox\"></label>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Каталог</p><h2>Стоимость услуг</h2></div><span class=\"badge\">Из админки</span></div>\n            <p class=\"panel-copy\">Цена появится в приложении только после сохранения здесь. Пустое поле скрывает стоимость.</p>\n            <div class=\"service-price-list\">\n              <div class=\"service-price-row\" data-service=\"tarot\"><label class=\"switch-row\"><span><strong>Расклад Таро</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"tarot_relationship\"><label class=\"switch-row\"><span><strong>Расклад Таро на двоих</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"natal\"><label class=\"switch-row\"><span><strong>Натальная подсказка</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"photo_energy\"><label class=\"switch-row\"><span><strong>Энергетический след</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"photo_damage\"><label class=\"switch-row\"><span><strong>Определение порчи</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"photo_compatibility\"><label class=\"switch-row\"><span><strong>Совместимость по фото</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"palmlink\"><label class=\"switch-row\"><span><strong>Путь двух судеб</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"compatibility\"><label class=\"switch-row\"><span><strong>Совместимость по данным</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" placeholder=\"Не показывать\"></label></div>\n              <div class=\"service-price-row\" data-service=\"palm_reading\"><label class=\"switch-row\"><span><strong>Чтение по ладони</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" value=\"0\"></label></div>\n              <div class=\"service-price-row\" data-service=\"rune_reading\"><label class=\"switch-row\"><span><strong>Руны</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" value=\"0\"></label></div>\n              <div class=\"service-price-row\" data-service=\"amur_compatibility\"><label class=\"switch-row\"><span><strong>Амур</strong></span><input data-service-enabled type=\"checkbox\" checked></label><label>Цена, SILARUM<input data-service-price type=\"number\" min=\"0\" step=\"0.01\" value=\"0\"></label></div>\n            </div>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Подарки</p><h2>Колесо Фортуны</h2></div><span class=\"badge violet\">Коробки</span></div>\n            <label class=\"switch-row\"><span><strong>Колесо включено</strong><small>Один ежедневный шанс плюс бонусные вращения</small></span><input name=\"wheelEnabled\" type=\"checkbox\" checked></label>\n            <label>Вращений пользователю в сутки<input name=\"wheelDailySpins\" type=\"number\" min=\"1\" max=\"10\" step=\"1\" value=\"1\"></label>\n            <p class=\"panel-copy\">Для каждой коробки задайте услугу, количество внутри, общий суточный лимит выдач и вес выпадения.</p>\n            <div class=\"reward-list\">\n              <div class=\"reward-row\" data-reward=\"pair-tarot\">\n                <label class=\"switch-row\"><span><strong>Коробка 1</strong></span><input data-reward-enabled type=\"checkbox\" checked></label>\n                <label>Название<input data-reward-title value=\"Бесплатный расклад на двоих\" maxlength=\"100\"></label>\n                <label>Услуга<select data-reward-service><option value=\"tarot_relationship\">Расклад Таро на двоих</option><option value=\"photo_compatibility\">Совместимость по фото</option><option value=\"palmlink\">Путь двух судеб</option><option value=\"tarot\">Расклад Таро</option><option value=\"natal\">Натальная подсказка</option><option value=\"photo_damage\">Определение порчи</option></select></label>\n                <div class=\"three-cols\"><label>В коробке<input data-reward-quantity type=\"number\" min=\"1\" max=\"20\" value=\"1\"></label><label>В сутки<input data-reward-daily type=\"number\" min=\"0\" value=\"5\"></label><label>Вес<input data-reward-weight type=\"number\" min=\"1\" value=\"4\"></label></div>\n              </div>\n              <div class=\"reward-row\" data-reward=\"photo-pair\">\n                <label class=\"switch-row\"><span><strong>Коробка 2</strong></span><input data-reward-enabled type=\"checkbox\" checked></label>\n                <label>Название<input data-reward-title value=\"Совместимость по фото\" maxlength=\"100\"></label>\n                <label>Услуга<select data-reward-service><option value=\"photo_compatibility\">Совместимость по фото</option><option value=\"tarot_relationship\">Расклад Таро на двоих</option><option value=\"palmlink\">Путь двух судеб</option><option value=\"tarot\">Расклад Таро</option><option value=\"natal\">Натальная подсказка</option><option value=\"photo_damage\">Определение порчи</option></select></label>\n                <div class=\"three-cols\"><label>В коробке<input data-reward-quantity type=\"number\" min=\"1\" max=\"20\" value=\"1\"></label><label>В сутки<input data-reward-daily type=\"number\" min=\"0\" value=\"5\"></label><label>Вес<input data-reward-weight type=\"number\" min=\"1\" value=\"3\"></label></div>\n              </div>\n              <div class=\"reward-row\" data-reward=\"destiny-pair\">\n                <label class=\"switch-row\"><span><strong>Коробка 3</strong></span><input data-reward-enabled type=\"checkbox\"></label>\n                <label>Название<input data-reward-title value=\"Путь двух судеб\" maxlength=\"100\"></label>\n                <label>Услуга<select data-reward-service><option value=\"palmlink\">Путь двух судеб</option><option value=\"tarot_relationship\">Расклад Таро на двоих</option><option value=\"photo_compatibility\">Совместимость по фото</option><option value=\"tarot\">Расклад Таро</option><option value=\"natal\">Натальная подсказка</option><option value=\"photo_damage\">Определение порчи</option></select></label>\n                <div class=\"three-cols\"><label>В коробке<input data-reward-quantity type=\"number\" min=\"1\" max=\"20\" value=\"1\"></label><label>В сутки<input data-reward-daily type=\"number\" min=\"0\" value=\"3\"></label><label>Вес<input data-reward-weight type=\"number\" min=\"1\" value=\"2\"></label></div>\n              </div>\n            </div>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Каждый день</p><h2>Гороскоп Эзотериума</h2></div></div>\n            <label class=\"switch-row\"><span><strong>Ежедневный гороскоп</strong><small>Рассылка только пользователям, которые включили её в профиле</small></span><input name=\"dailyHoroscopeEnabled\" type=\"checkbox\" checked></label>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Рост</p><h2>Реферальная программа</h2></div><span class=\"badge rose\">50% / 13%</span></div>\n            <label class=\"switch-row\"><span><strong>Рефералы включены</strong><small>Начисления только с подтверждённых покупок</small></span><input name=\"referralsEnabled\" type=\"checkbox\" checked></label>\n            <div class=\"two-cols\">\n              <label>Первая покупка, %<input name=\"firstReferralRate\" type=\"number\" min=\"0\" max=\"100\" value=\"50\"></label>\n              <label>Повторные, %<input name=\"repeatReferralRate\" type=\"number\" min=\"0\" max=\"100\" value=\"13\"></label>\n            </div>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Социальный контур</p><h2>PalmLink и ритуалы вдвоём</h2></div></div>\n            <label class=\"switch-row\"><span><strong>PalmLink</strong><small>Поиск любви, дружбы и делового партнёра</small></span><input name=\"palmLinkEnabled\" type=\"checkbox\"></label>\n            <label class=\"switch-row\"><span><strong>Совместные расклады</strong><small>Каждый участник вводит данные по защищённой ссылке</small></span><input name=\"jointReadingsEnabled\" type=\"checkbox\" checked></label>\n            <label class=\"switch-row\"><span><strong>Оплата партнёром</strong><small>Подарок, полная оплата или разделение стоимости</small></span><input name=\"partnerPaymentEnabled\" type=\"checkbox\" checked></label>\n          </section>\n\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Безопасность</p><h2>Модерация</h2></div></div>\n            <label class=\"switch-row\"><span><strong>Ручная проверка фото</strong><small>Подозрительные материалы отправляются модератору</small></span><input name=\"manualPhotoReview\" type=\"checkbox\" checked></label>\n            <label class=\"switch-row\"><span><strong>Режим 18+</strong><small>Для PalmLink и случайных знакомств</small></span><input name=\"adultOnly\" type=\"checkbox\" checked></label>\n          </section>\n\n          <div class=\"save-bar\">\n            <div><strong id=\"save-state\">Изменений нет</strong><small>Настройки сохраняются в защищённом серверном реестре.</small></div>\n            <button type=\"submit\">Сохранить</button>\n          </div>\n        </form>\n      </section>\n\n\n      <section class=\"tab-panel\" data-panel=\"content\" hidden>\n        <section class=\"card panel intro-panel\">\n          <p class=\"eyebrow\">Каталог без изменений кода</p>\n          <h2>Таро и совместимость</h2>\n          <p>Меняйте названия, описания, позиции, порядок, бесплатные попытки, VIP-доступ и цену. После сохранения приложение получает новую конфигурацию с сервера.</p>\n        </section>\n        <form id=\"content-form\">\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">12 раскладов</p><h2>Каталог Таро</h2></div><span class=\"badge violet\">78 карт</span></div>\n            <div id=\"tarot-editor-list\" class=\"catalog-editor-list\"></div>\n          </section>\n          <section class=\"card panel\">\n            <div class=\"panel-head\"><div><p class=\"eyebrow\">Амур</p><h2>Виды совместимости</h2></div><span class=\"badge rose\">3 сценария</span></div>\n            <div id=\"compatibility-editor-list\" class=\"catalog-editor-list\"></div>\n          </section>\n          <div class=\"save-bar\">\n            <div><strong>Публикация каталога</strong><small>Настройки применятся для новых запусков.</small></div>\n            <button type=\"submit\">Сохранить каталог</button>\n          </div>\n        </form>\n      </section>\n\n      <section class=\"tab-panel\" data-panel=\"payments\" hidden>\n        <section class=\"card panel intro-panel\">\n          <p class=\"eyebrow\">СБП</p>\n          <h2>Заявки на пополнение</h2>\n          <p>Обычные платежи сверяются автоматически. Вручную подтверждайте только резервные переводы и заявки с пометкой «Требует внимания».</p>\n        </section>\n        <form id=\"payment-provider-form\" class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Автопроверка</p><h2>Подключение ЮKassa</h2></div><span class=\"badge\" id=\"payment-provider-status\">Не настроено</span></div>\n          <p class=\"panel-copy\">Секретный ключ шифруется и после сохранения больше не показывается. Для мгновенного зачисления укажите в кабинете ЮKassa адрес уведомлений: <strong>https://hngfpdsnjgdpazmortix.supabase.co/functions/v1/nastardamus-sbp-webhook</strong></p>\n          <label class=\"switch-row\"><span><strong>Автоматические платежи включены</strong><small>Доступно после ввода Shop ID и секретного ключа</small></span><input name=\"enabled\" type=\"checkbox\"></label>\n          <div class=\"two-cols\">\n            <label>Shop ID<input name=\"merchantId\" inputmode=\"numeric\" pattern=\"[0-9]{3,32}\" maxlength=\"32\" placeholder=\"Идентификатор магазина\"></label>\n            <label>Секретный ключ<input name=\"secret\" type=\"password\" minlength=\"16\" maxlength=\"300\" autocomplete=\"new-password\" placeholder=\"Оставьте пустым, чтобы не менять\"></label>\n          </div>\n          <p id=\"payment-secret-hint\" class=\"panel-copy\">Ключ ещё не сохранён.</p>\n          <div class=\"form-actions\"><button type=\"submit\">Сохранить подключение</button></div>\n        </form>\n        <form id=\"self-credit-form\" class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Мой счёт</p><h2>Начислить себе SILARUM</h2></div><span class=\"badge violet\">Только ваш Telegram ID</span></div>\n          <p class=\"panel-copy\">Начисление попадёт в финансовый журнал. Эта форма не может изменить баланс другого пользователя.</p>\n          <div class=\"two-cols\">\n            <label>Количество SILARUM<input name=\"amount\" type=\"number\" min=\"0.01\" max=\"1000000\" step=\"0.01\" required placeholder=\"100\"></label>\n            <label>Комментарий<input name=\"note\" maxlength=\"300\" placeholder=\"Например: тестирование услуг\"></label>\n          </div>\n          <div class=\"form-actions\"><button type=\"submit\">Начислить на мой счёт</button></div>\n        </form>\n        <section class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Очередь</p><h2>Последние заявки</h2></div><button type=\"button\" class=\"mini-button\" id=\"refresh-payments-button\">Обновить</button></div>\n          <div id=\"payments-list\" class=\"entity-list\"><p class=\"empty-state\">Загрузка платежей…</p></div>\n        </section>\n      </section>\n\n      <section class=\"tab-panel\" data-panel=\"team\" hidden>\n        <section class=\"card panel intro-panel\">\n          <p class=\"eyebrow\">Доступ и ответственность</p>\n          <h2>Команда проекта</h2>\n          <p>Назначайте администраторов по Telegram ID. Каждый получает только выбранные права. API-ключи и секреты никому не показываются.</p>\n        </section>\n\n        <section class=\"card panel\" id=\"team-section\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Участники</p><h2>Администраторы</h2></div><button type=\"button\" class=\"mini-button\" id=\"new-admin-button\">Добавить</button></div>\n          <div id=\"admins-list\" class=\"entity-list\"><p class=\"empty-state\">Загрузка команды…</p></div>\n        </section>\n\n        <form id=\"admin-form\" class=\"card panel editor\" hidden>\n          <input type=\"hidden\" name=\"editingTelegramId\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Права доступа</p><h2 id=\"admin-form-title\">Новый администратор</h2></div><button type=\"button\" class=\"icon-button\" data-close-editor=\"admin\">×</button></div>\n          <div class=\"two-cols\">\n            <label>Telegram ID<input name=\"telegramId\" inputmode=\"numeric\" required placeholder=\"7018304698\"></label>\n            <label>Роль<select name=\"role\" required>\n              <option value=\"admin\">Администратор</option>\n              <option value=\"operator\">Оператор</option>\n              <option value=\"owner\">Владелец</option>\n            </select></label>\n          </div>\n          <div class=\"two-cols\">\n            <label>Имя<input name=\"displayName\" maxlength=\"80\" placeholder=\"Имя сотрудника\"></label>\n            <label>Username<input name=\"username\" maxlength=\"64\" placeholder=\"@username\"></label>\n          </div>\n          <label class=\"switch-row\"><span><strong>Доступ активен</strong><small>Можно временно выключить без удаления</small></span><input name=\"isActive\" type=\"checkbox\" checked></label>\n          <fieldset class=\"permission-grid\">\n            <legend>Индивидуальные права</legend>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"admins.manage\"> Управление администраторами</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"settings.manage\"> Общие настройки</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"finance.view\"> Просмотр финансов</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"finance.manage\"> Управление финансами</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"services.manage\"> Услуги и цены</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"users.view\"> Просмотр пользователей</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"users.manage\"> Управление пользователями</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"content.manage\"> Контент и расклады</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"palmlink.moderate\"> Модерация PalmLink</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"support.view\"> Просмотр поддержки</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"support.reply\"> Ответы пользователям</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"support.manage\"> Настройки поддержки</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"ai.view\"> Просмотр центра ответов</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"ai.manage\"> Управление подключениями и ключами</label>\n            <label><input type=\"checkbox\" name=\"permission\" value=\"audit.view\"> Журнал действий</label>\n          </fieldset>\n          <div class=\"form-actions\"><button type=\"button\" class=\"secondary-button\" data-close-editor=\"admin\">Отмена</button><button type=\"submit\">Сохранить администратора</button></div>\n        </form>\n      </section>\n\n      <section class=\"tab-panel\" data-panel=\"support\" hidden>\n        <form id=\"support-form\" class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Сервис</p><h2>Поддержка пользователей</h2></div><span class=\"badge violet\">бот + операторы</span></div>\n          <label class=\"switch-row\"><span><strong>Поддержка включена</strong><small>Показывать пользователям кнопку обращения</small></span><input name=\"enabled\" type=\"checkbox\" checked></label>\n          <div class=\"two-cols\">\n            <label>Telegram поддержки<input name=\"supportUsername\" placeholder=\"@support_bot\"></label>\n            <label>ID группы или чата<input name=\"supportChatId\" inputmode=\"numeric\" placeholder=\"-100...\"></label>\n          </div>\n          <label>Приветственное сообщение<textarea name=\"welcomeMessage\" rows=\"4\" placeholder=\"Опишите вопрос…\"></textarea></label>\n          <label>Сообщение вне рабочего времени<textarea name=\"offlineMessage\" rows=\"4\"></textarea></label>\n          <div class=\"three-cols\">\n            <label>Часовой пояс<input name=\"timezone\" value=\"Europe/Berlin\"></label>\n            <label>С<input name=\"workFrom\" type=\"time\" value=\"09:00\"></label>\n            <label>До<input name=\"workTo\" type=\"time\" value=\"18:00\"></label>\n          </div>\n          <fieldset class=\"days-grid\"><legend>Рабочие дни</legend>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"1\" checked> Пн</label>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"2\" checked> Вт</label>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"3\" checked> Ср</label>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"4\" checked> Чт</label>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"5\" checked> Пт</label>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"6\"> Сб</label>\n            <label><input type=\"checkbox\" name=\"workDay\" value=\"0\"> Вс</label>\n          </fieldset>\n          <label>Ожидаемое время ответа, минут<input name=\"responseSlaMinutes\" type=\"number\" min=\"5\" max=\"10080\" value=\"240\"></label>\n          <label class=\"switch-row\"><span><strong>Разрешить вложения</strong><small>Фото и файлы в обращениях</small></span><input name=\"allowAttachments\" type=\"checkbox\" checked></label>\n          <label class=\"switch-row\"><span><strong>Автораспределение</strong><small>Назначать обращения свободным операторам</small></span><input name=\"autoAssign\" type=\"checkbox\" checked></label>\n          <div class=\"form-actions\"><button type=\"submit\">Сохранить поддержку</button></div>\n        </form>\n      </section>\n\n      <section class=\"tab-panel\" data-panel=\"ai\" hidden>\n        <section class=\"card panel intro-panel\">\n          <p class=\"eyebrow\">Мастерская Эзотериума</p>\n          <h2>Центр ответов</h2>\n          <p>Подключайте несколько API и распределяйте их между проводниками. Ключи шифруются, обратно показывается только маска. Для каждого проводника можно задать резервное подключение.</p>\n        </section>\n\n        <section class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Подключения</p><h2>Источники ответов</h2></div><button type=\"button\" class=\"mini-button\" id=\"new-provider-button\">Добавить API</button></div>\n          <div id=\"providers-list\" class=\"entity-list\"><p class=\"empty-state\">Загрузка провайдеров…</p></div>\n        </section>\n\n        <form id=\"provider-form\" class=\"card panel editor\" hidden>\n          <input type=\"hidden\" name=\"id\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Безопасное подключение</p><h2 id=\"provider-form-title\">Новое подключение</h2></div><button type=\"button\" class=\"icon-button\" data-close-editor=\"provider\">×</button></div>\n          <div class=\"two-cols\">\n            <label>Название<input name=\"name\" required placeholder=\"Основной источник\"></label>\n            <label>Тип<select name=\"providerType\">\n              <option value=\"openai_compatible\">Совместимый текстовый API</option>\n              <option value=\"openai\">Responses API</option>\n              <option value=\"anthropic\">Anthropic</option>\n              <option value=\"google\">Google</option>\n              <option value=\"custom\">Другой API</option>\n            </select></label>\n          </div>\n          <label>Адрес API<input name=\"baseUrl\" type=\"url\" placeholder=\"https://.../v1\"></label>\n          <label>API-ключ<input name=\"apiKey\" type=\"password\" autocomplete=\"new-password\" placeholder=\"Оставьте пустым, чтобы сохранить текущий ключ\"><small class=\"field-help\">После сохранения ключ нельзя просмотреть — только заменить.</small></label>\n          <div class=\"two-cols\">\n            <label>Текстовая модель<input name=\"textModel\" placeholder=\"название модели\"></label>\n            <label>Модель для изображений<input name=\"visionModel\" placeholder=\"название vision-модели\"></label>\n          </div>\n          <label>Приоритет<input name=\"priority\" type=\"number\" min=\"1\" max=\"10000\" value=\"100\"></label>\n          <fieldset class=\"permission-grid\"><legend>Возможности API</legend>\n            <label><input type=\"checkbox\" name=\"providerCapability\" value=\"text\" checked> Текст</label>\n            <label><input type=\"checkbox\" name=\"providerCapability\" value=\"vision\"> Изображения</label>\n            <label><input type=\"checkbox\" name=\"providerCapability\" value=\"moderation\"> Модерация</label>\n            <label><input type=\"checkbox\" name=\"providerCapability\" value=\"embeddings\"> Поиск по знаниям</label>\n            <label><input type=\"checkbox\" name=\"providerCapability\" value=\"audio\"> Голос</label>\n          </fieldset>\n          <label class=\"switch-row\"><span><strong>Подключение активно</strong><small>Выключение не удаляет ключ и настройки</small></span><input name=\"enabled\" type=\"checkbox\" checked></label>\n          <div class=\"form-actions\"><button type=\"button\" class=\"secondary-button\" data-close-editor=\"provider\">Отмена</button><button type=\"submit\">Сохранить API</button></div>\n        </form>\n\n        <section class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Специализация</p><h2>Проводники</h2></div><button type=\"button\" class=\"mini-button\" id=\"new-agent-button\">Новый проводник</button></div>\n          <div id=\"agents-list\" class=\"entity-list\"><p class=\"empty-state\">Загрузка помощников…</p></div>\n        </section>\n\n        <form id=\"agent-form\" class=\"card panel editor\" hidden>\n          <input type=\"hidden\" name=\"id\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Роль и поведение</p><h2 id=\"agent-form-title\">Новый помощник</h2></div><button type=\"button\" class=\"icon-button\" data-close-editor=\"agent\">×</button></div>\n          <div class=\"two-cols\">\n            <label>Название<input name=\"name\" required placeholder=\"Помощник поддержки\"></label>\n            <label>Системное имя<input name=\"slug\" required pattern=\"[a-z0-9_-]+\" placeholder=\"support-guide\"></label>\n          </div>\n          <label>Направление<select name=\"purpose\">\n            <option value=\"support\">Поддержка и ответы в чате</option>\n            <option value=\"onboarding\">Обучение работе с приложением</option>\n            <option value=\"tarot\">Таро</option>\n            <option value=\"astrology\">Астрология</option>\n            <option value=\"compatibility\">Совместимость</option>\n            <option value=\"photo_moderation\">Модерация фото</option>\n            <option value=\"palmlink_moderation\">Модерация PalmLink</option>\n            <option value=\"custom\">Другое направление</option>\n          </select></label>\n          <div class=\"two-cols\">\n            <label>Основное подключение<select name=\"providerId\"><option value=\"\">Не назначено</option></select></label>\n            <label>Резервное подключение<select name=\"fallbackProviderId\"><option value=\"\">Нет</option></select></label>\n          </div>\n          <label>Отдельная модель<input name=\"modelOverride\" placeholder=\"необязательно\"></label>\n          <label>Инструкция помощнику<textarea name=\"instructions\" rows=\"8\" maxlength=\"12000\" placeholder=\"Опишите роль, ограничения и стиль ответов\"></textarea></label>\n          <div class=\"two-cols\">\n            <label>Творчество 0–2<input name=\"temperature\" type=\"number\" min=\"0\" max=\"2\" step=\"0.05\" value=\"0.4\"></label>\n            <label>Максимум токенов<input name=\"maxOutputTokens\" type=\"number\" min=\"100\" max=\"20000\" value=\"1200\"></label>\n          </div>\n          <fieldset class=\"permission-grid\"><legend>Где отвечает</legend>\n            <label><input type=\"checkbox\" name=\"agentChannel\" value=\"app\" checked> В приложении</label>\n            <label><input type=\"checkbox\" name=\"agentChannel\" value=\"telegram\"> В Telegram-чате</label>\n            <label><input type=\"checkbox\" name=\"agentChannel\" value=\"admin\"> В админке</label>\n          </fieldset>\n          <label class=\"switch-row\"><span><strong>Помощник активен</strong><small>Можно временно отключить</small></span><input name=\"enabled\" type=\"checkbox\" checked></label>\n          <div class=\"form-actions\"><button type=\"button\" class=\"secondary-button\" data-close-editor=\"agent\">Отмена</button><button type=\"submit\">Сохранить помощника</button></div>\n        </form>\n\n        <form id=\"moderation-form\" class=\"card panel\">\n          <div class=\"panel-head\"><div><p class=\"eyebrow\">Безопасность изображений</p><h2>Фото-модерация</h2></div><span class=\"badge rose\">Автопроверка + человек</span></div>\n          <label class=\"switch-row\"><span><strong>Автоматическая проверка включена</strong><small>Высокий риск блокируется, средний уходит модератору</small></span><input name=\"enabled\" type=\"checkbox\" checked></label>\n          <fieldset class=\"permission-grid moderation-rules\"><legend>Что проверять</legend>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"nudity\" checked> Нагота</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"sexual_content\" checked> Сексуальный контент</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"minors\" checked> Несовершеннолетние</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"violence\" checked> Насилие и кровь</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"self_harm\" checked> Самоповреждение</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"hate_extremism\" checked> Ненависть и экстремизм</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"illegal_goods\" checked> Запрещённые товары</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"personal_data\" checked> Документы и личные данные</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"spam_duplicates\" checked> Спам и дубликаты</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"low_quality\" checked> Плохое качество</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"face_count\" checked> Количество людей</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"consent_required\" checked> Согласие на обработку</label>\n            <label><input type=\"checkbox\" name=\"moderationRule\" value=\"palmlink_profile_safety\" checked> Безопасность PalmLink</label>\n          </fieldset>\n          <div class=\"two-cols\">\n            <label>Порог блокировки 0–1<input name=\"blockThreshold\" type=\"number\" min=\"0\" max=\"1\" step=\"0.01\" value=\"0.85\"></label>\n            <label>Порог ручной проверки<input name=\"reviewThreshold\" type=\"number\" min=\"0\" max=\"1\" step=\"0.01\" value=\"0.55\"></label>\n            <label>Минимальное качество<input name=\"qualityThreshold\" type=\"number\" min=\"0\" max=\"1\" step=\"0.01\" value=\"0.45\"></label>\n            <label>Максимум лиц<input name=\"maximumFaces\" type=\"number\" min=\"1\" max=\"20\" value=\"2\"></label>\n          </div>\n          <div class=\"two-cols\">\n            <label>Высокий риск<select name=\"highRiskAction\"><option value=\"block\">Блокировать</option><option value=\"review\">На проверку</option><option value=\"allow\">Разрешить</option></select></label>\n            <label>Средний риск<select name=\"mediumRiskAction\"><option value=\"review\">На проверку</option><option value=\"block\">Блокировать</option><option value=\"allow\">Разрешить</option></select></label>\n          </div>\n          <label>Хранить отмеченные материалы, дней<input name=\"retainFlaggedDays\" type=\"number\" min=\"0\" max=\"365\" value=\"30\"></label>\n          <label class=\"switch-row\"><span><strong>Уведомлять администратора</strong><small>При блокировке или ручной проверке</small></span><input name=\"notifyAdmin\" type=\"checkbox\" checked></label>\n          <div class=\"form-actions\"><button type=\"submit\">Сохранить модерацию</button></div>\n        </form>\n      </section>\n    </div>\n  </main>\n  <div id=\"toast\" class=\"toast\" role=\"status\" aria-live=\"polite\"></div>\n  <script src=\"/admin/admin.js\"></script>\n</body>\n</html>\n",
    "contentType": "text/html; charset=utf-8"
  },
  "css": {
    "body": ":root{color-scheme:dark;--bg:#07050f;--panel:rgba(24,16,43,.82);--panel-soft:rgba(14,9,27,.72);--line:rgba(255,255,255,.12);--line-strong:rgba(245,200,106,.3);--muted:#aaa1bd;--text:#fbf7ff;--gold:#f5c86a;--violet:#b89cff;--rose:#ff8fb6;--ok:#76e6ad;--danger:#ff7d8c;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;min-height:100vh;background:radial-gradient(circle at 15% 0%,rgba(111,68,181,.22),transparent 36%),radial-gradient(circle at 90% 20%,rgba(202,88,143,.12),transparent 30%),linear-gradient(180deg,#0b0715,#05030a 72%);color:var(--text)}body:before{content:\"\";position:fixed;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(255,255,255,.7) 0 1px,transparent 1.5px);background-size:42px 42px;opacity:.07}.shell{width:min(820px,100%);margin:0 auto;padding:calc(22px + env(safe-area-inset-top)) 16px calc(110px + env(safe-area-inset-bottom))}.hero{display:flex;justify-content:space-between;align-items:center;padding:14px 4px 24px}.hero h1{font-family:Georgia,serif;font-size:clamp(32px,8vw,48px);margin:4px 0 8px}.hero p{margin:0;color:var(--muted)}.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:11px;color:var(--gold)!important;font-weight:800}.sigil{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;font-size:28px;color:var(--gold);border:1px solid rgba(245,200,106,.35);box-shadow:0 0 35px rgba(245,200,106,.16),inset 0 0 25px rgba(245,200,106,.08)}.card{background:linear-gradient(145deg,rgba(37,25,62,.9),rgba(16,11,30,.92));border:1px solid var(--line);border-radius:24px;box-shadow:0 18px 48px rgba(0,0,0,.28);backdrop-filter:blur(18px)}.access-card{display:flex;gap:16px;align-items:center;padding:18px;margin-bottom:16px}.access-card p,.intro-panel p{margin:5px 0 0;color:var(--muted);line-height:1.55}.access-copy-wrap{min-width:0;flex:1}.loader{width:28px;height:28px;border:3px solid rgba(255,255,255,.12);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;flex:0 0 auto}.access-card.ok .loader{animation:none;border:0;background:var(--ok);box-shadow:0 0 0 7px rgba(118,230,173,.09)}.access-card.error .loader{animation:none;border:0;background:var(--danger);box-shadow:0 0 0 7px rgba(255,125,140,.09)}.telegram-link{display:inline-flex;margin-top:12px;padding:10px 13px;border-radius:12px;text-decoration:none;color:#130a22;background:linear-gradient(135deg,#f5c86a,#fff1bd);font-size:13px;font-weight:900}@keyframes spin{to{transform:rotate(360deg)}}.status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px}.stat{padding:17px}.stat span{display:block;color:var(--muted);font-size:12px;margin-bottom:8px}.stat strong{font-size:19px}.stat strong.good{color:var(--ok)}.admin-tabs{display:flex;gap:8px;overflow:auto;padding:2px 2px 14px;scrollbar-width:none}.admin-tabs::-webkit-scrollbar{display:none}.admin-tabs button{white-space:nowrap;border:1px solid var(--line);background:rgba(20,13,34,.75);color:var(--muted);border-radius:999px;padding:11px 15px;font-weight:800;font-size:13px}.admin-tabs button.active{color:#160d22;background:linear-gradient(135deg,#f5c86a,#fff0b4);border-color:transparent}.tab-panel{animation:reveal .22s ease}.tab-panel:not(.active){display:none}@keyframes reveal{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.panel{padding:20px;margin-bottom:14px}.intro-panel h2{margin:3px 0 8px}.panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:18px}.panel-head h2{margin:3px 0 0;font-size:23px}.badge{padding:8px 10px;border-radius:999px;background:rgba(245,200,106,.12);border:1px solid rgba(245,200,106,.25);color:var(--gold);font-size:11px;font-weight:800;white-space:nowrap}.badge.violet{color:var(--violet);border-color:rgba(184,156,255,.25);background:rgba(184,156,255,.1)}.badge.rose{color:var(--rose);border-color:rgba(255,143,182,.25);background:rgba(255,143,182,.1)}label{display:block;color:#ddd5ea;font-size:13px;margin-top:14px}input,select,textarea{width:100%;margin-top:8px;border:1px solid var(--line);background:rgba(7,5,15,.76);color:var(--text);border-radius:14px;padding:13px 14px;font:inherit;outline:none}textarea{resize:vertical;line-height:1.45}select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--muted) 50%),linear-gradient(135deg,var(--muted) 50%,transparent 50%);background-position:calc(100% - 18px) 50%,calc(100% - 13px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat;padding-right:36px}input:focus,select:focus,textarea:focus{border-color:rgba(184,156,255,.65);box-shadow:0 0 0 3px rgba(184,156,255,.1)}input:disabled,select:disabled,textarea:disabled{opacity:.55}.field-help{display:block;color:var(--muted);margin-top:6px;line-height:1.4}.two-cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.three-cols{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:12px}.switch-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:13px 0;border-top:1px solid rgba(255,255,255,.07);margin:0}.switch-row:first-of-type{border-top:0}.switch-row span{display:flex;flex-direction:column;gap:4px}.switch-row small{color:var(--muted);line-height:1.35}.switch-row input{appearance:none;width:48px;height:28px;border-radius:999px;background:#30273d;border:1px solid var(--line);position:relative;transition:.2s;flex:0 0 auto;margin:0;padding:0}.switch-row input:after{content:\"\";position:absolute;width:20px;height:20px;left:3px;top:3px;background:#c9bfd8;border-radius:50%;transition:.2s}.switch-row input:checked{background:linear-gradient(90deg,#6e4ec0,#ae68b6)}.switch-row input:checked:after{left:23px;background:white}fieldset{border:1px solid var(--line);border-radius:18px;padding:14px;margin:18px 0 0}legend{padding:0 8px;color:var(--gold);font-size:12px;font-weight:800}.permission-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px 12px}.permission-grid label,.days-grid label{display:flex;align-items:center;gap:8px;margin:0;padding:8px 9px;border-radius:11px;background:rgba(255,255,255,.035);line-height:1.3}.permission-grid input,.days-grid input{width:18px;height:18px;margin:0;accent-color:#a476dd;flex:0 0 auto}.days-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:7px}.days-grid label{justify-content:center;padding:8px 4px;font-size:12px}.entity-list{display:grid;gap:10px}.entity-card{border:1px solid rgba(255,255,255,.09);background:rgba(7,5,15,.48);border-radius:17px;padding:14px}.entity-main{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.entity-title{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.entity-title strong{font-size:15px}.entity-card p{color:var(--muted);margin:7px 0 0;font-size:12px;line-height:1.45}.entity-meta{display:flex;gap:6px;flex-wrap:wrap;margin-top:9px}.chip{display:inline-flex;padding:5px 8px;border-radius:999px;background:rgba(184,156,255,.09);border:1px solid rgba(184,156,255,.18);font-size:10px;color:#d8c9fb}.chip.ok{color:var(--ok);background:rgba(118,230,173,.08);border-color:rgba(118,230,173,.2)}.chip.off{color:var(--danger);background:rgba(255,125,140,.07);border-color:rgba(255,125,140,.18)}.entity-actions{display:flex;gap:7px;flex:0 0 auto}.entity-actions button,.mini-button,.icon-button,.secondary-button,.form-actions button,.save-bar button{border:0;border-radius:13px;padding:11px 14px;color:#170c25;background:linear-gradient(135deg,#f5c86a,#fff1bd);font-weight:900;font-size:13px}.entity-actions button{padding:8px 10px;font-size:11px}.entity-actions .danger,.danger-button{color:#ffdce2;background:rgba(255,125,140,.14);border:1px solid rgba(255,125,140,.22)}.mini-button{padding:9px 12px}.icon-button{width:36px;height:36px;padding:0;border-radius:50%;font-size:22px;background:rgba(255,255,255,.08);color:white}.secondary-button{background:rgba(255,255,255,.08)!important;color:white!important;border:1px solid var(--line)!important}.editor{border-color:var(--line-strong);box-shadow:0 22px 60px rgba(0,0,0,.42),0 0 0 1px rgba(245,200,106,.05)}.form-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.empty-state{color:var(--muted);text-align:center;padding:12px 0;margin:0}.save-bar{position:sticky;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;background:rgba(14,9,25,.95);border:1px solid var(--line);border-radius:20px;box-shadow:0 18px 50px rgba(0,0,0,.55);backdrop-filter:blur(22px);z-index:4}.save-bar div{display:flex;flex-direction:column;gap:3px}.save-bar small{color:var(--muted);font-size:10px;line-height:1.25}.save-bar button:disabled,.form-actions button:disabled,.mini-button:disabled{opacity:.45}.toast{position:fixed;left:50%;bottom:28px;transform:translate(-50%,24px);opacity:0;padding:12px 16px;border-radius:14px;background:#21162f;color:white;border:1px solid var(--line);transition:.25s;pointer-events:none;z-index:20;max-width:calc(100% - 32px);text-align:center}.toast.show{opacity:1;transform:translate(-50%,0)}[hidden]{display:none!important}@media(max-width:620px){.shell{padding-left:12px;padding-right:12px}.panel{padding:17px}.two-cols,.three-cols,.permission-grid{grid-template-columns:1fr}.days-grid{grid-template-columns:repeat(4,1fr)}.save-bar small{display:none}.hero{align-items:flex-start}.sigil{width:48px;height:48px}.entity-main{flex-direction:column}.entity-actions{width:100%}.entity-actions button{flex:1}.form-actions{flex-direction:column-reverse}.form-actions button{width:100%}}.catalog-editor-list{display:grid;gap:12px}.catalog-editor{padding:16px;border:1px solid var(--line);border-radius:20px;background:rgba(7,5,15,.48)}.catalog-editor__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.catalog-editor__head strong{font-size:16px}.catalog-editor textarea{min-height:74px}.catalog-editor .three-cols{grid-template-columns:repeat(3,1fr)}@media(max-width:620px){.catalog-editor .three-cols{grid-template-columns:1fr}.catalog-editor__head{align-items:flex-start}}",
    "contentType": "text/css; charset=utf-8"
  },
  "js": {
    "body": "const tg = window.Telegram?.WebApp;\ntg?.ready();\ntg?.expand();\ntg?.setHeaderColor?.('#090713');\ntg?.setBackgroundColor?.('#090713');\n\nconst accessCard = document.getElementById('access-card');\nconst accessTitle = document.getElementById('access-title');\nconst accessCopy = document.getElementById('access-copy');\nconst adminBotLink = document.getElementById('admin-bot-link');\nconst dashboard = document.getElementById('dashboard');\nconst settingsForm = document.getElementById('settings-form');\nconst adminForm = document.getElementById('admin-form');\nconst supportForm = document.getElementById('support-form');\nconst providerForm = document.getElementById('provider-form');\nconst agentForm = document.getElementById('agent-form');\nconst moderationForm = document.getElementById('moderation-form');\nconst paymentProviderForm = document.getElementById('payment-provider-form');\nconst selfCreditForm = document.getElementById('self-credit-form');\nconst toast = document.getElementById('toast');\nconst saveState = document.getElementById('save-state');\n\nconst state = {\n  overview: null,\n  payments: null,\n  team: null,\n  ai: null\n};\n\nconst roleLabels = {\n  owner: 'Владелец',\n  admin: 'Администратор',\n  operator: 'Оператор'\n};\n\nconst purposeLabels = {\n  support: 'Поддержка',\n  onboarding: 'Обучение',\n  tarot: 'Таро',\n  astrology: 'Астрология',\n  compatibility: 'Совместимость',\n  photo_moderation: 'Фото-модерация',\n  palmlink_moderation: 'PalmLink',\n  custom: 'Другое'\n};\n\nconst providerTypeLabels = {\n  openai_compatible: 'Совместимый API',\n  openai: 'Responses API',\n  anthropic: 'Messages API',\n  google: 'Generative API',\n  custom: 'Другой API'\n};\n\nlet toastTimer;\n\nfunction escapeHtml(value) {\n  return String(value ?? '')\n    .replaceAll('&', '&amp;')\n    .replaceAll('<', '&lt;')\n    .replaceAll('>', '&gt;')\n    .replaceAll('\"', '&quot;')\n    .replaceAll(\"'\", '&#039;');\n}\n\nfunction notify(text) {\n  clearTimeout(toastTimer);\n  toast.textContent = text;\n  toast.classList.add('show');\n  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);\n}\n\nfunction setAccess(type, title, copy) {\n  accessCard.classList.remove('ok', 'error');\n  if (type) accessCard.classList.add(type);\n  accessTitle.textContent = title;\n  accessCopy.textContent = copy;\n}\n\nfunction setStatus(id, text, ok = true) {\n  const node = document.getElementById(id);\n  node.textContent = text;\n  node.classList.toggle('good', Boolean(ok));\n}\n\nasync function requestJson(url, options = {}) {\n  const response = await fetch(url, options);\n  const data = await response.json().catch(() => ({}));\n  if (!response.ok) {\n    const error = new Error(data.error || `HTTP ${response.status}`);\n    error.status = response.status;\n    error.data = data;\n    throw error;\n  }\n  return data;\n}\n\nasync function api(path, method = 'GET', body) {\n  return requestJson(path, {\n    method,\n    headers: {\n      'Content-Type': 'application/json',\n      'X-Telegram-Init-Data': tg?.initData || ''\n    },\n    body: body ? JSON.stringify(body) : undefined\n  });\n}\n\nasync function loadBotLink() {\n  try {\n    const data = await requestJson('/api/admin-bot');\n    if (!data.bot?.username) return;\n    adminBotLink.href = `https://t.me/${data.bot.username}?start=admin`;\n    adminBotLink.textContent = `Открыть @${data.bot.username}`;\n    adminBotLink.hidden = false;\n  } catch {\n    adminBotLink.hidden = true;\n  }\n}\n\nfunction applySettings(settings = {}) {\n  for (const [key, value] of Object.entries(settings)) {\n    const field = settingsForm.elements.namedItem(key);\n    if (!field) continue;\n    if (field.type === 'checkbox') field.checked = Boolean(value);\n    else field.value = String(value);\n  }\n  document.querySelectorAll('[data-service]').forEach((row) => {\n    const service = settings.serviceCatalog?.[row.dataset.service] || {};\n    row.querySelector('[data-service-enabled]').checked = service.enabled !== false;\n    row.querySelector('[data-service-price]').value = service.price !== null\n      && service.price !== undefined\n      && Number.isFinite(Number(service.price))\n      ? String(service.price)\n      : '';\n  });\n  const rewards = new Map((settings.wheelRewards || []).map((reward) => [reward.id, reward]));\n  document.querySelectorAll('[data-reward]').forEach((row) => {\n    const reward = rewards.get(row.dataset.reward);\n    if (!reward) return;\n    row.querySelector('[data-reward-enabled]').checked = reward.enabled === true;\n    row.querySelector('[data-reward-title]').value = reward.title || '';\n    row.querySelector('[data-reward-service]').value = reward.serviceId || 'tarot_relationship';\n    row.querySelector('[data-reward-quantity]').value = reward.quantity ?? 1;\n    row.querySelector('[data-reward-daily]').value = reward.dailyLimit ?? 0;\n    row.querySelector('[data-reward-weight]').value = reward.weight ?? 1;\n  });\n}\n\nfunction collectServiceCatalog() {\n  return Object.fromEntries([...document.querySelectorAll('[data-service]')].map((row) => {\n    const rawPrice = row.querySelector('[data-service-price]').value.trim();\n    return [row.dataset.service, {\n      enabled: row.querySelector('[data-service-enabled]').checked,\n      price: rawPrice === '' ? null : Number(rawPrice)\n    }];\n  }));\n}\n\nfunction collectWheelRewards() {\n  return [...document.querySelectorAll('[data-reward]')].map((row) => ({\n    id: row.dataset.reward,\n    enabled: row.querySelector('[data-reward-enabled]').checked,\n    title: row.querySelector('[data-reward-title]').value,\n    serviceId: row.querySelector('[data-reward-service]').value,\n    quantity: Number(row.querySelector('[data-reward-quantity]').value),\n    dailyLimit: Number(row.querySelector('[data-reward-daily]').value),\n    weight: Number(row.querySelector('[data-reward-weight]').value)\n  }));\n}\n\nfunction formatPaymentMoney(value, fraction = 2) {\n  return Number(value || 0).toLocaleString('ru-RU', {\n    minimumFractionDigits: fraction,\n    maximumFractionDigits: fraction\n  });\n}\n\nfunction createActionKey(prefix) {\n  const randomPart = globalThis.crypto?.randomUUID?.()\n    || `${Date.now()}-${Math.random().toString(16).slice(2)}`;\n  return `${prefix}-${randomPart}`;\n}\n\nfunction paymentStatusLabel(status) {\n  return ({\n    pending: 'Создана',\n    awaiting_confirmation: 'Ожидает проверки',\n    paid: 'Подтверждена',\n    rejected: 'Отклонена',\n    cancelled: 'Отменена',\n    expired: 'Истекла'\n  })[status] || status;\n}\n\nfunction populatePaymentProvider() {\n  if (!paymentProviderForm) return;\n  const provider = state.payments?.provider || {};\n  paymentProviderForm.elements.enabled.checked = provider.enabled === true;\n  paymentProviderForm.elements.merchantId.value = provider.merchant_id || '';\n  paymentProviderForm.elements.secret.value = '';\n  const configured = Boolean(provider.merchant_id && provider.secret_hint);\n  const status = document.getElementById('payment-provider-status');\n  status.textContent = provider.enabled && configured ? 'Работает автоматически' : configured ? 'Выключено' : 'Не настроено';\n  status.classList.toggle('ok', provider.enabled && configured);\n  document.getElementById('payment-secret-hint').textContent = provider.secret_hint\n    ? `Сохранённый ключ: ${provider.secret_hint}`\n    : 'Ключ ещё не сохранён.';\n}\n\nfunction renderPayments() {\n  const list = document.getElementById('payments-list');\n  if (!list) return;\n  const orders = state.payments?.orders || [];\n  if (!orders.length) {\n    list.innerHTML = '<p class=\"empty-state\">Заявок на пополнение пока нет.</p>';\n    return;\n  }\n  list.innerHTML = orders.map((order) => {\n    const status = escapeHtml(paymentStatusLabel(order.status));\n    const pending = ['pending', 'awaiting_confirmation'].includes(order.status);\n    const canManage = state.payments?.canManage === true;\n    const verification = order.verification_state === 'automatic'\n      ? 'Автоматическая сверка'\n      : order.verification_state === 'manual_review'\n        ? 'Требует внимания'\n        : 'Резервная ручная проверка';\n    return `<article class=\"entity-card\" data-payment-id=\"${escapeHtml(order.id)}\">\n      <div class=\"entity-main\">\n        <div>\n          <div class=\"entity-title\"><strong>${escapeHtml(order.payment_reference)}</strong><span class=\"chip ${order.status === 'paid' ? 'ok' : pending ? '' : 'off'}\">${status}</span></div>\n          <p>Telegram ID ${Number(order.telegram_id)} · ${formatPaymentMoney(Number(order.silarum_units) / 100)} SILARUM · ${formatPaymentMoney(Number(order.ruble_kopecks) / 100)} ₽</p>\n          <p>${escapeHtml(verification)}${order.provider_payment_id ? ` · платёж ${escapeHtml(order.provider_payment_id)}` : ''}</p>\n          <p>${new Date(order.created_at).toLocaleString('ru-RU')}</p>\n        </div>\n        ${pending && canManage ? `<div class=\"entity-actions\">\n          <button type=\"button\" data-payment-decision=\"paid\">Подтвердить</button>\n          <button type=\"button\" class=\"danger\" data-payment-decision=\"rejected\">Отклонить</button>\n        </div>` : ''}\n      </div>\n    </article>`;\n  }).join('');\n}\n\nasync function loadPayments() {\n  try {\n    state.payments = await api('/api/admin?payments=1');\n    populatePaymentProvider();\n    renderPayments();\n  } catch (error) {\n    state.payments = null;\n    const tab = document.querySelector('[data-tab=\"payments\"]');\n    if (error.status === 403 && tab) tab.hidden = true;\n    const list = document.getElementById('payments-list');\n    if (list) list.innerHTML = '<p class=\"empty-state\">Платежи временно недоступны.</p>';\n  }\n}\n\npaymentProviderForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = paymentProviderForm.querySelector('button[type=\"submit\"]');\n  button.disabled = true;\n  try {\n    const result = await api('/api/admin', 'POST', {\n      paymentAction: 'save_sbp_provider',\n      provider: {\n        enabled: paymentProviderForm.elements.enabled.checked,\n        merchantId: paymentProviderForm.elements.merchantId.value.trim(),\n        secret: paymentProviderForm.elements.secret.value\n      }\n    });\n    state.payments = { ...(state.payments || {}), provider: result.provider };\n    populatePaymentProvider();\n    notify('Подключение СБП сохранено');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить подключение');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nselfCreditForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const amount = Number(selfCreditForm.elements.amount.value);\n  if (!Number.isFinite(amount) || amount <= 0) {\n    notify('Укажите сумму начисления');\n    return;\n  }\n  if (!window.confirm(`Начислить себе ${formatPaymentMoney(amount)} SILARUM? Операция попадёт в журнал.`)) return;\n  const button = selfCreditForm.querySelector('button[type=\"submit\"]');\n  button.disabled = true;\n  try {\n    const result = await api('/api/admin', 'POST', {\n      paymentAction: 'credit_self',\n      amount,\n      note: selfCreditForm.elements.note.value.trim(),\n      idempotencyKey: createActionKey('admin-self')\n    });\n    const balance = Number(result.credit?.balance_units || 0) / 100;\n    notify(`Начислено. Ваш баланс: ${formatPaymentMoney(balance)} SILARUM`);\n    selfCreditForm.reset();\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось начислить SILARUM');\n  } finally {\n    button.disabled = false;\n  }\n});\n\ndocument.getElementById('refresh-payments-button')?.addEventListener('click', loadPayments);\ndocument.getElementById('payments-list')?.addEventListener('click', async (event) => {\n  const button = event.target.closest('[data-payment-decision]');\n  const card = event.target.closest('[data-payment-id]');\n  if (!button || !card) return;\n  const decision = button.dataset.paymentDecision;\n  const message = decision === 'paid'\n    ? 'Подтвердить фактическое поступление перевода и начислить SILARUM?'\n    : 'Отклонить эту заявку?';\n  if (!window.confirm(message)) return;\n  button.disabled = true;\n  try {\n    await api('/api/admin', 'POST', {\n      paymentAction: 'review_sbp_topup',\n      orderId: card.dataset.paymentId,\n      decision,\n      note: ''\n    });\n    notify(decision === 'paid' ? 'Платёж подтверждён, SILARUM начислены' : 'Заявка отклонена');\n    await loadPayments();\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось обработать платёж');\n    button.disabled = false;\n  }\n});\n\nfunction disableForm(form, disabled) {\n  if (!form) return;\n  for (const field of form.elements) field.disabled = Boolean(disabled);\n}\n\nfunction activateTab(name) {\n  document.querySelectorAll('[data-tab]').forEach((button) => {\n    button.classList.toggle('active', button.dataset.tab === name);\n  });\n  document.querySelectorAll('[data-panel]').forEach((panel) => {\n    const active = panel.dataset.panel === name;\n    panel.classList.toggle('active', active);\n    panel.hidden = !active;\n  });\n  window.scrollTo({ top: 0, behavior: 'smooth' });\n}\n\ndocument.querySelector('.admin-tabs')?.addEventListener('click', (event) => {\n  const button = event.target.closest('[data-tab]');\n  if (button) activateTab(button.dataset.tab);\n});\n\nfunction renderAdmins() {\n  const list = document.getElementById('admins-list');\n  const admins = state.team?.admins || [];\n  const canManage = Boolean(state.team?.capabilities?.manageAdmins);\n  const currentId = Number(state.team?.profile?.telegram_id);\n\n  if (!canManage) {\n    list.innerHTML = '<p class=\"empty-state\">У вас нет права управлять администраторами.</p>';\n    document.getElementById('new-admin-button').hidden = true;\n    return;\n  }\n\n  document.getElementById('new-admin-button').hidden = false;\n  if (!admins.length) {\n    list.innerHTML = '<p class=\"empty-state\">Пока назначен только системный владелец.</p>';\n    return;\n  }\n\n  list.innerHTML = admins.map((admin) => {\n    const id = Number(admin.telegram_id);\n    const title = admin.display_name || (admin.username ? `@${admin.username}` : `ID ${id}`);\n    const permissions = admin.role === 'owner'\n      ? ['Полный доступ']\n      : Object.keys(admin.permissions || {}).filter((key) => admin.permissions[key]);\n    return `\n      <article class=\"entity-card\">\n        <div class=\"entity-main\">\n          <div>\n            <div class=\"entity-title\">\n              <strong>${escapeHtml(title)}</strong>\n              <span class=\"chip\">${escapeHtml(roleLabels[admin.role] || admin.role)}</span>\n              <span class=\"chip ${admin.is_active ? 'ok' : 'off'}\">${admin.is_active ? 'Активен' : 'Отключён'}</span>\n            </div>\n            <p>Telegram ID ${id}${admin.username ? ` · @${escapeHtml(admin.username)}` : ''}</p>\n            <div class=\"entity-meta\">${permissions.slice(0, 5).map((permission) => `<span class=\"chip\">${escapeHtml(permission)}</span>`).join('')}${permissions.length > 5 ? `<span class=\"chip\">+${permissions.length - 5}</span>` : ''}</div>\n          </div>\n          <div class=\"entity-actions\">\n            <button type=\"button\" data-admin-edit=\"${id}\">Изменить</button>\n            ${admin.role !== 'owner' && id !== currentId ? `<button type=\"button\" class=\"danger\" data-admin-delete=\"${id}\">Удалить</button>` : ''}\n          </div>\n        </div>\n      </article>`;\n  }).join('');\n}\n\nfunction applyRoleDefaults(role) {\n  const defaults = state.team?.roleDefaults?.[role] || {};\n  adminForm.querySelectorAll('input[name=\"permission\"]').forEach((field) => {\n    field.checked = role === 'owner' || defaults[field.value] === true;\n    field.disabled = role === 'owner';\n  });\n}\n\nfunction openAdminEditor(admin = null) {\n  adminForm.reset();\n  adminForm.hidden = false;\n  const editing = Boolean(admin);\n  adminForm.elements.editingTelegramId.value = editing ? admin.telegram_id : '';\n  adminForm.elements.telegramId.value = editing ? admin.telegram_id : '';\n  adminForm.elements.telegramId.readOnly = editing;\n  adminForm.elements.displayName.value = admin?.display_name || '';\n  adminForm.elements.username.value = admin?.username ? `@${admin.username}` : '';\n  adminForm.elements.role.value = admin?.role || 'admin';\n  adminForm.elements.isActive.checked = admin?.is_active !== false;\n  document.getElementById('admin-form-title').textContent = editing ? 'Изменить администратора' : 'Новый администратор';\n  applyRoleDefaults(admin?.role || 'admin');\n  if (admin && admin.role !== 'owner') {\n    adminForm.querySelectorAll('input[name=\"permission\"]').forEach((field) => {\n      field.checked = admin.permissions?.[field.value] === true;\n    });\n  }\n  adminForm.scrollIntoView({ behavior: 'smooth', block: 'start' });\n}\n\nfunction closeEditor(type) {\n  const form = type === 'admin' ? adminForm : type === 'provider' ? providerForm : agentForm;\n  form.hidden = true;\n}\n\ndocument.querySelectorAll('[data-close-editor]').forEach((button) => {\n  button.addEventListener('click', () => closeEditor(button.dataset.closeEditor));\n});\n\ndocument.getElementById('new-admin-button')?.addEventListener('click', () => openAdminEditor());\nadminForm?.elements.role?.addEventListener('change', () => applyRoleDefaults(adminForm.elements.role.value));\n\ndocument.getElementById('admins-list')?.addEventListener('click', async (event) => {\n  const editButton = event.target.closest('[data-admin-edit]');\n  const deleteButton = event.target.closest('[data-admin-delete]');\n  if (editButton) {\n    const admin = state.team.admins.find((item) => Number(item.telegram_id) === Number(editButton.dataset.adminEdit));\n    if (admin) openAdminEditor(admin);\n  }\n  if (deleteButton) {\n    const id = Number(deleteButton.dataset.adminDelete);\n    if (!confirm(`Удалить администратора с Telegram ID ${id}?`)) return;\n    try {\n      await api('/api/admin-team', 'POST', { action: 'delete_admin', telegramId: id });\n      await loadTeam();\n      notify('Администратор удалён');\n    } catch (error) {\n      notify(error.data?.error || 'Не удалось удалить администратора');\n    }\n  }\n});\n\nadminForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = adminForm.querySelector('button[type=\"submit\"]');\n  const permissions = {};\n  adminForm.querySelectorAll('input[name=\"permission\"]:checked').forEach((field) => {\n    permissions[field.value] = true;\n  });\n  const admin = {\n    telegramId: Number(adminForm.elements.telegramId.value),\n    displayName: adminForm.elements.displayName.value,\n    username: adminForm.elements.username.value,\n    role: adminForm.elements.role.value,\n    isActive: adminForm.elements.isActive.checked,\n    permissions\n  };\n  button.disabled = true;\n  try {\n    await api('/api/admin-team', 'POST', { action: 'upsert_admin', admin });\n    closeEditor('admin');\n    await loadTeam();\n    notify('Права администратора сохранены');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить администратора');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nfunction populateSupport() {\n  const support = state.team?.support;\n  const canView = Boolean(state.team?.capabilities?.viewSupport);\n  const canManage = Boolean(state.team?.capabilities?.manageSupport);\n  const tabButton = document.querySelector('[data-tab=\"support\"]');\n  if (!canView) {\n    tabButton.hidden = true;\n    return;\n  }\n  tabButton.hidden = false;\n  if (!support) return;\n  supportForm.elements.enabled.checked = support.enabled !== false;\n  supportForm.elements.supportUsername.value = support.support_username ? `@${support.support_username}` : '';\n  supportForm.elements.supportChatId.value = support.support_chat_id || '';\n  supportForm.elements.welcomeMessage.value = support.welcome_message || '';\n  supportForm.elements.offlineMessage.value = support.offline_message || '';\n  supportForm.elements.responseSlaMinutes.value = support.response_sla_minutes || 240;\n  supportForm.elements.allowAttachments.checked = support.allow_attachments !== false;\n  supportForm.elements.autoAssign.checked = support.auto_assign !== false;\n  supportForm.elements.timezone.value = support.working_hours?.timezone || 'Europe/Berlin';\n  supportForm.elements.workFrom.value = support.working_hours?.from || '09:00';\n  supportForm.elements.workTo.value = support.working_hours?.to || '18:00';\n  const days = new Set((support.working_hours?.days || [1, 2, 3, 4, 5]).map(Number));\n  supportForm.querySelectorAll('input[name=\"workDay\"]').forEach((field) => {\n    field.checked = days.has(Number(field.value));\n  });\n  disableForm(supportForm, !canManage);\n}\n\nsupportForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = supportForm.querySelector('button[type=\"submit\"]');\n  const support = {\n    enabled: supportForm.elements.enabled.checked,\n    supportUsername: supportForm.elements.supportUsername.value,\n    supportChatId: supportForm.elements.supportChatId.value,\n    welcomeMessage: supportForm.elements.welcomeMessage.value,\n    offlineMessage: supportForm.elements.offlineMessage.value,\n    responseSlaMinutes: Number(supportForm.elements.responseSlaMinutes.value),\n    allowAttachments: supportForm.elements.allowAttachments.checked,\n    autoAssign: supportForm.elements.autoAssign.checked,\n    workingHours: {\n      timezone: supportForm.elements.timezone.value,\n      from: supportForm.elements.workFrom.value,\n      to: supportForm.elements.workTo.value,\n      days: [...supportForm.querySelectorAll('input[name=\"workDay\"]:checked')].map((field) => Number(field.value))\n    }\n  };\n  button.disabled = true;\n  try {\n    await api('/api/admin-team', 'POST', { action: 'save_support', support });\n    await loadTeam();\n    notify('Настройки поддержки сохранены');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить поддержку');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nfunction providerName(id) {\n  return state.ai?.providers?.find((provider) => provider.id === id)?.name || 'Не назначена';\n}\n\nfunction renderProviders() {\n  const list = document.getElementById('providers-list');\n  const providers = state.ai?.providers || [];\n  const canManage = Boolean(state.ai?.canManage);\n  document.getElementById('new-provider-button').hidden = !canManage;\n  if (!providers.length) {\n    list.innerHTML = '<p class=\"empty-state\">Добавьте первый API. Текущий системный ключ Vercel продолжит работать отдельно.</p>';\n    refreshProviderSelects();\n    return;\n  }\n  list.innerHTML = providers.map((provider) => {\n    const caps = Object.entries(provider.capabilities || {}).filter(([, enabled]) => enabled).map(([key]) => key);\n    return `\n      <article class=\"entity-card\">\n        <div class=\"entity-main\">\n          <div>\n            <div class=\"entity-title\"><strong>${escapeHtml(provider.name)}</strong><span class=\"chip\">${escapeHtml(providerTypeLabels[provider.provider_type] || 'API')}</span><span class=\"chip ${provider.enabled ? 'ok' : 'off'}\">${provider.enabled ? 'Активен' : 'Отключён'}</span></div>\n            <p>${escapeHtml(provider.text_model || 'текстовая модель не задана')}${provider.vision_model ? ` · vision: ${escapeHtml(provider.vision_model)}` : ''} · ключ ${escapeHtml(provider.api_key_hint || 'не задан')}</p>\n            <div class=\"entity-meta\">${caps.map((cap) => `<span class=\"chip\">${escapeHtml(cap)}</span>`).join('')}</div>\n          </div>\n          ${canManage ? `<div class=\"entity-actions\"><button type=\"button\" data-provider-edit=\"${provider.id}\">Изменить</button><button type=\"button\" class=\"danger\" data-provider-delete=\"${provider.id}\">Удалить</button></div>` : ''}\n        </div>\n      </article>`;\n  }).join('');\n  refreshProviderSelects();\n}\n\nfunction refreshProviderSelects() {\n  const providers = state.ai?.providers || [];\n  for (const field of [agentForm?.elements.providerId, agentForm?.elements.fallbackProviderId]) {\n    if (!field) continue;\n    const current = field.value;\n    const firstLabel = field.name === 'fallbackProviderId' ? 'Нет' : 'Не назначена';\n    field.innerHTML = `<option value=\"\">${firstLabel}</option>${providers.map((provider) => `<option value=\"${provider.id}\">${escapeHtml(provider.name)}${provider.enabled ? '' : ' (выключена)'}</option>`).join('')}`;\n    field.value = current;\n  }\n}\n\nfunction openProviderEditor(provider = null) {\n  providerForm.reset();\n  providerForm.hidden = false;\n  providerForm.elements.id.value = provider?.id || '';\n  providerForm.elements.name.value = provider?.name || '';\n  providerForm.elements.providerType.value = provider?.provider_type || 'openai_compatible';\n  providerForm.elements.baseUrl.value = provider?.base_url || '';\n  providerForm.elements.apiKey.value = '';\n  providerForm.elements.textModel.value = provider?.text_model || '';\n  providerForm.elements.visionModel.value = provider?.vision_model || '';\n  providerForm.elements.priority.value = provider?.priority || 100;\n  providerForm.elements.enabled.checked = provider?.enabled !== false;\n  providerForm.querySelectorAll('input[name=\"providerCapability\"]').forEach((field) => {\n    field.checked = provider ? provider.capabilities?.[field.value] === true : field.value === 'text';\n  });\n  document.getElementById('provider-form-title').textContent = provider ? 'Изменить подключение' : 'Новое подключение';\n  providerForm.scrollIntoView({ behavior: 'smooth', block: 'start' });\n}\n\ndocument.getElementById('new-provider-button')?.addEventListener('click', () => openProviderEditor());\ndocument.getElementById('providers-list')?.addEventListener('click', async (event) => {\n  const editButton = event.target.closest('[data-provider-edit]');\n  const deleteButton = event.target.closest('[data-provider-delete]');\n  if (editButton) {\n    const provider = state.ai.providers.find((item) => item.id === editButton.dataset.providerEdit);\n    if (provider) openProviderEditor(provider);\n  }\n  if (deleteButton) {\n    const id = deleteButton.dataset.providerDelete;\n    if (!confirm('Удалить это подключение? Назначенные проводники останутся без источника ответов.')) return;\n    try {\n      await api('/api/admin-ai', 'POST', { action: 'delete_provider', id });\n      await loadAi();\n      notify('Подключение удалено');\n    } catch (error) {\n      notify(error.data?.error || 'Не удалось удалить подключение');\n    }\n  }\n});\n\nproviderForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = providerForm.querySelector('button[type=\"submit\"]');\n  const capabilities = {};\n  providerForm.querySelectorAll('input[name=\"providerCapability\"]').forEach((field) => {\n    capabilities[field.value] = field.checked;\n  });\n  const provider = {\n    id: providerForm.elements.id.value || undefined,\n    name: providerForm.elements.name.value,\n    providerType: providerForm.elements.providerType.value,\n    baseUrl: providerForm.elements.baseUrl.value,\n    apiKey: providerForm.elements.apiKey.value,\n    textModel: providerForm.elements.textModel.value,\n    visionModel: providerForm.elements.visionModel.value,\n    priority: Number(providerForm.elements.priority.value),\n    enabled: providerForm.elements.enabled.checked,\n    capabilities\n  };\n  button.disabled = true;\n  try {\n    await api('/api/admin-ai', 'POST', { action: 'upsert_provider', provider });\n    closeEditor('provider');\n    await loadAi();\n    notify('Подключение сохранено, ключ зашифрован');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить API');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nfunction renderAgents() {\n  const list = document.getElementById('agents-list');\n  const agents = state.ai?.agents || [];\n  const canManage = Boolean(state.ai?.canManage);\n  document.getElementById('new-agent-button').hidden = !canManage;\n  if (!agents.length) {\n    list.innerHTML = '<p class=\"empty-state\">Помощники ещё не созданы.</p>';\n    return;\n  }\n  list.innerHTML = agents.map((agent) => `\n    <article class=\"entity-card\">\n      <div class=\"entity-main\">\n        <div>\n          <div class=\"entity-title\"><strong>${escapeHtml(agent.name)}</strong><span class=\"chip\">${escapeHtml(purposeLabels[agent.purpose] || agent.purpose)}</span><span class=\"chip ${agent.enabled ? 'ok' : 'off'}\">${agent.enabled ? 'Активен' : 'Отключён'}</span></div>\n          <p>Основная: ${escapeHtml(providerName(agent.provider_id))} · резерв: ${escapeHtml(providerName(agent.fallback_provider_id))}</p>\n          <div class=\"entity-meta\">${Object.entries(agent.channels || {}).filter(([, enabled]) => enabled).map(([channel]) => `<span class=\"chip\">${escapeHtml(channel)}</span>`).join('')}<span class=\"chip\">${escapeHtml(agent.model_override || 'модель провайдера')}</span></div>\n        </div>\n        ${canManage ? `<div class=\"entity-actions\"><button type=\"button\" data-agent-edit=\"${agent.id}\">Изменить</button><button type=\"button\" class=\"danger\" data-agent-delete=\"${agent.id}\">Удалить</button></div>` : ''}\n      </div>\n    </article>`).join('');\n}\n\nfunction openAgentEditor(agent = null) {\n  agentForm.reset();\n  refreshProviderSelects();\n  agentForm.hidden = false;\n  agentForm.elements.id.value = agent?.id || '';\n  agentForm.elements.name.value = agent?.name || '';\n  agentForm.elements.slug.value = agent?.slug || '';\n  agentForm.elements.purpose.value = agent?.purpose || 'custom';\n  agentForm.elements.providerId.value = agent?.provider_id || '';\n  agentForm.elements.fallbackProviderId.value = agent?.fallback_provider_id || '';\n  agentForm.elements.modelOverride.value = agent?.model_override || '';\n  agentForm.elements.instructions.value = agent?.instructions || '';\n  agentForm.elements.temperature.value = agent?.temperature ?? 0.4;\n  agentForm.elements.maxOutputTokens.value = agent?.max_output_tokens || 1200;\n  agentForm.elements.enabled.checked = agent?.enabled !== false;\n  agentForm.querySelectorAll('input[name=\"agentChannel\"]').forEach((field) => {\n    field.checked = agent ? agent.channels?.[field.value] === true : field.value === 'app';\n  });\n  document.getElementById('agent-form-title').textContent = agent ? 'Изменить помощника' : 'Новый помощник';\n  agentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });\n}\n\ndocument.getElementById('new-agent-button')?.addEventListener('click', () => openAgentEditor());\ndocument.getElementById('agents-list')?.addEventListener('click', async (event) => {\n  const editButton = event.target.closest('[data-agent-edit]');\n  const deleteButton = event.target.closest('[data-agent-delete]');\n  if (editButton) {\n    const agent = state.ai.agents.find((item) => item.id === editButton.dataset.agentEdit);\n    if (agent) openAgentEditor(agent);\n  }\n  if (deleteButton) {\n    const id = deleteButton.dataset.agentDelete;\n    if (!confirm('Удалить проводника?')) return;\n    try {\n      await api('/api/admin-ai', 'POST', { action: 'delete_agent', id });\n      await loadAi();\n      notify('Помощник удалён');\n    } catch (error) {\n      notify(error.data?.error || 'Не удалось удалить помощника');\n    }\n  }\n});\n\nagentForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = agentForm.querySelector('button[type=\"submit\"]');\n  const channels = {};\n  agentForm.querySelectorAll('input[name=\"agentChannel\"]').forEach((field) => {\n    channels[field.value] = field.checked;\n  });\n  const agent = {\n    id: agentForm.elements.id.value || undefined,\n    name: agentForm.elements.name.value,\n    slug: agentForm.elements.slug.value,\n    purpose: agentForm.elements.purpose.value,\n    providerId: agentForm.elements.providerId.value || null,\n    fallbackProviderId: agentForm.elements.fallbackProviderId.value || null,\n    modelOverride: agentForm.elements.modelOverride.value,\n    instructions: agentForm.elements.instructions.value,\n    temperature: Number(agentForm.elements.temperature.value),\n    maxOutputTokens: Number(agentForm.elements.maxOutputTokens.value),\n    enabled: agentForm.elements.enabled.checked,\n    channels\n  };\n  button.disabled = true;\n  try {\n    await api('/api/admin-ai', 'POST', { action: 'upsert_agent', agent });\n    closeEditor('agent');\n    await loadAi();\n    notify('Настройки помощника сохранены');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить помощника');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nfunction populateModeration() {\n  const moderation = state.ai?.moderation;\n  if (!moderation) return;\n  moderationForm.elements.enabled.checked = moderation.enabled !== false;\n  moderationForm.querySelectorAll('input[name=\"moderationRule\"]').forEach((field) => {\n    field.checked = moderation.rules?.[field.value] !== false;\n  });\n  moderationForm.elements.blockThreshold.value = moderation.thresholds?.block ?? 0.85;\n  moderationForm.elements.reviewThreshold.value = moderation.thresholds?.manual_review ?? 0.55;\n  moderationForm.elements.qualityThreshold.value = moderation.thresholds?.minimum_quality ?? 0.45;\n  moderationForm.elements.maximumFaces.value = moderation.thresholds?.maximum_faces ?? 2;\n  moderationForm.elements.highRiskAction.value = moderation.actions?.high_risk || 'block';\n  moderationForm.elements.mediumRiskAction.value = moderation.actions?.medium_risk || 'review';\n  moderationForm.elements.retainFlaggedDays.value = moderation.actions?.retain_flagged_days ?? 30;\n  moderationForm.elements.notifyAdmin.checked = moderation.actions?.notify_admin !== false;\n  disableForm(moderationForm, !state.ai?.canManage);\n}\n\nmoderationForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = moderationForm.querySelector('button[type=\"submit\"]');\n  const rules = {};\n  moderationForm.querySelectorAll('input[name=\"moderationRule\"]').forEach((field) => {\n    rules[field.value] = field.checked;\n  });\n  const moderation = {\n    enabled: moderationForm.elements.enabled.checked,\n    rules,\n    thresholds: {\n      block: Number(moderationForm.elements.blockThreshold.value),\n      manual_review: Number(moderationForm.elements.reviewThreshold.value),\n      minimum_quality: Number(moderationForm.elements.qualityThreshold.value),\n      maximum_faces: Number(moderationForm.elements.maximumFaces.value)\n    },\n    actions: {\n      high_risk: moderationForm.elements.highRiskAction.value,\n      medium_risk: moderationForm.elements.mediumRiskAction.value,\n      low_risk: 'allow',\n      retain_flagged_days: Number(moderationForm.elements.retainFlaggedDays.value),\n      notify_admin: moderationForm.elements.notifyAdmin.checked\n    }\n  };\n  button.disabled = true;\n  try {\n    await api('/api/admin-ai', 'POST', { action: 'save_moderation', moderation });\n    await loadAi();\n    notify('Правила фото-модерации сохранены');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить модерацию');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nasync function loadTeam() {\n  try {\n    state.team = await api('/api/admin-team');\n    renderAdmins();\n    populateSupport();\n  } catch (error) {\n    state.team = null;\n    document.getElementById('admins-list').innerHTML = '<p class=\"empty-state\">Раздел команды временно недоступен.</p>';\n    if (error.status === 403) {\n      document.querySelector('[data-tab=\"team\"]').hidden = true;\n      document.querySelector('[data-tab=\"support\"]').hidden = true;\n    }\n  }\n}\n\nasync function loadAi() {\n  try {\n    state.ai = await api('/api/admin-ai');\n    renderProviders();\n    renderAgents();\n    populateModeration();\n    const enabled = state.ai.providers.filter((provider) => provider.enabled).length;\n    const total = state.ai.providers.length;\n    if (total) setStatus('status-ai', `${enabled}/${total} API`, enabled > 0);\n    else if (state.overview?.services?.readings) setStatus('status-ai', 'Системный ключ', true);\n    else setStatus('status-ai', 'Не настроен', false);\n  } catch (error) {\n    state.ai = null;\n    document.querySelector('[data-tab=\"ai\"]').hidden = error.status === 403;\n    if (state.overview?.services?.readings) setStatus('status-ai', 'Системный ключ', true);\n    else setStatus('status-ai', 'Недоступен', false);\n  }\n}\n\nsettingsForm?.addEventListener('input', () => {\n  saveState.textContent = 'Есть несохранённые изменения';\n});\n\nsettingsForm?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const button = settingsForm.querySelector('button[type=\"submit\"]');\n  const values = {};\n  for (const [key, value] of new FormData(settingsForm).entries()) {\n    if (key) values[key] = value;\n  }\n  for (const checkbox of settingsForm.querySelectorAll('input[type=\"checkbox\"]')) values[checkbox.name] = checkbox.checked;\n  for (const number of settingsForm.querySelectorAll('input[type=\"number\"]')) values[number.name] = Number(number.value);\n  values.serviceCatalog = collectServiceCatalog();\n  values.wheelRewards = collectWheelRewards();\n  values.tarotCatalog = state.overview?.settings?.tarotCatalog || [];\n  values.compatibilityCatalog = state.overview?.settings?.compatibilityCatalog || [];\n  button.disabled = true;\n  saveState.textContent = 'Сохраняем…';\n  try {\n    const result = await api('/api/admin', 'POST', { settings: values });\n    if (!result.persisted) throw new Error('persistence_not_configured');\n    saveState.textContent = 'Настройки сохранены';\n    notify('Изменения применены');\n    tg?.HapticFeedback?.notificationOccurred?.('success');\n  } catch (error) {\n    saveState.textContent = 'Не удалось сохранить';\n    notify(error.data?.error || 'Ошибка серверного сохранения');\n    tg?.HapticFeedback?.notificationOccurred?.('error');\n  } finally {\n    button.disabled = false;\n  }\n});\n\n\nconst tarotContentDefinitions = [\n  ['card-of-day', 'Карта дня', 1],\n  ['yes-no', 'Да или нет', 1],\n  ['past-present-future', 'Прошлое · Настоящее · Будущее', 3],\n  ['situation-obstacle-advice', 'Ситуация · Препятствие · Совет', 3],\n  ['love-relationship', 'Любовь и отношения', 5],\n  ['money-career', 'Деньги и карьера', 5],\n  ['two-paths', 'Два пути', 5],\n  ['pair-compatibility', 'Совместимость пары', 7],\n  ['near-future', 'Ближайшее будущее', 7],\n  ['shadow-side', 'Теневая сторона', 7],\n  ['celtic-cross', 'Кельтский крест', 10],\n  ['wheel-of-year', 'Колесо года', 12]\n];\nconst compatibilityContentDefinitions = [\n  ['data', 'По личным данным'],\n  ['photo', 'По фотографиям'],\n  ['palm', 'По ладоням']\n];\n\nfunction catalogAccessOptions(value) {\n  const selectedValue = ({ public: 'optional', vip: 'included', vip_only: 'only' })[value] || value;\n  return [\n    ['optional', 'Для всех'],\n    ['included', 'Включено в VIP'],\n    ['only', 'Только VIP'],\n    ['none', 'Без VIP-льгот']\n  ].map(([id, title]) => `<option value=\"${id}\"${selectedValue === id ? ' selected' : ''}>${title}</option>`).join('');\n}\n\nfunction renderCatalogEditor(item, kind, fallbackTitle, fallbackCardCount = 1, index = 0) {\n  const id = item?.id || '';\n  const cardCount = Number(item?.cardCount || fallbackCardCount);\n  const positions = Array.isArray(item?.positions) ? item.positions.join('\\n') : '';\n  return `<article class=\"catalog-editor\" data-catalog-kind=\"${kind}\" data-catalog-id=\"${escapeHtml(id)}\">\n    <div class=\"catalog-editor__head\">\n      <strong>${escapeHtml(item?.title || fallbackTitle)}</strong>\n      <label class=\"switch-row\"><span><small>Показывать</small></span><input data-catalog-enabled type=\"checkbox\"${item?.enabled === false ? '' : ' checked'}></label>\n    </div>\n    <label>Название<input data-catalog-title maxlength=\"100\" value=\"${escapeHtml(item?.title || fallbackTitle)}\"></label>\n    <label>Короткое описание<textarea data-catalog-description maxlength=\"500\">${escapeHtml(item?.description || '')}</textarea></label>\n    ${kind === 'tarot' ? `<div class=\"two-cols\"><label>Количество карт<input data-catalog-card-count type=\"number\" min=\"1\" max=\"12\" value=\"${cardCount}\"></label><label>Позиции, по одной на строку<textarea data-catalog-positions maxlength=\"1000\">${escapeHtml(positions)}</textarea></label></div>` : ''}\n    <div class=\"three-cols\">\n      <label>Цена, SILARUM<input data-catalog-price type=\"number\" min=\"0\" step=\"0.01\" value=\"${item?.price ?? ''}\"></label>\n      <label>Бесплатных попыток<input data-catalog-free type=\"number\" min=\"0\" max=\"1000\" value=\"${Number(item?.freeChecks || 0)}\"></label>\n      <label>Доступ<select data-catalog-vip>${catalogAccessOptions(item?.vipAccess || 'optional')}</select></label>\n    </div>\n    <label>Порядок<input data-catalog-order type=\"number\" min=\"0\" max=\"1000\" value=\"${Number(item?.displayOrder ?? index + 1)}\"></label>\n  </article>`;\n}\n\nfunction renderContentSettings(settings = {}) {\n  const tarotOverrides = new Map((settings.tarotCatalog || []).map((item) => [item.id, item]));\n  const compatibilityOverrides = new Map((settings.compatibilityCatalog || []).map((item) => [item.id, item]));\n  const tarotList = document.getElementById('tarot-editor-list');\n  const compatibilityList = document.getElementById('compatibility-editor-list');\n  if (tarotList) tarotList.innerHTML = tarotContentDefinitions.map(([id, title, count], index) => renderCatalogEditor({ id, ...tarotOverrides.get(id) }, 'tarot', title, count, index)).join('');\n  if (compatibilityList) compatibilityList.innerHTML = compatibilityContentDefinitions.map(([id, title], index) => renderCatalogEditor({ id, ...compatibilityOverrides.get(id) }, 'compatibility', title, 1, index)).join('');\n  disableForm(document.getElementById('content-form'), state.overview?.canManageSettings === false);\n}\n\nfunction collectContentCatalog(kind) {\n  return [...document.querySelectorAll(`[data-catalog-kind=\"${kind}\"]`)].map((row) => {\n    const rawPrice = row.querySelector('[data-catalog-price]').value.trim();\n    const item = {\n      id: row.dataset.catalogId,\n      enabled: row.querySelector('[data-catalog-enabled]').checked,\n      title: row.querySelector('[data-catalog-title]').value,\n      description: row.querySelector('[data-catalog-description]').value,\n      price: rawPrice === '' ? null : Number(rawPrice),\n      freeChecks: Number(row.querySelector('[data-catalog-free]').value),\n      vipAccess: row.querySelector('[data-catalog-vip]').value,\n      displayOrder: Number(row.querySelector('[data-catalog-order]').value)\n    };\n    if (kind === 'tarot') {\n      item.cardCount = Number(row.querySelector('[data-catalog-card-count]').value);\n      item.positions = row.querySelector('[data-catalog-positions]').value.split('\\n').map((value) => value.trim()).filter(Boolean);\n    }\n    return item;\n  });\n}\n\ndocument.getElementById('content-form')?.addEventListener('submit', async (event) => {\n  event.preventDefault();\n  const form = event.currentTarget;\n  const button = form.querySelector('button[type=\"submit\"]');\n  button.disabled = true;\n  try {\n    const result = await api('/api/admin', 'POST', {\n      settings: {\n        ...(state.overview?.settings || {}),\n        tarotCatalog: collectContentCatalog('tarot'),\n        compatibilityCatalog: collectContentCatalog('compatibility')\n      }\n    });\n    if (!result.persisted) throw new Error('persistence_not_configured');\n    state.overview.settings = result.settings;\n    renderContentSettings(result.settings);\n    notify('Каталог опубликован');\n    tg?.HapticFeedback?.notificationOccurred?.('success');\n  } catch (error) {\n    notify(error.data?.error || 'Не удалось сохранить каталог');\n    tg?.HapticFeedback?.notificationOccurred?.('error');\n  } finally {\n    button.disabled = false;\n  }\n});\n\nasync function boot() {\n  if (!tg?.initData) {\n    setAccess('error', 'Откройте через Telegram', 'Прямой вход закрыт. Запустите бота и нажмите кнопку «Админ-панель».');\n    await loadBotLink();\n    return;\n  }\n\n  try {\n    state.overview = await api('/api/admin');\n    setAccess('ok', 'Доступ подтверждён', `Администратор: ${state.overview.user?.first_name || state.overview.user?.username || state.overview.user?.id}`);\n    document.getElementById('admin-subtitle').textContent = `Telegram ID ${state.overview.user.id} · ${roleLabels[state.overview.role] || state.overview.role}`;\n    setStatus('status-bot', state.overview.services.bot ? 'Подключён' : 'Нет', state.overview.services.bot);\n    setStatus('status-app', state.overview.services.webAppUrl ? 'Онлайн' : 'Нет адреса', state.overview.services.webAppUrl);\n    setStatus('status-access', roleLabels[state.overview.role] || state.overview.role, true);\n    applySettings(state.overview.settings);\n    renderContentSettings(state.overview.settings);\n    disableForm(settingsForm, state.overview.canManageSettings === false);\n    dashboard.hidden = false;\n    await Promise.all([loadPayments(), loadTeam(), loadAi()]);\n  } catch (error) {\n    if (error.status === 403 && error.data?.userId) {\n      setAccess('error', 'Ожидается подтверждение владельца', `Ваш Telegram ID: ${error.data.userId}. Доступ должен назначить владелец.`);\n      document.getElementById('admin-subtitle').textContent = `Telegram ID ${error.data.userId}`;\n    } else if (error.status === 401) {\n      setAccess('error', 'Сессия Telegram истекла', 'Закройте панель и снова откройте её кнопкой в боте.');\n    } else {\n      setAccess('error', 'Ошибка подключения', 'Не удалось подтвердить доступ. Повторите запуск из Telegram.');\n    }\n  }\n}\n\nboot();\n",
    "contentType": "text/javascript; charset=utf-8"
  }
}
);

const CONTROL_ENTRY_HTML = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#090713">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Эзотериум</title>
  <style>
    :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 32%,#39225f 0,#120d24 38%,#07050d 78%);color:#f4dfaa;font-family:system-ui,-apple-system,sans-serif}.entry{width:min(88vw,360px);padding:32px 24px;text-align:center}.mark{width:76px;height:76px;margin:0 auto 20px;border:1px solid #d8ad5b;border-radius:50%;display:grid;place-items:center;box-shadow:0 0 34px #9f6add55;font-size:32px}.entry h1{margin:0 0 8px;font-family:Georgia,serif;font-size:28px}.entry p{margin:0;color:#b9a9c9;line-height:1.55}.spinner{width:22px;height:22px;margin:24px auto 0;border:2px solid #d8ad5b44;border-top-color:#e8c878;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
  </style>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
  <main class="entry">
    <div class="mark" aria-hidden="true">✦</div>
    <h1>Эзотериум</h1>
    <p>Открываем ваше пространство…</p>
    <div class="spinner" aria-hidden="true"></div>
  </main>
  <script src="/ui-kit/control-entry-gate.js"></script>
</body>
</html>`;

const SERVICE_DEFINITIONS = Object.freeze({
  tarot: 'Расклад Таро',
  tarot_relationship: 'Расклад Таро на двоих',
  natal: 'Натальная подсказка',
  photo_energy: 'Энергетический след',
  photo_damage: 'Определение порчи',
  photo_compatibility: 'Совместимость по фото',
  palmlink: 'Путь двух судеб',
  compatibility: 'Совместимость по данным',
  palm_reading: 'Чтение по ладони',
  rune_reading: 'Руны',
  amur_compatibility: 'Амур'
});

const DIALOGUE_DEFINITIONS = Object.freeze({
  personal: 'Личные диалоги во всех разделах',
  solo: 'Личная комната',
  pair: 'Комната для двоих',
  group: 'Групповое мероприятие'
});

const DEFAULT_DIALOGUE_CATALOG = Object.freeze(Object.fromEntries(
  Object.entries(DIALOGUE_DEFINITIONS).map(([id, title]) => [id, {
    id,
    title,
    enabled: true,
    sectionFree: true,
    includedQuestions: id === 'group' ? 5 : 3,
    extraQuestionPrice: 0.1
  }])
));

const TAROT_DEFINITIONS = Object.freeze({
  'card-of-day': { title: 'Карта дня', cardCount: 1 },
  'yes-no': { title: 'Да или нет', cardCount: 1 },
  'past-present-future': { title: 'Прошлое · Настоящее · Будущее', cardCount: 3 },
  'situation-obstacle-advice': { title: 'Ситуация · Препятствие · Совет', cardCount: 3 },
  'love-relationship': { title: 'Любовь и отношения', cardCount: 5 },
  'money-career': { title: 'Деньги и карьера', cardCount: 5 },
  'two-paths': { title: 'Два пути', cardCount: 5 },
  'pair-compatibility': { title: 'Совместимость пары', cardCount: 7 },
  'near-future': { title: 'Ближайшее будущее', cardCount: 7 },
  'shadow-side': { title: 'Теневая сторона', cardCount: 7 },
  'celtic-cross': { title: 'Кельтский крест', cardCount: 10 },
  'wheel-of-year': { title: 'Колесо года', cardCount: 12 }
});

const COMPATIBILITY_DEFINITIONS = Object.freeze({
  data: 'По личным данным',
  photo: 'По фотографиям',
  palm: 'По ладоням'
});

const DEFAULT_SERVICE_CATALOG = Object.freeze(
  Object.fromEntries(Object.entries(SERVICE_DEFINITIONS).map(([id, title]) => [
    id,
    { id, title, enabled: true, price: null }
  ]))
);

const DEFAULT_WHEEL_REWARDS = Object.freeze([
  { id: 'pair-tarot', serviceId: 'tarot_relationship', title: 'Бесплатный расклад на двоих', enabled: true, quantity: 1, dailyLimit: 5, weight: 4 },
  { id: 'photo-pair', serviceId: 'photo_compatibility', title: 'Совместимость по фото', enabled: true, quantity: 1, dailyLimit: 5, weight: 3 },
  { id: 'destiny-pair', serviceId: 'palmlink', title: 'Путь двух судеб', enabled: false, quantity: 1, dailyLimit: 3, weight: 2 }
]);

const DEFAULT_SETTINGS = Object.freeze({
  paymentsEnabled: true,
  everythingFree: false,
  starsEnabled: true,
  starsPerSilarum: 50,
  paymentMethods: {
    stars: { enabled: true, miniApp: true },
    ton: { enabled: false, miniApp: false },
    usdt: { enabled: false, miniApp: false },
    sbp: { enabled: false, miniApp: false }
  },
  paymentRates: { starsPerSilarum: 50, tonPerSilarum: 0, usdtPerSilarum: 0 },
  sbpTopupsEnabled: false,
  sbpAutomationEnabled: true,
  sbpMinimumSilarum: 10,
  sbpMaximumSilarum: 1000,
  sbpRoublesPerSilarum: 100,
  sbpRecipientName: '',
  sbpBankName: '',
  sbpPhone: '',
  sbpPaymentUrl: '',
  sbpQrImageUrl: '',
  sbpInstructions: 'Переведите точную сумму и укажите код заявки в сообщении к платежу. Начисление выполняется после проверки администратором.',
  withdrawalFee: 25,
  minimumWithdrawal: 25,
  withdrawalsEnabled: false,
  wheelEnabled: true,
  wheelPrizeShare: 50,
  wheelMaxPrize: 1000,
  wheelDailySpins: 1,
  wheelRewards: DEFAULT_WHEEL_REWARDS,
  serviceCatalog: DEFAULT_SERVICE_CATALOG,
  dialogueCatalog: DEFAULT_DIALOGUE_CATALOG,
  tarotCatalog: [],
  compatibilityCatalog: [],
  dailyHoroscopeEnabled: true,
  subscriptionGateEnabled: false,
  subscriptionChannelUsername: '',
  subscriptionChannelTitle: 'Канал Эзотериума',
  dailyFreeServiceIds: ['tarot', 'tarot_relationship', 'palm_reading', 'natal', 'rune_reading'],
  tonTreasuryAddress: 'UQAVyNXcWPUm-24n7JMqIIjMjYN1bVMPXbNww29NNh-l1CyO',
  referralsEnabled: true,
  firstReferralRate: 50,
  repeatReferralRate: 13,
  palmLinkEnabled: false,
  jointReadingsEnabled: true,
  partnerPaymentEnabled: true,
  manualPhotoReview: true,
  adultOnly: true
});

function sendJson(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(body);
}

function sendControl(res, status, body = '', contentType = 'text/plain; charset=utf-8') {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  return res.status(status).send(body);
}

function parseAdminIds(value) {
  return new Set(
    String(value || '')
      .split(/[\s,;]+/)
      .map(Number)
      .filter(Number.isSafeInteger)
  );
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanHttpsUrl(value) {
  const text = cleanText(value, 1000);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function cleanTelegramChannel(value) {
  const username = cleanText(value, 80).replace(/^https?:\/\/(?:t\.me|telegram\.me)\//i, '').replace(/^@/, '').split(/[/?#]/)[0];
  return /^[A-Za-z0-9_]{5,32}$/.test(username) ? `@${username}` : '';
}

function cleanTonAddress(value) {
  const address = cleanText(value, 100);
  return /^(?:-?\d+:[0-9a-fA-F]{64}|[A-Za-z0-9_-]{40,80})$/.test(address) ? address : '';
}

function sanitizeServiceCatalog(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(Object.entries(SERVICE_DEFINITIONS).map(([id, title]) => {
    const item = source[id] && typeof source[id] === 'object' ? source[id] : {};
    const numericPrice = item.price === '' || item.price === null || item.price === undefined
      ? null
      : clampNumber(item.price, 0, 1_000_000, null);
    return [id, {
      id,
      title,
      enabled: item.enabled !== false,
      price: numericPrice
    }];
  }));
}

function sanitizeDialogueCatalog(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return Object.fromEntries(Object.entries(DIALOGUE_DEFINITIONS).map(([id, title]) => {
    const item = source[id] && typeof source[id] === 'object' ? source[id] : {};
    return [id, {
      id,
      title,
      enabled: item.enabled !== false,
      sectionFree: item.sectionFree !== false,
      includedQuestions: Math.round(clampNumber(item.includedQuestions, 0, 1000, id === 'group' ? 5 : 3)),
      extraQuestionPrice: clampNumber(item.extraQuestionPrice, 0.1, 1_000_000, 0.1)
    }];
  }));
}

function sanitizeCatalogPrice(value) {
  if (value === '' || value === null || value === undefined) return null;
  return clampNumber(value, 0, 1_000_000, null);
}

function sanitizeVipAccess(value) {
  const normalized = ({
    public: 'optional',
    vip: 'included',
    vip_only: 'only'
  })[String(value)] || String(value);
  return ['none', 'optional', 'included', 'only'].includes(normalized) ? normalized : 'optional';
}

function sanitizeTarotCatalog(input) {
  const rows = Array.isArray(input) ? input : [];
  const byId = new Map(rows.map((item) => [String(item?.id || ''), item]));
  return Object.entries(TAROT_DEFINITIONS).map(([id, definition], index) => {
    const item = byId.get(id) || {};
    const cardCount = Math.round(clampNumber(item.cardCount, 1, 12, definition.cardCount));
    const positions = Array.isArray(item.positions)
      ? item.positions.map((position) => cleanText(position, 80)).filter(Boolean).slice(0, cardCount)
      : [];
    return {
      id,
      enabled: item.enabled !== false,
      title: cleanText(item.title, 100) || definition.title,
      description: cleanText(item.description, 500),
      cardCount,
      positions,
      price: sanitizeCatalogPrice(item.price),
      freeChecks: Math.round(clampNumber(item.freeChecks, 0, 1000, 0)),
      vipAccess: sanitizeVipAccess(item.vipAccess),
      displayOrder: Math.round(clampNumber(item.displayOrder, 0, 1000, index + 1))
    };
  });
}

function sanitizeCompatibilityCatalog(input) {
  const rows = Array.isArray(input) ? input : [];
  const byId = new Map(rows.map((item) => [String(item?.id || ''), item]));
  return Object.entries(COMPATIBILITY_DEFINITIONS).map(([id, defaultTitle], index) => {
    const item = byId.get(id) || {};
    return {
      id,
      enabled: item.enabled !== false,
      title: cleanText(item.title, 100) || defaultTitle,
      description: cleanText(item.description, 500),
      price: sanitizeCatalogPrice(item.price),
      freeChecks: Math.round(clampNumber(item.freeChecks, 0, 1000, 0)),
      vipAccess: sanitizeVipAccess(item.vipAccess),
      displayOrder: Math.round(clampNumber(item.displayOrder, 0, 1000, index + 1))
    };
  });
}

function sanitizeWheelRewards(input) {
  const source = Array.isArray(input) ? input : DEFAULT_WHEEL_REWARDS;
  const seen = new Set();
  return source.slice(0, 24).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const serviceId = String(item.serviceId || '');
    if (!SERVICE_DEFINITIONS[serviceId]) return [];
    const rawId = String(item.id || `reward-${index + 1}`).toLowerCase();
    const id = rawId.replace(/[^a-z0-9_-]/g, '').slice(0, 48);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      serviceId,
      title: String(item.title || SERVICE_DEFINITIONS[serviceId]).trim().slice(0, 100),
      enabled: item.enabled === true,
      quantity: Math.round(clampNumber(item.quantity, 1, 20, 1)),
      dailyLimit: Math.round(clampNumber(item.dailyLimit, 0, 100_000, 0)),
      weight: Math.round(clampNumber(item.weight, 1, 10_000, 1))
    }];
  });
}

function sanitizeSettings(input = {}) {
  const minimumTopup = clampNumber(input.sbpMinimumSilarum, 0.01, 1_000_000, 10);
  const maximumTopup = clampNumber(input.sbpMaximumSilarum, minimumTopup, 1_000_000, Math.max(1000, minimumTopup));
  const starsEnabled = input.starsEnabled === undefined
    ? input.paymentMethods?.stars?.enabled !== false
    : input.starsEnabled === true;
  const starsPerSilarum = clampNumber(
    input.starsPerSilarum ?? input.paymentRates?.starsPerSilarum,
    0.01,
    1_000_000,
    50
  );
  return {
    paymentsEnabled: input.paymentsEnabled !== false,
    everythingFree: input.everythingFree === true,
    starsEnabled,
    starsPerSilarum,
    paymentMethods: {
      stars: { enabled: starsEnabled, miniApp: true },
      ton: { enabled: input.paymentMethods?.ton?.enabled === true, miniApp: false },
      usdt: { enabled: input.paymentMethods?.usdt?.enabled === true, miniApp: false },
      sbp: { enabled: input.sbpTopupsEnabled === true, miniApp: false }
    },
    paymentRates: {
      starsPerSilarum,
      tonPerSilarum: clampNumber(input.paymentRates?.tonPerSilarum, 0, 1_000_000, 0),
      usdtPerSilarum: clampNumber(input.paymentRates?.usdtPerSilarum, 0, 1_000_000, 0)
    },
    sbpTopupsEnabled: Boolean(input.sbpTopupsEnabled),
    sbpAutomationEnabled: input.sbpAutomationEnabled !== false,
    sbpMinimumSilarum: minimumTopup,
    sbpMaximumSilarum: maximumTopup,
    sbpRoublesPerSilarum: clampNumber(input.sbpRoublesPerSilarum, 0, 1_000_000, 100),
    sbpRecipientName: cleanText(input.sbpRecipientName, 160),
    sbpBankName: cleanText(input.sbpBankName, 120),
    sbpPhone: cleanText(input.sbpPhone, 40).replace(/[^+\d()\s-]/g, ''),
    sbpPaymentUrl: cleanHttpsUrl(input.sbpPaymentUrl),
    sbpQrImageUrl: cleanHttpsUrl(input.sbpQrImageUrl),
    sbpInstructions: cleanText(input.sbpInstructions, 700) || DEFAULT_SETTINGS.sbpInstructions,
    withdrawalFee: clampNumber(input.withdrawalFee, 0, 100, 25),
    minimumWithdrawal: clampNumber(input.minimumWithdrawal, 0, 1_000_000, 25),
    withdrawalsEnabled: Boolean(input.withdrawalsEnabled),
    wheelEnabled: Boolean(input.wheelEnabled),
    wheelPrizeShare: clampNumber(input.wheelPrizeShare, 0, 100, 50),
    wheelMaxPrize: clampNumber(input.wheelMaxPrize, 1, 1_000_000, 1000),
    wheelDailySpins: Math.round(clampNumber(input.wheelDailySpins, 1, 10, 1)),
    wheelRewards: sanitizeWheelRewards(input.wheelRewards),
    serviceCatalog: sanitizeServiceCatalog(input.serviceCatalog),
    dialogueCatalog: sanitizeDialogueCatalog(input.dialogueCatalog),
    tarotCatalog: sanitizeTarotCatalog(input.tarotCatalog),
    compatibilityCatalog: sanitizeCompatibilityCatalog(input.compatibilityCatalog),
    dailyHoroscopeEnabled: input.dailyHoroscopeEnabled !== false,
    subscriptionGateEnabled: input.subscriptionGateEnabled === true && Boolean(cleanTelegramChannel(input.subscriptionChannelUsername)),
    subscriptionChannelUsername: cleanTelegramChannel(input.subscriptionChannelUsername),
    subscriptionChannelTitle: cleanText(input.subscriptionChannelTitle, 80) || 'Канал Эзотериума',
    dailyFreeServiceIds: ['tarot', 'tarot_relationship', 'palm_reading', 'natal', 'rune_reading'],
    tonTreasuryAddress: cleanTonAddress(input.tonTreasuryAddress) || DEFAULT_SETTINGS.tonTreasuryAddress,
    referralsEnabled: Boolean(input.referralsEnabled),
    firstReferralRate: clampNumber(input.firstReferralRate, 0, 100, 50),
    repeatReferralRate: clampNumber(input.repeatReferralRate, 0, 100, 13),
    palmLinkEnabled: Boolean(input.palmLinkEnabled),
    jointReadingsEnabled: Boolean(input.jointReadingsEnabled),
    partnerPaymentEnabled: Boolean(input.partnerPaymentEnabled),
    manualPhotoReview: Boolean(input.manualPhotoReview),
    adultOnly: Boolean(input.adultOnly)
  };
}

function hasPermission(profile, permission) {
  if (!profile?.is_active) return false;
  if (profile.role === 'owner') return true;
  return profile.permissions?.[permission] === true;
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

async function directSupabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`supabase_${response.status}`);
  return response;
}

async function edgeStore(botToken, action, payload = {}) {
  if (!botToken) throw new Error('admin_bot_token_missing');
  const response = await fetch(ADMIN_STORE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Bot-Token': botToken
    },
    body: JSON.stringify({ ...payload, action }),
    signal: AbortSignal.timeout(12_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || `admin_store_${response.status}`);
  return data;
}

async function readSettings(botToken) {
  const direct = await directSupabaseRequest('nastardamus_settings?key=eq.global&select=settings&limit=1');
  if (direct) {
    const rows = await direct.json();
    return { settings: sanitizeSettings(rows?.[0]?.settings || DEFAULT_SETTINGS), persisted: true };
  }
  const data = await edgeStore(botToken, 'read_settings');
  return { settings: sanitizeSettings(data.settings || DEFAULT_SETTINGS), persisted: true };
}

async function writeSettings(settings, botToken) {
  const currentResponse = await directSupabaseRequest('nastardamus_settings?key=eq.global&select=settings&limit=1');
  if (currentResponse) {
    const rows = await currentResponse.json();
    const merged = { ...(rows?.[0]?.settings || {}), ...settings };
    await directSupabaseRequest('nastardamus_settings?key=eq.global', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ settings: merged, updated_at: new Date().toISOString() })
    });
    return true;
  }
  await edgeStore(botToken, 'write_settings', { settings });
  return true;
}

async function readPayments(botToken) {
  const direct = await directSupabaseRequest(
    'nastardamus_sbp_topups?select=id,telegram_id,silarum_units,ruble_kopecks,payment_reference,status,provider_type,provider_payment_id,provider_status,verification_state,reviewed_by,review_note,created_at,updated_at,paid_at,expires_at&order=created_at.desc&limit=100'
  );
  if (direct) return await direct.json();
  return (await edgeStore(botToken, 'list_sbp_topups')).orders || [];
}

async function readServicePopularity(botToken, days = 30) {
  const safeDays = Math.max(1, Math.min(365, Math.round(Number(days || 30))));
  const direct = await directSupabaseRequest('rpc/nastardamus_service_popularity', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_days: safeDays })
  });
  if (direct) return await direct.json();
  return (await edgeStore(botToken, 'service_popularity', { days: safeDays })).services || [];
}

async function readPaymentProvider(botToken) {
  return (await edgeStore(botToken, 'read_payment_provider')).provider;
}

async function writePaymentProvider(provider, adminId, botToken) {
  return (await edgeStore(botToken, 'write_payment_provider', {
    provider: {
      merchantId: cleanText(provider?.merchantId, 40),
      secret: cleanText(provider?.secret, 300),
      enabled: provider?.enabled === true,
      updatedBy: adminId
    }
  })).provider;
}

async function creditAdminSelf({ adminId, amountUnits, idempotencyKey, note }, botToken) {
  const direct = await directSupabaseRequest('rpc/nastardamus_credit_admin_self', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      p_admin_id: adminId,
      p_amount_units: amountUnits,
      p_idempotency_key: idempotencyKey,
      p_note: note
    })
  });
  if (direct) return await direct.json();
  return (await edgeStore(botToken, 'credit_admin_self', {
    adminId,
    amountUnits,
    idempotencyKey,
    note
  })).credit;
}

async function resolveWalletTarget(target, botToken) {
  const normalized = cleanText(target, 80).replace(/^@/, '');
  if (/^\d{1,20}$/.test(normalized)) {
    const telegramId = Number(normalized);
    if (Number.isSafeInteger(telegramId) && telegramId > 0) {
      return { telegramId, username: null, firstName: null };
    }
  }
  if (!/^[A-Za-z0-9_]{3,64}$/.test(normalized)) return null;
  const direct = await directSupabaseRequest(
    `nastardamus_users?username=ilike.${encodeURIComponent(normalized)}`
      + '&select=telegram_id,username,first_name&limit=1'
  );
  if (direct) {
    const row = (await direct.json())?.[0];
    return row ? {
      telegramId: Number(row.telegram_id),
      username: row.username || null,
      firstName: row.first_name || null
    } : null;
  }
  return (await edgeStore(botToken, 'resolve_wallet_target', { target: normalized })).user || null;
}

async function adjustUserWallet({ adminId, telegramId, amountUnits, idempotencyKey, note }, botToken) {
  const direct = await directSupabaseRequest('rpc/nastardamus_admin_adjust_wallet', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      p_admin_id: adminId,
      p_telegram_id: telegramId,
      p_amount_units: amountUnits,
      p_idempotency_key: idempotencyKey,
      p_note: note
    })
  });
  if (direct) return await direct.json();
  return (await edgeStore(botToken, 'adjust_user_wallet', {
    adminId,
    telegramId,
    amountUnits,
    idempotencyKey,
    note
  })).adjustment;
}

async function reviewPayment({ orderId, decision, adminId, note }, botToken) {
  const direct = await directSupabaseRequest('rpc/nastardamus_review_sbp_topup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({
      p_order_id: orderId,
      p_decision: decision,
      p_admin_id: adminId,
      p_note: note
    })
  });
  if (direct) return await direct.json();
  return (await edgeStore(botToken, 'review_sbp_topup', {
    orderId,
    decision,
    adminId,
    note
  })).order;
}

async function getAdminProfile(userId, botToken, telegramUser) {
  if (parseAdminIds(process.env.ADMIN_TELEGRAM_IDS).has(userId)) {
    return {
      telegram_id: userId,
      role: 'owner',
      display_name: telegramUser?.first_name || null,
      username: telegramUser?.username || null,
      permissions: { '*': true },
      is_active: true
    };
  }

  const direct = await directSupabaseRequest(
    `nastardamus_admins?telegram_id=eq.${encodeURIComponent(userId)}&select=telegram_id,role,display_name,username,permissions,is_active&limit=1`
  );
  if (direct) {
    const rows = await direct.json();
    return rows?.[0] || null;
  }
  return (await edgeStore(botToken, 'get_admin_profile', { telegramId: userId })).profile || null;
}

async function writeAudit(userId, action, payload, botToken) {
  const direct = await directSupabaseRequest('nastardamus_admin_audit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ telegram_id: userId, action, payload })
  });
  if (direct) return true;
  await edgeStore(botToken, 'write_audit', {
    telegramId: userId,
    auditAction: action,
    payload
  });
  return true;
}

async function checkPersistence(botToken) {
  if (getSupabaseConfig()) return true;
  try {
    await edgeStore(botToken, 'read_settings');
    return true;
  } catch {
    return false;
  }
}

async function readControlProfile(userId, botToken, telegramUser) {
  return readAdminProfile({ userId, botToken, telegramUser });
}

function enhanceControlFile(control, source) {
  let body = source;
  if (control === 'page') {
    const dialogueRows = Object.entries(DEFAULT_DIALOGUE_CATALOG).map(([id, item]) => (
      `<article class="service-price-row" data-dialogue="${id}"><div><strong>${item.title}</strong>`
        + '<label class="switch-row"><span><small>Диалог включён</small></span><input data-dialogue-enabled type="checkbox" checked></label>'
        + '<label class="switch-row"><span><small>Вход в чат бесплатный</small></span><input data-dialogue-free type="checkbox" checked></label></div>'
        + `<div class="two-cols"><label>Включено вопросов<input data-dialogue-limit type="number" min="0" max="1000" step="1" value="${item.includedQuestions}"></label>`
        + `<label>Цена следующего, S<input data-dialogue-price type="number" min="0.10" max="1000000" step="0.01" value="${item.extraQuestionPrice.toFixed(2)}"></label></div></article>`
    )).join('');
    body = body.replace(
      '<label class="switch-row"><span><strong>Платные услуги включены</strong><small>Полный ответ выдаётся после списания цены услуги</small></span><input name="paymentsEnabled" type="checkbox" checked></label>',
      '<label class="switch-row"><span><strong>Платные услуги включены</strong><small>Полный ответ выдаётся после списания цены услуги</small></span><input name="paymentsEnabled" type="checkbox" checked></label>\n'
        + '<label class="switch-row"><span><strong>Всё бесплатно</strong><small>Глобальный режим: ответы выдаются без списания SILARUM, включая совместные чтения</small></span><input name="everythingFree" type="checkbox"></label>\n'
        + '<label class="switch-row"><span><strong>Telegram Stars</strong><small>Безопасное пополнение SILARUM встроенным счётом Telegram</small></span><input name="starsEnabled" type="checkbox" checked></label>\n'
        + '<label>Telegram Stars за 1 SILARUM<input name="starsPerSilarum" type="number" min="0.01" max="1000000" step="1" value="50"></label>'
    );
    body = body.replace(
      '<label class="switch-row"><span><strong>Ежедневный гороскоп</strong><small>Рассылка только пользователям, которые включили её в профиле</small></span><input name="dailyHoroscopeEnabled" type="checkbox" checked></label>',
      '<label class="switch-row"><span><strong>Ежедневный гороскоп</strong><small>Рассылка только пользователям, которые включили её в профиле</small></span><input name="dailyHoroscopeEnabled" type="checkbox" checked></label>\n'
        + '<label class="switch-row"><span><strong>Проверять подписку на канал</strong><small>Бот должен быть администратором канала; проверка защищает гороскоп, Колесо и бесплатный выбор дня</small></span><input name="subscriptionGateEnabled" type="checkbox"></label>\n'
        + '<div class="two-cols"><label>Канал, @username<input name="subscriptionChannelUsername" maxlength="80" placeholder="@your_channel"></label><label>Название канала<input name="subscriptionChannelTitle" maxlength="80" value="Канал Эзотериума"></label></div>\n'
        + '<label>TON-кошелёк проекта<input name="tonTreasuryAddress" maxlength="100" value="UQAVyNXcWPUm-24n7JMqIIjMjYN1bVMPXbNww29NNh-l1CyO"></label>\n'
        + '<p class="panel-copy">TON Connect используется для привязки кошелька к профилю. SILARUM внутри Telegram продаются только через Stars.</p>'
    );
    body = body.replace(
      '<button type="button" data-tab="payments">Платежи</button>',
      '<button type="button" data-tab="payments">Платежи</button>\n        <button type="button" data-tab="dialogues">Живые диалоги</button>\n        <button type="button" data-tab="popularity">Популярные сервисы</button>'
    );
    body = body.replace(
      '<section class="tab-panel" data-panel="payments" hidden>',
      '<section class="tab-panel" data-panel="dialogues" hidden>\n'
        + '        <section class="card panel"><div class="panel-head"><div><p class="eyebrow">Квоты сообщений</p><h2>Живые диалоги Эзотериума</h2></div><span class="badge violet">SILARUM</span></div>\n'
        + '          <p class="panel-copy">Ответы Эзотериума не расходуют лимит. Считаются только вопросы пользователя, на которые получен ответ. После лимита каждый новый вопрос оплачивается по указанной цене.</p>\n'
        + `          <div id="dialogue-policy-list" class="service-price-list">${dialogueRows}</div>\n`
        + '        </section>\n'
        + '      </section>\n\n      <section class="tab-panel" data-panel="popularity" hidden>\n'
        + '        <section class="card panel"><div class="panel-head"><div><p class="eyebrow">Использование</p><h2>Популярные сервисы</h2></div><span class="badge violet">30 дней</span></div>\n'
        + '          <p class="panel-copy">Считаются реальные старты, завершения, ошибки, бесплатные и платные использования. Уникальные пользователи не суммируются дважды.</p>\n'
        + '          <div id="popularity-list" class="service-price-list"><p class="empty-state">Загружаем статистику…</p></div>\n'
        + '        </section>\n'
        + '      </section>\n\n      <section class="tab-panel" data-panel="payments" hidden>'
    );
    const queueMarker = '<section class="card panel">\n          <div class="panel-head"><div><p class="eyebrow">Очередь</p><h2>Последние заявки</h2></div>';
    body = body.replace(
      queueMarker,
      '<form id="wallet-adjust-form" class="card panel">\n'
        + '          <div class="panel-head"><div><p class="eyebrow">Баланс пользователя</p><h2>Начислить или списать SILARUM</h2></div><span class="badge rose">Финансовый журнал</span></div>\n'
        + '          <p class="panel-copy">Найдите пользователя по Telegram ID или @username. Положительная сумма начисляет, отрицательная списывает; повтор с тем же ключом не дублируется.</p>\n'
        + '          <div class="two-cols">\n'
        + '            <label>Telegram ID или @username<input name="target" maxlength="80" required placeholder="7018304698 или @username"></label>\n'
        + '            <label>Изменение, SILARUM<input name="amount" type="number" min="-1000000" max="1000000" step="0.01" required placeholder="100 или -25"></label>\n'
        + '          </div>\n'
        + '          <label>Причина<input name="note" maxlength="300" required placeholder="Причина корректировки для аудита"></label>\n'
        + '          <div class="form-actions"><button type="submit">Применить изменение</button></div>\n'
        + '        </form>\n        '
        + queueMarker
    );
  }
  if (control === 'js') {
    body = body.replace(
      "  const rewards = new Map((settings.wheelRewards || []).map((reward) => [reward.id, reward]));",
      `  document.querySelectorAll('[data-dialogue]').forEach((row) => {
    const policy = settings.dialogueCatalog?.[row.dataset.dialogue] || {};
    row.querySelector('[data-dialogue-enabled]').checked = policy.enabled !== false;
    row.querySelector('[data-dialogue-free]').checked = policy.sectionFree !== false;
    row.querySelector('[data-dialogue-limit]').value = Number(policy.includedQuestions ?? (row.dataset.dialogue === 'group' ? 5 : 3));
    row.querySelector('[data-dialogue-price]').value = Number(policy.extraQuestionPrice ?? 0.1).toFixed(2);
  });
  const rewards = new Map((settings.wheelRewards || []).map((reward) => [reward.id, reward]));`
    );
    body = body.replace(
      'function collectWheelRewards() {',
      `function collectDialogueCatalog() {
  return Object.fromEntries([...document.querySelectorAll('[data-dialogue]')].map((row) => [row.dataset.dialogue, {
    enabled: row.querySelector('[data-dialogue-enabled]').checked,
    sectionFree: row.querySelector('[data-dialogue-free]').checked,
    includedQuestions: Number(row.querySelector('[data-dialogue-limit]').value),
    extraQuestionPrice: Number(row.querySelector('[data-dialogue-price]').value)
  }]));
}

function collectWheelRewards() {`
    );
    body = body.replace(
      '  values.serviceCatalog = collectServiceCatalog();\n  values.wheelRewards = collectWheelRewards();',
      '  values.serviceCatalog = collectServiceCatalog();\n  values.dialogueCatalog = collectDialogueCatalog();\n  values.wheelRewards = collectWheelRewards();'
    );
    body = body.replace(
      '  payments: null,\n  team: null,',
      '  payments: null,\n  popularity: null,\n  team: null,'
    );
    body = body.replace(
      'async function loadTeam() {',
      `function renderPopularity() {
  const list = document.getElementById('popularity-list');
  if (!list) return;
  const rows = state.popularity?.services || [];
  if (!rows.length) {
    list.innerHTML = '<p class="empty-state">Данных пока нет — статистика появится после первых завершённых практик.</p>';
    return;
  }
  list.innerHTML = rows.map((row, index) => {
    const title = state.overview?.settings?.serviceCatalog?.[row.service_id]?.title || row.service_id;
    const started = Number(row.started || 0);
    const completed = Number(row.completed || 0);
    const conversion = started ? Math.round(completed / started * 100) : 0;
    return '<article class="service-price-row"><div><small>#' + (index + 1) + ' · ' + escapeHtml(row.service_id) + '</small><strong>' + escapeHtml(title) + '</strong><p>' + Number(row.unique_users || 0) + ' пользователей · ' + conversion + '% завершено</p></div><div><strong>' + completed + ' завершений</strong><small>' + Number(row.free_used || 0) + ' бесплатно · ' + Number(row.paid_used || 0) + ' платно · ' + Number(row.failed || 0) + ' ошибок</small></div></article>';
  }).join('');
}

async function loadPopularity() {
  try {
    state.popularity = await api('/api/admin?popularity=1&days=30');
    renderPopularity();
  } catch {
    const list = document.getElementById('popularity-list');
    if (list) list.innerHTML = '<p class="empty-state">Не удалось загрузить статистику.</p>';
  }
}

const walletAdjustForm = document.getElementById('wallet-adjust-form');
walletAdjustForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const amount = Number(walletAdjustForm.elements.amount.value);
  const target = walletAdjustForm.elements.target.value.trim();
  const operation = amount > 0 ? 'Начислить' : 'Списать';
  if (!amount || !target) return notify('Укажите пользователя и ненулевую сумму');
  if (!window.confirm(operation + ' ' + formatPaymentMoney(Math.abs(amount)) + ' SILARUM для ' + target + '?')) return;
  const button = walletAdjustForm.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    const result = await api('/api/admin', 'POST', {
      paymentAction: 'adjust_user_wallet',
      target,
      amount,
      note: walletAdjustForm.elements.note.value,
      idempotencyKey: createActionKey('admin-adjust')
    });
    const user = result.user || {};
    const label = user.username ? '@' + user.username : String(user.telegramId || target);
    notify('Баланс ' + label + ' изменён на ' + formatPaymentMoney(amount) + ' SILARUM');
    walletAdjustForm.reset();
  } catch (error) {
    const code = error.data?.error;
    notify(code === 'wallet_user_not_found' ? 'Пользователь не найден' : code === 'insufficient_funds' ? 'Нельзя списать заблокированные средства' : 'Не удалось изменить баланс');
  } finally {
    button.disabled = false;
  }
});

async function loadTeam() {`
    );
    body = body.replace(
      'await Promise.all([loadPayments(), loadTeam(), loadAi()]);',
      'await Promise.all([loadPayments(), loadPopularity(), loadTeam(), loadAi()]);'
    );
  }
  return body;
}

async function handleControlRequest(req, res, botToken) {
  const control = String(req.query?.control || '');

  if (control === 'session') {
    if (req.method !== 'POST') return sendControl(res, 404);
    const validation = validateTelegramInitData(
      getRequestHeader(req, 'x-telegram-init-data'),
      botToken,
      { maxAgeSeconds: 60 * 60 * 12 }
    );
    if (!validation.ok) {
      res.setHeader('Set-Cookie', clearAdminSessionCookie());
      return sendControl(res, 404);
    }

    try {
      const profile = await readControlProfile(
        validation.user.id,
        botToken,
        validation.user
      );
      if (!hasAdminPanelAccess(profile)) {
        res.setHeader('Set-Cookie', clearAdminSessionCookie());
        return sendControl(res, 404);
      }
      res.setHeader(
        'Set-Cookie',
        adminSessionCookie(createAdminSessionToken(validation.user.id))
      );
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      console.error('Control session failed:', error);
      res.setHeader('Set-Cookie', clearAdminSessionCookie());
      return sendControl(res, 404);
    }
  }

  if (req.method !== 'GET' || !['page', 'css', 'js'].includes(control)) {
    return sendControl(res, 404);
  }

  const session = readAdminSession(req);
  if (session.ok) {
    try {
      const profile = await readControlProfile(session.userId, botToken);
      if (hasAdminPanelAccess(profile)) {
        const file = CONTROL_FILES[control];
        const body = enhanceControlFile(control, file.body);
        return sendControl(res, 200, body, file.contentType);
      }
    } catch (error) {
      console.error('Protected control resource failed:', error);
    }
    res.setHeader('Set-Cookie', clearAdminSessionCookie());
  }

  if (control === 'page') {
    return sendControl(res, 200, CONTROL_ENTRY_HTML, 'text/html; charset=utf-8');
  }
  return sendControl(res, 404);
}

export default async function handler(req, res) {
  const botToken = process.env.ADMIN_BOT_TOKEN || process.env.BOT_TOKEN;
  if (req.query?.control) {
    return handleControlRequest(req, res, botToken);
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  if (req.method === 'GET' && req.query?.health === '1') {
    return sendJson(res, 200, {
      ok: true,
      services: {
        adminBot: Boolean(botToken),
        telegramSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET),
        readings: Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
        webAppUrl: Boolean(process.env.WEB_APP_URL),
        persistence: await checkPersistence(botToken)
      }
    });
  }

  const initData = getRequestHeader(req, 'x-telegram-init-data');
  const validation = validateTelegramInitData(initData, botToken, { maxAgeSeconds: 60 * 60 * 12 });
  if (!validation.ok) {
    return sendJson(res, 401, {
      error: 'telegram_auth_required',
      reason: validation.reason
    });
  }

  const userId = Number(validation.user.id);
  const profile = await getAdminProfile(userId, botToken, validation.user);
  if (!hasAdminPanelAccess(profile)) {
    console.info('Nastardamus admin access requested', {
      telegramId: userId,
      username: validation.user.username || null,
      firstName: validation.user.first_name || null
    });
    return sendJson(res, 403, {
      error: 'admin_access_denied',
      userId,
      registrationRequired: true
    });
  }

  try {
    if (req.method === 'GET') {
      if (req.query?.popularity === '1') {
        if (!hasPermission(profile, 'settings.manage') && !hasPermission(profile, 'finance.view')) {
          return sendJson(res, 403, { error: 'permission_denied' });
        }
        const days = Math.max(1, Math.min(365, Number(req.query?.days || 30)));
        return sendJson(res, 200, { ok: true, days, services: await readServicePopularity(botToken, days) });
      }
      if (req.query?.payments === '1') {
        if (!hasPermission(profile, 'finance.view') && !hasPermission(profile, 'finance.manage')) {
          return sendJson(res, 403, { error: 'permission_denied' });
        }
        return sendJson(res, 200, {
          ok: true,
          canManage: hasPermission(profile, 'finance.manage'),
          orders: await readPayments(botToken),
          provider: await readPaymentProvider(botToken)
        });
      }
      const current = await readSettings(botToken);
      await Promise.all([
        writeAudit(userId, 'admin_opened', { role: profile.role }, botToken),
        edgeStore(botToken, 'touch_admin', { telegramId: userId }).catch(() => null)
      ]);
      return sendJson(res, 200, {
        ok: true,
        user: validation.user,
        role: profile.role,
        permissions: profile.permissions || {},
        accessConfigured: true,
        persistenceConfigured: current.persisted,
        canManageSettings: hasPermission(profile, 'settings.manage'),
        services: {
          bot: Boolean(botToken),
          readings: Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY),
          webAppUrl: Boolean(process.env.WEB_APP_URL)
        },
        settings: current.settings
      });
    }

    if (req.body?.paymentAction === 'review_sbp_topup') {
      if (!hasPermission(profile, 'finance.manage')) {
        return sendJson(res, 403, { error: 'permission_denied' });
      }
      const orderId = String(req.body?.orderId || '');
      const decision = String(req.body?.decision || '');
      const note = cleanText(req.body?.note, 500);
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId)) {
        return sendJson(res, 400, { error: 'invalid_order_id' });
      }
      if (!['paid', 'rejected'].includes(decision)) {
        return sendJson(res, 400, { error: 'invalid_topup_decision' });
      }
      const order = await reviewPayment({ orderId, decision, adminId: userId, note }, botToken);
      await writeAudit(userId, 'sbp_topup_reviewed', { orderId, decision, note }, botToken);
      return sendJson(res, 200, { ok: true, order });
    }

    if (req.body?.paymentAction === 'save_sbp_provider') {
      if (!hasPermission(profile, 'finance.manage')) {
        return sendJson(res, 403, { error: 'permission_denied' });
      }
      const provider = await writePaymentProvider(req.body?.provider, userId, botToken);
      await writeAudit(userId, 'sbp_provider_updated', {
        enabled: provider?.enabled === true,
        merchantId: provider?.merchant_id || null,
        secretChanged: Boolean(req.body?.provider?.secret)
      }, botToken);
      return sendJson(res, 200, { ok: true, provider });
    }

    if (req.body?.paymentAction === 'credit_self') {
      if (!hasPermission(profile, 'finance.manage')) {
        return sendJson(res, 403, { error: 'permission_denied' });
      }
      const amount = Number(req.body?.amount);
      const amountUnits = Math.round(amount * 100);
      const idempotencyKey = cleanText(req.body?.idempotencyKey, 128);
      const note = cleanText(req.body?.note, 300);
      if (
        !Number.isFinite(amount)
        || amount <= 0
        || amount > 1_000_000
        || !Number.isSafeInteger(amountUnits)
        || amountUnits <= 0
        || Math.abs(amount * 100 - amountUnits) > 1e-7
      ) {
        return sendJson(res, 400, { error: 'invalid_amount' });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return sendJson(res, 400, { error: 'invalid_idempotency_key' });
      }
      const credit = await creditAdminSelf({ adminId: userId, amountUnits, idempotencyKey, note }, botToken);
      await writeAudit(userId, 'admin_self_credited', { amountUnits, note }, botToken);
      return sendJson(res, 200, { ok: true, credit });
    }

    if (req.body?.paymentAction === 'adjust_user_wallet') {
      if (!hasPermission(profile, 'finance.manage')) {
        return sendJson(res, 403, { error: 'permission_denied' });
      }
      const amount = Number(req.body?.amount);
      const amountUnits = Math.round(amount * 100);
      const idempotencyKey = cleanText(req.body?.idempotencyKey, 128);
      const note = cleanText(req.body?.note, 300);
      if (
        !Number.isFinite(amount)
        || amount === 0
        || Math.abs(amount) > 1_000_000
        || !Number.isSafeInteger(amountUnits)
        || amountUnits === 0
        || Math.abs(amount * 100 - amountUnits) > 1e-7
      ) {
        return sendJson(res, 400, { error: 'invalid_amount' });
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/.test(idempotencyKey)) {
        return sendJson(res, 400, { error: 'invalid_idempotency_key' });
      }
      const user = await resolveWalletTarget(req.body?.target, botToken);
      if (!user?.telegramId) return sendJson(res, 404, { error: 'wallet_user_not_found' });
      const adjustment = await adjustUserWallet({
        adminId: userId,
        telegramId: user.telegramId,
        amountUnits,
        idempotencyKey,
        note
      }, botToken);
      await writeAudit(userId, 'user_wallet_adjusted', {
        targetTelegramId: user.telegramId,
        amountUnits,
        note,
        idempotentReplay: adjustment?.idempotent_replay === true
      }, botToken);
      return sendJson(res, 200, { ok: true, user, adjustment });
    }

    if (!hasPermission(profile, 'settings.manage')) {
      return sendJson(res, 403, { error: 'permission_denied' });
    }

    const settings = sanitizeSettings(req.body?.settings);
    const persisted = await writeSettings(settings, botToken);
    await writeAudit(userId, 'settings_updated', settings, botToken);
    return sendJson(res, 200, { ok: true, persisted, settings });
  } catch (error) {
    console.error('Admin API failed:', error);
    return sendJson(res, 502, { error: 'admin_backend_failed' });
  }
}
