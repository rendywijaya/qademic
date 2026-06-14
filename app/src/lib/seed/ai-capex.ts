/**
 * Curated ground-truth graph for the "AI capex acceleration" wave.
 *
 * This is the hand-authored causal chain — used both to seed the first wave and as the
 * validation set the AI edge extractor must rediscover/extend (lib/ai/extract-edges).
 *
 * Edge orientation = benefit flow: src→dst means a demand shock at src lifts dst.
 *   relation: exposed_to_theme (theme→co) | drives_demand_for (customer→supplier) | consumes_commodity
 */

export interface SeedEntity {
  slug: string
  kind: 'company' | 'commodity' | 'theme' | 'macro_driver' | 'sector'
  ticker: string | null
  name: string
  sector: string | null
}

export interface SeedEdge {
  src: string // slug
  dst: string // slug
  relation: 'exposed_to_theme' | 'drives_demand_for' | 'consumes_commodity'
  weight: number // 0..1 transmission strength
  confidence: number // 0..1
  evidence: string
}

export const AI_CAPEX_SHOCK = {
  slug: 'ai-capex',
  name: 'AI Capex Acceleration',
  originSlug: 'ai-capex',
  magnitude: 1.0,
  stage: 'building' as const,
  thesis:
    'Hyperscaler + sovereign AI capital spending is accelerating faster than consensus, ' +
    'pulling demand through GPUs → foundry → HBM/memory → networking/optics → power & grid → ' +
    'cooling → commodities. The question for each node: is it still cheap relative to the wave?',
}

