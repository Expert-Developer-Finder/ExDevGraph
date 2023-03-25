import neo4j, { Node, Relationship } from "neo4j-driver";
import { Integer } from "neo4j-driver";
import fs from "fs";
import dotenv from "dotenv";
async function main() {
  dotenv.config({ path: "NeoProto\\credentials-96f0cd65.env" });

  // Create a Driver Instance
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  // To learn more about the driver: https://neo4j.com/docs/javascript-manual/current/client-applications/#js-driver-driver-object
  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  var folderPath =
    "https://api.github.com/repos/chaoss/grimoirelab-perceval/contents/perceval/backends/core";

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
    let authors = new Set();
    let commits = new Set();
    let COMMITED_BY = new Set();
    let files = new Set();
    let filesAdded = new Set();
    let filesDeleted = new Set();
    let filesModified = new Set();

    let INSIDE = new Set();

    let RELATION_FOLDER_FOLDER = new Set();

    let folders = new Set();

    let rawdata = fs.readFileSync(
      "C:\\Users\\boraa\\REACT\\ExDevAux\\gitdata.json"
    );
    let gitData = JSON.parse(rawdata);

    let rawFolderContentData = fs.readFileSync(
      "C:\\Users\\boraa\\REACT\\ExDevAux\\folder_content_json.json"
    );

    let folderData = JSON.parse(rawFolderContentData);

    folderData = folderData["tree"];

    folderData.forEach((element) => {
      if (element.type == "tree") {
        folders.add(element);
      }
    });

    folders.forEach((folder) => {
      //console.log(folder.path);
      if (folder.path.includes("/")) {
        var parentFolderPath = getFolderPath(folder.path); //for example perceval/backend returns perceval
        if (parentFolderPath != "") {
          RELATION_FOLDER_FOLDER.add([parentFolderPath, folder.path]);
        }
      }
    });

    gitData.forEach((element) => {
      authors.add(element.authorName);
      commits.add(element.hash);
      COMMITED_BY.add([element.authorName, element.hash]);

      element.filesAdded.forEach((file) => {
        filesAdded.add([element.hash, file.path]);
        files.add(file.path);

        var folderPath = getFolderPath(file.path);
        //console.log(folderPath);

        INSIDE.add([folderPath, file.path]);
      });
      element.filesDeleted.forEach((file) => {
        filesDeleted.add([element.hash, file.path]);
        files.add(file.path);
      });
      element.filesModified.forEach((file) => {
        filesModified.add([element.hash, file.path]);
        files.add(file.path);
      });
    });

    console.log(`authors bys ${authors.size}`);
    console.log(`commits ${commits.size}`);
    console.log(`commited bys ${COMMITED_BY.size}`);

    for (const author of authors) {
      const res = await session.executeWrite((tx) =>
        tx.run(
          `CREATE (u:Author {authorName: $author})
           RETURN u
          `,
          { author }
        )
      );
    }

    console.log("Authors Done");

    for (const commit of commits) {
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (c:Commit {
              hash: $commit
            })
            RETURN c
          `,
          { commit }
        )
      );
    }
    console.log("Commits Done");

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

        MERGE (m)-[:INSIDE]->(u)

      `,
          { parentFolderData, folderData }
        )
      );
    }
    console.log("Folder Folder Relation Done");

    for (const insideData of INSIDE) {
      let folderData = insideData[0];
      let fileData = insideData[1];
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (u:Folder {path: $folderData})
            MATCH (m:File {path: $fileData})

            MERGE (m)-[:INSIDE]->(u)

          `,
          { folderData, fileData }
        )
      );
    }
    console.log("Folder-File Relation Done");

    for (const commitData of COMMITED_BY) {
      let authorD = commitData[0];
      //let authorName = authorD.authorName;
      //let authorEmail = authorD.authorEmail;
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

    for (const fileAdded of filesAdded) {
      let commitHash = fileAdded[0];
      let path = fileAdded[1];
      let weight = 1;
      const res = await session.executeWrite((tx) =>
        tx.run(
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
    }

    console.log("Authors-File Add Relation Done");

    for (const fileModified of filesModified) {
      let commitHash = fileModified[0];
      let path = fileModified[1];
      let weight = 1;
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (c:Commit {hash: $commitHash})
            MATCH (f:File {path: $path})

            MERGE (c)-[r:MODIFIED_FILE]->(f)
            SET r.weight = $weight,
                r.timestamp = timestamp()

          `,
          { commitHash, path, weight }
        )
      );
    }

    console.log("Authors-File Modify Relation Done");

    for (const fileDeleted of filesDeleted) {
      let commitHash = fileDeleted[0];
      let path = fileDeleted[1];
      let weight = 1;
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (c:Commit {hash: $commitHash})
            MATCH (f:File {path: $path})

            MERGE (c)-[r:DELETED_FILE]->(f)
            SET r.weight = $weight,
                r.timestamp = timestamp()

          `,
          { commitHash, path, weight }
        )
      );
    }
    console.log("Authors-File Delete Relation Done");
    console.log("Done");
  } finally {
    // Close the Session
    await session.close();
  }
}

// interface DeveloperProperties{
//   "authorName": string,
//   "authorEmail": string
// }

// type Developer = Node<Integer, DeveloperProperties>

// interface CommitProperties{
//   "hash": string,
//   "date": string,
//   "message": string,
// }

// type Commit = Node<Integer, CommitProperties>
main();