import fs from 'fs'
import fss from "fs/promises";
import axios from  'axios';
import {spawn} from 'child_process'
import neo4j, { Node, Relationship, Integer, auth } from 'neo4j-driver'
const ISSUE_NO_PER_FETCH = 100; // This can be at tops 100

// HELPERS


function sleep(time) {
    return new Promise(resolve => setTimeout(resolve, time));
} 

// bla

const check_and_ceate_file = async (path) => {
    try {
        if (!fs.existsSync(path)) {
            await fss.writeFile(path, "", (err) => {
                if (err) {
                    console.log(err);
                }
            });
            return;
        }
    } catch (err) {
        console.error(err);
        return;
    }
}

// This method will be called by the api and immediatelly return a response. 
// Then, asyncroniously, the graph will started to be created
export const startCreateGraph = async (req, res) => {
    const { repoOwner, repoName, tokens , branch} = req.body;
    createGraph(repoOwner, repoName, tokens, branch);
    return res.status(200).json({"message": "Graph creation process has been started and will continue in parallel"})
}

export const createGraph = async (repo_owner, repo_name, tokens, branch ) => {
    try {
        // Make sure the path exists
        await fss.mkdir(`./data/${repo_owner}/${repo_name}`, { recursive: true }, (err) => {
            if (err) return res.status(404).json({"message": err.message});
        })

        // // Make sure the files exists, else create the files
        // //const commitsREST = `./data/${repo_owner}/${repo_name}/commits_REST.json`;
        const commits = `./data/${repo_owner}/${repo_name}/commits.json`;
        const issues = `./data/${repo_owner}/${repo_name}/issues.json`;
        const pulls = `./data/${repo_owner}/${repo_name}/pulls.json`;
        const tree = `./data/${repo_owner}/${repo_name}/tree.json`;
        const log = `./data/${repo_owner}/${repo_name}/log.txt`;

        // //await check_and_ceate_file (commitsREST); 
        await check_and_ceate_file (commits); 
        await check_and_ceate_file (issues);  
        await check_and_ceate_file (pulls);   
        await check_and_ceate_file (tree);   
        await check_and_ceate_file (log); 

        // Similateniously collect every required data
        //const commits_REST_fetched = get_commits_REST(repo_owner, repo_name, commitsREST, log, tokens);
        const commits_fetched = get_commits(repo_owner, repo_name, commits, log, tokens)
        const issues_and_prs_fetched = get_issues_and_prs(repo_owner, repo_name, issues, pulls, log, tokens);
        const tree_fetched = get_tree(repo_owner, repo_name, branch,  tree, log, tokens);
        
        // Wait for data fetching to end
        // await commits_REST_fetched;
        await commits_fetched;
        await issues_and_prs_fetched;
        await tree_fetched;

        console.log("Data has been fetched");

        /** THE DATA HAS BEEN FETCHED **/
        await upload_graph(commits, tree)

        // Update the creating status of the repository
        fetch(`${process.env.SERVER_BASE_URL}/repos/${repo_owner}/${repo_name}/update-status`, {
          method: "POST",
          body: JSON.stringify({"newStatus" : "ready"}),
          headers: {
              "Content-type": "application/json; charset=UTF-8"
          }
        }) 

    } catch (error) {
        // Something has gone wrong during the data retrieval!
        // TODO: mail to us
        
    }

};

