const upload_COMMITTED_BY_relation = async(COMMIT_AUTHOR, session)=> {
    var loading = 0;
    for (const commitData of COMMIT_AUTHOR) {
      let authorD = commitData[0];
      let commitD = commitData[1];
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (u:Author {authorLogin: $authorD})
            MATCH (m:Commit {hash: $commitD})
            MERGE (m)-[r:COMMITTED_BY]->(u)
          `,
          { authorD, commitD }
        )
      );
      loading++;
      if (loading % Math.ceil(COMMIT_AUTHOR.size / 10) == 0) {
        console.log(
          "COMMIT_AUTHOR uploading: " +
            Math.ceil((loading / (COMMIT_AUTHOR.size / 10)) * 10) +
            "%"
        );
      }
    }
    console.log("COMMITTED_BY relation Done");

}

export {upload_COMMITTED_BY_relation}