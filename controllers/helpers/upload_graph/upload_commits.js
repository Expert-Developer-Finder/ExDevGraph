const upload_commits = async (commits, session)=> {
    var loading = 0;
    for (const commit of commits) {
      var hash = commit[0];
      var year = commit[1];
      year = parseInt(year);
      var monthNumber = commit[2];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            CREATE (c:Commit {
              hash: $hash,
              year: $year,
              month: $monthNumber
            })
            RETURN c
          `,
          { hash, year, monthNumber }
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
