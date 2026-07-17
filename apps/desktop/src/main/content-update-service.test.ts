import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDatabase, openDatabase, type SqliteDatabase } from "@lifeafter-assistant/database";
import { baseDataPackageSchema, contentManifestSchema } from "@lifeafter-assistant/data-schema";
import { applyBaseDataPackage, applyContentManifest } from "./content-update-service.js";
let database: SqliteDatabase | undefined;
const temporaryDirectories: string[] = [];
afterEach(()=>{database?.close();database=undefined;for(const directory of temporaryDirectories.splice(0))rmSync(directory,{recursive:true,force:true})});
describe("public content application",()=>{it("updates public fields without overwriting personal price and focus",()=>{database=openDatabase(":memory:");migrateDatabase(database);const now=new Date().toISOString();database.prepare("INSERT INTO public_entities(id,entity_type,name,payload_json,content_version,updated_at) VALUES ('item.wood','market-item','旧木头','{}','2026.07.16.1',?)").run(now);database.prepare("INSERT INTO user_item_state(entity_id,market_price,focused,updated_at) VALUES ('item.wood',321,1,?)").run(now);const value=baseDataPackageSchema.parse({schemaVersion:1,contentVersion:"2026.07.17.1",market:{schemaVersion:1,contentVersion:"2026.07.17.1",items:[{id:"item.wood",name:"木头",category:"wood",legacyType:0,sortOrder:0,level:1,couponCost:10,legacyAliases:[],recipe:[]}],knownIssues:[]},nano:{schemaVersion:1,contentVersion:"2026.07.17.1",items:[{itemId:"item.wood",nano1:{min:9,average:12.5,max:16},nano2:{min:0,average:0,max:0},nano3:{min:0,average:0,max:0}}]},cookbook:{schemaVersion:1,contentVersion:"2026.07.17.1",source:"test",recipes:[]},growth:{}});applyBaseDataPackage(database,value);expect(database.prepare("SELECT name,content_version AS contentVersion FROM public_entities WHERE id='item.wood'").get()).toEqual({name:"木头",contentVersion:"2026.07.17.1"});expect(database.prepare("SELECT market_price,focused FROM user_item_state WHERE entity_id='item.wood'").get()).toEqual({market_price:321,focused:1});});});

it("reapplies changed packages when a maintainer accidentally reuses a version", async () => {
  database=openDatabase(":memory:");migrateDatabase(database);
  const dataRoot=mkdtempSync(join(tmpdir(),"lifeafter-content-"));temporaryDirectories.push(dataRoot);
  const packageFor=(name:string)=>baseDataPackageSchema.parse({schemaVersion:1,contentVersion:"2026.07.17.1",market:{schemaVersion:1,contentVersion:"2026.07.17.1",items:[{id:"item.wood",name,category:"wood",legacyType:0,sortOrder:0,level:1,couponCost:10,legacyAliases:[],recipe:[]}],knownIssues:[]},nano:{schemaVersion:1,contentVersion:"2026.07.17.1",items:[{itemId:"item.wood",nano1:{min:9,average:12.5,max:16},nano2:{min:0,average:0,max:0},nano3:{min:0,average:0,max:0}}]},cookbook:{schemaVersion:1,contentVersion:"2026.07.17.1",source:"test",recipes:[]},growth:{}});
  const apply=async(name:string,publishedAt:string)=>{const buffer=Buffer.from(`${JSON.stringify(packageFor(name),null,2)}\n`);const manifest=contentManifestSchema.parse({schemaVersion:1,contentVersion:"2026.07.17.1",publishedAt,minimumClientVersion:"0.1.0",clientUpdate:{latestVersion:"0.1.1",minimumSupportedVersion:"0.1.0",updateLevel:"optional",message:"test",downloadPageUrl:"https://github.com/example/example/releases",effectiveAt:publishedAt,graceDays:0},packages:[{kind:"base-data",version:"2026.07.17.1",url:"https://raw.githubusercontent.com/example/example/main/releases/base-data.json",sha256:createHash("sha256").update(buffer).digest("hex"),sizeBytes:buffer.length}]});return applyContentManifest(database!,dataRoot,manifest,()=>undefined,async()=>new Response(buffer));};
  expect((await apply("木头","2026-07-17T01:00:00.000Z")).updated).toBe(true);
  expect((await apply("新木头","2026-07-17T02:00:00.000Z")).updated).toBe(true);
  expect(database.prepare("SELECT name FROM public_entities WHERE id='item.wood'").get()).toEqual({name:"新木头"});
});
