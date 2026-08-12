-- Add administrator-controlled message quotas for every user-facing section
-- and a dedicated paid sports analysis service. Existing administrator values
-- win over defaults so this migration never resets configured prices.
with defaults as (
  select
    jsonb_build_object(
      'sports_personal', jsonb_build_object(
        'id', 'sports_personal',
        'title', 'Персональный спортивный разбор',
        'enabled', true,
        'price', 10
      )
    ) as services,
    jsonb_build_object(
      'personal', jsonb_build_object('id','personal','title','Общие вопросы к чтению','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'tarot', jsonb_build_object('id','tarot','title','Таро','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'runes', jsonb_build_object('id','runes','title','Руны','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'palm', jsonb_build_object('id','palm','title','Хиромантия','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'natal', jsonb_build_object('id','natal','title','Натальная карта','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'horoscope', jsonb_build_object('id','horoscope','title','Гороскоп дня','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'sports', jsonb_build_object('id','sports','title','Спортивный аналитик','enabled',true,'sectionFree',true,'includedQuestions',2,'extraQuestionPrice',5),
      'path', jsonb_build_object('id','path','title','Мой путь','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'amur', jsonb_build_object('id','amur','title','Амур','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'compatibility', jsonb_build_object('id','compatibility','title','Совместимость','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'photo', jsonb_build_object('id','photo','title','Чтение по фотографии','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'solo', jsonb_build_object('id','solo','title','Личная комната','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'pair', jsonb_build_object('id','pair','title','Комната для двоих','enabled',true,'sectionFree',true,'includedQuestions',3,'extraQuestionPrice',0.1),
      'group', jsonb_build_object('id','group','title','Групповая комната','enabled',true,'sectionFree',true,'includedQuestions',5,'extraQuestionPrice',0.1)
    ) as dialogues
)
update public.nastardamus_settings as target
set settings = jsonb_set(
  jsonb_set(
    target.settings,
    '{serviceCatalog}',
    defaults.services || coalesce(target.settings->'serviceCatalog', '{}'::jsonb),
    true
  ),
  '{dialogueCatalog}',
  defaults.dialogues || coalesce(target.settings->'dialogueCatalog', '{}'::jsonb),
  true
),
updated_at = now()
from defaults
where target.key = 'global';
