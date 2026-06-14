'use server'

import { createClient } from '@/lib/supabase/server'
import { addToWatchlist, removeFromWatchlist } from '@/lib/supabase/queries'
import { revalidatePath } from 'next/cache'

export async function toggleWatchlist(
  ticker: string,
  companyName: string,
  currentlyWatched: boolean,
): Promise<{ success: boolean; watched: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, watched: currentlyWatched }

  if (currentlyWatched) {
    const ok = await removeFromWatchlist(supabase, user.id, ticker)
    if (ok) {
      revalidatePath(`/dashboard/stocks/${ticker}`)
      revalidatePath('/dashboard/watchlist')
    }
    return { success: ok, watched: !ok }
  } else {
    const item = await addToWatchlist(supabase, user.id, ticker, companyName)
    if (item) {
      revalidatePath(`/dashboard/stocks/${ticker}`)
      revalidatePath('/dashboard/watchlist')
    }
    return { success: !!item, watched: !!item }
  }
}
