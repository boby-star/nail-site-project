"use server";

import { eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, postCategories, postCities, postRevisions, postSeo, posts, redirects } from "@/db/schema";
import { requireAdmin } from "@/modules/auth/service";
import { adminPostSchema, structuredContentFromText } from "./admin-schema";

function checkbox(form: FormData, key: string) { return form.get(key) === "on"; }
function values(form: FormData) {
  return adminPostSchema.safeParse({
    id: form.get("id") || undefined,
    title: form.get("title"), h1: form.get("h1"), slug: form.get("slug"), excerpt: form.get("excerpt"),
    type: form.get("type"), body: form.get("body"), metaTitle: form.get("metaTitle") || undefined,
    metaDescription: form.get("metaDescription") || undefined, canonicalUrl: form.get("canonicalUrl") || "",
    robotsIndex: checkbox(form, "robotsIndex"), robotsFollow: checkbox(form, "robotsFollow"),
    sitemapEnabled: checkbox(form, "sitemapEnabled"), maxImagePreview: form.get("maxImagePreview"),
    schemaType: form.get("schemaType"), openGraphTitle: form.get("openGraphTitle") || undefined,
    openGraphDescription: form.get("openGraphDescription") || undefined,
    openGraphImageId: form.get("openGraphImageId") || "", categoryIds: form.getAll("categoryIds"), cityIds: form.getAll("cityIds"),
  });
}

export async function savePost(form: FormData) {
  const admin = await requireAdmin();
  const parsed = values(form);
  if (!parsed.success) redirect(`/admin/posts/${form.get("id") || "new"}?error=validation`);
  const value = parsed.data;
  const [slugOwner]=await db.select({id:posts.id}).from(posts).where(eq(posts.slug,value.slug)).limit(1);
  if(slugOwner&&slugOwner.id!==value.id)redirect(`/admin/posts/${form.get("id") || "new"}?error=slug`);
  const content = structuredContentFromText(value.body);
  let postId = value.id;
  await db.transaction(async (tx) => {
    if (!postId) {
      const [created] = await tx.insert(posts).values({ type:value.type,title:value.title,h1:value.h1,slug:value.slug,excerpt:value.excerpt,content,status:"DRAFT",authorId:admin.id }).returning({id:posts.id});
      postId = created.id;
      await tx.insert(auditLogs).values({adminId:admin.id,action:"POST_CREATED",entityType:"post",entityId:postId});
    } else {
      const [current] = await tx.select().from(posts).where(eq(posts.id,postId)).limit(1);
      if (!current) throw new Error("NOT_FOUND");
      if (current.slug !== value.slug && current.status === "PUBLISHED") await tx.insert(redirects).values({sourcePath:`/statti/${current.slug}`,targetPath:`/statti/${value.slug}`,statusCode:301}).onConflictDoUpdate({target:redirects.sourcePath,set:{targetPath:`/statti/${value.slug}`,statusCode:301}});
      await tx.update(posts).set({type:value.type,title:value.title,h1:value.h1,slug:value.slug,excerpt:value.excerpt,content,updatedAt:new Date()}).where(eq(posts.id,postId));
      await tx.insert(auditLogs).values({adminId:admin.id,action:"POST_UPDATED",entityType:"post",entityId:postId});
    }
    await tx.insert(postSeo).values({postId:postId!,metaTitle:value.metaTitle||null,metaDescription:value.metaDescription||null,canonicalUrl:value.canonicalUrl||null,robotsIndex:value.robotsIndex,robotsFollow:value.robotsFollow,maxImagePreview:value.maxImagePreview,schemaType:value.schemaType,openGraphTitle:value.openGraphTitle||null,openGraphDescription:value.openGraphDescription||null,openGraphImageId:value.openGraphImageId||null,sitemapEnabled:value.sitemapEnabled}).onConflictDoUpdate({target:postSeo.postId,set:{metaTitle:value.metaTitle||null,metaDescription:value.metaDescription||null,canonicalUrl:value.canonicalUrl||null,robotsIndex:value.robotsIndex,robotsFollow:value.robotsFollow,maxImagePreview:value.maxImagePreview,schemaType:value.schemaType,openGraphTitle:value.openGraphTitle||null,openGraphDescription:value.openGraphDescription||null,openGraphImageId:value.openGraphImageId||null,sitemapEnabled:value.sitemapEnabled,updatedAt:new Date()}});
    await tx.delete(postCategories).where(eq(postCategories.postId,postId!));
    await tx.delete(postCities).where(eq(postCities.postId,postId!));
    if(value.categoryIds.length) await tx.insert(postCategories).values(value.categoryIds.map(categoryId=>({postId:postId!,categoryId})));
    if(value.cityIds.length) await tx.insert(postCities).values(value.cityIds.map(cityId=>({postId:postId!,cityId})));
    const [revision] = await tx.select({number:max(postRevisions.revisionNumber)}).from(postRevisions).where(eq(postRevisions.postId,postId!));
    await tx.insert(postRevisions).values({postId:postId!,revisionNumber:(revision.number??0)+1,contentSnapshot:{type:value.type,title:value.title,h1:value.h1,slug:value.slug,excerpt:value.excerpt,content},seoSnapshot:value,createdBy:admin.id});
  });
  revalidatePath("/statti"); revalidatePath(`/statti/${value.slug}`); revalidatePath("/sitemap.xml");
  redirect(`/admin/posts/${postId}?saved=1`);
}

