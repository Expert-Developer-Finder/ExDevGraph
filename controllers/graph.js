import fs from "fs";
import fss from "fs/promises";
import neo4j from "neo4j-driver";
import dotenv from "dotenv";
import { graph_pulls_create, fetchPatchData } from "./patch.js";
import { fetchReviewData_invaldJson, graph_review_create } from "../controllers/reviews.js";
import {
  upload_authors,
  upload_commits,
  upload_COMMITTED_BY_relation,
  upload_files,
  upload_folders,
  upload_FOFI_relation,
  upload_FOFO_relation,
  upoad_ADDED_FILE_relation,
  get_commits,
  get_issues_and_prs,
  get_pr_patchs,
  get_rest_commits,
  get_tree,
  get_methods
}from "./helpers/index.js";
import { check_and_create_file } from "./helpers/helpers.js";


dotenv.config();

// This method will be called by the api and immediately return a response.
// Then, asynchronously, the graph will started to be created
export const startCreateGraph = async (req, res) => {
  const { repoOwner, repoName, tokens, branch } = req.body;
  createGraph(repoOwner, repoName, tokens, branch);
  return res.status(200).json({
    message:
      "Graph creation process has been started and will continue in parallel",
  });
};

export const createGraph = async (repo_owner, repo_name, tokens, branch) => {
  try {
    // Make sure the path exists
    await fss.mkdir(
      `./data/${repo_owner}/${repo_name}`,
      { recursive: true },
      (err) => {
        if (err) return res.status(404).json({ message: err.message });
      }
    );

    // Make sure the files exists, else create the files
    const commits = `./data/${repo_owner}/${repo_name}/commits.json`;
    const rest_commits = `./data/${repo_owner}/${repo_name}/rest_commits.json`;
    const issues = `./data/${repo_owner}/${repo_name}/issues.json`;
    const pulls = `./data/${repo_owner}/${repo_name}/pulls.json`;
    const tree = `./data/${repo_owner}/${repo_name}/tree.json`;
    const patches = `./data/${repo_owner}/${repo_name}/patches.json`;
    const log = `./data/${repo_owner}/${repo_name}/log.txt`;
    const reviews = `./data/${repo_owner}/${repo_name}/reviews.json`;
    const methods = `./data/${repo_owner}/${repo_name}/methods.json`;

    await check_and_create_file(commits);
    await check_and_create_file(rest_commits);
    await check_and_create_file(issues);
    await check_and_create_file(pulls);
    await check_and_create_file(tree);
    await check_and_create_file(patches);
    await check_and_create_file(log);
    await check_and_create_file(reviews);
    await check_and_create_file(methods);
    console.log("Necessary files are created if they aready don't exist");


    // Fetch the data
    /** If the data already has been fetched, comment for the development */
    // await fetch_data(repo_owner, repo_name, methods, commits,rest_commits,issues,pulls,tree,patches,log,reviews, tokens, branch);
    // Upload the data to Neo4j
    await upload_graph(commits, tree, rest_commits, patches, reviews, methods);

    
    // Update the creating status of the repository
    // fetch(
    //   `${process.env.SERVER_BASE_URL}/repos/${repo_owner}/${repo_name}/update-status`,
    //   {
    //     method: "POST",
    //     body: JSON.stringify({ newStatus: "ready" }),
    //     headers: {
    //       "Content-type": "application/json; charset=UTF-8",
    //     },
    //   }
    // );
  } catch (error) {
    console.log('====================================');
    console.log("ERROR: " + error);
    console.log('====================================');
    // TODO: mail to us
  }
};