// GRAPH CREATOR
async function upload_graph(path_commits, path_tree) {
    // Create a Driver Instance
  const uri="neo4j+s://8c4cdf6a.databases.neo4j.io"
  const user="neo4j"
  const password="exdev2001"


  console.log("Uploading graph");
  console.log('====================================');
  
  // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session()

  // given a path, returns the path minus the last directory
  function getFolderPath(filePath) {
    // Split the file path into an array of directories and file name
    let pathArray = filePath.split("/");

    // Remove the empty string at the beginning of the array
    //pathArray.shift();

    //Get last element
    let last = pathArray[pathArray.length - 1];

    if (last.includes(".")) {
      pathArray.pop();
    } else {
      pathArray.pop();
    }

    if (pathArray.length == 0) return "";

    // Join the remaining directories into a new file path string
    let newFilePath = pathArray.join("/");

    return newFilePath;
  }

  try {
    // nodes
    let authors = new Set()
    let commits = new Set()
    let folders = new Set();
    let files = new Set()

    // relations
    let COMMITED_BY = new Set()
    let INSIDE = new Set();
    let RELATION_FOLDER_FOLDER = new Set();

    let folderData = JSON.parse(fs.readFileSync(path_tree))["tree"];

    folderData.forEach((element) => {
      if (element.type == "tree") {
        folders.add(element);
      }
    });

    folders.forEach((folder) => {
      if (folder.path.includes("/")) {
        var parentFolderPath = getFolderPath(folder.path); //for example perceval/backend returns perceval
        if (parentFolderPath != "") {
          RELATION_FOLDER_FOLDER.add([parentFolderPath, folder.path]);
        }
      }
    });


    const commitsLines = fs.readFileSync(path_commits, 'utf-8');
    commitsLines.split(/\r?\n/).forEach(line =>  {
        if (line.length) {
            var commit = JSON.parse(line)

            var authorStr = commit["data"]["Author"]
            if (authorStr.indexOf("<")!= -1) {
                authorStr = authorStr.split("<")[0]
                authorStr = authorStr.trim()

            }
            
            authors.add(authorStr)
            commits.add(commit["data"]["commit"])
            COMMITED_BY.add([authorStr, commit["data"]["commit"]])
  
            commit["data"]["files"].forEach( file =>{
                files.add([commit["data"]["commit"], file["file"]])

                var folderPath = getFolderPath(file["file"]);
                INSIDE.add([folderPath, file["file"]]);
            })
        

        }

    });

    // console.log(authors);
    // console.log(commits);
    // console.log(COMMITED_BY);
    //console.log(files);

    for (const author of authors) {
      const res = await session.executeWrite(
        tx => tx.run(
          `CREATE (u:Author {authorName: $author})
           RETURN u
          `,
        { author }
        )
      )
    }
  
    console.log("Authors Done")
  
    console.log('====================================')
    console.log("Commits size: " + commits.size);

    for (const commit of commits) {
      const res = await session.executeWrite(
        tx => tx.run(
          `
            CREATE (c:Commit {
              hash: $commit
            })
            RETURN c
          `,
          { commit }
        )
      )
    }
    console.log("Commits Done")

    for (const file of files) {
      console.log(file);
      let fileData = file[1];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (c:File {
              path: $fileData
            })
            RETURN c
          `,
          { fileData }
        )
      );
    }

    console.log("Files Done");

    for (const folder of folders) {
      let folderPath = folder.path;
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (c:Folder {
              path: $folderPath
            })
            RETURN c
          `,
          { folderPath }
        )
      );
    }

    console.log("Folders Done");

    for (const relation_ff of RELATION_FOLDER_FOLDER) {
      let parentFolderData = relation_ff[0];
      let folderData = relation_ff[1];
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
        MATCH (u:Folder {path: $parentFolderData})
        MATCH (m:Folder {path: $folderData})

        MERGE (m)-[:INSIDE_FOFO]->(u)

      `,
          { parentFolderData, folderData }
        )
      );
    }
    console.log("Folder Folder Relation Done");

    console.log(INSIDE);
    for (const insideData of INSIDE) {
      let folderData = insideData[0];
      let fileData = insideData[1];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (u:Folder {path: $folderData})
            MATCH (m:File {path: $fileData})

            MERGE (m)-[:INSIDE_FOFI]->(u)

          `,
          { folderData, fileData }
        )
      );
    }
    console.log("Folder-File Relation Done");

    for (const commitData of COMMITED_BY) {
      let authorD = commitData[0];
      let commitD = commitData[1];
      let weight = 1;
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (u:Author {authorName: $authorD})
            MATCH (m:Commit {hash: $commitD})

            MERGE (m)-[r:COMMITED_BY]->(u)
            SET r.weight = $weight,
                r.timestamp = timestamp()

          `,
          { authorD, commitD, weight }
        )
      );
    }
    console.log("Authors-Commit Relation Done");
  
    for (const file of files) {

      console.log(file);
      let commitHash = file[0]
      let path = file[1]
      let weight = 1
      const res = await session.executeWrite(
        tx => tx.run(
          `
            MATCH (c:Commit {hash: $commitHash})
            MATCH (f:File {path: $path})

            MERGE (c)-[r:ADDED_FILE]->(f)
            SET r.weight = $weight,
                r.timestamp = timestamp()

          `,
          { commitHash, path, weight }
        )
      )
    }

    console.log("commit-File Add Relation Done")

    await session.close()
    console.log("Done")

  }
  catch (error) {
    console.log(error.message);
  }
}

// DATA FETCHERS
function get_commits(repo_owner, repo_name, path_commits, path_log) {
    return new Promise((resolve, reject) => {
      
        var process = spawn('python3',["./controllers/perceval_git.py", repo_owner, repo_name, path_commits, path_log] );        
        fs.writeFileSync(path_commits, "")

        process.stdout.on('data', function(data) {
            var dataStr =  data.toString()
            fs.appendFileSync(path_commits,  dataStr )
        } )    

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
            fs.appendFileSync(path_log, data.toString())
        });
        
        process.stdout.on('close', (code) => {
            console.log("COMMITS: finished");
            fs.appendFileSync(path_log, "\nCOMMITS: Finished fetching")
            resolve(code);
        } ) 
    });
}

async function get_tree(repo_owner, repo_name, branch, path_tree, log_path, tokens) {
    console.log(repo_owner);
    console.log(repo_name);
    try {
        const config = {
            headers: { Authorization: `Bearer ${tokens[0]}` },
        };
        var {data} = await axios.get(
            `https://api.github.com/repos/${repo_owner}/${repo_name}/git/trees/${branch}?recursive=1`
        );


        fs.writeFileSync(path_tree, JSON.stringify(data));

        console.log(
            `TREE: Fethced tree of files and folder of ${repo_owner}/${repo_name} and extracted them to ${path_tree}`
        );
        fs.appendFileSync(log_path, 
            `\nTREE: Fethced tree of files and folder of ${repo_owner}/${repo_name} and extracted them to ${path_tree}`
        );
    } catch (error) {
        // if the data is empty, then we have fetched everything
        console.log(
            `TREE: Error occured while fetching the tree of ${repo_owner}/${repo_name}: ${error.message}`
        );
        fs.appendFileSync(log_path, 
            `\nTREE: Error occured while fetching the tree of ${repo_owner}/${repo_name}: ${error.message}`
        );
    }
   

}

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
                `\nISSUES & PRs: Fethced all issues and pull requests of ${repo_owner}/${repo_name} and extracted them to ${path_issues} and ${path_prs}\n`  
            );
            terminated_sucessfully = true
            break;
        }
   
    } catch (e) {
        // the token might have been expired
        if(e.response.status == 403 ) {
            fs.appendFileSync(log_path, `\nISSUES & PRs: TOKEN ${ALL_TOKENS[token_no]} WAS OVER! We changed the token and moved on!\n`);
            console.log(`ISSUES & PRs: TOKEN ${ALL_TOKENS[token_no]} WAS OVER! We changed the token and moved on!\n`);
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

async function get_commits_REST(repo_owner, repo_name, path_commits, log_path, tokens) {
  console.log("COMMITS REST");
  if(ISSUE_NO_PER_FETCH > 100) {
    throw  new Error("Issue no per fetch cannot be bigger than 100");
  }

  var no_of_commits_fetched_so_far = fs.readFileSync(path_commits, 'utf-8').split(/\r?\n/).length;
  var page_no = Math.floor(( no_of_commits_fetched_so_far )/ ISSUE_NO_PER_FETCH + 1);
  var token_no = 0;

  var terminated_sucessfully = false;

  while (1) {
    try {
        // Get ISSUE_NO_PER_FETCH commits at a time
        const config = {
            headers: { Authorization: `Bearer ${tokens[token_no]}` },
        };
        var {data} = await axios.get(
          `https://api.github.com/repos/${repo_owner}/${repo_name}/commits?per_page=${ISSUE_NO_PER_FETCH}&page=${page_no}`,
          config
        );

        // These are the strings that will eventually be written to data/../commits_REST.json
        var str_commits = "";



        if( data.length> 0) {
            // For each commit, get the necessary information and append it to str_issues or str_prs

         
            for (var commit of data) {
                var commit_trimmed = {}

                var githubUsername = ""
                
                console.log("Hİ " + commit["sha"]);
                try {
                  const author = commit["author"]
                  const committer = commit["committer"]
                  if(author != null && author != undefined) {
                    console.log("here");
                    githubUsername = author["login"]
                  } else  if(committer != null && committer != undefined) {
                    console.log("here2");
                    githubUsername = committer["login"]
                  } else {
                    console.log("olmadı");

                  }
                  
                } catch (error) {
                  console.log(error.message);
                }

                commit_trimmed[commit["sha"]] = githubUsername
                str_commits += JSON.stringify(commit_trimmed);
                //str_commits += JSON.stringify(commit);
                str_commits += "\n";
            }

            if( str_commits != "") {
                fs.appendFileSync(path_commits, str_commits);
                console.log(`\n${(page_no -1) * ISSUE_NO_PER_FETCH + data.length }th commit written`);
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
            terminated_sucessfully = true
            break;
        }
   
    } catch (e) {
        // the token might have been expired
        if(e.response.status == 403 ) {
            fs.appendFileSync(log_path, `\nCOMMIT REST: TOKEN ${ALL_TOKENS[token_no]} WAS OVER! We changed the token and moved on!\n`);
            console.log(`COMMIT REST:: TOKEN ${ALL_TOKENS[token_no]} WAS OVER! We changed the token and moved on!\n`);
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

  return terminated_sucessfully;
}




