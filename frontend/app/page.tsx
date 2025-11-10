import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, Shield, DollarSign } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-card border-none backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-teal-500 rounded-xl shadow-holographic"></div>
              <span className="text-3xl font-black heading-gradient">FluxAPI</span>
            </div>
            <nav className="hidden md:flex space-x-8">
              <Link href="/marketplace" className="font-bold text-purple-600 hover:text-purple-700 transition-colors">
                Marketplace
              </Link>
              <Link href="/add-api" className="font-bold text-purple-600 hover:text-purple-700 transition-colors">
                Add API
              </Link>
            </nav>
            <Link href="/marketplace">
              <Button className="btn-vibrant">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-100/50 via-teal-50/50 to-amber-50/50"></div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h1 className="text-7xl md:text-9xl font-black mb-8 heading-gradient animate-gradient-shift">FluxAPI</h1>
          <p className="text-3xl md:text-4xl font-bold mb-10 text-purple-900 max-w-4xl mx-auto">
            The Ultimate Marketplace for AI-Powered APIs
          </p>
          <p className="text-xl font-semibold mb-14 text-purple-700 max-w-2xl mx-auto">
            Monetize your APIs with blockchain payments. Connect AI developers with powerful tools. Build the future of AI
            integration.
          </p>
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href="/marketplace">
              <Button className="btn-vibrant text-xl px-10 py-6 h-auto">
                Browse APIs
                <ArrowRight className="ml-3 h-6 w-6" />
              </Button>
            </Link>
            <Link href="/add-api">
              <Button className="btn-orange text-xl px-10 py-6 h-auto">
                List Your API
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-5xl md:text-7xl font-black text-center mb-20 heading-gradient">Why Choose FluxAPI?</h2>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="custom-card p-10 float-animation">
              <Zap className="h-16 w-16 mb-6 text-purple-500" />
              <h3 className="text-3xl font-black mb-6 text-purple-900">Lightning Fast</h3>
              <p className="font-semibold text-purple-700 text-lg">
                Instant API discovery and integration. Get your AI tools connected in minutes, not hours.
              </p>
            </div>
            <div className="custom-card p-10 float-animation float-delay-1">
              <Shield className="h-16 w-16 mb-6 text-teal-500" />
              <h3 className="text-3xl font-black mb-6 text-purple-900">Secure & Reliable</h3>
              <p className="font-semibold text-purple-700 text-lg">
                Built-in verification system and monitoring. Your APIs are protected with enterprise-grade security.
              </p>
            </div>
            <div className="custom-card p-10 float-animation float-delay-2">
              <DollarSign className="h-16 w-16 mb-6 text-amber-500" />
              <h3 className="text-3xl font-black mb-6 text-purple-900">Monetize Easily</h3>
              <p className="font-semibold text-purple-700 text-lg">
                Blockchain payment integration makes monetization seamless. Start earning from your APIs today.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-purple-700 to-purple-900"></div>
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-teal-500 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-500 rounded-full blur-3xl"></div>
        </div>
        <div className="container mx-auto px-4 text-center relative z-10">
          <h2 className="text-5xl md:text-7xl font-black mb-10 text-white">Ready to Get Started?</h2>
          <p className="text-2xl font-semibold mb-14 max-w-2xl mx-auto text-purple-100">
            Join thousands of developers already using FluxAPI to power their AI applications.
          </p>
          <Link href="/marketplace">
            <Button className="bg-white text-purple-900 hover:bg-purple-50 font-black text-xl px-14 py-7 h-auto rounded-xl shadow-holographic-lg hover:shadow-holographic hover:scale-105 transition-all duration-300">
              Explore Marketplace
              <ArrowRight className="ml-3 h-7 w-7" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="glass-card border-none backdrop-blur-xl py-10">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-teal-500 rounded-xl shadow-holographic"></div>
            <span className="text-2xl font-black heading-gradient">FluxAPI</span>
          </div>
          <p className="font-semibold text-purple-700">© 2024 FluxAPI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
