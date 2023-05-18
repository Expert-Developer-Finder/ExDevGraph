const upload_ADDED_FILE_relation = async (COMMIT_FILE, session) => {
    var loading = 0;
    for (const file of COMMIT_FILE) {
      let commitHash = file[0];
      let path = file[1];
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (c:Commit {hash: $commitHash})
            MATCH (f:File {path: $path})
            MERGE (c)-[r:ADDED_FILE]->(f)
          `,
          { commitHash, path }
        )
      );
      loading++;
      if (loading % Math.ceil(COMMIT_FILE.size / 10) == 0) {
        console.log(
          "ADDED_FILE uploading: " +
            Math.ceil((loading / (COMMIT_FILE.size / 10)) * 10) +
            "%"
        );
      }
    }

    console.log("ADDED_FILE relation uploaded");

}

export {upload_ADDED_FILE_relation}