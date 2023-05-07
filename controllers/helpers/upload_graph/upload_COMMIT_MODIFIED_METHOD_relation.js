const upload_COMMIT_MODIFIED_METHOD_relation = async (
  COMMIT_MODIFIED_METHOD,
  COMMIT_AUTHOR,
  session
) => {
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
};

export { upload_COMMIT_MODIFIED_METHOD_relation };
