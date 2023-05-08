import fs from "fs";


async function upload_pulls(path_patches, session) {
    //MERGE PRS
    const pullsLines = JSON.parse(fs.readFileSync(path_patches, "utf-8"));
    const maxCount = pullsLines.length;
    var currentCount = 0;
    for (var pr of pullsLines) {
      var prDate = pr.closed_at;
      var prTitle = pr.title;
      var prNumber = pr.number;
  
      currentCount++;
      console.log(`Uploading PR Data ${(currentCount / maxCount * 100).toPrecision(2)}%`);
  
      try {
        //Create Pull node
        const res1 = await session.executeWrite((tx) =>
          tx.run(
            `
                  CREATE (u:Pull{
                      prNumber: $prNumber,
                      prTitle: $prTitle,
                      prDate: $prDate
                  })RETURN u`,
            { prNumber, prTitle, prDate }
          )
        );
  
        //Create connections for every commit and author
        for (const patch of pr.patch) {
          var prSubmitterLogin = pr.user.login;

          var prAuthorName = patch.authorName;
          var prAuthorEmail = patch.authorEmail;

          var commit = patch.hash;
  
          //Create (Pull)-[SUBMITED_PR_BY]->(Author) relation
          const res2 = await session.executeWrite((tx) =>
            tx.run(
              `
                  MATCH (a:Author {authorLogin: $prSubmitterLogin})
                  MATCH (p:Pull {prNumber: $prNumber})
                  MERGE (p)-[:SUBMITED_PR_BY]->(a)`,
              { prSubmitterLogin, prNumber }
            )
          );
  
          //Create (Commit)-[CONTAINED_IN_PR]->(Pull) relation
          const res3 = await session.executeWrite((tx) =>
            tx.run(
              `
                  MATCH (p:Pull {prNumber: $prNumber})
                  MATCH (c:Commit {hash: $commit})
                  MERGE (c)-[:CONTAINED_IN_PR]->(p)`,
              { prNumber, commit }
            )
          );
        }
      } catch (error) {
        console.log("PR data upload failed. Issue Number: " + prNumber);
        console.log(error);
      }
    }

    console.log("Pull Request data uploaded.");

  }
  
  export {upload_pulls}
  