async function  fetch_data(repo_owner, repo_name, methods, commits, rest_commits,issues,pulls,tree,patches,log,reviews, tokens, branch) {
  console.log("Fetching Data");

  const methods_fetched = get_methods( repo_owner, repo_name, methods, log, "erhjker");
  await methods_fetched;


  // Similateniously collect every required data
  // const rest_commits_fetched = get_rest_commits( repo_owner, repo_name, rest_commits, log, tokens);
  // const commits_fetched = get_commits(repo_owner, repo_name, commits, log, tokens);
  // const issues_and_prs_fetched = get_issues_and_prs( repo_owner, repo_name, issues, pulls, log, tokens);
  // const tree_fetched = get_tree( repo_owner, repo_name, branch, tree, log, tokens);

  // // Wait for data fetching to end
  // await commits_fetched;
  // await rest_commits_fetched;
  // await issues_and_prs_fetched;
  // await tree_fetched;

  // // Only after issues_and_prs_fetched done, fetch the PR patches
  // //await get_pr_patchs(repo_owner, repo_name, patches, pulls, log, tokens);
  // await fetchPatchData(pulls, patches, tokens, repo_owner, repo_name);
  // await fetchReviewData_invaldJson(pulls, reviews, tokens, repo_owner, repo_name);
  // console.log("Data has been fetched");
}


