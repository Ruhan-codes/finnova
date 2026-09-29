import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";

export const Route = createFileRoute("/verify-email")({
  head: () => ({
    meta: [
      { title: "Verify email — FinGuard AI" },
      { name: "description", content: "Verify your FinGuard AI email address." },
      { property: "og:title", content: "Verify email — FinGuard AI" },
      { property: "og:description", content: "Check your inbox to activate your FinGuard AI account." },
    ],
  }),
  component: Verify,
});

function Verify() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass w-full max-w-md rounded-3xl p-8 text-center"
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand/15 text-brand">
          <Mail className="h-8 w-8" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Check your inbox</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a verification link to your email. Click the link, then sign in to continue.
        </p>
        <Link
          to="/login"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl gradient-brand py-2.5 text-sm font-medium text-white"
        >
          Back to sign in
        </Link>
      </motion.div>
    </div>
  );
}
