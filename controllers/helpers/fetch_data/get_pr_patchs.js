import fs from 'fs';
import fss from "fs/promises";
import axios from  'axios';

async function get_pr_patchs(repo_owner, repo_name, path, path_prs, log_path, tokens ) {
  
  var raw = await fss.readFile(path_prs, "utf8");
  var lines = raw.split("\n").filter(Boolean);
  var token_no = 0;
  const fetched_so_far = fs.readFileSync(path, 'utf-8').split(/\r?\n/).length -1;

  for (var i in lines) {
    if( i < fetched_so_far) continue;

    const line = lines[i];
    var pr = JSON.parse(line);

    const prNo = pr["number"];
    const patchURL = pr["pull_request"]["patch_url"];

    var can_go = false;
    while( !can_go) {
      try {
        const config = {
          headers: { Authorization: `Bearer ${tokens[token_no % tokens.length]}` },
        };
        var {data} = await axios.get(
            patchURL,
            config
         );
       
        //////////////////////////////////////////////////////////////
        var patch_info = {};
        patch_info["number"] = prNo;
        patch_info["patch"] = data.toString();
        
        var str_patches = "";
        str_patches += JSON.stringify(patch_info);
        str_patches += "\n";
  
        fs.appendFileSync( path, str_patches);
  
        /////////////////////////////////////////////////////////////////
        can_go = true;
        if(i%100==0) {
          console.log( "PR_PATCHES: " +i +"th pr has been looked up");
        }
      } catch (e) {
        if (e.response.status == 502) {
          fs.appendFileSync(log_path, "PR_PATCHES.js: Server error aldık!\n");
        }
        // Token is over, changing token
        else if(e.response.status == 403 ) {
          fs.appendFileSync(log_path, `PR_PATCHES.js: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
          console.log(`PR_PATCHES.js: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
          token_no += 1;

          // if we have tried every token, let's wait for 15 minutes before trying again
          if(token_no % tokens.length  == 0) {
            function sleep(ms) {
              return new Promise((resolve) => {
                setTimeout(resolve, ms);
              });
            }
            fs.appendFileSync(log_path, `PR_PATCHES: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
            console.log( `PR_PATCHES: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
            await sleep(60000*15); 
            fs.appendFileSync(log_path, `PR_PATCHES: Waking up. time:  ${new Date()} \n`);
            console.log(`PR_PATCHES: Waking up. time:  ${new Date()} \n`);
          }

        } else {
          fs.appendFileSync(log_path, `\nPR_PATCHES: Something went wrong! ${e.message} \n`);
          console.log( `PR_PATCHES: Something went wrong! ${e.message} \n`);
        }
      }
    }
  }

  console.log(
    `PR_PATCHES: Fetched all issue timelines of ${repo_owner}/${repo_name} and extracted them to ${path}`
  );
  fs.appendFileSync(log_path, 
    `PR_PATCHES: Fetched all issue timelines of ${repo_owner}/${repo_name} and extracted them to ${path}\n`
  );

  return;
}

export {get_pr_patchs};