export const AI_CAPEX_ENTITIES: SeedEntity[] = [
  // origin theme
  { slug: 'ai-capex', kind: 'theme', ticker: null, name: 'AI Capex Acceleration', sector: null },

  // hyperscalers / demand sources
  { slug: 'MSFT', kind: 'company', ticker: 'MSFT', name: 'Microsoft', sector: 'Technology' },
  { slug: 'GOOGL', kind: 'company', ticker: 'GOOGL', name: 'Alphabet', sector: 'Communication Services' },
  { slug: 'AMZN', kind: 'company', ticker: 'AMZN', name: 'Amazon', sector: 'Consumer Cyclical' },
  { slug: 'META', kind: 'company', ticker: 'META', name: 'Meta Platforms', sector: 'Communication Services' },

  // prime silicon
  { slug: 'NVDA', kind: 'company', ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology' },
  { slug: 'AMD', kind: 'company', ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology' },
  { slug: 'AVGO', kind: 'company', ticker: 'AVGO', name: 'Broadcom', sector: 'Technology' },
  { slug: 'MRVL', kind: 'company', ticker: 'MRVL', name: 'Marvell Technology', sector: 'Technology' },

  // foundry + semicap
  { slug: 'TSM', kind: 'company', ticker: 'TSM', name: 'Taiwan Semiconductor', sector: 'Technology' },
  { slug: 'ASML', kind: 'company', ticker: 'ASML', name: 'ASML Holding', sector: 'Technology' },
  { slug: 'AMAT', kind: 'company', ticker: 'AMAT', name: 'Applied Materials', sector: 'Technology' },
  { slug: 'LRCX', kind: 'company', ticker: 'LRCX', name: 'Lam Research', sector: 'Technology' },
  { slug: 'KLAC', kind: 'company', ticker: 'KLAC', name: 'KLA Corp', sector: 'Technology' },

  // HBM / memory / storage
  { slug: 'MU', kind: 'company', ticker: 'MU', name: 'Micron Technology', sector: 'Technology' },
  { slug: 'WDC', kind: 'company', ticker: 'WDC', name: 'Western Digital', sector: 'Technology' },
  { slug: 'SNDK', kind: 'company', ticker: 'SNDK', name: 'Sandisk Corp', sector: 'Technology' },
  { slug: 'STX', kind: 'company', ticker: 'STX', name: 'Seagate Technology', sector: 'Technology' },

  // networking / optics
  { slug: 'ANET', kind: 'company', ticker: 'ANET', name: 'Arista Networks', sector: 'Technology' },
  { slug: 'CSCO', kind: 'company', ticker: 'CSCO', name: 'Cisco Systems', sector: 'Technology' },
  { slug: 'COHR', kind: 'company', ticker: 'COHR', name: 'Coherent Corp', sector: 'Technology' },
  { slug: 'CIEN', kind: 'company', ticker: 'CIEN', name: 'Ciena Corp', sector: 'Technology' },
  { slug: 'LITE', kind: 'company', ticker: 'LITE', name: 'Lumentum Holdings', sector: 'Technology' },

  // power, grid, electrical, cooling
  { slug: 'VRT', kind: 'company', ticker: 'VRT', name: 'Vertiv Holdings', sector: 'Industrials' },
  { slug: 'ETN', kind: 'company', ticker: 'ETN', name: 'Eaton Corp', sector: 'Industrials' },
  { slug: 'GEV', kind: 'company', ticker: 'GEV', name: 'GE Vernova', sector: 'Industrials' },
  { slug: 'POWL', kind: 'company', ticker: 'POWL', name: 'Powell Industries', sector: 'Industrials' },
  { slug: 'PWR', kind: 'company', ticker: 'PWR', name: 'Quanta Services', sector: 'Industrials' },

  // independent power producers / utilities
  { slug: 'VST', kind: 'company', ticker: 'VST', name: 'Vistra Corp', sector: 'Utilities' },
  { slug: 'CEG', kind: 'company', ticker: 'CEG', name: 'Constellation Energy', sector: 'Utilities' },
  { slug: 'NRG', kind: 'company', ticker: 'NRG', name: 'NRG Energy', sector: 'Utilities' },
  { slug: 'TLN', kind: 'company', ticker: 'TLN', name: 'Talen Energy', sector: 'Utilities' },

  // commodities + miners
  { slug: 'uranium', kind: 'commodity', ticker: null, name: 'Uranium', sector: null },
  { slug: 'CCJ', kind: 'company', ticker: 'CCJ', name: 'Cameco Corp', sector: 'Energy' },
  { slug: 'natgas', kind: 'commodity', ticker: null, name: 'Natural Gas', sector: null },
  { slug: 'copper', kind: 'commodity', ticker: null, name: 'Copper', sector: null },
  { slug: 'FCX', kind: 'company', ticker: 'FCX', name: 'Freeport-McMoRan', sector: 'Basic Materials' },
]

export const AI_CAPEX_EDGES: SeedEdge[] = [
  // theme → demand sources & prime beneficiaries
  { src: 'ai-capex', dst: 'MSFT', relation: 'exposed_to_theme', weight: 0.7, confidence: 0.9, evidence: 'Azure AI buildout; largest single capex spender' },
  { src: 'ai-capex', dst: 'GOOGL', relation: 'exposed_to_theme', weight: 0.65, confidence: 0.9, evidence: 'TPU + Google Cloud AI capex' },
  { src: 'ai-capex', dst: 'AMZN', relation: 'exposed_to_theme', weight: 0.65, confidence: 0.9, evidence: 'AWS Trainium/Inferentia + data-center capex' },
  { src: 'ai-capex', dst: 'META', relation: 'exposed_to_theme', weight: 0.6, confidence: 0.9, evidence: 'GPU fleet expansion for Llama / ranking' },
  { src: 'ai-capex', dst: 'NVDA', relation: 'exposed_to_theme', weight: 0.95, confidence: 0.95, evidence: 'Dominant AI accelerator supplier — prime beneficiary' },
  { src: 'ai-capex', dst: 'AMD', relation: 'exposed_to_theme', weight: 0.6, confidence: 0.85, evidence: 'MI-series accelerators, #2 GPU' },
  { src: 'ai-capex', dst: 'AVGO', relation: 'exposed_to_theme', weight: 0.7, confidence: 0.85, evidence: 'Custom AI silicon (XPUs) + AI networking' },
  { src: 'ai-capex', dst: 'MRVL', relation: 'exposed_to_theme', weight: 0.6, confidence: 0.8, evidence: 'Custom silicon + optical DSPs' },

  // GPU demand → foundry & memory & networking
  { src: 'NVDA', dst: 'TSM', relation: 'drives_demand_for', weight: 0.85, confidence: 0.95, evidence: 'TSMC fabricates NVIDIA GPUs (CoWoS advanced packaging)' },
  { src: 'AMD', dst: 'TSM', relation: 'drives_demand_for', weight: 0.6, confidence: 0.9, evidence: 'AMD GPUs fabbed at TSMC' },
  { src: 'AVGO', dst: 'TSM', relation: 'drives_demand_for', weight: 0.5, confidence: 0.85, evidence: 'Custom silicon fabbed at TSMC' },
  { src: 'NVDA', dst: 'MU', relation: 'drives_demand_for', weight: 0.8, confidence: 0.9, evidence: 'HBM3E memory stacks on GPU packages' },
  { src: 'NVDA', dst: 'ANET', relation: 'drives_demand_for', weight: 0.6, confidence: 0.8, evidence: 'Back-end AI cluster ethernet fabric' },
  { src: 'NVDA', dst: 'AVGO', relation: 'drives_demand_for', weight: 0.5, confidence: 0.75, evidence: 'NVLink/networking + co-packaged optics ecosystem' },

  // foundry → semicap equipment
  { src: 'TSM', dst: 'ASML', relation: 'drives_demand_for', weight: 0.75, confidence: 0.9, evidence: 'EUV lithography for advanced nodes' },
  { src: 'TSM', dst: 'AMAT', relation: 'drives_demand_for', weight: 0.6, confidence: 0.85, evidence: 'Deposition/etch capacity adds' },
  { src: 'TSM', dst: 'LRCX', relation: 'drives_demand_for', weight: 0.55, confidence: 0.85, evidence: 'Etch + HBM TSV processing' },
  { src: 'TSM', dst: 'KLAC', relation: 'drives_demand_for', weight: 0.5, confidence: 0.8, evidence: 'Process control / inspection' },
  { src: 'MU', dst: 'LRCX', relation: 'drives_demand_for', weight: 0.45, confidence: 0.75, evidence: 'HBM through-silicon-via etch' },
  { src: 'MU', dst: 'AMAT', relation: 'drives_demand_for', weight: 0.45, confidence: 0.75, evidence: 'Memory fab equipment' },

  // memory/storage ecosystem
  { src: 'AMZN', dst: 'WDC', relation: 'drives_demand_for', weight: 0.4, confidence: 0.65, evidence: 'Nearline HDD for AI data lakes' },
  { src: 'AMZN', dst: 'STX', relation: 'drives_demand_for', weight: 0.4, confidence: 0.65, evidence: 'Mass-capacity storage for training corpora' },
  { src: 'NVDA', dst: 'SNDK', relation: 'drives_demand_for', weight: 0.35, confidence: 0.6, evidence: 'Enterprise NAND/SSD for AI servers' },

  // optics
  { src: 'ANET', dst: 'COHR', relation: 'drives_demand_for', weight: 0.5, confidence: 0.7, evidence: 'Optical transceivers / datacom lasers' },
  { src: 'ANET', dst: 'LITE', relation: 'drives_demand_for', weight: 0.45, confidence: 0.7, evidence: 'Indium phosphide lasers for 800G/1.6T' },
  { src: 'AVGO', dst: 'CIEN', relation: 'drives_demand_for', weight: 0.35, confidence: 0.6, evidence: 'DCI coherent optics between AI campuses' },

  // compute → power, electrical, cooling, grid
  { src: 'NVDA', dst: 'VRT', relation: 'drives_demand_for', weight: 0.75, confidence: 0.85, evidence: 'Rack power + liquid cooling for GB-class racks' },
  { src: 'MSFT', dst: 'VRT', relation: 'drives_demand_for', weight: 0.5, confidence: 0.75, evidence: 'Data-center thermal management' },
  { src: 'MSFT', dst: 'ETN', relation: 'drives_demand_for', weight: 0.55, confidence: 0.8, evidence: 'Electrical distribution / switchgear' },
  { src: 'MSFT', dst: 'PWR', relation: 'drives_demand_for', weight: 0.45, confidence: 0.7, evidence: 'Grid interconnection / electrical construction' },
  { src: 'VRT', dst: 'POWL', relation: 'drives_demand_for', weight: 0.4, confidence: 0.6, evidence: 'Electrical switchgear for data centers' },
  { src: 'MSFT', dst: 'GEV', relation: 'drives_demand_for', weight: 0.5, confidence: 0.75, evidence: 'Gas turbines + grid equipment for new load' },

  // power demand → IPPs / utilities (the data-center electricity wave)
  { src: 'ai-capex', dst: 'VST', relation: 'exposed_to_theme', weight: 0.55, confidence: 0.7, evidence: 'Data-center power demand lifts merchant generation' },
  { src: 'ai-capex', dst: 'CEG', relation: 'exposed_to_theme', weight: 0.6, confidence: 0.75, evidence: 'Nuclear PPAs with hyperscalers' },
  { src: 'ai-capex', dst: 'TLN', relation: 'exposed_to_theme', weight: 0.5, confidence: 0.65, evidence: 'Nuclear capacity sold to AWS' },
  { src: 'ai-capex', dst: 'NRG', relation: 'exposed_to_theme', weight: 0.35, confidence: 0.55, evidence: 'Merchant power exposure' },

  // power → fuel commodities → miners
  { src: 'CEG', dst: 'uranium', relation: 'consumes_commodity', weight: 0.5, confidence: 0.7, evidence: 'Nuclear fleet fuel demand' },
  { src: 'uranium', dst: 'CCJ', relation: 'drives_demand_for', weight: 0.6, confidence: 0.7, evidence: 'Cameco is a top uranium producer' },
  { src: 'VST', dst: 'natgas', relation: 'consumes_commodity', weight: 0.4, confidence: 0.6, evidence: 'Gas-fired generation fuel' },
  { src: 'GEV', dst: 'copper', relation: 'consumes_commodity', weight: 0.35, confidence: 0.55, evidence: 'Grid + turbine copper intensity' },
  { src: 'ETN', dst: 'copper', relation: 'consumes_commodity', weight: 0.35, confidence: 0.55, evidence: 'Electrical equipment copper content' },
  { src: 'copper', dst: 'FCX', relation: 'drives_demand_for', weight: 0.5, confidence: 0.6, evidence: 'Freeport is a major copper producer' },
]
