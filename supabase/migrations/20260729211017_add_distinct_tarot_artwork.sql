update public.nastardamus_tarot_spreads
set
  artwork_key = 'tarot-' || id,
  updated_at = now()
where artwork_key = 'tarot-deck';

update public.nastardamus_compatibility_types
set
  artwork_key = case id
    when 'photo' then 'compatibility-photo-cover'
    when 'palm' then 'compatibility-palm-cover'
    when 'data' then 'compatibility-data-cover'
    else artwork_key
  end,
  updated_at = now()
where id in ('photo', 'palm', 'data');
