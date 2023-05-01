import { fetchReviewData } from "../controllers/reviews.js";
import dotenv from "dotenv"

var repo_owner = "chaoss"
var repo_name = "grimoirelab-perceval"
var tokens = ["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"]
var branch = "main"

var path_pulls = "data/chaoss/grimoirelab-perceval/pulls.json"
var path_reviews = "data/chaoss/grimoirelab-perceval/reviews.json"


fetchReviewData(path_pulls, path_reviews, tokens,repo_owner,repo_name )