'use client'

import { useState } from 'react'
import { Search, Sparkles, AlertTriangle, Cpu } from 'lucide-react'
import ScreenerInput from '@/components/qtools/screener-input'
import ResultsTable from '@/components/qtools/results-table'
import type { ScreenerApiResult } from '@/app/api/screener/route'
import type { StockQuote } from '@/app/api/stocks/prices/route'
import type { FMPFundamentals } from '@/app/api/fmp/fundamentals/route'

type ScreenerResult = ScreenerApiResult

export default function ScreenerPage() {
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [livePrices, setLivePrices] = useState<Record<string, StockQuote>>({})
  const [fmpData, setFmpData] = useState<Record<string, FMPFundamentals>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [lastQuery, setLastQuery] = useState('')
  const [aiPowered, setAiPowered] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<string | null>(null)
  const [universeSize, setUniverseSize] = useState<number | null>(null)

  const handleSearch = async (query: string) => {
    setIsLoading(true)
    setLastQuery(query)
    setErrorMsg(null)
    setLivePrices({})
    setFmpData({})

    try {
      const res = await fetch('/api/screener', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json() as { results: ScreenerResult[]; aiPowered: boolean; error?: string; explanation?: string; universeSize?: number }
      const stockResults = data.results ?? []
      setResults(stockResults)
      setAiPowered(data.aiPowered ?? false)
      setExplanation(data.explanation ?? null)
      setUniverseSize(data.universeSize ?? null)
      if (data.error) setErrorMsg(data.error)

      if (stockResults.length > 0) {
        const tickers = stockResults.map(r => r.ticker).join(',')

        // Fetch live Yahoo Finance prices and FMP fundamentals in parallel
        Promise.all([
          fetch(`/api/stocks/prices?tickers=${tickers}`).then(r => r.json()).catch(() => ({})),
          fetch(`/api/fmp/fundamentals?tickers=${tickers}`).then(r => r.json()).catch(() => ({ data: [] })),
        ]).then(([prices, fmp]) => {
          if (prices && typeof prices === 'object') {
            setLivePrices(prices as Record<string, StockQuote>)
          }
          if (fmp?.data && Array.isArray(fmp.data)) {
            const fmpMap: Record<string, FMPFundamentals> = {}
            for (const item of fmp.data as FMPFundamentals[]) {
              if (item.source === 'fmp') fmpMap[item.ticker] = item
            }
            setFmpData(fmpMap)
          }
        }).catch(() => {})
      }
    } catch {
      setErrorMsg('Connection error — please try again')
      setResults([])
    } finally {
      setHasSearched(true)
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-9 h-9 rounded-lg border flex items-center justify-center"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}>
            <Search className="w-4 h-4" style={{ color: 'var(--amber)' }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold th-text">AI Stock Screener</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-[0.08em]"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)', borderColor: 'var(--amber-border)', backgroundColor: 'var(--amber-dim)' }}>
                Q4 Quant
              </span>
            </div>
            <p className="text-xs th-text-dim">Describe what you&apos;re looking for in plain English</p>
          </div>
        </div>
      </div>

      {/* Screener input */}
      <div className="animate-fade-up-d1 border rounded-lg p-6 th-border" style={{ backgroundColor: 'transparent' }}>
        <ScreenerInput onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="animate-fade-up text-center py-12">
          <div className="inline-flex items-center gap-3 px-6 py-4 rounded-lg border"
            style={{ borderColor: 'var(--amber-border)', backgroundColor: 'var(--amber-dim)' }}>
            <Sparkles className="w-5 h-5 animate-pulse" style={{ color: 'var(--amber)' }} />
            <div className="text-left">
              <div className="text-sm font-semibold th-text">AI is analyzing your query...</div>
              <div className="text-[10px] mt-0.5 uppercase tracking-[0.08em] th-text-dim"
                style={{ fontFamily: 'var(--font-mono)' }}>
                Screening the covered universe on live nightly signals
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {hasSearched && !isLoading && (
        <div className="animate-fade-up space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs"
              style={{ borderColor: 'rgba(248,113,113,0.2)', backgroundColor: 'rgba(248,113,113,0.04)', color: 'var(--negative)' }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold th-text flex items-center gap-2">
                <span className="tabular-nums" style={{ color: 'var(--positive)', fontFamily: 'var(--font-mono)' }}>
                  {results.length}
                </span>{' '}
                matches found
                {aiPowered && (
                  <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-[0.08em]"
                    style={{ fontFamily: 'var(--font-mono)', color: '#A78BFA', borderColor: 'rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.06)' }}>
                    <Cpu className="w-2.5 h-2.5" />
                    AI
                  </span>
                )}
              </h2>
              {lastQuery && (
                <p className="text-[10px] mt-0.5 flex items-center gap-1 th-text-dim">
                  <Sparkles className="w-3 h-3" style={{ color: 'var(--amber)' }} />
                  &quot;{lastQuery.slice(0, 70)}{lastQuery.length > 70 ? '...' : ''}&quot;
                  {universeSize != null && (
                    <span style={{ fontFamily: 'var(--font-mono)' }}>· screened {universeSize} stocks</span>
                  )}
                </p>
              )}
              {explanation && (
                <p className="text-[11px] mt-1 th-text-dim">{explanation}</p>
              )}
            </div>
            <div className="hidden md:flex items-center gap-3">
              {[
                { label: '90+', desc: 'Strong', color: 'var(--positive)' },
                { label: '75–89', desc: 'Moderate', color: 'var(--info)' },
                { label: '< 75', desc: 'Weak', color: 'var(--amber)' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5 text-[10px]">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span style={{ color: item.color, fontFamily: 'var(--font-mono)' }}>{item.label}</span>
                  <span className="th-text-dim">{item.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <ResultsTable results={results} livePrices={livePrices} fmpData={fmpData} />

          <div className="flex items-start gap-2.5 p-3.5 rounded-lg border text-xs th-text-dim th-border"
            style={{ backgroundColor: 'transparent' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--amber)' }} />
            <span>
              Results are for <strong className="th-text">educational purposes only</strong> and do not constitute financial advice.
              Always do your own research before making any investment decisions.
            </span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasSearched && !isLoading && (
        <div className="animate-fade-up-d2 text-center py-16">
          <div className="w-14 h-14 rounded-lg border flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'var(--amber-dim)', borderColor: 'var(--amber-border)' }}>
            <Sparkles className="w-7 h-7" style={{ color: 'var(--amber)' }} />
          </div>
          <h3 className="text-base font-semibold mb-2 th-text">Describe your ideal stock</h3>
          <p className="text-sm max-w-sm mx-auto leading-relaxed th-text-dim">
            Use natural language to describe the fundamentals, growth profile, or sector you&apos;re interested in.
            Our AI will find matching stocks across 5,000+ companies.
          </p>
        </div>
      )}
    </div>
  )
}
