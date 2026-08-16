import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-xl font-bold text-orange-500 tracking-tight">
          ZenZ
        </span>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-full transition-colors"
          >
            Register your cafe
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-col items-center text-center px-6 py-24 flex-1">
        <div className="max-w-3xl">
          <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">
            QR ordering &amp; loyalty
            <br />
            <span className="text-orange-500">for your cafe</span> — free to
            start
          </h1>
          <p className="text-lg text-gray-500 mb-10 max-w-xl mx-auto">
            Let customers scan, order, and earn stamps. You get a live dashboard,
            real-time orders, and full loyalty management — all in one platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-white bg-orange-500 hover:bg-orange-600 rounded-full transition-colors"
            >
              Register your cafe
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
            >
              Already have an account?
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-24 max-w-4xl w-full text-left">
          <FeatureCard
            icon="📱"
            title="QR Menu"
            description="Customers scan a table QR code to browse your menu and place orders instantly — no app required."
          />
          <FeatureCard
            icon="⭐"
            title="Loyalty Stamps"
            description="Reward returning customers with a digital stamp card. Configure tiers, rewards, and check-in rules your way."
          />
          <FeatureCard
            icon="📊"
            title="Order Tracking"
            description="Customers track their order status in real time. Your team gets live updates on every incoming order."
          />
        </div>
      </main>

      <footer className="text-center py-8 text-sm text-gray-400 border-t border-gray-100">
        &copy; {new Date().getFullYear()} ZenZ. All rights reserved.
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl border border-gray-100 bg-gray-50">
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
    </div>
  );
}
