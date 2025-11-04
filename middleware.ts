import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Helper: Check if email is admin (supports multiple admins)
function isAdminEmail(email: string): boolean {
	const adminEmails = (process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn').split(',');
	return adminEmails.some(adminEmail =>
		email.toLowerCase() === adminEmail.trim().toLowerCase()
	);
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Skip middleware for API routes, static files, and public assets
	if (pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname.includes('.') || pathname === '/login' || pathname === '/auth/callback') {
		return NextResponse.next();
	}

	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

	// Get role from cookie (set by auth callback from backend)
	const roleFromCookie = req.cookies.get("role")?.value;
	const email = (token as any)?.email as string | undefined;

	console.log('🔒 Middleware check:', { pathname, role: roleFromCookie, email, hasToken: !!token });

	// If no email (no Next-Auth session), redirect to login
	if (!email) {
		console.log('❌ No email found, redirecting to login');
		const url = req.nextUrl.clone();
		url.pathname = "/login";
		url.searchParams.set("error", "no_session");
		return NextResponse.redirect(url);
	}

	// If no role, redirect to login
	if (!roleFromCookie) {
		console.log('❌ No role found, redirecting to login');
		const url = req.nextUrl.clone();
		url.pathname = "/login";
		return NextResponse.redirect(url);
	}

	// Check if user is super admin (can access all routes)
	const isSuperAdmin = isAdminEmail(email);

	if (isSuperAdmin) {
		console.log('✅ Super admin access granted:', email);
		return NextResponse.next();
	}

	// Check role-based access for non-admin users
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
