import { redirect } from "next/navigation";

/**
 * Root page — redirects to the dashboard.
 * The dashboard is the primary interface for Open-Audit.
 */
export default function RootPage(): never {
  redirect("/dashboard");
}
