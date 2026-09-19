-- Enable RLS on all tables
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

-- 1. Admins (Authenticated Users) have FULL ACCESS to everything
CREATE POLICY "Admins have full access" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON meals FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON orders FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON chats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON messages FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON users FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON expenses FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Admins have full access" ON audit_logs FOR ALL USING (auth.role() = 'authenticated');

-- 2. Guests (Anon Users) can READ public menu data
CREATE POLICY "Guests can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Guests can view meals" ON meals FOR SELECT USING (true);
CREATE POLICY "Guests can view settings" ON settings FOR SELECT USING (true);

-- 3. Guests (Anon Users) can READ and INSERT orders/chats
-- (We allow SELECT so the guest app can sync realtime data and filter client-side)
-- (We restrict UPDATE and DELETE so malicious users cannot alter or delete orders)
CREATE POLICY "Guests can view orders" ON orders FOR SELECT USING (true);
CREATE POLICY "Guests can place orders" ON orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Guests can view chats" ON chats FOR SELECT USING (true);
CREATE POLICY "Guests can create chats" ON chats FOR INSERT WITH CHECK (true);

CREATE POLICY "Guests can view messages" ON messages FOR SELECT USING (true);
CREATE POLICY "Guests can send messages" ON messages FOR INSERT WITH CHECK (true);
