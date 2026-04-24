import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  // Skip token refresh for Server Action POSTs — the action's own Supabase
  // client will refresh as needed, and refreshing here races with that path.
  if (isServerAction) return supabaseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the session — required for Server Components.
  // This is the ONLY place that should call getUser() for non-action requests,
  // to avoid token-rotation races with downstream SSR renders.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute = pathname.startsWith("/login") || pathname.startsWith("/signup");
  const isProtectedRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/check-in") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/stats") ||
    pathname.startsWith("/groups") ||
    pathname.startsWith("/profile");

  if (!user && isProtectedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
