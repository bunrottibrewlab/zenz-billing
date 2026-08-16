export default async function TableMenuPage({
  params,
}: {
  params: Promise<{ shopSlug: string; tableId: string }>;
}) {
  const { shopSlug, tableId } = await params;
  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-bold text-gray-900">Table {tableId}</h1>
      <p className="text-sm text-gray-500 mt-2">Shop: {shopSlug} — coming soon</p>
    </div>
  );
}
