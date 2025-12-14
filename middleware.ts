import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Skip middleware for API routes, static files, and public assets
	if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.') || pathname === '/login' || pathname === '/auth/callback') {
		return NextResponse.next();
	}

	// Public routes that don't require authentication
	const publicRoutes = ['/security/checkin', '/security/open-door'];
	if (publicRoutes.includes(pathname)) {
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

	// Map role to dashboard path
	const getDashboardPath = (role: string | undefined): string => {
		switch (role) {
			case "admin":
				return "/admin/dashboard";
			case "office":
				return "/office/dashboard";
			case "staff":
				return "/staff/dashboard";
			default:
				return "/user/dashboard";
		}
	};

	if (pathname.startsWith("/admin")) {
		// Only admin role can access admin routes
		if (roleFromCookie !== "admin") {
			console.log('❌ Access denied - not admin role, redirecting to user dashboard');
			const url = req.nextUrl.clone();
			url.pathname = getDashboardPath(roleFromCookie);
			return NextResponse.redirect(url);
		}
	} else if (pathname.startsWith("/office")) {
		if (roleFromCookie !== "office") {
			console.log('❌ Access denied - not office, redirecting to user dashboard');
			const url = req.nextUrl.clone();
			url.pathname = getDashboardPath(roleFromCookie);
			return NextResponse.redirect(url);
		}
	} else if (pathname.startsWith("/staff")) {
		if (roleFromCookie !== "staff") {
			console.log('❌ Access denied - not staff, redirecting to user dashboard');
			const url = req.nextUrl.clone();
			url.pathname = getDashboardPath(roleFromCookie);
			return NextResponse.redirect(url);
		}
	} else if (pathname.startsWith("/security")) {
		// Public security routes (checkin, open-door) don't require role check
		if (pathname === "/security/checkin" || pathname === "/security/open-door") {
			return NextResponse.next();
		}
		// Other security routes still require security role
		if (roleFromCookie !== "security") {
			console.log('❌ Access denied - not security, redirecting to user dashboard');
			const url = req.nextUrl.clone();
			url.pathname = getDashboardPath(roleFromCookie);
			return NextResponse.redirect(url);
		}
	} else if (pathname.startsWith("/user")) {
		// Redirect users with specific roles to their own dashboard
		// ADMINISTRATIVE (office) should go to /office, not /user
		if (roleFromCookie === "office" || roleFromCookie === "admin" || roleFromCookie === "staff" || roleFromCookie === "security") {
			console.log(`🔄 Redirecting ${roleFromCookie} role from /user to their dashboard`);
			const url = req.nextUrl.clone();
			url.pathname = getDashboardPath(roleFromCookie);
			return NextResponse.redirect(url);
		}
		// Allow only USER role to access /user routes
	}

	return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
