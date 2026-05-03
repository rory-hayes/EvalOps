create index if not exists eval_cases_source_job_id_idx
  on public.eval_cases (source_job_id);

create index if not exists eval_cases_source_trace_import_id_idx
  on public.eval_cases (source_trace_import_id);

create index if not exists graders_source_job_id_idx
  on public.graders (source_job_id);

create index if not exists graders_source_trace_import_id_idx
  on public.graders (source_trace_import_id);

create index if not exists review_issues_source_job_id_idx
  on public.review_issues (source_job_id);

create index if not exists review_issues_source_trace_import_id_idx
  on public.review_issues (source_trace_import_id);

create index if not exists eval_runs_source_job_id_idx
  on public.eval_runs (source_job_id);

create index if not exists eval_runs_source_trace_import_id_idx
  on public.eval_runs (source_trace_import_id);

create index if not exists failure_clusters_source_job_id_idx
  on public.failure_clusters (source_job_id);

create index if not exists failure_clusters_source_trace_import_id_idx
  on public.failure_clusters (source_trace_import_id);

create index if not exists prompt_candidates_source_job_id_idx
  on public.prompt_candidates (source_job_id);

create index if not exists prompt_candidates_source_trace_import_id_idx
  on public.prompt_candidates (source_trace_import_id);

create index if not exists routing_rules_source_job_id_idx
  on public.routing_rules (source_job_id);

create index if not exists routing_rules_source_trace_import_id_idx
  on public.routing_rules (source_trace_import_id);

create index if not exists cache_recommendations_source_job_id_idx
  on public.cache_recommendations (source_job_id);

create index if not exists cache_recommendations_source_trace_import_id_idx
  on public.cache_recommendations (source_trace_import_id);

create index if not exists reports_source_job_id_idx
  on public.reports (source_job_id);

create index if not exists reports_source_trace_import_id_idx
  on public.reports (source_trace_import_id);
