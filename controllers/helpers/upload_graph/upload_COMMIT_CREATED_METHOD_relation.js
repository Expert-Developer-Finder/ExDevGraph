const upload_COMMIT_CREATED_METHOD_relation = async (
  COMMIT_CREATED_METHOD,
  COMMIT_AUTHOR,
  session
) => {
  var loading = 0;
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
};

export { upload_COMMIT_CREATED_METHOD_relation };
