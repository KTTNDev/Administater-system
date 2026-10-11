import type {ReactNode} from 'react';
import {ChevronDown,type LucideIcon} from 'lucide-react';

export function WorkspaceHeading({icon:Icon,title,description,actions}:{icon:LucideIcon;title:string;description?:string;actions?:ReactNode}){
 return <header className="workspace-heading"><div className="workspace-heading-copy"><span className="workspace-heading-icon" aria-hidden="true"><Icon size={25}/></span><div><h1>{title}</h1>{description&&<p>{description}</p>}</div></div>{actions&&<div className="workspace-heading-actions">{actions}</div>}</header>;
}

export function DetailNote({title,children}:{title:string;children:ReactNode}){
 return <details className="workspace-detail"><summary><span>{title}</span><ChevronDown size={17} aria-hidden="true"/></summary><div>{children}</div></details>;
}

export function WorkspaceEmpty({icon:Icon,title,description,action}:{icon:LucideIcon;title:string;description:string;action?:ReactNode}){
 return <div className="workspace-empty"><span aria-hidden="true"><Icon size={32}/></span><h2>{title}</h2><p>{description}</p>{action}</div>;
}
