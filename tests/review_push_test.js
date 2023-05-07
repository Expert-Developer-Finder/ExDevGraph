import neo4j from 'neo4j-driver'
import { graph_review_create } from "../controllers/reviews.js"

const uri = "neo4j+s://8117a2ff.databases.neo4j.io"
const user = "neo4j"
const password = "gwLRO3knpyBg60EYlofS0hxjXF2Pd7H8bsvKv9QZ5Mk"

console.log("Uploading graph");
console.log('====================================');

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session()

var repo_owner = "ceydas"
var repo_name = "exdev_test"
var tokens = ["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"]
var branch = "main"

var path_reviews = "data/" + repo_owner + "/" + repo_name + "/reviews.json"

await graph_review_create(path_reviews, session)

session.close();
console.log("Review push done.")