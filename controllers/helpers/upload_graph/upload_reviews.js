import { log } from "console";
import fs from "fs";

async function upload_reviews(path_reviews, session) {

    //MERGE PRS
    const reviewJson = JSON.parse(fs.readFileSync(path_reviews, "utf-8"));

    for (const reviews of reviewJson) {
        for (const review of reviews) {
            //If review is not Approved or changes_requested (i.e. "dismissed" and "commented")
            //do not submit to graph. Commented is a bit problematic. If the author of the pr
            //responds to reviewer, gets commented tag. We do not want to submit author as reviewer.
            if ((review.state !== "APPROVED") && (review.state !== "CHANGES_REQUESTED")) {
                continue;
            }

            const username = review.user.login;
            const state = review.state;
            const prNumber = review.pull_request_url.split("/").slice(-1)[0];
            const intPrNo = parseInt(prNumber)

            const res1 = await session.executeWrite((tx) =>
                tx.run(
                    `
                        MATCH (a:Author {authorLogin: $username} )
                        MATCH (p:Pull {prNumber: $intPrNo } )
                        MERGE (p)-[r:REVIEWED_BY]->(a)
                        RETURN a,r,p`,
                { username ,intPrNo}
                )
            );
        }

    }

    console.log("Review data uploaded.");


}

export {upload_reviews}