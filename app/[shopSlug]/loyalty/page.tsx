export default async function LoyaltyPage({
  params,
}: {
  params: Promise<{ shopSlug: string }>;
}) {
  const { shopSlug } = await params;
  return (
    <div className="p-8 text-center">
      <h1 className="text-xl font-bold text-gray-900">Loyalty — {shopSlug}</h1>
      <p className="text-sm text-gray-500 mt-2">Coming soon</p>
    </div>
  );
}
