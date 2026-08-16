"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ROLE_ALLOWED, ShopRole } from "@/lib/auth/role";

export function RouteGuard({ role, shopSlug }: { role: ShopRole; shopSlug: string }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const allowed = ROLE_ALLOWED[role];
    if (allowed === "*") return;

    // Segment after /admin/[shopSlug]/
    const parts = pathname.split("/").filter(Boolean);
    const segment = parts[2] ?? ""; // ["admin", shopSlug, segment, ...]

    if (!allowed.includes(segment)) {
      router.replace(`/admin/${shopSlug}/orders`);
    }
  }, [pathname, role, shopSlug, router]);

  return null;
}
