import fs from "fs";
import axios from "axios";

export async function fetchReviewData(
    pulls_path,
    reviews_path,
    tokens,
    repo_owner,
    repo_name
) {
    console.log("Review collection started");
    var f = fs.readFileSync(pulls_path, "utf-8");
    var fetched_reviews = "[";
    var pulls = JSON.parse(f)
    var pullLength = pulls.length
    var i = 0;
    var skipped = 0;
    for (var pr of pulls) {
        i++;
        if (pr.pull_request.merged_at === null) {
            continue;
        }

        console.log("Reviews: Processing " + pr.number);
        const config = {
            headers: { Authorization: `Bearer ${tokens[0]}` }, //TODO: Prepare Muliple token
        };
        console.log();
        var { data } = await axios.get(
            "https://api.github.com/repos/" +
            repo_owner +
            "/" +
            repo_name +
            "/pulls/" +
            pr.number +
            "/reviews",
            config
        );
        // Data Array olarak geliyor. Github direkt json olarak gönderiyor NORMALDE. Token bitince falan patlama olasılığı yüksek. 
        //console.log(data);
        console.log(i, " / ", pullLength);
        if (data.length === 0) {
            skipped++;
            continue;
        }
        
        fetched_reviews = fetched_reviews + JSON.stringify(data) + ",\n";
    }
    if (skipped === i) { //If no review found 
        var fetched_reviews = fetched_reviews + "]"
    } else {
        var fetched_reviews = fetched_reviews.slice(0, -2) + "]";
    }
    
    fs.appendFileSync(reviews_path, fetched_reviews);
    return;
}


export async function graph_review_create(path_reviews, session) {

    //MERGE PRS
    const reviewJson = JSON.parse(fs.readFileSync(path_reviews, "utf-8"));
    const maxCount = reviewJson.length;
    var currentCount = 0;

    for (const reviews of reviewJson) {
        for (const review of reviews) {

            //If review is not Approved or changes_requested (i.e. "dismissed" and "commented")
            //do not submit to graph. Commented is a bit problematic. If the author of the pr
            //responds to reviewer, gets commented tag. We do not want to submit author as reviewer.
            if ((review.state !== "APPROVED")) {
                continue;
            }

            const username = review.user.login;
            const state = review.state;
            const prNumber = review.pull_request_url.split("/").slice(-1)[0];

            const res1 = await session.executeWrite((tx) =>
                tx.run(
                    `
                MATCH (a:Author {authorName: $username})
                MATCH (p:Pull {prNumber: $prNumber})
                MERGE (a)-[:Approved_Review]->(p)`,
                    { username, prNumber }
                )
            );
        }

    }

}


export async function fetchReviewData_invalidJson(
    pulls_path,
    reviews_path,
    tokens,
    repo_owner,
    repo_name
) {
    console.log("Review collection started");

    var f = fs.readFileSync(pulls_path, "utf-8");
    const pullsLinesSplitted = f.split(/\r?\n/);
    var skipped = 0;
    var fetched_reviews = "[";

    var i = 0;
    for (var line of pullsLinesSplitted) {
        if (line.length) {
            i++;
            var pr = JSON.parse(line);
            if (pr.pull_request.merged_at === null) {
                continue;
            }

            console.log("Reviews: Processing " + pr.number);
            const config = {
                headers: { Authorization: `Bearer ${tokens[0]}` },
            };
            console.log();
            var { data } = await axios.get(
                "https://api.github.com/repos/" +
                repo_owner +
                "/" +
                repo_name +
                "/pulls/" +
                pr.number +
                "/reviews",
                config
            );
            // Data Array olarak geliyor. Github direkt json olarak gönderiyor NORMALDE. Token bitince falan patlama olasılığı yüksek. 
            console.log(data);
            //console.log(i, " / ", pullLength);
            if (data.length === 0) {
                skipped++;
                continue;
            }

            fetched_reviews = fetched_reviews + JSON.stringify(data) + ",\n";
        }
    }

    if (skipped === i -1) { //If no review found 
        var fetched_reviews = fetched_reviews + "]"
    } else {
        var fetched_reviews = fetched_reviews.slice(0, -2) + "]";
    }
    fs.appendFileSync(reviews_path, fetched_reviews);
    return;

}