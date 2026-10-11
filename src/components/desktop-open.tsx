"use client";
import { useEffect, useState } from "react";
export default function DesktopOpen() {
  const [message, setMessage] = useState("กำลังเปิดระบบสารบรรณ…");
  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", "/desktop");
    fetch("/api/desktop/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then(response => { if (!response.ok) throw new Error(); window.location.replace("/"); })
      .catch(() => setMessage("กรุณาเปิดระบบจาก Open-Sarabun.cmd อีกครั้ง"));
  }, []);
  return <main className="login-page"><div className="login-card"><h1>{message}</h1></div></main>;
}
