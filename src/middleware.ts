import { NextRequest, NextResponse } from "next/server";
import { isPlausibleServerActionId } from "@/lib/security/server-action";

export function middleware(request: NextRequest) {
  const actionId = request.headers.get("next-action");

  if (actionId && !isPlausibleServerActionId(actionId)) {
    return new NextResponse("Некоректний запит.", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
