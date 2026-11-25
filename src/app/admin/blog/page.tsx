import Link from 'next/link'
import { requireHost } from '@/lib/hosts'
import { createServiceClient } from '@/lib/supabase/service'
import { formatPostDate } from '@/lib/blog'
import PostRowActions from './PostRowActions'
import ShareButtons from '@/components/ShareButtons'
import { SITE_URL } from '@/lib/site'

export default async function AdminBlogPage() {
  await requireHost()
  const supabase = createServiceClient()
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('id, slug, title, main_keyword, keywords, status, published_at, social_caption')
    .order('published_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-navy-deep">Blog</h1>
        <p className="mt-1 text-sm text-stone">
          Claude escribe y publica un artículo nuevo los lunes, miércoles y viernes para atraer visitas desde Google.
          Aquí puedes verlos, despublicar o borrar cualquiera.
        </p>
      </div>
      {(posts ?? []).length === 0 ? (
        <p className="rounded-xl border border-stone/15 bg-white p-5 text-sm text-stone">
          Todavía no hay artículos. El primero se publica en el próximo día programado.
        </p>
      ) : (
        <div className="divide-y divide-stone/10 rounded-xl border border-stone/15 bg-white">
          {(posts ?? []).map((p) => (
            <div key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <Link href={`/blog/${p.slug}`} target="_blank" className="font-medium text-navy-deep hover:underline">
                  {p.title}
                </Link>
                <p className="mt-0.5 text-xs text-stone">
                  {formatPostDate(p.published_at)}
                  {p.status !== 'published' && ' · No publicado'}
                  {p.main_keyword ? ` · Palabra clave: ${p.main_keyword}` : ''}
                </p>
              </div>
              <PostRowActions id={p.id} status={p.status} title={p.title} />
              {p.status === 'published' && (
                <div className="w-full sm:basis-full">
                  <ShareButtons url={`${SITE_URL}/blog/${p.slug}`} title={p.title} caption={p.social_caption} compact />
                  {p.social_caption && (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-cream p-3 text-xs text-stone">{p.social_caption}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
