import { redirect } from "next/navigation";
import { authenticated,localDemo } from "@/lib/auth";
import { listDrafts,getSetting } from "@/lib/db";
import { driveStatus } from "@/lib/drive";
import { documentAssets } from "@/lib/assets";
import { Workspace } from "@/components/workspace";
import { listOffice } from "@/lib/office-db";
import { bookingSnapshot } from "@/lib/booking-db";
import { listCalendar } from "@/lib/calendar-db";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export default async function Page({searchParams}:{searchParams:Promise<{view?:string;google?:string}>}) {
  if(!await authenticated())redirect("/login"); const params=await searchParams;
  return <Workspace initialCalendar={listCalendar()} initialBookings={bookingSnapshot()} initialOffice={listOffice()} initialDocuments={listDrafts()} assets={documentAssets()} drive={driveStatus()} local={localDemo()} initialView={params.view} googleResult={params.google} savedOrganization={getSetting("organization")?JSON.parse(getSetting("organization")!):null}/>;
}
