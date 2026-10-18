-- After `n8n import:entities` ran as the postgres superuser (it must: it switches session_replication_role to load rows before their
-- foreign keys), every table it CREATED - the Data Tables' data_table_user_<id> - belongs to postgres, and n8n's own role can then
-- neither write a row nor add a column (sync_tables.py answered 500 on the scratch test of 2026-10-18). Hand them to n8n.
-- Run in the n8n database: psql -U postgres -d n8n -f fix_owner.sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE schemaname = 'public' AND tableowner <> 'n8n' LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO n8n', r.schemaname, r.tablename);
  END LOOP;
  FOR r IN SELECT sequence_schema AS s, sequence_name AS n FROM information_schema.sequences WHERE sequence_schema = 'public' LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO n8n', r.s, r.n);
  END LOOP;
END $$;
SELECT tableowner, count(*) AS tables FROM pg_tables WHERE schemaname = 'public' GROUP BY 1;
