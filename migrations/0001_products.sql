CREATE TABLE products (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  name_ro TEXT NOT NULL,
  name_en TEXT NOT NULL,
  tag_ro TEXT NOT NULL,
  tag_en TEXT NOT NULL,
  short_ro TEXT NOT NULL,
  short_en TEXT NOT NULL,
  description_ro TEXT NOT NULL,
  description_en TEXT NOT NULL,
  alt_ro TEXT NOT NULL,
  alt_en TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Animals', 'Seasonal')),
  price_min_ron INTEGER NOT NULL CHECK (price_min_ron >= 0),
  price_max_ron INTEGER NOT NULL CHECK (price_max_ron >= price_min_ron),
  image_key TEXT,
  image_url TEXT,
  credit_author TEXT NOT NULL DEFAULT '',
  credit_url TEXT NOT NULL DEFAULT '',
  credit_license TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (image_key IS NOT NULL OR image_url IS NOT NULL OR is_published = 0)
);

CREATE INDEX products_public_order ON products (is_published, sort_order, created_at);

INSERT INTO products (
  id, slug, name_ro, name_en, tag_ro, tag_en, short_ro, short_en, description_ro,
  description_en, alt_ro, alt_en, category, price_min_ron, price_max_ron, image_url,
  credit_author, credit_url, credit_license, is_published, sort_order
) VALUES
  ('00000000-0000-4000-8000-000000000001', 'bonnie-the-bunny', 'Bonnie, iepurașul', 'Bonnie the Bunny', 'Un mic drăgălaș', 'A little sweetheart', 'Urechi lungi. Mult drag.', 'Floppy ears. A very full heart.', 'Urechi lungi, o fundiță micuță și o rochiță delicată. Un dar inspirat de iepurași pentru persoana care aduce blândețe în viața ta.', 'Long floppy ears, a tiny bow, and a soft little dress. A bunny-inspired gift for the person who brings a little gentleness to your world.', 'Iepuraș croșetat cu urechi lungi, rochie roz pal și fundiță asortată', 'Crocheted bunny with floppy ears, a pale pink dress, and a matching bow', 'Animals', 75, 200, '/images/bunny-large.jpg', 'Creativa Atelier', 'https://commons.wikimedia.org/wiki/File:Conejita_Amigurumi.jpg', 'CC BY-SA 4.0', 0, 1),
  ('00000000-0000-4000-8000-000000000002', 'bramble-the-bear', 'Bramble, ursulețul', 'Bramble the Bear', 'Bucurie de buzunar', 'Pocketful of joy', 'O porție de bucurie pufoasă.', 'A bear-sized dose of happy.', 'Un ursuleț vesel, cu o floricică și multă personalitate. Imaginează-ți-l în culoarea preferată, cu un accesoriu care îl face să semene cu persoana dragă.', 'A cheerful bear with a flower and plenty of character. Reimagine this little friend in a favorite color, with a tiny accessory that makes it feel like them.', 'Ursuleț croșetat, decorat cu o floare colorată și un costumaș în dungi', 'A handmade crochet bear wearing a colorful flower and striped outfit', 'Animals', 75, 200, '/images/bear.jpg', 'Thesunandtheturtle', 'https://commons.wikimedia.org/wiki/File:Amigurumi-bear.jpg', 'CC BY-SA 4.0', 0, 2),
  ('00000000-0000-4000-8000-000000000003', 'fern-the-fox', 'Fern, vulpița', 'Fern the Fox', 'O poveste din pădure', 'Woodland daydream', 'Puțin poznașă. Foarte drăgălașă.', 'A little wild. A lot of lovely.', 'Urechi țuguiate, o privire curioasă și un strop de farmec de pădure. O vulpiță pentru visători, iubitori de natură și mici aventuri.', 'Pointy ears, a curious face, and a little woodland charm. A fox-inspired companion for daydreamers, nature lovers, and the person who is always up for a tiny adventure.', 'Vulpiță croșetată portocalie, cu piept alb și bot lung', 'Orange crochet fox with a white chest and a long pointed nose', 'Animals', 75, 200, '/images/fox.jpg', 'Vanessa25120', 'https://commons.wikimedia.org/wiki/File:Renard_amigurumi.jpg', 'CC BY-SA 4.0', 0, 3),
  ('00000000-0000-4000-8000-000000000004', 'clover-the-cat', 'Clover, pisicuța', 'Clover the Cat', 'Mieunat de drag', 'Purr-sonal favorite', 'Pentru iubitorii de pisici.', 'For your favorite cat person.', 'Mustăți micuțe și multă personalitate. O pisicuță care poate prelua culorile unui companion iubit sau orice nuanță aduce cuiva drag un zâmbet.', 'Tiny whiskers and a whole lot of personality. A cat-inspired keepsake that can take on the colors of a beloved pet, or simply the colors that make someone smile.', 'Colecție de pisicuțe croșetate în nuanțe pastelate de roz, mov, mentă și piersică', 'A collection of small crocheted cats in soft pink, lavender, mint, and peach', 'Animals', 75, 200, '/images/cat.jpg', 'Rachel1', 'https://commons.wikimedia.org/wiki/File:Amigurumi_Kitty.jpg', 'CC BY-SA 4.0', 0, 4),
  ('00000000-0000-4000-8000-000000000005', 'pumpkin', 'Dovlecel', 'Pumpkin', 'Bucurie de toamnă', 'Autumn little love', 'Un strop pufos de toamnă.', 'A softer side of sweater weather.', 'Un dovlecel rotofei pentru zile răcoroase și colțuri primitoare. Această ilustrație originală imaginează un dovleac croșetat, cu codiță spiralată și chip prietenos.', 'A plump little pumpkin for crisp-day gifting and cozy corners. This original concept illustration imagines a textured crochet pumpkin with a curly stem and a friendly face.', 'Ilustrație concept originală cu un dovleac croșetat, textură moale, codiță spiralată și chip prietenos', 'Original concept illustration of a softly textured crochet pumpkin with a curly stem', 'Seasonal', 75, 200, '/images/pumpkin.svg', '', '', '', 0, 5),
  ('00000000-0000-4000-8000-000000000006', 'pip-the-penguin', 'Pip, pinguinul', 'Pip the Penguin', 'O mică minune de iarnă', 'Winter little wonder', 'Un prieten mic. O bucurie caldă.', 'Small friend. Warmest wishes.', 'Un pinguin rotunjor, cu cioc viu colorat și o personalitate pe măsură. Un dar inspirat de iarnă, de imaginat în mărimea și stilul potrivite.', 'A round little penguin with a bright beak and an even brighter personality. A winter-inspired gift to reimagine in a size and style that feels just right.', 'Doi pinguini croșetați cu burtică albă și ciocuri galbene', 'Two small handmade crochet penguins with white bellies and yellow beaks', 'Seasonal', 75, 200, '/images/penguin.jpg', 'Enziee', 'https://commons.wikimedia.org/wiki/File:Penguin_amigurumi.jpg', 'CC BY-SA 4.0', 0, 6);
