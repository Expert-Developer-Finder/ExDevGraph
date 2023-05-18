const upload_authors = async (authors, namesAndEmails , session)=> {
    var loading = 0;
    for (const author of authors) {
      var authorLogin = author;
      let email = "";
      if (namesAndEmails.hasOwnProperty(authorLogin))
        email = namesAndEmails[authorLogin];
      const res = await session.executeWrite((tx) =>
        tx.run(
          `CREATE (u:Author {authorLogin: $authorLogin, email: $email})
           RETURN u
          `,
          { authorLogin, email }
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
