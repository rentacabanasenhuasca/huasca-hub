import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import SiteFooter from '@/components/SiteFooter'
import { getPostBySlug, getPublishedPosts, formatPostDate } from '@/lib/blog'
import { renderMarkdown, readingMinutes } from '@/lib/markdown'
import { optimizedImage } from '@/lib/media'
import { SITE_URL, SITE_NAME } from '@/lib/site'
import BlogHeader from '../BlogHeader'
import ShareButtons from '@/components/ShareButtons'

export const revalidate = 300

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    keywords: post.keywords,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      url: `/blog/${post.slug}`,
      publishedTime: post.published_at,
      modifiedTime: post.updated_at,
      images: post.cover_url ? [{ url: post.cover_url }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: post.cover_url ? [post.cover_url] : undefined,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) notFound()

  const others = (await getPublishedPosts()).filter((p) => p.id !== post.id).slice(0, 3)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: post.cover_url ? [post.cover_url] : undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    inLanguage: 'es-MX',
    keywords: post.keywords.join(', '),
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
    publisher: { '@type': 'Organization', name: SITE_NAME, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
  }

  return (
    <div className="font-body min-h-full bg-[#f8f6f1] text-navy-deep">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <BlogHeader />

      <article className="mx-auto max-w-[760px] px-5 pb-16 pt-10 md:pt-16">
        <nav aria-label="Ruta" className="text-sm text-[#6f6d5c]">
          <Link href="/blog" className="hover:underline">Blog</Link>
        </nav>
        <h1 className="font-poster mt-4 text-[clamp(36px,5vw,60px)] leading-[0.98]">{post.title}</h1>
        <p className="mt-5 text-[15px] text-[#6f6d5c]">
          {formatPostDate(post.published_at)}, {readingMinutes(post.content_md)} min de lectura
        </p>
        {post.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizedImage(post.cover_url, 1080)} alt={post.title} fetchPriority="high" className="mt-8 aspect-[16/10] w-full rounded-md object-cover" />
        )}
        <div className="mt-6">
          <ShareButtons url={`${SITE_URL}/blog/${post.slug}`} title={post.title} />
        </div>
        <div
          className="blog-prose mt-10"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content_md) }}
        />

        <div className="mt-12 border-t border-[#ddd6c8] pt-6">
          <ShareButtons url={`${SITE_URL}/blog/${post.slug}`} title={post.title} />
        </div>

        <aside className="mt-10 rounded-lg bg-navy-deep p-8 text-[#f8f6f1] md:p-10">
          <h2 className="font-poster text-[clamp(28px,3vw,38px)] leading-none">Quédate en el bosque</h2>
          <p className="mt-4 max-w-[30em] text-[#f8f6f1]/80">
            Cabañas privadas en Huasca de Ocampo con fogata, asador y algunas con jacuzzi. Reserva directo y ve el
            precio total al instante.
          </p>
          <Link href="/#buscar" className="mt-6 inline-block rounded-md bg-gold px-6 py-3 font-semibold text-navy-deep hover:bg-gold-light">
            Ver cabañas disponibles
          </Link>
        </aside>
      </article>

      {others.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-5 pb-24 md:px-10">
          <h2 className="font-poster mb-8 text-[clamp(28px,3vw,40px)] leading-none">Más guías</h2>
          <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden rounded-md bg-[#e9e1d2]">
                  {p.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={optimizedImage(p.cover_url, 640)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  )}
                </div>
                <h3 className="font-poster mt-4 text-xl leading-none">{p.title}</h3>
              </Link>
            ))}
          </div>
        </section>
      )}

      <SiteFooter className="" />
    </div>
  )
}
