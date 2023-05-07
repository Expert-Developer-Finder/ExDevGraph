import fs from 'fs';
import axios from  'axios';
const ISSUE_NO_PER_FETCH = 100; // This can be at tops 100

async function get_issues_and_prs(repo_owner, repo_name, path_issues, path_prs, log_path, tokens) {
    if(ISSUE_NO_PER_FETCH > 100) {
      throw  new Error("Issue no per fetch cannot be bigger than 100");
    }
  
    var no_of_issues_fetched_so_far = fs.readFileSync(path_issues, 'utf-8').split(/\r?\n/).length;
    var no_of_prs_fetched_so_far = fs.readFileSync(path_prs, 'utf-8').split(/\r?\n/).length;
    var page_no = Math.floor(( no_of_issues_fetched_so_far+ no_of_prs_fetched_so_far )/ ISSUE_NO_PER_FETCH + 1);
    var token_no = 0;
  
    var terminated_sucessfully = false;
  
    while (1) {
      try {
          // Get ISSUE_NO_PER_FETCH commits at a time
          const config = {
              headers: { Authorization: `Bearer ${tokens[token_no]}` },
          };
          var {data} = await axios.get(
            `https://api.github.com/repos/${repo_owner}/${repo_name}/issues?state=all&per_page=${ISSUE_NO_PER_FETCH}&page=${page_no}`,
            config
          );
  
          // These are the strings that will eventually be written to data/../issues.json or data/../pulls.js
          var str_issues = "";
          var str_prs = "";
  
          if( data.length> 0) {
              // For each commit, get the necessary information and append it to str_issues or str_prs
              for (var index in data) {
                  const issue_or_pr = data[index];
  
                  if ("pull_request" in issue_or_pr) {
                    // Then it is a PR
                    str_prs += JSON.stringify(issue_or_pr);
                    str_prs += "\n";
                  } else {
                    // it is an issue
                    str_issues += JSON.stringify(issue_or_pr);
                    str_issues += "\n";
                  }
              }
  
              if( str_issues != "") {
                  fs.appendFileSync(path_issues, str_issues);
                  console.log(`\n${(page_no -1) * ISSUE_NO_PER_FETCH + data.length }th issue written`);
              }
  
              if( str_prs != "") {
                  fs.appendFileSync(path_prs, str_prs);
                  console.log(`\n${(page_no -1) * ISSUE_NO_PER_FETCH + data.length }th pr written`);
              }
  
              page_no++;
          } else {
              // if the data is empty, then we have fetched everything
              console.log(
                  `ISSUES & PRs:Fethced all issues and pull requests of ${repo_owner}/${repo_name} and extracted them to ${path_issues} and ${path_prs}`
              );
              fs.appendFileSync(log_path, 
                  `ISSUES & PRs: Fetcced all issues and pull requests of ${repo_owner}/${repo_name} and extracted them to ${path_issues} and ${path_prs}\n`  
              );
              terminated_sucessfully = true
              break;
          }
     
      } catch (e) {
          // the token might have been expired
          if(e.response.status == 403 ) {
              fs.appendFileSync(log_path, `\nISSUES & PRs: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
              console.log(`ISSUES & PRs: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
              token_no += 1;
              token_no = token_no % tokens.length
    
              // if we have tried every token, let's wait for 15 minutes before trying again
              if(token_no == 0) {
                fs.appendFileSync(log_path, `\nISSUES & PRs: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
                console.log( `ISSUES & PRs: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
                await sleep(60000*15); 
                fs.appendFileSync(log_path, `\nISSUES & PRs: Waking up. time:  ${new Date()} \n`);
                console.log(`ISSUES & PRs: Waking up. time:  ${new Date()} \n`);
              }
          } else {
              // might be a server error or something else might have gone wrong
              fs.appendFileSync(log_path, `\nISSUES & PRs: Something went wrong! ${e.message} \n`);
              console.log( `Something went wrong! ${e.message} \n`);
          }
  
          // Whatever happens, when an error is caught, it is handled
  
      }
  
    }
  
    return terminated_sucessfully;
  }
  
  export {get_issues_and_prs};