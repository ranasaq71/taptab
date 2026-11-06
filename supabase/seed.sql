-- Demo restaurant for development and sales demos
insert into organizations (id, name, plan, status)
values ('5a5a0000-0000-4000-8000-000000000001', 'Saffron Street Kitchen', 'pro', 'trial');

insert into locations (id, org_id, name, slug, tagline, brand_color)
values ('5a5a0000-0000-4000-8000-000000000002', '5a5a0000-0000-4000-8000-000000000001',
        'Saffron Street Kitchen', 'saffron-street', 'Indo-Tex comfort food in Sugar Land', '#1F4D36');

update hub_settings set
  special = 'Brisket biryani is back. Half off mango lassi until 6 pm.',
  special_es = 'Volvió el biryani de brisket. Lassi de mango a mitad de precio hasta las 6 pm.',
  wifi_name = 'SaffronGuest', wifi_password = 'chai4everyone',
  google_review_url = 'https://search.google.com/local/writereview?placeid=REPLACE_ME',
  instagram_url = 'https://instagram.com/saffronstreethtx'
where location_id = '5a5a0000-0000-4000-8000-000000000002';

-- 16 tables in two server sections, each with its own tag (DEMO0001 ... DEMO0016)
insert into dining_tables (location_id, label, section, sort_order)
select '5a5a0000-0000-4000-8000-000000000002', g::text, case when g <= 8 then 'A' else 'B' end, g
from generate_series(1, 16) g;

insert into tags (code, location_id, table_id, status, encoded_at, locked)
select 'DEMO' || lpad(t.label, 4, '0'), t.location_id, t.id, 'assigned', now(), true
from dining_tables t where t.location_id = '5a5a0000-0000-4000-8000-000000000002';

-- Menu
with m as (select id from menus where location_id = '5a5a0000-0000-4000-8000-000000000002'),
c as (
  insert into menu_categories (menu_id, name, sort_order)
  select m.id, x.name::jsonb, x.ord from m, (values
    ('{"en":"Starters","es":"Entradas"}', 1),
    ('{"en":"Mains","es":"Platos fuertes"}', 2),
    ('{"en":"Drinks","es":"Bebidas"}', 3)) as x(name, ord)
  returning id, name->>'en' as cat
)
insert into menu_items (category_id, name, description, price_cents, tags, sort_order)
select c.id, i.name::jsonb, i.descr::jsonb, i.price, i.tags::text[], i.ord
from c join (values
  ('Starters','{"en":"Charred street corn","es":"Elote asado"}','{"en":"Masala butter, cotija, lime","es":"Mantequilla masala, cotija, limón"}',800,'{veg,gf}',1),
  ('Starters','{"en":"Chicken tikka sliders","es":"Mini hamburguesas de pollo tikka"}','{"en":"Mint chutney, pickled onion","es":"Chutney de menta, cebolla encurtida"}',1200,'{hot}',2),
  ('Starters','{"en":"Crispy cauliflower","es":"Coliflor crujiente"}','{"en":"Tamarind glaze, sesame","es":"Glaseado de tamarindo, ajonjolí"}',1000,'{veg,vegan}',3),
  ('Mains','{"en":"Smoked brisket biryani","es":"Biryani de brisket ahumado"}','{"en":"12-hour brisket, saffron rice, raita","es":"Brisket de 12 horas, arroz con azafrán, raita"}',1900,'{hot}',1),
  ('Mains','{"en":"Saffron butter chicken","es":"Pollo a la mantequilla con azafrán"}','{"en":"Tomato cream, garlic naan","es":"Crema de tomate, naan de ajo"}',1800,'{}',2),
  ('Mains','{"en":"Paneer tikka bowl","es":"Bowl de paneer tikka"}','{"en":"Charred paneer, greens, cilantro rice","es":"Paneer asado, verduras, arroz con cilantro"}',1600,'{veg,gf}',3),
  ('Mains','{"en":"Gulf shrimp tacos","es":"Tacos de camarón del Golfo"}','{"en":"Chili rub, mango slaw, three tacos","es":"Adobo de chile, ensalada de mango, tres tacos"}',1700,'{gf,hot}',4),
  ('Drinks','{"en":"Mango lassi","es":"Lassi de mango"}','{"en":"Yogurt, cardamom","es":"Yogur, cardamomo"}',600,'{veg,gf}',1),
  ('Drinks','{"en":"Cardamom cold brew","es":"Café frío con cardamomo"}','{"en":"Oat milk on request","es":"Leche de avena a petición"}',500,'{vegan,gf}',2),
  ('Drinks','{"en":"Hibiscus agua fresca","es":"Agua fresca de jamaica"}','{"en":"House-made, lightly sweet","es":"Hecha en casa, poco dulce"}',400,'{vegan,gf}',3)
) as i(cat, name, descr, price, tags, ord) on i.cat = c.cat;

insert into staff_contacts (location_id, name, phone_e164, sections) values
  ('5a5a0000-0000-4000-8000-000000000002', 'Maria (Section A)', '+15555550101', '{A}'),
  ('5a5a0000-0000-4000-8000-000000000002', 'James (Section B)', '+15555550102', '{B}');
