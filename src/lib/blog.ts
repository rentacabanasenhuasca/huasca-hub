import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'

export const BLOG_TAG = 'blog'

export type BlogPost = {
  id: string
  slug: string
  title: string
  description: string
  content_md: string
  main_keyword: string | null
  keywords: string[]
  cover_url: string | null
  social_caption: string | null
  published_at: string
  updated_at: string
}

const COLUMNS = 'id, slug, title, description, content_md, main_keyword, keywords, cover_url, social_caption, published_at, updated_at'

// Artículos publicados (los más nuevos primero). En caché 5 min para que el
// blog cargue rápido; un artículo nuevo aparece a más tardar en 5 min.
export const getPublishedPosts = unstable_cache(
  async () => {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('blog_posts')
      .select(COLUMNS)
      .eq('status', 'published')
      .lte('published_at', new Date().toISOString())
      .order('published_at', { ascending: false })
    return (data ?? []) as BlogPost[]
  },
  ['blog-posts-v2'],
  { revalidate: 300, tags: [BLOG_TAG] }
)

export async function getPostBySlug(slug: string) {
  const posts = await getPublishedPosts()
  return posts.find((p) => p.slug === slug) ?? null
}

export function formatPostDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Mexico_City',
  })
}
