import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { PublicShell } from "@/components/public/shell";
import { RichContent } from "@/components/public/rich-content";
import { publishedPost } from "@/modules/posts/queries";

export const dynamic="force-dynamic";

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params,p=await publishedPost(slug);
  if(!p)return {};
  let image:string|undefined;
  if(p.seo?.openGraphImageId){const [item]=await db.select({path:media.storagePath}).from(media).where(eq(media.id,p.seo.openGraphImageId)).limit(1);image=item?.path;}
  return {title:p.seo?.metaTitle??p.post.title,description:p.seo?.metaDescription??p.post.excerpt,alternates:{canonical:p.seo?.canonicalUrl??`/statti/${slug}`},robots:{index:p.seo?.robotsIndex??true,follow:p.seo?.robotsFollow??true},openGraph:{title:p.seo?.openGraphTitle??p.post.title,description:p.seo?.openGraphDescription??p.post.excerpt,type:"article",images:image?[{url:image}]:undefined}};
}

export default async function Page({params}:{params:Promise<{slug:string}>}){
  const p=await publishedPost((await params).slug);if(!p)notFound();
  let image:null|typeof media.$inferSelect=null;
  if(p.seo?.openGraphImageId){const [found]=await db.select().from(media).where(eq(media.id,p.seo.openGraphImageId)).limit(1);image=found??null;}
  const ld={"@context":"https://schema.org","@type":"Article",headline:p.post.h1,datePublished:p.post.publishedAt?.toISOString(),dateModified:p.post.updatedAt.toISOString(),description:p.post.excerpt,image:image?new URL(image.storagePath,process.env.APP_URL!).toString():undefined};
  return <PublicShell><article className="article"><nav aria-label="Навігаційний шлях"><Link href="/">Головна</Link> / <Link href="/statti">Статті</Link></nav><span className="eyebrow">Практичний матеріал</span><h1>{p.post.h1}</h1><p className="meta">{p.post.excerpt}</p><p className="meta">Оновлено {p.post.updatedAt.toLocaleDateString("uk-UA")}</p>{image&&<Image className="article-image" src={image.storagePath} alt={image.alt} width={image.width} height={image.height}/>}<RichContent document={p.post.content}/><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(ld).replace(/</g,"\\u003c")}}/></article></PublicShell>;
}
