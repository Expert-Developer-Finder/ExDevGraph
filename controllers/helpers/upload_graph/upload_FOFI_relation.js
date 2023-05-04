const upload_FOFI_relation = async(FOLDER_FILE, session)=> {
    var loading = 0;
    for (const insideData of FOLDER_FILE) {
      let folderData = insideData[0];
      let fileData = insideData[1];

      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (u:Folder {path: $folderData})
            MATCH (m:File {path: $fileData})

            MERGE (m)-[:INSIDE_FOFI]->(u)
          `,
          { folderData, fileData }
        )
      );
      loading++;
      if (loading % Math.ceil(FOLDER_FILE.size / 10) == 0) {
        console.log(
          "FOLDER_FILE uploading: " +
            Math.ceil((loading / (FOLDER_FILE.size / 10)) * 10) +
            "%"
        );
      }
    }
    console.log("INSIDE_FOFI relation uploaded");
}

export {upload_FOFI_relation}