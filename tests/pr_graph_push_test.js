import neo4j from 'neo4j-driver'
import fs from "fs"
import { graph_pulls_create } from "../controllers/patch.js"
import dotenv from "dotenv";

var NEO4J_URI = "neo4j+s://8117a2ff.databases.neo4j.io"
var NEO4J_USERNAME = "neo4j"
var NEO4J_PASSWORD = "gwLRO3knpyBg60EYlofS0hxjXF2Pd7H8bsvKv9QZ5Mk"
var AURA_INSTANCENAME = "Instance01"

var path_patches = "data/chaoss/grimoirelab-perceval/patches.json"
// Create a Driver Instance
const uri = NEO4J_URI
const user = NEO4J_USERNAME
const password = NEO4J_PASSWORD

console.log("Uploading graph");
console.log('====================================');

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session()

graph_pulls_create(path_patches, session)

// var count = 0
// const pullsLines = JSON.parse(fs.readFileSync(path_pulls, 'utf-8'));

// for (var pr of pullsLines) {
//     try {
//         count++
//         console.log("Count " + count + "   \r")

//         //console.log(pr)
//         var patch = pr.patch
//         var prDate = "" + pr.closed_at
//         var prTitle = "" + pr.title
//         var prNumber = "" + pr.number
//         const res1 = await session.executeWrite(
//             tx => tx.run(
//                 `CREATE (u:Pull {prNumber: $prNumber,prTitle: $prTitle,prDate: $prDate})
//            RETURN u
//           `,
//                 { prNumber, prTitle, prDate }
//             )
//         );



//         for (var commit of patch) {


//             var prAuthorName = commit.authorName
//             var prAuthorEmail = commit.authorEmail
//             var commitHash = commit.hash

//             const res2 = await session.executeWrite((tx) =>
//                 tx.run(
//                     `
//         MATCH (a:Author {authorName: $prAuthorName})
//         MATCH (p:Pull {prNumber: $prNumber})

//         MERGE (p)-[:SUBMITED_PR_BY]->(a)
//       `,
//                     { prAuthorName, prNumber }
//                 )
//             );


//             const res3 = await session.executeWrite((tx) =>
//                 tx.run(
//                     `
//         MATCH (p:Pull {prNumber: $prNumber})
//         MATCH (c:Commit {hash: $commitHash})

//         MERGE (c)-[:CONTAINED_IN_PR]->(p)

//       `,
//                     { prNumber, commitHash }
//                 )
//             );
//         };
//     } catch (e) {
//         console.log("ERROR " + e)
//         console.log(pr)
//     }
// }

// console.log("Patch upload done.")

