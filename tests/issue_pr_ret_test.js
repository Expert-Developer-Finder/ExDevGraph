import { createGraph, startCreateGraph } from "../controllers/graph.js";

var logPath = "./issue_pr_ret_test_artifects/log"
var issuesPath = "./issue_pr_ret_test_artifects/issues"
var PRPath = "./issue_pr_ret_test_artifects/prs"

var repo_owner = "chaoss"
var repo_name = "grimoirelab-perceval"
var tokens = ["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"]
var branch = "master"

console.log("Starting Data Collection")
await createGraph(repo_owner, repo_name, tokens, branch);
console.log("Finished")
