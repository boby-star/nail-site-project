"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { auditLogs, media } from "@/db/schema";
import { requireAdmin } from "@/modules/auth/service";

const inputSchema=z.object({alt:z.string().trim().min(1).max(300),caption:z.string().trim().max(1000).optional()});
function inspect(buffer:Buffer){
  if(buffer.length>24&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:"image/png",extension:"png",width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(buffer.length>4&&buffer[0]===0xff&&buffer[1]===0xd8){let offset=2;while(offset+9<buffer.length){if(buffer[offset]!==0xff){offset++;continue}const marker=buffer[offset+1],length=buffer.readUInt16BE(offset+2);if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {mime:"image/jpeg",extension:"jpg",height:buffer.readUInt16BE(offset+5),width:buffer.readUInt16BE(offset+7)};if(length<2)break;offset+=2+length}}
  return null;
}
export async function uploadMedia(form:FormData){
  const admin=await requireAdmin();
  const parsed=inputSchema.safeParse({alt:form.get("alt"),caption:form.get("caption")||undefined});
  const file=form.get("file");
  if(!parsed.success||!(file instanceof File)||file.size===0||file.size>10*1024*1024)redirect("/admin/media?error=validation");
  if(!(file instanceof File)||!parsed.success)throw new Error("INVALID_MEDIA");
  const buffer=Buffer.from(await file.arrayBuffer()),image=inspect(buffer);
  if(!image||image.width<1||image.height<1||image.width>12000||image.height>12000)redirect("/admin/media?error=format");
  if(!image)throw new Error("INVALID_MEDIA");
  const directory=path.resolve(process.env.MEDIA_DIR??"./public/uploads");
  const filename=`${randomBytes(24).toString("hex")}.${image.extension}`;
  await mkdir(directory,{recursive:true});
  await writeFile(path.join(directory,filename),buffer,{flag:"wx",mode:0o640});
  const [created]=await db.insert(media).values({filename,storagePath:`/uploads/${filename}`,mimeType:image.mime,width:image.width,height:image.height,size:buffer.length,alt:parsed.data.alt,caption:parsed.data.caption||null,createdBy:admin.id}).returning({id:media.id});
  await db.insert(auditLogs).values({adminId:admin.id,action:"MEDIA_UPLOADED",entityType:"media",entityId:created.id});
  revalidatePath("/admin/media");redirect("/admin/media?uploaded=1");
}
