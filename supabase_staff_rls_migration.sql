-- =====================================================
-- ZenZ — Staff RLS Policies Migration
-- Run in Supabase SQL Editor
-- Allows active shop_staff members to read orders
-- and order_items for their shop (needed for
-- real-time subscription in OrdersManager).
-- =====================================================

-- Orders: staff can SELECT (read) orders for their shop
CREATE POLICY "staff_select_orders"
  ON orders FOR SELECT TO authenticated
  USING (
    shop_id IN (
      SELECT shop_id FROM shop_staff
      WHERE email = auth.email()
        AND is_active = true
    )
  );

-- Order items: staff can SELECT items for orders in their shop
CREATE POLICY "staff_select_order_items"
  ON order_items FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE shop_id IN (
        SELECT shop_id FROM shop_staff
        WHERE email = auth.email()
          AND is_active = true
      )
    )
  );
