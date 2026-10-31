import WorkspacePage from '../page';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'sarabun — โต๊ะทำงานวันนี้'};
export const dynamic='force-dynamic';
export const runtime='nodejs';
// Delegate to the same authorization and data loader as the existing workspace.
export default async function HomePage(){return WorkspacePage({searchParams:Promise.resolve({view:'home'})})}
