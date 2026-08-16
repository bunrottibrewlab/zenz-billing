export default async function Page({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 capitalize">program-qr</h1>
      <p className="text-sm text-gray-500 mt-1">Coming soon — shop: {shopSlug}</p>
    </div>
  );
}