async function changeStatus(form:FormData,status:"DRAFT"|"PUBLISHED"|"ARCHIVED",action:string){const admin=await requireAdmin();const id=String(form.get("id"));const [post]=await db.select().from(posts).where(eq(posts.id,id)).limit(1);if(!post)throw new Error("NOT_FOUND");await db.update(posts).set({status,publishedAt:status==="PUBLISHED"?(post.publishedAt??new Date()):post.publishedAt,updatedAt:new Date()}).where(eq(posts.id,id));await db.insert(auditLogs).values({adminId:admin.id,action,entityType:"post",entityId:id});revalidatePath("/statti");revalidatePath(`/statti/${post.slug}`);revalidatePath("/sitemap.xml");redirect(`/admin/posts/${id}?status=${status.toLowerCase()}`)}
export async function publishPost(form:FormData){return changeStatus(form,"PUBLISHED","POST_PUBLISHED")}
export async function unpublishPost(form:FormData){return changeStatus(form,"DRAFT","POST_UNPUBLISHED")}
export async function archivePost(form:FormData){return changeStatus(form,"ARCHIVED","POST_ARCHIVED")}
export async function deletePost(form:FormData){const admin=await requireAdmin();const id=String(form.get("id"));await db.update(posts).set({deletedAt:new Date(),updatedAt:new Date()}).where(eq(posts.id,id));await db.insert(auditLogs).values({adminId:admin.id,action:"POST_DELETED",entityType:"post",entityId:id});revalidatePath("/statti");redirect("/admin/posts?deleted=1")}
export async function restorePost(form:FormData){const admin=await requireAdmin();const id=String(form.get("id"));await db.update(posts).set({deletedAt:null,updatedAt:new Date()}).where(eq(posts.id,id));await db.insert(auditLogs).values({adminId:admin.id,action:"POST_RESTORED",entityType:"post",entityId:id});redirect(`/admin/posts/${id}?restored=1`)}
export async function restoreRevision(form:FormData){const admin=await requireAdmin();const revisionId=String(form.get("revisionId"));const [revision]=await db.select().from(postRevisions).where(eq(postRevisions.id,revisionId)).limit(1);if(!revision||!revision.contentSnapshot||typeof revision.contentSnapshot!=="object")throw new Error("NOT_FOUND");const snapshot=revision.contentSnapshot as {type?:typeof posts.$inferSelect.type;title?:string;h1?:string;slug?:string;excerpt?:string;content?:unknown};if(!snapshot.type||!snapshot.title||!snapshot.h1||!snapshot.slug||!snapshot.excerpt||!snapshot.content)throw new Error("INVALID_REVISION");await db.update(posts).set({type:snapshot.type,title:snapshot.title,h1:snapshot.h1,slug:snapshot.slug,excerpt:snapshot.excerpt,content:snapshot.content,updatedAt:new Date()}).where(eq(posts.id,revision.postId));await db.insert(auditLogs).values({adminId:admin.id,action:"POST_REVISION_RESTORED",entityType:"post",entityId:revision.postId,metadata:{revisionNumber:revision.revisionNumber}});revalidatePath(`/admin/posts/${revision.postId}`);redirect(`/admin/posts/${revision.postId}?restored=1`)}
