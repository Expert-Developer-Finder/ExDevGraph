import { fetchReviewData_invaldJson } from "../controllers/reviews.js";
import dotenv from "dotenv"

var repo_owner = "ceydas"
var repo_name = "exdev_test"
var tokens = ["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"]
var branch = "main"

var path_pulls = "data/" + repo_owner + "/" + repo_name +"/pulls.json"
var path_reviews = "data/" + repo_owner+ "/" + repo_name + "/reviews.json"


fetchReviewData_invaldJson(path_pulls, path_reviews, tokens,repo_owner,repo_name )