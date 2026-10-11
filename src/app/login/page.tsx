import { redirect } from "next/navigation";
import { authenticated, loginRequired } from "@/lib/auth";
import LoginForm from "@/components/login-form";
export const dynamic = "force-dynamic";
export default async function Login() {
  if (!loginRequired() || await authenticated()) redirect("/");
  return <LoginForm/>;
}
