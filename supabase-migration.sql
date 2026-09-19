-- ============================================
-- Averroes Restaurant — Supabase Migration
-- Run this ONCE in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================

-- 1. Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT DEFAULT '',
  "order" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Meals
CREATE TABLE IF NOT EXISTS meals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  price NUMERIC NOT NULL DEFAULT 0,
  image TEXT DEFAULT '',
  available BOOLEAN DEFAULT TRUE,
  out_of_stock BOOLEAN DEFAULT FALSE,
  hidden BOOLEAN DEFAULT FALSE,
  description TEXT DEFAULT '',
  prep_time TEXT DEFAULT '',
  is_chef_special BOOLEAN DEFAULT FALSE,
  is_popular BOOLEAN DEFAULT FALSE,
  is_todays_special BOOLEAN DEFAULT FALSE,
  is_chef_recommendation BOOLEAN DEFAULT FALSE,
  meal_types JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 3. Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  order_number TEXT NOT NULL,
  month_key TEXT,
  location TEXT DEFAULT '',
  identifier TEXT DEFAULT '',
  method TEXT DEFAULT 'direct',
  items JSONB DEFAULT '[]',
  total NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- 4. Chats (conversations)
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  order_id TEXT,
  location TEXT DEFAULT '',
  identifier TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Chat Messages (extracted from nested arrays for Realtime support)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB,
  read_by JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Settings (single row)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  restaurant_name TEXT DEFAULT 'Averroes Restaurant',
  tagline TEXT DEFAULT 'Luxury Hotel Dining',
  address TEXT DEFAULT '',
  currency TEXT DEFAULT '₦',
  locale TEXT DEFAULT 'en-NG',
  logo_url TEXT DEFAULT ''
);

