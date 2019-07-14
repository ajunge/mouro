import { PersistedEdgeType } from "./storageMgr";
import { AuthDataType, AuthzConditionType } from "./authMgr";
const sqlite = require('sqlite')
const sql = require('sql-bricks-sqlite');

module.exports = class SQLiteMgr {

  db:any;

  constructor() {
    console.log("SQLite Driver Started.")
  }

  async _getDatabase(){
    if(!this.db){
        this.db=await sqlite.open(process.env.SQLITE_FILE);
    }
    return this.db
  }

  async init(){
    const sql=`
    CREATE TABLE IF NOT EXISTS edges
    (
      hash CHAR(128) PRIMARY KEY, 
      "from" VARCHAR(64) NOT NULL, 
      "to" VARCHAR(64) NOT NULL, 
      type VARCHAR(128) NOT NULL, 
      "time" INTEGER NOT NULL, -- from iat
      visibility VARCHAR(4) NOT NULL,
      retention INTEGER NULL,
      tag VARCHAR(128) NULL, 
      claim TEXT NULL, 
      encPriv TEXT NULL, 
      encShar TEXT NULL,
      jwt TEXT NOT NULL
    )
    `
    const db = await this._getDatabase();
    try {
      const res = await db.run(sql);
      return res;
    } catch (e) {
      throw (e);
    } 
  }

  async addEdge(edge: PersistedEdgeType){
    //Store edge
    const sql=`
    INSERT INTO edges
    (
      hash, 
      "from", 
      "to", 
      type, 
      "time",
      visibility,
      retention,
      tag, 
      claim, 
      encPriv, 
      encShar,
      jwt
    )
    VALUES
    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT(edges.hash) DO NOTHING;
    `
    const db = await this._getDatabase();
    try {
      const res = await db.run(sql,[
        edge.hash,
        edge.from,
        edge.to,
        edge.type,
        edge.time,
        edge.visibility,
        edge.retention,
        edge.tag,
        edge.claim,
        edge.encPriv,
        edge.encShar,
        edge.jwt
      ]);
      return res;
    } catch (e) {
      throw (e);
    } 
  }

  async getEdge(hash: string, authData: AuthDataType){
    let whereClause=sql.eq('hash',hash);
    
    //Add perms to whereClause
    whereClause = sql.and(whereClause,this._getPermsReadWhere(authData))
    
    const q=sql.select().from('edges').where(whereClause).toString();
    console.log(q);

    const db = await this._getDatabase();
    try {
      const res = await db.get(q);
      if(res) res.time= (new Date((res.time)));
      return res;
    } catch (e) {
      throw (e);
    } finally {
      await db.close()
    }
  }

  async findEdges(args: any, authData: AuthDataType){
    //find edges
    let where={};
    
    if(args.fromDID) where=sql.and(where,sql.in('from',args.fromDID))
    if(args.toDID)   where=sql.and(where,sql.in('to'  ,args.toDID))
    if(args.type)  where=sql.and(where,sql.in('type',args.type))
    if(args.since) where=sql.and(where,sql.gte('time', args.since))
    if(args.tag)   where=sql.and(where,sql.in('tag',args.tag))
    
    //Add perms to whereClause
    where = sql.and(where,this._getPermsReadWhere(authData))

    const q=sql.select().from('edges')
      .where(where)
      .orderBy('time')
      .toString();
    console.log(q);

    const db = await this._getDatabase();
    try {
      let res = await db.all(q);

      //Converts
      if(res){
        res=res.map((r:any)=>{
            r.time= (new Date((r.time)));
            return r;
        })
      }
      return res;
    } catch (e) {
      throw (e);
    }
  }


  _getPermsReadWhere(authData: AuthDataType){
    //Visibility access
    //Owner access
    let own=sql.and(
              sql.eq('visibility','TO'),
              sql.eq('to',authData.user)
            )

    //Both access
    let both=sql.and(
              sql.eq('visibility','BOTH'),
              sql.or(
                sql.eq('from',authData.user),
                sql.eq('to',authData.user)
              )
            )

    //add ANY
    let any=sql.eq('visibility','ANY');
    let vis=sql.or(own,both,any);

    let perms={};
    //Perms (authz)
    if(authData.authzRead){
        for(let i=0;i<authData.authzRead.length;i++){
            const authzCond:AuthzConditionType=authData.authzRead[i];
            
            //"From" condition
            if(authzCond.from){
                const authzPerm=sql.and(
                    sql.eq('to',authzCond.iss),
                    sql.eq('from',authzCond.from)
                );
                perms=sql.or(perms,authzPerm)
            }
        }
    }
    return sql.or(vis,perms);
  }

}