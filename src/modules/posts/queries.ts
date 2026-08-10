import "server-only"; import { and,desc,eq,isNull } from "drizzle-orm";import { db } from "@/db";import { posts,postSeo } from "@/db/schema";
export async function publishedPosts(){return db.select().from(posts).where(and(eq(posts.status,"PUBLISHED"),isNull(posts.deletedAt))).orderBy(desc(posts.publishedAt)).limit(30)}
export async function publishedPost(slug:string){const [result]=await db.select({post:posts,seo:postSeo}).from(posts).leftJoin(postSeo,eq(postSeo.postId,posts.id)).where(and(eq(posts.slug,slug),eq(posts.status,"PUBLISHED"),isNull(posts.deletedAt))).limit(1);return result}
