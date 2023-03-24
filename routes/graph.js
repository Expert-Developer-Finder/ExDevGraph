import express from "express";

import {  startCreateGraph} from "../controllers/graph.js";

const graphRouter = express.Router();
graphRouter.post("/create", startCreateGraph);

export default graphRouter;
