import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";
import { getLimiter } from "@/lib/rate-limit";

// A fixed dummy hash compared against when the email is not found, so the
// authorize() path takes ~the same time whether or not the user exists.
// Without this, an attacker can enumerate valid emails via login timing.
const DUMMY_HASH_PROMISE = hash("dummy-password-no-one-uses-this", 12);

// 10 login attempts per minute per email. Returning null on overflow makes a
// rate-limited response indistinguishable from a wrong password — the user
// just sees "Invalid email or password" and doesn't learn we're throttling.
const loginLimiter = getLimiter("login", 10, "1 m");

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const { success } = await loginLimiter.limit(email);
        if (!success) return null;

        // Case-insensitive lookup keyed by the same normalized value as the
        // limiter. New users are stored lowercased; the insensitive match also
        // covers any legacy mixed-case rows so they can't get locked out.
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });

        // Always run bcrypt.compare — against the real hash if the user exists,
        // against a dummy hash otherwise — so response time doesn't leak which
        // emails are registered.
        const passwordHash = user?.password ?? (await DUMMY_HASH_PROMISE);
        const valid = await compare(credentials.password as string, passwordHash);

        if (!user || !valid) return null;

        return {
          id: user.id,
          name: `${user.name} ${user.surname}`,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        if (user.id) token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as Role;
        session.user.id   = token.id   as string;
      }
      return session;
    },
  },
});
