'use client'
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Star } from "lucide-react"

import { useEffect, useState } from "react"

export default function MarketplacePage() {
  const [marketplace, setMarketplace] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    async function fetchListings() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4021"}/listings`)
        const data = await res.json()
        if (!data.listings) throw new Error("No listings found")
        const fetched = await Promise.all(
          data.listings.map(async (item: { cid: string, timestamp: number }) => {
            try {
              const ipfsRes = await fetch(`https://gateway.pinata.cloud/ipfs/${item.cid}`)
              if (!ipfsRes.ok) throw new Error("Not found on IPFS")
              const ipfsData = await ipfsRes.json()
              return { ...ipfsData, cid: item.cid, timestamp: item.timestamp }
            } catch {
              return { cid: item.cid, timestamp: item.timestamp, error: "Could not fetch from IPFS" }
            }
          })
        )
        setMarketplace(fetched)
      } catch (err: any) {
        setError(err.message || "Unknown error")
      } finally {
        setLoading(false)
      }
    }
    fetchListings()
  }, [])

  const filtered = (() => {
    const seen = new Set<string>()
    return marketplace.filter(api => {
      if (!api.cid || seen.has(api.cid)) return false
      seen.add(api.cid)
      if (!search) return true
      return (
        (api.name && api.name.toLowerCase().includes(search.toLowerCase())) ||
        (api.description && api.description.toLowerCase().includes(search.toLowerCase())) ||
        (api.category && api.category.toLowerCase().includes(search.toLowerCase())) ||
        (api.tags && api.tags.toLowerCase().includes(search.toLowerCase()))
      )
    })
  })()

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="glass-card border-none backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-teal-500 rounded-xl shadow-holographic"></div>
              <span className="text-3xl font-black heading-gradient">FluxAPI</span>
            </Link>
            <nav className="hidden md:flex space-x-8">
              <Link href="/marketplace" className="font-bold text-purple-700 underline decoration-2 underline-offset-4">
                Marketplace
              </Link>
              <Link href="/add-api" className="font-bold text-purple-600 hover:text-purple-700 transition-colors">
                Add API
              </Link>
            </nav>
            <Link href="/add-api">
              <Button className="btn-vibrant">
                List Your API
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        {/* Search Section */}
        <div className="mb-16">
          <h1 className="text-5xl md:text-7xl font-black mb-10 text-center heading-gradient">API Marketplace</h1>
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-5 top-1/2 transform -translate-y-1/2 h-7 w-7 text-purple-400" />
            <Input
              placeholder="Search APIs..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-custom pl-16 h-16 text-lg"
            />
          </div>
        </div>

        {/* Live Marketplace APIs */}
        <section>
          <h2 className="text-3xl font-black mb-6">All APIs</h2>
          {loading && <div className="text-center">Loading APIs...</div>}
          {error && <div className="text-center text-red-600">{error}</div>}
          {!loading && !error && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.length === 0 && <div className="col-span-3 text-center text-gray-500">No APIs found.</div>}
              {filtered.map((api, i) => (
                <ApiCard key={api.cid || i} api={api} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function ApiCard({ api }: { api: any }) {
  const tagsArray = typeof api.tags === "string"
    ? api.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
    : Array.isArray(api.tags) ? api.tags : [];

  return (
    <div className="custom-card p-8 hover:scale-105 transition-transform duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col">
          <h3 className="text-2xl font-black mb-2 text-purple-900">{api.name || "Untitled API"}</h3>
          <span className="text-xs text-purple-400 break-all font-mono">CID: {api.cid || "-"}</span>
        </div>
        <Badge className="badge-gradient">{api.category || "-"}</Badge>
      </div>
      <div className="mb-3 text-xs text-purple-400">{api.timestamp ? new Date(api.timestamp).toLocaleString() : ""}</div>
      <div className="mb-4 text-purple-700 font-medium">{api.description || "No description."}</div>
      <div className="mb-3 text-sm"><span className="font-bold text-purple-900">Endpoint:</span> <span className="font-mono text-teal-600">{api.endpoint || "-"}</span></div>
      <div className="mb-3 text-sm"><span className="font-bold text-purple-900">Cost:</span> <span className="text-amber-600 font-bold">{api.costPerRequest ? `$${api.costPerRequest}` : "-"}</span></div>
      <div className="mb-4 text-sm"><span className="font-bold text-purple-900">Docs:</span> {api.documentation ? <a href={api.documentation} target="_blank" rel="noopener noreferrer" className="underline text-teal-600 hover:text-teal-700">{api.documentation}</a> : "-"}</div>
      <div className="flex flex-wrap gap-2 mb-6">
        {tagsArray.length > 0 ? tagsArray.map((tag: string) => (
          <Badge key={tag} variant="outline" className="border-2 border-purple-300 text-purple-700 font-semibold hover:bg-purple-50">
            {tag}
          </Badge>
        )) : <span className="text-xs text-purple-400">No tags</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link href={`/api/${api.cid}`}>
          <Button className="btn-vibrant">
            View Details
          </Button>
        </Link>
        <Link href={`/analytics?apiId=${encodeURIComponent(api.cid)}`}>
          <Button className="btn-orange">
            Stats
          </Button>
        </Link>
      </div>
    </div>
  )
}
