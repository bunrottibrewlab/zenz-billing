export default async function ShopDetailPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900">Shop {shopId}</h1>
      <p className="text-sm text-gray-500 mt-1">Superadmin — coming soon</p>
    </div>
  );
}
