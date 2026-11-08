-- Runs as fm_audit_source_owner in a reviewed source setup transaction.
-- All serialized values are fixed ASCII enums/IDs/field names, never row values.
CREATE FUNCTION audit_capture.canonical_json(p jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $canonical$
DECLARE result text;
BEGIN
 CASE jsonb_typeof(p)
 WHEN 'object' THEN SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||audit_capture.canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO result FROM jsonb_each(p);
 WHEN 'array' THEN SELECT '['||coalesce(string_agg(audit_capture.canonical_json(value),',' ORDER BY ordinal),'')||']' INTO result FROM jsonb_array_elements(p) WITH ORDINALITY a(value,ordinal);
 ELSE result:=p::text;
 END CASE;
 RETURN result;
END $canonical$;
REVOKE ALL ON FUNCTION audit_capture.canonical_json(jsonb) FROM PUBLIC;
CREATE FUNCTION audit_capture.business_record_changed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $trigger$
DECLARE before_row jsonb; after_row jsonb; row_data jsonb; changes jsonb; key_value text; event text; encoded text; event_uuid uuid:=gen_random_uuid();
BEGIN
 IF TG_TABLE_SCHEMA<>'public' OR TG_NARGS<>1 OR TG_OP NOT IN ('INSERT','UPDATE','DELETE') THEN RAISE EXCEPTION 'Invalid audit trigger context'; END IF;
 before_row:=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 after_row:=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 IF before_row=after_row THEN RETURN NULL; END IF;
 row_data:=CASE WHEN TG_OP='DELETE' THEN before_row ELSE after_row END;
 SELECT string_agg(row_data->>key_name,'|' ORDER BY ordinal) INTO key_value FROM unnest(string_to_array(TG_ARGV[0],',')) WITH ORDINALITY k(key_name,ordinal);
 IF key_value IS NULL OR key_value !~ '^[A-Za-z0-9_-]{1,100}(\|[A-Za-z0-9_-]{1,100})?$' THEN RAISE EXCEPTION 'Unsupported audit record identity'; END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('field',key,'redacted',true) ORDER BY key COLLATE "C"),'[]'::jsonb) INTO changes
 FROM (SELECT key FROM jsonb_object_keys(before_row||after_row) key WHERE before_row->key IS DISTINCT FROM after_row->key) changed;
 IF jsonb_array_length(changes) NOT BETWEEN 1 AND 64 THEN RAISE EXCEPTION 'Unsupported audit field count'; END IF;
 event:=CASE TG_OP WHEN 'INSERT' THEN 'data.record_created.v1' WHEN 'UPDATE' THEN 'data.record_updated.v1' ELSE 'data.record_deleted.v1' END;
 encoded:=audit_capture.canonical_json(jsonb_build_object(
  'eventId',event_uuid::text,'schemaVersion',1,'catalogVersion',1,'eventName',event,'outcome','succeeded','retentionClass','B',
  'occurredAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'actor',jsonb_build_object('kind','service','serviceId','database-runtime'),'scope',jsonb_build_object('kind','unknown'),
  'target',jsonb_build_object('type','database_record','id',TG_TABLE_NAME||':'||key_value),
  'source',jsonb_build_object('application','fitsmytime','environment','development','component','database'),
  'requestId',event_uuid::text,'operationId',event_uuid::text,'changes',changes));
 PERFORM audit_capture.enqueue(encoded,encode(sha256(convert_to(encoded,'UTF8')),'hex'),'sha256-sorted-json-v1');
 RETURN NULL;
END $trigger$;
REVOKE ALL ON FUNCTION audit_capture.business_record_changed() FROM PUBLIC;
