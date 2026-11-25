'use server'

import { revalidatePath } from 'next/cache'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'

// Despublicar / volver a publicar / borrar artículos del blog desde el panel.
export async function setPostStatus(id: string, status: 'draft' | 'published') {
  await requireHost()
  const supabase = createServiceClient()
  const { error } = await supabase
    .from('blog_posts')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/blog')
  revalidatePath('/blog/[slug]', 'page')
  revalidatePath('/admin/blog')
  return { error: null }
}

export async function deletePost(id: string) {
  await requireHost()
  const supabase = createServiceClient()
  const { error } = await supabase.from('blog_posts').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/blog')
  revalidatePath('/blog/[slug]', 'page')
  revalidatePath('/admin/blog')
  return { error: null }
}
