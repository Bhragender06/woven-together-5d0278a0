import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "./login";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Medileaf" },
      { name: "description", content: "Create a Medileaf account to manage your medications." },
      { property: "og:title", content: "Sign up — Medileaf" },
      { property: "og:description", content: "Start turning prescriptions into a clear daily plan." },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
