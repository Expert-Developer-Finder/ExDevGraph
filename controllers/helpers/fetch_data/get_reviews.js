import fs from "fs";
import axios from "axios";


async function get_reviews(
    pulls_path,
    reviews_path,
    tokens,
    repo_owner,
    repo_name,
    log_path
) {
    console.log("Fetching reviews  started");
    var token_no = 0;

    var f = fs.readFileSync(pulls_path, "utf-8");
    const pullsLinesSplitted = f.split(/\r?\n/);

    var fetched_reviews = [];
    const pullLength = pullsLinesSplitted.length
    var i = 0;
    for (var line of pullsLinesSplitted) {
        if (line.length) {
            i++;
            var pr = JSON.parse(line);
            if (pr.pull_request.merged_at === null) {
                continue;
            }

            var okToGo = false
            while (okToGo == false) {
              okToGo = true;

              try {
                const config = {
                    headers: { Authorization: `Bearer ${tokens[token_no]}` },
                };
    
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
                
              } catch (e) {
                okToGo = false;
                if(e.response.status == 403 ) {
                    fs.appendFileSync(log_path, `REVIEW: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
                    console.log(`REVIEW: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
                    token_no += 1;
                    token_no = token_no % tokens.length
        
                    // if we have tried every token, let's wait for 15 minutes before trying again
                    if(token_no == 0) {
                    fs.appendFileSync(log_path, `REVIEW: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
                    console.log( `REVIEW: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
                    await sleep(60000*15); 
                    fs.appendFileSync(log_path, `\REVIEW: Waking up. time:  ${new Date()} \n`);
                    console.log(`REVIEW: Waking up. time:  ${new Date()} \n`);
                    }
                } else {
                    // might be a server error or something else might have gone wrong
                    fs.appendFileSync(log_path, `\REVIEW: Something went wrong! ${e.message} \n`);
                    console.log( `REVIEW: Something went wrong! ${e.message} \n`);
                } 
                
              }
            
            
            }
            
            
            
           
            // Data Array olarak geliyor. Github direkt json olarak gönderiyor NORMALDE. Token bitince falan patlama olasılığı yüksek.

            if (i%100 == 0){
                console.log(`Processing reviews: ${i} / ${pullLength} `);
                fs.appendFileSync(log_path, `Processing reviews: ${Math.floor(i / pullLength * 100)}%\n`)
            }
            if (data.length === 0) {
                continue;
            }

            fetched_reviews.push(data);
        }
    }

    fs.appendFileSync(reviews_path, JSON.stringify(fetched_reviews));
    console.log("Processing reviews: " + 100 + "%");
    return;

}

export {get_reviews}