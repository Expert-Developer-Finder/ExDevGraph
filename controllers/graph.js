import fs from 'fs';
import fss from "fs/promises";
import axios from  'axios';
import neo4j, { Node, Relationship, Integer, auth } from 'neo4j-driver';
import {check_and_create_file, sleep} from "./helpers/helpers.js";
import {get_commits} from "./helpers/get_commits.js";
import { get_tree } from './helpers/get_tree.js';
import { get_issues_and_prs } from './helpers/get_issues_and_prs.js';
import {get_pr_patchs} from "./helpers/get_pr_patchs.js";
import dotenv from "dotenv";

dotenv.config();

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
        const patches = `./data/${repo_owner}/${repo_name}/patches.json`;
        const log = `./data/${repo_owner}/${repo_name}/log.txt`;

        // //await check_and_ceate_file (commitsREST); 
        await check_and_create_file (commits); 
        await check_and_create_file (issues);  
        await check_and_create_file (pulls);   
        await check_and_create_file (tree);   
        await check_and_create_file (patches);   
        await check_and_create_file (log); 

        // // Similateniously collect every required data
        // const commits_fetched = get_commits(repo_owner, repo_name, commits, log, tokens)
        // const issues_and_prs_fetched = get_issues_and_prs(repo_owner, repo_name, issues, pulls, log, tokens);
        // const tree_fetched = get_tree(repo_owner, repo_name, branch,  tree, log, tokens);
        
        // // Wait for data fetching to end
        // await commits_fetched;
        // await issues_and_prs_fetched;
        // await tree_fetched;
        // // Only after issues_and_prs_fetched done, fetch the PR patches
        // await get_pr_patchs(repo_owner, repo_name, patches, pulls, log, tokens);

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
  const uri= process.env.NEO_URI;
  const user= process.env.NEO_USER;
  const password = process.env.NEW_PWD;

  console.log("Uploading graph");
  
  // Connect to Neo4j
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  // given a path, returns the path minus the last directory
  // e.g. "src/views/file.js" => "src/views"
  function getFolderPath(filePath) {
    // Split the file path into an array of directories and file name
    let pathArray = filePath.split("/");
    pathArray.pop();
    if (pathArray.length == 0) return "";
    return pathArray.join("/");
  }

  try {
    // nodes
    let authors = new Set();
    let commits = new Set();
    let folders = new Set();
    let files = new Set();

    // relations
    let COMMIT_AUTHOR = new Set()
    let FOLDER_FILE = new Set();
    let FOLDER_FOLDER = new Set();
    let COMMIT_FILE = new Set();

    // Add the folders to the folders set
    let folderData = JSON.parse(fs.readFileSync(path_tree))["tree"];
    folderData.forEach((element) => {
      if (element.type == "tree") {
        folders.add(element);
      }
    });

    // for each folder, add the folder folder relation a 
    // list like as follows: [parent_folder_dir, full_folder_dir].
    // e.g. "src/views/home" => ["src/views" ,"src/views/home"]
    folders.forEach((folder) => {
      if (folder.path.includes("/")) {
        var parentFolderPath = getFolderPath(folder.path); //for example perceval/backend returns perceval
        if (parentFolderPath != "") {
          FOLDER_FOLDER.add([parentFolderPath, folder.path]);
        }
      }
    });

    // read commits and add them to the commits set
    // also add the commit author relation to that set as well
    // finally, add which files are in which folder
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
            COMMIT_AUTHOR.add([authorStr, commit["data"]["commit"]])
  
            commit["data"]["files"].forEach( file =>{
                files.add( file["file"]);
                COMMIT_FILE.add([commit["data"]["commit"], file["file"]]);

                var folderPath = getFolderPath(file["file"]);
                FOLDER_FILE.add([folderPath, file["file"]]);
            });
        }

    });

    console.log("No of authors: " + authors.size);
    console.log("No of commits: " + commits.size);
    console.log("No of files: " + files.size);
    console.log("No of folders: " + folders.size);
    console.log("No of COMMIT_AUTHOR: " + COMMIT_AUTHOR.size);
    console.log("No of COMMIT_FILE: " + FOLDER_FILE.size);
    console.log("No of FOLDER_FOLDER: " + FOLDER_FOLDER.size);

    var loading = 0;
    for (const author of authors) {
      const res = await session.executeWrite(
        tx => tx.run(
          `CREATE (u:Author {authorName: $author})
           RETURN u
          `,
        { author }
        )
      );
      loading++;
      if (loading % Math.ceil( authors.size / 10) == 0) {
        console.log("Authors uploading: " + Math.ceil(loading / (authors.size / 10)* 10) + "%");
      }
    }
    console.log("Authors uploaded");

    loading = 0;
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
      );
      loading++;
      if (loading % Math.ceil( commits.size / 10) == 0) {
        console.log( "Commits uploading: " + Math.ceil(loading / (commits.size / 10)* 10) + "%");
      }
    }
    console.log("Commits uploaded");

    loading = 0;
    for (const file of files) {
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (c:File {
              path: $file
            })
            RETURN c
          `,
          { file }
        )
      );
      loading++;
      if (loading % Math.ceil( files.size / 10) == 0) {
        console.log( "Files uploading: " + Math.ceil(loading / (files.size / 10)* 10) + "%");
      }
    }
    console.log("Files uploaded");

    loading = 0;
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
      loading++;
      if (loading % Math.ceil( folders.size / 10) == 0) {
        console.log( "Folders uploading: " + Math.ceil(loading / (folders.size / 10)* 10) + "%");
      }
    }
    console.log("Folders uploaded");

    loading = 0;
    for (const relation_ff of FOLDER_FOLDER) {
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
      loading++;
      if (loading % Math.ceil( FOLDER_FOLDER.size / 10) == 0) {
        console.log( "FOLDER_FOLDER uploading: " + Math.ceil(loading / (FOLDER_FOLDER.size / 10)* 10) + "%");
      }
    }
    console.log("INSIDE_FOFO relation uploaded");

    loading = 0;
    for (const insideData of FOLDER_FILE) {
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
      loading++;
      if (loading % Math.ceil( FOLDER_FILE.size / 10) == 0) {
        console.log( "FOLDER_FILE uploading: " + Math.ceil(loading / (FOLDER_FILE.size / 10)* 10) + "%");
      }
    }
    console.log("INSIDE_FOFI relation uploaded");

    loading = 0;
    for (const commitData of COMMIT_AUTHOR) {
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
      loading++;
      if (loading % Math.ceil( COMMIT_AUTHOR.size / 10) == 0) {
        console.log( "COMMIT_AUTHOR uploading: " + Math.ceil(loading / (COMMIT_AUTHOR.size / 10)* 10) + "%");
      }
    }
    console.log("COMMITED_BY relation Done");
  
    loading = 0;
    for (const file of COMMIT_FILE) {
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
      );
      loading++;
      if (loading % Math.ceil( COMMIT_FILE.size / 10) == 0) {
        console.log( "COMMIT_FILE uploading: " + Math.ceil(loading / (COMMIT_FILE.size / 10)* 10) + "%");
      }
    };

    console.log("ADDED_FILE relation uploaded");

    
    console.log("GRAPH CREATED!");
    await session.close();

  }
  catch (error) {
    console.log(error.message);
  }
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

  return terminated_sucessfully;
}




