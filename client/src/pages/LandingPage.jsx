import PublicHeader from "../components/headers/PublicHeader";
import Footer from "../components/Footer";

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen flex flex-col">
      <PublicHeader />

      <main className="flex-grow pt-20">
        {/* Hero Section */}
        <section className="text-center py-20 bg-gradient-to-b from-indigo-50 to-white">
          <h1 className="text-4xl md:text-6xl font-bold text-slate-800 mb-6">
            Welcome to <span className="text-indigo-600">Furlink</span>
          </h1>
          <p className="text-slate-600 text-lg mb-8">
            Connecting pet owners with trusted service providers — all in one place.
          </p>
          <a
            href="/signup"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg shadow hover:bg-indigo-700 transition"
          >
            Get Started
          </a>
        </section>

        {/* How It Works */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-semibold text-center mb-8 text-slate-800">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 gap-10">
            <div className="p-6 bg-white rounded-xl shadow">
              <h3 className="text-xl font-bold mb-2 text-indigo-600">For Pet Owners</h3>
              <p className="text-slate-600">
                Find trusted pet sitters, groomers, or walkers near you. Book with ease and confidence.
              </p>
            </div>
            <div className="p-6 bg-white rounded-xl shadow">
              <h3 className="text-xl font-bold mb-2 text-indigo-600">For Service Providers</h3>
              <p className="text-slate-600">
                List your services, reach new clients, and grow your pet care business effortlessly.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
