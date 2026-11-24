/** Included in the existing credential-free backup and verified restore pipeline. */
export const domainSql={
 procurement_domain_cases:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL',
 procurement_domain_master:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL',
 procurement_domain_registry:'id TEXT PRIMARY KEY,track TEXT NOT NULL,year_be INTEGER NOT NULL,running_no TEXT NOT NULL,UNIQUE(track,year_be)',
 procurement_core_drafts:'id TEXT PRIMARY KEY,case_id TEXT NOT NULL,doc_id TEXT NOT NULL,draft_id TEXT NOT NULL UNIQUE,copies INTEGER NOT NULL,source_version INTEGER NOT NULL,synced_at TEXT NOT NULL,UNIQUE(case_id,doc_id)',
} as const;
