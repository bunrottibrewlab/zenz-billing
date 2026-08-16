import { createAdminClient } from "@/lib/supabase/admin";

export type ShopRole = "owner" | "manager" | "staff";

/**
 * Returns the authenticated user's role for a given shop.
 * "owner"   – user owns the shop
 * "manager" – shop_staff row with role admin|manager
 * "staff"   – shop_staff row with role staff
 * null      – no access
 */
export async function getShopRole(
  userId: string,
  userEmail: string | null | undefined,
  shopId: string,
  shopOwnerId: string
): Promise<ShopRole | null> {
  if (userId === shopOwnerId) return "owner";
  if (!userEmail) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("shop_staff")
    .select("role")
    .eq("shop_id", shopId)
    .eq("email", userEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  if (data.role === "admin" || data.role === "manager") return "manager";
  return "staff";
}

/** Pages each role is allowed to visit (by route segment) */
export const ROLE_ALLOWED: Record<ShopRole, string[] | "*"> = {
  owner:   "*",
  manager: ["dashboard", "orders", "menu", "qr", "customers", "team"],
  staff:   ["orders", "menu", "qr"],
};
