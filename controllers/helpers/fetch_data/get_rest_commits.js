import fs from 'fs';
import axios from  'axios';
import { sleep} from "../helpers.js";
import { log } from 'console';
const COMMIT_NO_PER_FETCH = 100;

async function get_rest_commits(repo_owner, repo_name, path_commits, log_path, tokens) {

    if(COMMIT_NO_PER_FETCH > 100) {
      throw  new Error("Issue no per fetch cannot be bigger than 100");
    }
  
    var no_of_commits_fetched_so_far = fs.readFileSync(path_commits, 'utf-8').split(/\r?\n/).length;
    var page_no = Math.floor(( no_of_commits_fetched_so_far )/ COMMIT_NO_PER_FETCH + 1);
    var token_no = 0;

  
    while (1) {
      try {
          // Get ISSUE_NO_PER_FETCH commits at a time
          const config = {
              headers: { Authorization: `Bearer ${tokens[token_no]}` },
          };
          var {data} = await axios.get(
            `https://api.github.com/repos/${repo_owner}/${repo_name}/commits?per_page=${COMMIT_NO_PER_FETCH}&page=${page_no}`,
            config
          );
  
          // These are the strings that will eventually be written to data/../commits_REST.json
          var str_commits = "";
  
          if( data.length> 0) {
              // For each commit, get the necessary information and append it to str_issues or str_prs
  
              for (var commit of data) {
                  str_commits += JSON.stringify(commit);
                  str_commits += "\n";
              }
  
              if( str_commits != "") {
                  fs.appendFileSync(path_commits, str_commits);
                  console.log(`\n${(page_no -1) * COMMIT_NO_PER_FETCH + data.length }th commit written`);
              }
  
              page_no++;
          } else {
              // if the data is empty, then we have fetched everything
              console.log(
                `COMMIT REST:Fethced all committs of ${repo_owner}/${repo_name} from REST API and extracted them to ${path_commits}`
              );
              fs.appendFileSync(log_path, 
                `COMMIT REST:Fethced all committs of ${repo_owner}/${repo_name} from REST API and extracted them to ${path_commits}\n`  
              );
              break;
          }
     
      } catch (e) {
          console.log(e);
          // the token might have been expired
          if(e.response.status == 403 ) {
              fs.appendFileSync(log_path, `\nCOMMIT REST: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
              console.log(`COMMIT REST:: TOKEN ${tokens[token_no]} WAS OVER! We changed the token and moved on!\n`);
              token_no += 1;
              token_no = token_no % tokens.length
    
              // if we have tried every token, let's wait for 15 minutes before trying again
              if(token_no == 0) {
                fs.appendFileSync(log_path, `\nCOMMIT REST:: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
                console.log( `COMMIT REST: ALL TOKENS WERE OVER! Sleeping for 15 minutes. Sleeping time ${new Date()} \n`);
                await sleep(60000*15); 
                fs.appendFileSync(log_path, `\nCOMMIT REST: Waking up. time:  ${new Date()} \n`);
                console.log(`COMMIT REST: Waking up. time:  ${new Date()} \n`);
              }
          } else {
              // might be a server error or something else might have gone wrong
              fs.appendFileSync(log_path, `\nCOMMIT REST: Something went wrong! ${e.message} \n`);
              console.log( `COMMIT REST: Something went wrong! ${e.message} \n`);
          }
          // Whatever happens, when an error is caught, it is handled
      }
    }
  }

  
export {get_rest_commits};