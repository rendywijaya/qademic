export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  subscription_tier: 'free' | 'growth' | 'pro' | 'teams'
  subscription_status: 'active' | 'cancelled' | 'past_due' | 'trialing'
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface WatchlistItem {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  notes: string | null
  alert_price: number | null
  added_at: string
}

export interface ScreenerHistory {
  id: string
  user_id: string
  query: string
  filters: Record<string, unknown> | null
  results: unknown
  result_count: number | null
  created_at: string
}

export interface Portfolio {
  id: string
  user_id: string
  name: string
  description: string | null
  currency: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PortfolioHolding {
  id: string
  portfolio_id: string
  ticker: string
  company_name: string | null
  shares: number
  avg_cost_usd: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface UserSettings {
  user_id: string
  theme: 'dark' | 'light'
  notifications_enabled: boolean
  email_digest: boolean
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive'
  investment_style: 'value' | 'growth' | 'quant' | 'blend'
  updated_at: string
}

export interface PriceAlert {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  target_price: number
  direction: 'above' | 'below'
  triggered: boolean
  triggered_at: string | null
  created_at: string
}

// ─── Community ────────────────────────────────────────────────────────────────

export interface InvestmentThesis {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  title: string
  thesis_text: string
  direction: 'bullish' | 'bearish' | 'neutral'
  q7_layers: string[] | null
  ai_score: number | null
  ai_feedback: string | null
  ai_risks: string[] | null
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface ThesisReaction {
  id: string
  thesis_id: string
  user_id: string
  reaction: 'like' | 'insightful' | 'disagree'
  created_at: string
}

export interface ThesisWithReactions extends InvestmentThesis {
  reactions: { like: number; insightful: number; disagree: number }
  userReaction: 'like' | 'insightful' | 'disagree' | null
  authorName: string | null
}
