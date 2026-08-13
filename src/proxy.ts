import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * Sends signed-out visitors to the sign-in page before an app route renders.
 *
 * Why this exists: page-level guards had drifted. `/dashboard`, `/matches`,
 * `/ai` and `/analytics` are server components that call `getCurrentUser()` and
 * redirect, but `/applications`, `/resumes` and `/preferences` are client
 * components and had no server guard at all — signed out, they answered 200 and
 * rendered an empty shell instead of the sign-in page. No data leaked (their
 * APIs return 401), but the protection depended entirely on every future API
 * staying correctly gated, and on nobody adding another unguarded page.
 *
 * One matcher covers the whole authenticated surface, so a new page under
 * `(app)` is protected the moment it exists.
 *
 * Named `proxy` rather than `middleware`: the `middleware` file convention is
 * deprecated in Next.js 16 and renamed to `proxy`
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 */
export async function proxy(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (token) return NextResponse.next()

  const signIn = new URL('/auth/signin', request.url)
  // Come back to the page that was asked for once signed in.
  signIn.searchParams.set('callbackUrl', request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(signIn)
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/matches/:path*',
    '/ai/:path*',
    '/suggestions/:path*',
    '/evaluate/:path*',
    '/applications/:path*',
    '/resumes/:path*',
    '/preferences/:path*',
    '/analytics/:path*',
    '/onboarding/:path*',
    '/tools/:path*',
  ],
}
