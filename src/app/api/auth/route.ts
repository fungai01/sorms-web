import NextAuth, { type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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

// Helper: Get user status from database (mock for now)
async function getUserStatus(email: string): Promise<{ status: 'ACTIVE' | 'INACTIVE'; role?: string }> {
  // Admin is always ACTIVE
  if (isAdminEmail(email)) {
    return { status: 'ACTIVE', role: 'admin' };
  }

  // TODO: Query database for user status
  // For now, return mock data - users cần admin activate
  const mockUsers = [
    { email: 'quyentnqe170062@fpt.edu.vn', status: 'ACTIVE' as const, role: 'admin' },
  ];

  const user = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
  return {
    status: user?.status || 'INACTIVE',
    role: user?.role
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      const email = user.email || (profile as any)?.email;

      if (!email) {
        console.error('❌ No email provided during sign in');
        return false;
      }

      // Check if email domain is allowed
      if (!isAllowedDomain(email)) {
        console.error('❌ Email domain not allowed:', email);
        return false;
      }

      console.log('✅ Sign in allowed for:', email);
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (account && profile) {
        const email = (profile as any).email;
        token.email = email;
        token.name = (profile as any).name;
        token.picture = (profile as any).picture;

        // Check user status
        const { status, role } = await getUserStatus(email);
        token.status = status;
        token.isAdmin = isAdminEmail(email);

        if (role) {
          token.role = role;
        }

        console.log('🔐 JWT Token created:', {
          email,
          status,
          isAdmin: token.isAdmin,
          role: token.role
        });
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string | undefined;
        session.user.name = token.name as string | undefined;
        (session.user as any).picture = token.picture;
        (session.user as any).status = token.status;
        (session.user as any).isAdmin = token.isAdmin;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
