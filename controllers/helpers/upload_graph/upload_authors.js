const upload_authors = async (authors, session)=> {
    var loading = 0;
    for (const author of authors) {
      var authorLogin = author;
      const res = await session.executeWrite((tx) =>
        tx.run(
          `CREATE (u:Author {authorLogin: $authorLogin})
           RETURN u
          `,
          { authorLogin }
        )
      );
      loading++;
      if (loading % Math.ceil(authors.size / 10) == 0) {
        console.log(
          "Authors uploading: " +
            Math.ceil((loading / (authors.size / 10)) * 10) +
            "%"
        );
      }
    }
    console.log("Authors uploaded");
}

export {upload_authors};
