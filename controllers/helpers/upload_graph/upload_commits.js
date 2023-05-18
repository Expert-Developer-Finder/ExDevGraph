const upload_commits = async (commits, session)=> {
    var loading = 0;
    for (const commit of commits) {
      var sha = commit[0];
      var millis = commit[1];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (c:Commit {
              hash: $sha,
              millis: $millis
            })
            RETURN c
          `,
          { sha, millis }
        )
      );
      loading++;
      if (loading % Math.ceil(commits.size / 10) == 0) {
        console.log(
          "Commits uploading: " +
            Math.ceil((loading / (commits.size / 10)) * 10) +
            "%"
        );
      }
    }
    console.log("Commits uploaded");
}

export {upload_commits};
