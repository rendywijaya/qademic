import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { runWave } from '@/lib/waves'
import WavesClient from '@/components/waves/waves-client'

export const metadata: Metadata = {
  title: 'Wave Map — WorldContrarian',
  description:
    'The interconnection graph: how a demand shock propagates through the economy, and which companies are exposed but not yet repriced.',
}

export const revalidate = 1800

export default async function WavesPage({
  searchParams,
}: {
  searchParams: Promise<{ shock?: string }>
}) {
  const { shock: shockParam } = await searchParams
  const db = createAdminClient()

  // all active waves (for the switcher), newest-detected first; ensure the seed is first
  const { data: shockList } = await db
    .from('wave_shocks')
    .select('slug, name, stage, detected_by')
    .eq('active', true)
    .order('started_at', { ascending: true })
  const waves = (shockList ?? []).map((s) => ({ slug: s.slug, name: s.name, stage: s.stage, detected_by: s.detected_by }))

  const run = await runWave(db, shockParam ?? waves[0]?.slug ?? 'ai-capex')

  if (!run) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        <p>No wave found. Seed one with <code>scripts/seed-waves.ts</code>.</p>
      </div>
    )
  }

  return (
    <WavesClient
      shock={run.shock}
      nodes={run.nodes}
      edges={run.edges}
      results={run.results}
      waves={waves}
    />
  )
}
