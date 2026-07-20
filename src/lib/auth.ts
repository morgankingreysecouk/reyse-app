import { NextAuthOptions, getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

// Single hardcoded allowlist — this console has exactly one legitimate user.
// No database, no roles table to misconfigure: if the signed-in Google
// account's verified email doesn't match this, sign-in is refused outright.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "morgan.king@reyse.co.uk";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: { prompt: "select_account" },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, profile }) {
      if (!user.email) return false;
      if (profile && "email_verified" in profile && profile.email_verified === false) {
        return false;
      }
      return user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
};

export async function getSession() {
  return getServerSession(authOptions);
}