-- 7. Users (admin metadata — auth handled by Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'staff',
  display_name TEXT DEFAULT '',
  disabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 8. Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'General',
  amount NUMERIC DEFAULT 0,
  payment_method TEXT DEFAULT 'Cash',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 9. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  type TEXT DEFAULT 'OTHER',
  description TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  related_id TEXT,
  category TEXT DEFAULT '',
  payment_method TEXT DEFAULT '',
  status TEXT DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT,
  actor_id TEXT,
  order_id TEXT,
  order_number TEXT,
  result TEXT DEFAULT 'success',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Enable Row Level Security on ALL tables
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies — Initial (open for anon key)
-- These will be tightened in Phase 6
-- ============================================

-- Categories: public read, anon write (admin controls via app logic)
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (true);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (true);

-- Meals
CREATE POLICY "meals_select" ON meals FOR SELECT USING (true);
CREATE POLICY "meals_insert" ON meals FOR INSERT WITH CHECK (true);
CREATE POLICY "meals_update" ON meals FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "meals_delete" ON meals FOR DELETE USING (true);

-- Orders
CREATE POLICY "orders_select" ON orders FOR SELECT USING (true);
CREATE POLICY "orders_insert" ON orders FOR INSERT WITH CHECK (true);
CREATE POLICY "orders_update" ON orders FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "orders_delete" ON orders FOR DELETE USING (true);

-- Chats
CREATE POLICY "chats_select" ON chats FOR SELECT USING (true);
CREATE POLICY "chats_insert" ON chats FOR INSERT WITH CHECK (true);
CREATE POLICY "chats_update" ON chats FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "chats_delete" ON chats FOR DELETE USING (true);

-- Messages
CREATE POLICY "messages_select" ON messages FOR SELECT USING (true);
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "messages_update" ON messages FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "messages_delete" ON messages FOR DELETE USING (true);

-- Settings
CREATE POLICY "settings_select" ON settings FOR SELECT USING (true);
CREATE POLICY "settings_insert" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "settings_update" ON settings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "settings_delete" ON settings FOR DELETE USING (true);

-- Users (admin metadata)
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "users_delete" ON users FOR DELETE USING (true);

-- Expenses
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (true);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (true);

-- Transactions
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (true);

-- Audit Logs
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_logs_update" ON audit_logs FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "audit_logs_delete" ON audit_logs FOR DELETE USING (true);

-- ============================================
-- Enable Realtime for key tables
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE meals;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- ============================================
-- Seed: Default Settings
-- ============================================
INSERT INTO settings (id, restaurant_name, tagline, address, currency, locale, logo_url)
VALUES ('main', 'Averroes Restaurant', 'Luxury Hotel Dining', 'Averroes Hotel, Lagos, Nigeria', '₦', 'en-NG', '')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Seed: Categories
-- ============================================
INSERT INTO categories (id, title, subtitle, "order") VALUES
  ('nigerian-breakfast', 'Nigerian Breakfast', 'Start your day with authentic Nigerian breakfast selections.', 1),
  ('continental-breakfast', 'Continental Breakfast', 'Classic international breakfast prepared fresh every morning.', 2),
  ('nigerian-dishes', 'Nigerian Dishes', 'Hearty local favourites prepared with premium ingredients.', 3),
  ('continental-dishes', 'Continental Dishes', 'Elegant international plates from around the world.', 4),
  ('soup', 'Soup', 'Rich traditional soups made with the finest proteins and vegetables.', 5),
  ('pepper-soup', 'Pepper Soup', 'Spiced, aromatic pepper soups to warm the soul.', 6),
  ('protein', 'Protein', 'Grilled, fried and roasted premium protein selections.', 7),
  ('creaming-pasta', 'Creaming Pasta', 'Silky, creamy pasta creations finished to perfection.', 8),
  ('sauce', 'Sauce', 'Classic and signature sauces to complement every plate.', 9),
  ('fries', 'Fries', 'Golden, crispy sides and fries.', 10),
  ('snacks', 'Snacks', 'Light bites for any time of day.', 11),
  ('pasta', 'Pasta', 'Classic pasta dishes in rich, balanced sauces.', 12),
  ('salad', 'Salad', 'Fresh, crisp salads and healthy bowls.', 13),
  ('swallow', 'Swallow', 'Traditional Nigerian swallows served with love.', 14),
  ('special-coffee', 'Special Coffee', 'Artisan coffee, teas and espresso.', 15),
  ('drinks', 'Drinks', 'Chilled soft drinks, juices and refreshments.', 16),
  ('poolside-bar', 'Poolside Bar', 'Cocktails, beers and refreshing drinks served by the pool.', 17)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Seed: Meals (all 120+ dishes)
-- ============================================
INSERT INTO meals (id, name, category_id, price, image, available, out_of_stock, hidden) VALUES
  ('nigerian-breakfast-01','Custard + Akara or Moi Moi','nigerian-breakfast',4500,'/images/custard-akara-or-moi-moi.jpg',true,false,false),
  ('nigerian-breakfast-02','Pap + Akara or Moi Moi','nigerian-breakfast',4500,'/images/pap-akara-or-moi-moi.jpg',true,false,false),
  ('nigerian-breakfast-03','Plantain + Vegetable Sauce & Titus','nigerian-breakfast',5500,'/images/plantain-vegetable-sauce-titus.jpg',true,false,false),
  ('nigerian-breakfast-04','Plantain Porridge & Dry Fish','nigerian-breakfast',6000,'/images/plantain-porridge-dry-fish.jpg',true,false,false),
  ('nigerian-breakfast-05','Fried Plantain & Egg Sauce','nigerian-breakfast',4500,'/images/fried-plantain-egg-sauce.jpg',true,false,false),
  ('nigerian-breakfast-06','Quaker Oats + Bread & Milk','nigerian-breakfast',5200,'/images/quaker-oats-bread-milk.jpg',true,false,false),
  ('continental-breakfast-01','Onion Omelette','continental-breakfast',2200,'/images/onion-omelette.jpg',true,false,false),
  ('continental-breakfast-02','Vegetable Omelette','continental-breakfast',2200,'/images/vegetable-omelette.jpg',true,false,false),
  ('continental-breakfast-03','Sardine Omelette','continental-breakfast',2500,'/images/sardine-omelette.jpg',true,false,false),
  ('continental-breakfast-04','Fried Omelette','continental-breakfast',1600,'/images/fried-omelette.jpg',true,false,false),
  ('continental-breakfast-05','Scrambled Egg','continental-breakfast',2500,'/images/scrambled-egg.jpg',true,false,false),
  ('continental-breakfast-06','Boiled Egg','continental-breakfast',1500,'/images/boiled-egg.jpg',true,false,false),
  ('continental-breakfast-07','English Breakfast','continental-breakfast',7700,'images/english-breakfast.jpg',true,false,false),
  ('continental-breakfast-08','Big American Breakfast','continental-breakfast',8700,'images/big-american-breakfast.jpg',true,false,false),
  ('nigerian-dishes-01','Jollof Rice & Chicken','nigerian-dishes',8000,'images/jollof-rice-chicken.jpg',true,false,false),
  ('nigerian-dishes-02','Jollof Rice & Turkey','nigerian-dishes',10000,'images/jollof-rice-turkey.jpg',true,false,false),
  ('nigerian-dishes-03','Jollof Rice & Beef','nigerian-dishes',8000,'images/jollof-rice-beef.jpg',true,false,false),
  ('nigerian-dishes-04','Jollof Rice & Goat Meat','nigerian-dishes',8500,'images/jollof-rice-goat-meat.jpg',true,false,false),
  ('nigerian-dishes-05','Fried Rice & Chicken','nigerian-dishes',9000,'images/fried-rice-chicken.jpg',true,false,false),
  ('nigerian-dishes-06','Fried Rice & Turkey','nigerian-dishes',10000,'images/fried-rice-turkey.jpg',true,false,false),
  ('nigerian-dishes-07','Fried Rice & Beef','nigerian-dishes',8500,'images/fried-rice-beef.jpg',true,false,false),
  ('nigerian-dishes-08','Fried Rice & Goat Meat','nigerian-dishes',9000,'images/fried-rice-goat-meat.jpg',true,false,false),
  ('nigerian-dishes-09','White Rice & Chicken','nigerian-dishes',8500,'images/white-rice-chicken.jpg',true,false,false),
  ('nigerian-dishes-10','White Rice & Beef','nigerian-dishes',8000,'images/white-rice-beef.jpg',true,false,false),
  ('nigerian-dishes-11','White Rice & Turkey','nigerian-dishes',9500,'images/white-rice-turkey.jpg',true,false,false),
  ('nigerian-dishes-12','Party Jollof Rice & Chicken','nigerian-dishes',8500,'images/party-jollof-rice-chicken.jpg',true,false,false),
  ('nigerian-dishes-13','Party Jollof Rice & Turkey','nigerian-dishes',9500,'images/party-jollof-rice-turkey.jpg',true,false,false),
  ('continental-dishes-01','Chinese Rice & Chicken','continental-dishes',13000,'images/chinese-rice-chicken.jpg',true,false,false),
  ('continental-dishes-02','Chinese Rice & Turkey','continental-dishes',14700,'images/chinese-rice-turkey.jpg',true,false,false),
  ('continental-dishes-03','Singapore Rice & Chicken','continental-dishes',17500,'images/singapore-rice-chicken.jpg',true,false,false),
  ('continental-dishes-04','Singapore Rice & Turkey','continental-dishes',19500,'images/singapore-rice-turkey.jpg',true,false,false),
  ('continental-dishes-05','Vegetable Rice & Chicken','continental-dishes',10500,'images/vegetable-rice-chicken.jpg',true,false,false),
  ('continental-dishes-06','Vegetable Rice & Turkey','continental-dishes',12500,'images/vegetable-rice-turkey.jpg',true,false,false),
  ('continental-dishes-07','Vegetable Rice & Beef','continental-dishes',9000,'images/vegetable-rice-beef.jpg',true,false,false),
  ('continental-dishes-08','Vegetable Rice & Goat Meat','continental-dishes',10500,'images/vegetable-rice-goat-meat.jpg',true,false,false),
  ('continental-dishes-09','Coconut Rice & Chicken','continental-dishes',11000,'images/coconut-rice-chicken.jpg',true,false,false),
  ('continental-dishes-10','Coconut Rice & Turkey','continental-dishes',13000,'images/coconut-rice-turkey.jpg',true,false,false),
  ('soup-01','Atama Soup','soup',8500,'images/atama-soup.jpg',true,false,false),
  ('soup-02','Afang Soup','soup',8500,'images/afang-soup.jpg',true,false,false),
  ('soup-03','Vegetable Soup','soup',8000,'images/vegetable-soup.jpg',true,false,false),
  ('soup-04','Bitter leaf Soup','soup',6500,'images/bitter-leaf-soup.jpg',true,false,false),
  ('soup-05','Edikaikong Soup','soup',9500,'images/edikaikong-soup.jpg',true,false,false),
  ('soup-06','Oha Soup','soup',8000,'images/oha-soup.jpg',true,false,false),
  ('soup-07','Egusi Soup','soup',6500,'images/egusi-soup.jpg',true,false,false),
  ('soup-08','Ogbono Soup','soup',7000,'images/ogbono-soup.jpg',true,false,false),
  ('soup-09','Okro Soup','soup',7500,'images/okro-soup.jpg',true,false,false),
  ('soup-10','Ofe Owerri Soup','soup',8500,'images/ofe-owerri-soup.jpg',true,false,false),
  ('soup-11','Banga Soup','soup',9000,'images/banga-soup.jpg',true,false,false),
  ('soup-12','Fisherman Soup','soup',11500,'images/fisherman-soup.jpg',true,false,false),
  ('pepper-soup-01','CatFish Pepper Soup','pepper-soup',6500,'images/catfish-pepper-soup.jpg',true,false,false),
  ('pepper-soup-02','Cow Tail pepper Soup','pepper-soup',6000,'images/cow-tail-pepper-soup.jpg',true,false,false),
  ('pepper-soup-03','Goat Meat Soup','pepper-soup',5000,'images/goat-meat-soup.jpg',true,false,false),
  ('pepper-soup-04','Assorted Pepper Soup','pepper-soup',5000,'images/assorted-pepper-soup.jpg',true,false,false),
  ('pepper-soup-05','Isiewu Soup','pepper-soup',11500,'images/isiewu-soup.jpg',true,false,false),
  ('pepper-soup-06','Abacha','pepper-soup',6000,'images/abacha.jpg',true,false,false),
  ('pepper-soup-07','Ugba','pepper-soup',5500,'images/ugba.jpg',true,false,false),
  ('protein-01','Turkey','protein',8000,'images/turkey.jpg',true,false,false),
  ('protein-02','Chicken Lap','protein',5500,'images/chicken-lap.jpg',true,false,false),
  ('protein-03','Vegetable Snail','protein',12000,'images/vegetable-snail.jpg',true,false,false),
  ('protein-04','Fried Titus Fish','protein',2000,'images/fried-titus-fish.jpg',true,false,false),
  ('protein-05','Goat Meat','protein',5500,'images/goat-meat.jpg',true,false,false),
  ('protein-06','Beef','protein',5000,'images/beef.jpg',true,false,false),
  ('protein-07','Assorted','protein',5500,'images/assorted.jpg',true,false,false),
  ('protein-08','Cow Leg','protein',5500,'images/cow-leg.jpg',true,false,false),
  ('protein-09','Honey great Wings','protein',5000,'images/honey-great-wings.jpg',true,false,false),
  ('protein-10','Pepped Catfish','protein',5500,'images/peppered-catfish.jpg',true,false,false),
  ('protein-11','Spicy Wings','protein',4000,'images/spicy-wings.jpg',true,false,false),
  ('protein-12','Crispy Wings','protein',4500,'images/crispy-wings.jpg',true,false,false),
  ('protein-13','Dry Fish','protein',4500,'images/dry-fish.jpg',true,false,false),
  ('creaming-pasta-01','Cream Of Chicken Soup & Bread','creaming-pasta',3500,'images/cream-of-chicken-soup-bread.jpg',true,false,false),
  ('creaming-pasta-02','Cream Of Mushroom & Bread','creaming-pasta',3500,'images/cream-of-mushroom-bread.jpg',true,false,false),
  ('creaming-pasta-03','Cream Of Sweet Corn Soup','creaming-pasta',3500,'images/cream-of-sweet-corn-soup.jpg',true,false,false),
  ('sauce-01','Egg Sauce','sauce',2500,'images/egg-sauce.jpg',true,false,false),
  ('sauce-02','Fish Sauce','sauce',3000,'images/fish-sauce.jpg',true,false,false),
  ('sauce-03','Vegetable Sauce','sauce',3000,'images/vegetable-sauce.jpg',true,false,false),
  ('sauce-04','Liver Sauce','sauce',3500,'images/liver-sauce.jpg',true,false,false),
  ('sauce-05','Shrimp Sauce','sauce',4500,'images/shrimp-sauce.jpg',true,false,false),
  ('sauce-06','Chicken Curry Sauce','sauce',5500,'images/chicken-curry-sauce.jpg',true,false,false),
  ('sauce-07','Beef Sauce','sauce',5000,'images/beef-sauce.jpg',true,false,false),
  ('sauce-08','Shredded Chicken Sauce','sauce',5000,'images/shredded-chicken-sauce.jpg',true,false,false),
  ('sauce-09','Shredded Beef Sauce','sauce',5000,'images/shredded-beef-sauce.jpg',true,false,false),
  ('sauce-10','Chicken Hot plate','sauce',22000,'images/chicken-hot-plate.jpg',true,false,false),
  ('fries-01','Sweet Potato Fries','fries',3300,'images/sweet-potato-fries.jpg',true,false,false),
  ('fries-02','French Fries','fries',3300,'images/french-fries.jpg',true,false,false),
  ('fries-03','Yam Fried','fries',3300,'images/yam-fried.jpg',true,false,false),
  ('fries-04','Fried Plantain','fries',3300,'images/fried-plantain.jpg',true,false,false),
  ('fries-05','Boiled Yam','fries',3500,'images/boiled-yam.jpg',true,false,false),
  ('fries-06','Boiled Ripe Plantain','fries',3500,'images/boiled-ripe-plantain.jpg',true,false,false),
  ('fries-07','Boiled Unripe Plantain','fries',3500,'images/boiled-unripe-plantain.jpg',true,false,false),
  ('fries-08','Moi Moi Leaf Wrap','fries',1500,'images/moi-moi-leaf-wrap.jpg',true,false,false),
  ('snacks-01','Chicken Shawarma+Sausage','snacks',5500,'images/chicken-shawarma-sausage.jpg',true,false,false),
  ('snacks-02','Beef Shawarma+Sausage','snacks',5500,'images/beef-shawarma-sausage.jpg',true,false,false),
  ('snacks-03','Burger','snacks',6000,'images/burger.jpg',true,false,false),
  ('snacks-04','Extra Cheese','snacks',1000,'images/extra-cheese.jpg',true,false,false),
  ('snacks-05','Pizza Mini','snacks',10500,'images/pizza-mini.jpg',true,false,false),
  ('snacks-06','Jumbo Pizza','snacks',16000,'images/jumbo-pizza.jpg',true,false,false),
  ('snacks-07','Odogwu Pizza','snacks',19500,'images/odogwu-pizza.jpg',true,false,false),
  ('snacks-08','Plain Doughnut','snacks',1000,'images/plain-doughnut.jpg',true,false,false),
  ('snacks-09','Jam Doughnut','snacks',1500,'images/jam-doughnut.jpg',true,false,false),
  ('snacks-10','Meat Pie','snacks',2000,'images/meat-pie.jpg',true,false,false),
  ('snacks-11','Fish Pie','snacks',2000,'images/fish-pie.jpg',true,false,false),
  ('snacks-12','Chicken Pie','snacks',2000,'images/chicken-pie.jpg',true,false,false),
  ('snacks-13','Vegetable Sandwich','snacks',2500,'images/vegetable-sandwich.jpg',true,false,false),
  ('snacks-14','Averroes Special Sandwich','snacks',6500,'images/averroes-special-sandwich.jpg',true,false,false),
  ('snacks-15','Club Sandwich','snacks',4500,'images/club-sandwich.jpg',true,false,false),
  ('pasta-01','Creamy Pasta','pasta',5000,'images/creamy-pasta.jpg',true,false,false),
  ('pasta-02','Jollof Pasta','pasta',3500,'images/jollof-pasta.jpg',true,false,false),
  ('pasta-03','White Pasta','pasta',3500,'images/white-pasta.jpg',true,false,false),
  ('pasta-04','Alfredo Pasta','pasta',8500,'images/alfredo-pasta.jpg',true,false,false),
  ('salad-01','Coleslaw','salad',1450,'images/coleslaw.jpg',true,false,false),
  ('salad-02','Side Salad','salad',1250,'images/side-salad.jpg',true,false,false),
  ('salad-03','Vegetable Salad','salad',3500,'images/vegetable-salad.jpg',true,false,false),
  ('salad-04','Ceasar Salad','salad',6200,'images/ceasar-salad.jpg',true,false,false),
  ('salad-05','Chicken Salad','salad',6500,'images/chicken-salad.jpg',true,false,false),
  ('swallow-01','Eba','swallow',2000,'images/eba.jpg',true,false,false),
  ('swallow-02','Semovita','swallow',2000,'images/semovita.jpg',true,false,false),
  ('swallow-03','Wheat','swallow',2000,'images/wheat.jpg',true,false,false),
  ('swallow-04','Sam-Vita','swallow',2000,'images/sam-vita.jpg',true,false,false),
  ('swallow-05','Poundo','swallow',2000,'images/poundo.jpg',true,false,false),
  ('special-coffee-01','Nescafe Gold','special-coffee',3000,'images/nescafe-gold.jpg',true,false,false),
  ('special-coffee-02','natural Green Tea','special-coffee',2500,'images/natural-green-tea.jpg',true,false,false),
  ('special-coffee-03','Hot Chocolate','special-coffee',2500,'images/hot-chocolate.jpg',true,false,false),
  ('special-coffee-04','Nescafe Classic Coffee','special-coffee',2500,'images/nescafe-classic-coffee.jpg',true,false,false),
  ('special-coffee-05','Lipton','special-coffee',2000,'images/lipton.jpg',true,false,false)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- Seed: Default admin user metadata
-- (Auth accounts created separately via Supabase Auth API)
-- ============================================
INSERT INTO users (id, username, role, display_name, disabled) VALUES
  ('staff', 'ave_admin', 'staff', '', false),
  ('manager', 'manager_admin', 'manager', '', false)
ON CONFLICT (id) DO NOTHING;

-- Done! You should see "Success. No rows returned" if everything ran correctly.
