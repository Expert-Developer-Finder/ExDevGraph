import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { graphRouter } from "./routes/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT;

app.use(express.json());
app.use(bodyParser.json({ limit: "30mb", extended: "true" }));
app.use(bodyParser.urlencoded({ limit: "30mb", extended: "true" }));
app.use(bodyParser.json()); // for parsing application/json
app.use(cors());

app.get("/", (req, res)=> {
    return res.status(200).json("Hi");
})


app.use("/graph", graphRouter);


try {
    app.listen(PORT, () => console.log(`Server running on port: ${PORT}`))
} catch (error) {
    console.log(error.message)
}
