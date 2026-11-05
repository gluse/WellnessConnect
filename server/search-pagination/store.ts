import {sql} from 'drizzle-orm';
import type {db} from '../db';
import type {ServiceWithProvider} from '../../shared/schema';
import {searchPageSQL,type SearchPageRow} from './query';
import type {SearchPageStore} from './service';

export function createSearchPageStore(database:typeof db,hydrate:(ids:number[])=>Promise<ServiceWithProvider[]>):SearchPageStore{
 return {
  async rows(request){
   return database.transaction(async tx=>{
    await tx.execute(sql`SET TRANSACTION READ ONLY`);
    await tx.execute(sql`SET LOCAL statement_timeout='8000ms'`);
    return (await tx.execute(searchPageSQL(request))).rows as SearchPageRow[];
   });
  },
  hydrate:ids=>ids.length?hydrate(ids):Promise.resolve([]),
 };
}
