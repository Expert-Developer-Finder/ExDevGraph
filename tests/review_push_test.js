import neo4j from 'neo4j-driver'
import { graph_review_create } from "../controllers/reviews.js"

const uri = "neo4j+s://8117a2ff.databases.neo4j.io"
const user = "neo4j"
const password = "gwLRO3knpyBg60EYlofS0hxjXF2Pd7H8bsvKv9QZ5Mk"

console.log("Uploading graph");
console.log('====================================');

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session()


var path_pulls = "data/chaoss/grimoirelab-perceval/pulls.json"
var path_reviews = "data/chaoss/grimoirelab-perceval/reviews.json"
await graph_review_create(path_reviews, session)

session.close();
console.log("Review push done.")