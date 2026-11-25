import Link from 'next/link'
import type { Metadata } from 'next'
import SiteFooter from '@/components/SiteFooter'
import { getPublishedPosts, formatPostDate } from '@/lib/blog'
import { optimizedImage } from '@/lib/media'
import { readingMinutes } from '@/lib/markdown'
import BlogHeader from './BlogHeader'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Blog: qué hacer en Huasca de Ocampo, guías y consejos de viaje',
  description:
    'Guías para planear tu escapada a Huasca de Ocampo, Hidalgo: qué hacer, dónde comer, cómo llegar desde CDMX, temporadas y consejos para tu estancia en cabaña.',
  alternates: { canonical: '/blog' },
}

export default async function BlogIndex() {
  const posts = await getPublishedPosts()
  const [first, ...rest] = posts

  return (
    <div className="font-body min-h-full bg-[#f8f6f1] text-navy-deep">
      <BlogHeader />
      <main className="mx-auto max-w-[1240px] px-5 pb-24 pt-12 md:px-10 md:pt-16">
        <h1 className="font-poster text-[clamp(44px,6vw,80px)] leading-[0.95]">Guías de Huasca</h1>
        <p className="mt-5 max-w-[34em] text-lg text-[#6f6d5c]">
          Qué hacer, dónde comer, cómo llegar y todo lo que te sirve para planear tu escapada a Huasca de Ocampo.
        </p>

        {posts.length === 0 && (
          <p className="mt-12 text-[#6f6d5c]">Pronto publicaremos las primeras guías.</p>
        )}

        {first && (
          <Link href={`/blog/${first.slug}`} className="group mt-12 grid gap-8 md:grid-cols-2 md:items-center">
            <div className="aspect-[4/3] overflow-hidden rounded-md bg-[#e9e1d2]">
              {first.cover_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizedImage(first.cover_url, 1080)} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03] motion-reduce:transition-none" />
              )}
            </div>
            <div>
              <p className="text-sm text-[#6f6d5c]">
                {formatPostDate(first.published_at)}, {readingMinutes(first.content_md)} min de lectura
              </p>
              <h2 className="font-poster mt-3 text-[clamp(30px,3.4vw,44px)] leading-[0.98]">{first.title}</h2>
              <p className="mt-4 text-lg leading-relaxed text-[#6f6d5c]">{first.description}</p>
              <span className="mt-6 inline-block font-semibold underline underline-offset-4">Leer guía</span>
            </div>
          </Link>
        )}

        {rest.length > 0 && (
          <div className="mt-20 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group block">
                <div className="aspect-[4/3] overflow-hidden rounded-md bg-[#e9e1d2]">
                  {p.cover_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={optimizedImage(p.cover_url, 640)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04] motion-reduce:transition-none" />
                  )}
                </div>
                <p className="mt-4 text-sm text-[#6f6d5c]">{formatPostDate(p.published_at)}</p>
                <h2 className="font-poster mt-2 text-2xl leading-none">{p.title}</h2>
                <p className="mt-3 line-clamp-3 text-[15px] text-[#6f6d5c]">{p.description}</p>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter className="" />
    </div>
  )
}