// GRAPH CREATOR
async function upload_graph(
  path_commits,
  path_tree,
  path_rest_commits,
  patches_path,
  reviews_path,
  methods
) {
  // Create a Driver Instance
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

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
    let METHODS = new Set();
   

    // relations
    let COMMIT_AUTHOR = new Set();
    let FOLDER_FILE = new Set();
    let FOLDER_FOLDER = new Set();
    let COMMIT_FILE = new Set();
    let COMMIT_CREATED_METHOD = new Set();
    let COMMIT_MODIFIED_METHOD = new Set();

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

    var commitsAndGithubUsernames = {};
    const restCommitsLines = fs.readFileSync(path_rest_commits, "utf-8");
    restCommitsLines.split(/\r?\n/).forEach((line) => {
      if (line.length) {
        var commit = JSON.parse(line);
        try {
          var githubUsername = commit.author.login;
          const sha = commit["sha"];
          commitsAndGithubUsernames[sha] = githubUsername;
          // var item = {}
          // item[githubUsername] = [commit.commit.author.name, commit.commit.author.email];
          // authors.add(item);
        } catch (error) {}
      }
    });


    // read commits and add them to the commits set
    // also add the commit author relation to that set as well
    // finally, add which files are in which folder
    const commitsLines = fs.readFileSync(path_commits, "utf-8");
    commitsLines.split(/\r?\n/).forEach((line) => {
      if (line.length) {
        var commit = JSON.parse(line);

        var authorStr = commit["data"]["Author"];
        if (authorStr.indexOf("<") != -1) {
          authorStr = authorStr.split("<")[0];
          authorStr = authorStr.trim();
        }

        const sha = commit["data"]["commit"];

        const commitDate = commit["data"]["CommitDate"];

        var dateArray = commitDate.split(" ");
        const year = dateArray[4];
        const month = dateArray[1];
        var monthArray = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        var monthNumber = monthArray.indexOf(month);
        monthNumber = monthNumber + 1;

        commits.add([sha, year, monthNumber]);

        if (sha in commitsAndGithubUsernames) {
          authorStr = commitsAndGithubUsernames[sha];
        }

        authors.add(authorStr);
        COMMIT_AUTHOR.add([authorStr, commit["data"]["commit"]]);

        commit["data"]["files"].forEach((file) => {
          files.add(file["file"]);
          COMMIT_FILE.add([commit["data"]["commit"], file["file"]]);

          var folderPath = getFolderPath(file["file"]);
          FOLDER_FILE.add([folderPath, file["file"]]);
        });
      }
    });

    const methodsLines = fs.readFileSync(methods, "utf-8");
    var parsedMethodData = [];


    methodsLines.split(/\r?\n/).forEach((line) => {
      if (line.length) {
        var method = JSON.parse(line);
        parsedMethodData.push(method)
        
      }
    });

    //console.log(parsedMethodData.methods);

    parsedMethodData.forEach((method) => {
      console.log(method);
      METHODS.add([
        method.key,
        method.filePath,
        method.className,
        method.functionName,
        method.startLineFun.toString(),
        method.endLineFun.toString(),
      ]);
      COMMIT_CREATED_METHOD.add([method.shaCreatorCommit[0], method.key]);
      method["commitShas"].forEach((commitSha) => {
        COMMIT_MODIFIED_METHOD.add([commitSha, method.key]);
      });
    });


    console.log("No of authors: " + authors.size);
    console.log("No of commits: " + commits.size);
    console.log("No of files: " + files.size);
    console.log("No of folders: " + folders.size);
    console.log("No of COMMIT_AUTHOR: " + COMMIT_AUTHOR.size);
    console.log("No of COMMIT_FILE: " + FOLDER_FILE.size);
    console.log("No of FOLDER_FOLDER: " + FOLDER_FOLDER.size);

    await upload_authors(authors, session);
    await upload_commits(commits, session);
    await upload_files(files, session);
    await upload_folders(folders, session);

    await upload_FOFO_relation(FOLDER_FOLDER, session);
    await upload_FOFI_relation( FOLDER_FILE, session)
    await upload_COMMITTED_BY_relation(COMMIT_AUTHOR, session);
    await upoad_ADDED_FILE_relation(COMMIT_FILE, session);

    loading = 0;
    for (const method of METHODS) {
      var key = method[0];
      var filePath = method[1];
      var className = method[2];
      var functionName = method[3];
      var startLineFun = method[4];
      var endLineFun = method[5];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (m:Method {
              key: $key,
              filePath: $filePath,
              className: $className,
              functionName: $functionName,
              startLineFun: $startLineFun,
              endLineFun: $endLineFun

            })
            RETURN m
          `,
          { key, filePath, className, functionName, startLineFun, endLineFun }
        )
      );
      loading++;
      if (loading % Math.ceil(commits.size / 10) == 0) {
        console.log(
          "Methods uploading: " +
            Math.ceil((loading / (commits.size / 10)) * 10) +
            "%"
        );
      }
    }

    console.log("METHODS are Done");

    loading = 0;
    for (const commitCreatedMethod of COMMIT_CREATED_METHOD) {
      let shaCreatorCommitHash = commitCreatedMethod[0];
      let key = commitCreatedMethod[1];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (m:Method {key: $key})
            MATCH (c:Commit {hash: $shaCreatorCommitHash})

            MERGE (c)-[r:COMMIT_CREATED_METHOD]->(m)
            SET r.timestamp = timestamp()
          `,
          { shaCreatorCommitHash, key }
        )
      );
      loading++;
      if (loading % Math.ceil(COMMIT_AUTHOR.size / 10) == 0) {
        console.log(
          "COMMIT_CREATED_METHOD uploading: " +
            Math.ceil((loading / (COMMIT_AUTHOR.size / 10)) * 10) +
            "%"
        );
      }
    }

    console.log("COMMIT_CREATED_METHOD relation Done");
    

    var loading = 0;
    for (const commitModifiedMethod of COMMIT_MODIFIED_METHOD) {
      let shaModifierCommitHash = commitModifiedMethod[0];
      let key = commitModifiedMethod[1];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (m:Method {key: $key})
            MATCH (c:Commit {hash: $shaModifierCommitHash})

            MERGE (c)-[r:COMMIT_MODIFIED_METHOD]->(m)
            SET r.timestamp = timestamp()
          `,
          { shaModifierCommitHash, key }
        )
      );
      loading++;
      if (loading % Math.ceil(COMMIT_AUTHOR.size / 10) == 0) {
        console.log(
          "COMMIT_MODIFIED_METHOD uploading: " +
            Math.ceil((loading / (COMMIT_AUTHOR.size / 10)) * 10) +
            "%"
        );
      }
    }

    console.log("COMMIT_MODIFIED_METHOD relation Done");
    
    //Be careful! This is an async function and has to be run after authors and commits are created!
    await graph_pulls_create(patches_path, session);
    console.log("Pull Request data uploaded.");
    await graph_review_create(reviews_path, session);
    console.log("Review data uploaded.");


    console.log("GRAPH CREATED!");
    await session.close();
  } catch (error) {
    console.log(error.message);
  }
}
