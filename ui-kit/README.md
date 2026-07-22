# Nastardamus Modular UI Kit

Компонентная библиотека построена по присланному макету из четырёх экранов.

## Состав

- 54 отдельных ES-модуля интерфейса;
- 4 модульных экрана;
- 35 отдельных SVG-ассета;
- `preview.html` — визуальный каталог всех компонентов;
- динамические имена, даты, баланс, цены, проценты и состояния не встроены в изображения.

## Просмотр

Откройте каталог через локальный HTTP-сервер:

```bash
python -m http.server 8080
```

Затем откройте:

```text
http://localhost:8080/ui-kit/preview.html
```

## Подключение

```html
<link rel="stylesheet" href="/ui-kit/tokens.css">
<link rel="stylesheet" href="/ui-kit/components.css">
<script type="module">
  import { BalanceCard } from "/ui-kit/components/index.js";
  document.body.append(BalanceCard({ amount: 1250 }));
</script>
```

## Важно

Компоненты не содержат зашитых персональных данных. Карточки, кнопки, шкалы,
имена, баланс, стоимость, фотографии и результаты получают значения через параметры.
