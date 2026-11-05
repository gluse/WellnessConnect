import "dotenv/config";
import { ACTIVITY_INTERVAL_MS,createActivityStore,processActivityTick } from "./worker";

// Explicitly opt in after migration/runtime activation. Disabled runs never load db.
async function main(){
  if(process.env.PRODUCT_ACTIVITY_ENABLED!=="true")throw new Error("Product activity is disabled.");
  const {db,pool}=await import("../db");
  const {verifyBillingDatabaseReadiness}=await import("../billing/database-readiness");
  let stopping=false;const stop=()=>{stopping=true;};process.on("SIGINT",stop);process.on("SIGTERM",stop);
  try{
    await verifyBillingDatabaseReadiness((text,values)=>pool.query(text,values));
    const store=createActivityStore(db);
    while(!stopping){
      const start=Date.now();
      try{const result=await processActivityTick(store);console.info("Product activity batch completed:",result.processed);}
      catch{console.error("Product activity batch failed; transaction rolled back.");}
      while(!stopping&&Date.now()-start<ACTIVITY_INTERVAL_MS)await new Promise(resolve=>setTimeout(resolve,Math.min(1000,ACTIVITY_INTERVAL_MS-(Date.now()-start))));
    }
  }finally{await pool.end();process.off("SIGINT",stop);process.off("SIGTERM",stop);}
}
void main().catch(()=>{console.error("Product activity worker initialization refused.");process.exitCode=1;});
