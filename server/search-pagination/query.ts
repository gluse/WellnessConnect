import {sql,type SQL} from 'drizzle-orm';
import type {SearchFilters} from '../searchInput';
import type {SearchSort} from '../../shared/search-pagination';
import {SUPPORTED_CURRENCIES} from '../../shared/currencies';

export type SearchPosition=(number|string|null)[];
export type SearchPageRequest={filters:SearchFilters;sort:SearchSort;limit:number;position?:SearchPosition;embedding?:number[];requireEmbedding?:boolean};
export type SearchPageRow={id:number;keys:SearchPosition;distance:number|null;priceSortAvailable?:boolean;currency?:string|null};
type OrderKey={name:string;direction:'ASC'|'DESC';type:'float8'|'timestamp'|'integer'};
function orderKeys(request:SearchPageRequest):OrderKey[]{
 const {filters,sort,embedding}=request;
 if(sort==='default'){
  if(embedding)return [{name:'score_key',direction:'DESC',type:'float8'},{name:'id',direction:'ASC',type:'integer'}];
  return [...(filters.latitude!==undefined?[{name:'distance_key',direction:'ASC',type:'float8'} as OrderKey]:[]),{name:'created_key',direction:'DESC',type:'timestamp'},{name:'id',direction:'DESC',type:'integer'}];
 }
 return [{name:sort.startsWith('price-')?'price_key':sort.startsWith('rating-')?'rating_key':'distance_key',direction:sort.endsWith('-desc')?'DESC':'ASC',type:'float8'},{name:'id',direction:'ASC',type:'integer'}];
}
function column(name:string){return sql.raw(`e.${name}`);}
export function searchPageSQL(request:SearchPageRequest):SQL{
 const {filters,limit,embedding,position}=request;
 const conditions:SQL[]=[sql`s.is_active=true`,sql`(c.id IS NULL OR c.is_active=true)`];
 if(filters.category)conditions.push(sql`s.category=${filters.category}`);
 if(filters.serviceType)conditions.push(sql`s.service_type=${filters.serviceType}`);
 if(filters.ageGroups?.length)conditions.push(sql`s.age_groups ?| ARRAY[${sql.join(filters.ageGroups.map(group=>sql`${group}`),sql`, `)}]::text[]`);
 if(filters.searchQuery?.trim()){
  const term=`%${filters.searchQuery.trim().toLowerCase()}%`;
  conditions.push(sql`(lower(s.name) LIKE ${term} OR lower(s.description) LIKE ${term} OR lower(c.name) LIKE ${term} OR (em.show_name=true AND lower(em.name) LIKE ${term}))`);
 }
 if(filters.time||filters.timeEnd){const minutes=(value:string)=>Number(value.slice(0,2))*60+Number(value.slice(3));conditions.push(sql`s.duration<=${minutes(filters.timeEnd??'23:59')-minutes(filters.time??'00:00')}`);}
 // Keep the haversine longitude division inside sin, matching existing search.
 const haversine=filters.latitude===undefined?null:sql`least(1.0,greatest(0.0,power(sin(radians(a.latitude-${filters.latitude})/2),2)+cos(radians(${filters.latitude}))*cos(radians(a.latitude))*power(sin(radians(a.longitude-${filters.longitude})/2),2)))`;
 const distance=haversine?sql`CASE WHEN a.latitude IS NOT NULL AND a.longitude IS NOT NULL AND (a.location_source IS DISTINCT FROM 'google' OR a.location_expires_at>now()) THEN (6371*2*atan2(sqrt(${haversine}),sqrt(1-${haversine})))::float8 ELSE NULL END`:sql`NULL::float8`;
 if(filters.availableOnly&&filters.date){
  const time=filters.time||filters.timeEnd;
  conditions.push(sql`EXISTS(SELECT 1 FROM public.availability av
   WHERE av.is_active=true AND ((s.company_id IS NOT NULL AND av.company_id=s.company_id) OR (s.company_id IS NULL AND av.company_id IS NULL AND av.provider_id=s.provider_id))
   AND (av.service_id IS NULL OR av.service_id=s.id)
   AND EXISTS(SELECT 1 FROM generate_series(${filters.date}::date,${filters.dateEnd??filters.date}::date,interval '1 day') AS dates(day)
    WHERE (av.schedule_type='specific' AND av.specific_date::date=day::date) OR (av.schedule_type='recurring' AND av.days_of_week @> jsonb_build_array(extract(dow FROM day)::integer)))
   ${time?sql`AND ${filters.time??'00:00'}<COALESCE(av.end_time,'23:59') AND ${filters.timeEnd??'23:59'}>COALESCE(av.start_time,'00:00')
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(av.breaks)='array' THEN av.breaks ELSE '[]'::jsonb END) br
     WHERE ${filters.time??'00:00'}<(br->>'endTime') AND ${filters.timeEnd??'23:59'}>(br->>'startTime'))`:sql``})`);
 }
 // A LEFT LATERAL aggregate scores one existing JSONB vector at a time. CASE
 // guards protect casts even when PostgreSQL reorders WHERE conditions.
 let vectorJoin=sql``,score=sql`NULL::float8`;
 if(request.requireEmbedding&&!embedding)vectorJoin=sql`JOIN public.service_embeddings se ON se.service_id=s.id`;
 if(embedding){
  vectorJoin=sql`JOIN public.service_embeddings se ON se.service_id=s.id
   CROSS JOIN LATERAL (SELECT CASE WHEN jsonb_typeof(se.embedding)='array' THEN CASE WHEN jsonb_array_length(se.embedding)=${embedding.length} THEN se.embedding ELSE '[]'::jsonb END ELSE '[]'::jsonb END AS vector) safe_vector
   CROSS JOIN LATERAL (SELECT sum(component*q.value) AS dot,sum(component*component) AS norm
    FROM (SELECT v.ordinality,CASE WHEN jsonb_typeof(v.value)='number' THEN CASE WHEN abs((v.value#>>'{}')::numeric)<=1e100 THEN (v.value#>>'{}')::float8 ELSE NULL END ELSE NULL END AS component
     FROM jsonb_array_elements(safe_vector.vector) WITH ORDINALITY v(value,ordinality)) vector_values
    JOIN unnest(${`{${embedding.join(',')}}`}::float8[]) WITH ORDINALITY q(value,ordinality) USING(ordinality)
    HAVING count(*)=${embedding.length} AND count(component)=${embedding.length} AND jsonb_array_length(safe_vector.vector)=${embedding.length}) scored`;
  const queryNorm=embedding.reduce((sum,value)=>sum+value*value,0);
  score=sql`CASE WHEN scored.norm>0 THEN scored.dot/(sqrt(scored.norm)*${Math.sqrt(queryNorm)}) ELSE NULL END`;
 }
 const keys=orderKeys(request);
 if(position&&position.length!==keys.length)throw new Error('INVALID_SEARCH_POSITION');
 const continuation:SQL[]=[];
 if(position)for(let index=0;index<keys.length;index++){
  const key=keys[index],value=position[index];if(value===null)continue;
  const equal=keys.slice(0,index).map((previous,i)=>position[i]===null?sql`${column(previous.name)} IS NULL`:sql`${column(previous.name)} IS NOT DISTINCT FROM ${position[i]}::${sql.raw(previous.type)}`);
  const after=sql`(${column(key.name)} ${sql.raw(key.direction==='ASC'?'>':'<')} ${value}::${sql.raw(key.type)} OR ${column(key.name)} IS NULL)`;
  continuation.push(sql`(${sql.join([...equal,after],sql` AND `)})`);
 }
 return sql`WITH candidates AS (SELECT s.id,s.currency,s.created_at AS created_key,CASE WHEN s.price>=0 THEN s.price::float8 ELSE NULL END AS price_key,
  reviews.rating AS rating_key,${distance} AS distance_key,${score} AS score_key
  FROM public.services s LEFT JOIN public.addresses a ON a.id=s.address_id
  LEFT JOIN public.companies c ON c.id=s.company_id LEFT JOIN public.employees em ON em.id=s.employee_id
  LEFT JOIN (SELECT b.service_id,avg(r.rating)::float8 AS rating FROM public.service_reviews r JOIN public.bookings b ON b.id=r.booking_id GROUP BY b.service_id) reviews ON reviews.service_id=s.id
  ${vectorJoin} WHERE ${sql.join(conditions,sql` AND `)}),
  matched AS (SELECT * FROM candidates e WHERE true ${filters.radius!==undefined?sql`AND e.distance_key<=${filters.radius}`:sql``}
    ${embedding?sql`AND e.score_key>=0.30 AND e.score_key<'Infinity'::float8 AND e.score_key<>'NaN'::float8`:sql``}),
  currency_state AS (SELECT count(DISTINCT currency)<=1 AND coalesce(bool_and(currency IS NOT NULL AND currency IN (${sql.join(SUPPORTED_CURRENCIES.map(code=>sql`${code}`),sql`, `)})),true) AS price_sort_available FROM matched),
  eligible AS (SELECT m.id,m.currency,m.created_key,m.rating_key,m.distance_key,m.score_key,
    CASE WHEN cs.price_sort_available THEN m.price_key ELSE NULL END AS price_key,cs.price_sort_available FROM matched m CROSS JOIN currency_state cs)
  SELECT e.id,e.currency,jsonb_build_array(${sql.join(keys.map(key=>column(key.name)),sql`, `)}) AS keys,e.distance_key AS distance,e.price_sort_available AS "priceSortAvailable"
  FROM eligible e WHERE true
  ${position?sql`AND (${continuation.length?sql.join(continuation,sql` OR `):sql`false`})`:sql``}
  ORDER BY ${sql.join(keys.map(key=>sql`${column(key.name)} ${sql.raw(key.direction)} NULLS LAST`),sql`, `)} LIMIT ${limit+1}`;
}
