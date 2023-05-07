import { createGraph, startCreateGraph } from "../controllers/graph.js";
import dotenv from "dotenv"
var logPath = "./issue_pr_ret_test_artifects/log"
var issuesPath = "./issue_pr_ret_test_artifects/issues"
var PRPath = "./issue_pr_ret_test_artifects/prs"

dotenv.config({ path: 'tests/test.env' });
var repo_owner = "ceydas"
var repo_name = "exdev_test"
var tokens = ["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"]
var branch = "main"

console.log(process.env.NEO4J_URI)

console.log("Starting Data Collection")
await createGraph(repo_owner, repo_name, tokens, branch);
console.log("Finished")
