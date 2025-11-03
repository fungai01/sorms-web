import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Helper: Check if email is admin
function isAdminEmail(email: string): boolean {
	const adminEmail = process.env.ADMIN_EMAIL_WHITELIST || 'quyentnqe170062@fpt.edu.vn';
	return email.toLowerCase() === adminEmail.toLowerCase();
}

// Helper: Check if email domain is allowed
function isAllowedDomain(email: string): boolean {
	const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'fpt.edu.vn,fe.edu.vn').split(',');
	const domain = email.split('@')[1]?.toLowerCase();
	return allowedDomains.some(d => d.trim().toLowerCase() === domain);
}

export async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

	// Get role and email from token or cookies (for backward compatibility)
	const roleFromToken = (token as any)?.role as string | undefined;
	const roleFromCookie = req.cookies.get("role")?.value;
	const role = roleFromToken || roleFromCookie;
	const email = (token as any)?.email as string | undefined;

	// CRITICAL: Nếu không có role, redirect về login
	if (!role) {
		console.log('❌ No role found, redirecting to login');
		const url = req.nextUrl.clone();
		url.pathname = "/login";
		url.searchParams.set("next", pathname);
		return NextResponse.redirect(url);
	}

	// Helper: map role to base dashboard
	const roleBasePath = (r?: string) => {
		switch (r) {
			case "admin":
				return "/admin/dashboard";
			case "office":
				return "/office/dashboard";
			case "staff":
				return "/staff/dashboard";
			case "lecturer":
				return "/user/dashboard"; // lecturers use user dashboard in app
			case "guest":
				return "/user/dashboard";
			default:
				return "/login";
		}
	};

	// Helper: get required role from path
	const requiredRoleForPath = (path: string): string | undefined => {
		if (path.startsWith("/admin")) return "admin";
		if (path.startsWith("/office")) return "office";
		if (path.startsWith("/staff")) return "staff";
		if (path.startsWith("/lecturer")) return "lecturer";
		if (path.startsWith("/guest")) return "guest";
		return undefined;
	};
	
	console.log('🔍 Middleware check:', {
		pathname,
		role,
		email,
		hasToken: !!token,
		cookies: req.cookies.getAll().map(c => `${c.name}=${c.value}`)
	});
	
	// Check if this is a role page
	const isRolePage = pathname.startsWith("/admin") || pathname.startsWith("/office") ||
	                   pathname.startsWith("/staff") || pathname.startsWith("/lecturer") ||
	                   pathname.startsWith("/guest");

	if (isRolePage) {
		console.log('🎯 Role page detected:', pathname);
		console.log('🔐 Authentication status:', { role, email });
	}

	// Validate email domain
	const domainValid = !!email && isAllowedDomain(email);

	console.log('🌐 Domain validation:', {
		email,
		domainValid,
		isAdmin: email ? isAdminEmail(email) : false
	});

	// CRITICAL: Nếu không có email (không có Next-Auth token), KHÔNG cho vào
	// Vì không thể verify status mà không có email
	if (!email) {
		console.log('❌ No email found (no Next-Auth token), denying access');
		const url = req.nextUrl.clone();
		url.pathname = "/login";
		url.searchParams.set("error", "no_session");
		return NextResponse.redirect(url);
	}

	// Check user status (ACTIVE/INACTIVE)
	const statusFromToken = (token as any)?.status as 'ACTIVE' | 'INACTIVE' | undefined;

	// Admin is always ACTIVE, others need to be activated by admin
	const isActive = email && isAdminEmail(email) ? true : statusFromToken === 'ACTIVE';

	const needsStrictAccess = pathname.startsWith("/admin") || pathname.startsWith("/office");
	const needsRoleAccess = pathname.startsWith("/staff") || pathname.startsWith("/lecturer") || pathname.startsWith("/guest");

	// Enforce exact role-to-route mapping first
	const requiredRole = requiredRoleForPath(pathname);
	if (requiredRole && isRolePage) {
		if (!role) {
			const url = req.nextUrl.clone();
			url.pathname = "/login";
			url.searchParams.set("next", pathname);
			return NextResponse.redirect(url);
		}
		if (role !== requiredRole) {
			const url = req.nextUrl.clone();
			url.pathname = roleBasePath(role);
			return NextResponse.redirect(url);
		}
	}

	// Admin access control - ONLY admin email can access
	if (needsStrictAccess) {
		const isAdmin = role === "admin";
		const isOffice = role === "office";

		// For admin routes, ONLY the whitelisted admin email can access
		if (pathname.startsWith("/admin")) {
			const isAdminUser = email && isAdminEmail(email);
			console.log('🔒 Admin access check:', {
				email,
				isAdminUser,
				isAdmin,
				domainValid,
				isActive
			});

			if (!isAdminUser || !isAdmin || !domainValid || !isActive) {
				console.log('❌ Access denied - not admin or inactive');
				const url = req.nextUrl.clone();
				url.pathname = "/login";
				return NextResponse.redirect(url);
			}
		}

		// For office routes
		if (pathname.startsWith("/office")) {
			const allowedByRole = isOffice;
			const allowedByDomain = domainValid;
			console.log('🔒 Office access check:', { isOffice, allowedByRole, allowedByDomain, isActive });

			if (!allowedByRole || !allowedByDomain) {
				console.log('❌ Redirecting to login from office - invalid role/domain');
				const url = req.nextUrl.clone();
				url.pathname = "/login";
				url.searchParams.set("next", pathname);
				return NextResponse.redirect(url);
			}

			// Check if user is ACTIVE
			if (!isActive) {
				console.log('❌ Access denied - user INACTIVE, needs admin activation');
				const url = req.nextUrl.clone();
				url.pathname = "/login";
				url.searchParams.set("error", "inactive");
				return NextResponse.redirect(url);
			}
		}
	}

	// Other role access control - requires ACTIVE status
	if (needsRoleAccess) {
		const isStaff = role === "staff";
		const isLecturer = role === "lecturer";
		const isGuest = role === "guest";
		const allowedByRole = (pathname.startsWith("/staff") && isStaff) ||
		                      (pathname.startsWith("/lecturer") && isLecturer) ||
		                      (pathname.startsWith("/guest") && isGuest);
		const allowedByDomain = domainValid;

		console.log('👥 Role access check:', {
			isStaff,
			isLecturer,
			isGuest,
			allowedByRole,
			allowedByDomain,
			isActive
		});

		if (!allowedByRole || !allowedByDomain) {
			console.log('❌ Redirecting to login from role access');
			const url = req.nextUrl.clone();
			url.pathname = "/login";
			url.searchParams.set("next", pathname);
			return NextResponse.redirect(url);
		}

		// Check if user is ACTIVE
		if (!isActive) {
			console.log('❌ Access denied - user INACTIVE, needs admin activation');
			const url = req.nextUrl.clone();
			url.pathname = "/login";
			url.searchParams.set("error", "inactive");
			return NextResponse.redirect(url);
		}
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		"/admin/:path*",
		"/office/:path*",
		"/staff/:path*",
		"/lecturer/:path*",
		"/guest/:path*"
	],
};


