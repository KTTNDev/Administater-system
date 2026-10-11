import { redirect } from "next/navigation";
import { loginRequired } from "@/lib/auth";
import DesktopOpen from "@/components/desktop-open";
export const dynamic = "force-dynamic";
export default function DesktopPage() {
  if (!loginRequired()) redirect("/");
  return <DesktopOpen/>;
}
