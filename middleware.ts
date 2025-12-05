import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Skip middleware for API routes, static files, and public assets
	if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.') || pathname === '/login' || pathname === '/auth/callback') {
		return NextResponse.next();
	}

	// Get role and login flag from cookies (set by client after auth)
	const roleFromCookie = req.cookies.get("role")?.value;
	const isLoggedInCookie = req.cookies.get("isLoggedIn")?.value === 'true';
	const accessToken = req.cookies.get("access_token")?.value;

	console.log('🔒 Middleware check:', { pathname, role: roleFromCookie, hasToken: !!accessToken, isLoggedInCookie });

	// Accept either access token OR role cookie OR isLoggedIn cookie
	if (!accessToken && !roleFromCookie && !isLoggedInCookie) {
		console.log('❌ No access token and no role/isLoggedIn cookie, redirecting to home page');
		const url = req.nextUrl.clone();
		url.pathname = "/";
		return NextResponse.redirect(url);
	}

	if (pathname.startsWith("/admin")) {
		// Only admin role can access admin routes
		if (roleFromCookie !== "admin") {
			console.log('❌ Access denied - not admin role');
			const url = req.nextUrl.clone();
			url.pathname = "/user/dashboard";
			return NextResponse.redirect(url);
		}
	} else if (pathname.startsWith("/office")) {
		if (roleFromCookie !== "office") {
			console.log('❌ Access denied - not office');
			const url = req.nextUrl.clone();
			url.pathname = "/user/dashboard";
			return NextResponse.redirect(url);
		}
	} else if (pathname.startsWith("/staff")) {
		if (roleFromCookie !== "staff") {
			console.log('❌ Access denied - not staff');
			const url = req.nextUrl.clone();
			url.pathname = "/user/dashboard";
			return NextResponse.redirect(url);
		}
	}

	return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
