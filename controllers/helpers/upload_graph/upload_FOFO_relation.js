const upload_FOFO_relation = async (FOLDER_FOLDER, session)=> {
    var loading = 0;
    for (const relation_ff of FOLDER_FOLDER) {
      let parentFolderData = relation_ff[0];
      let folderData = relation_ff[1];
      const res = await session.executeWrite((tx) =>
        tx.run(
          `
            MATCH (u:Folder {path: $parentFolderData})
            MATCH (m:Folder {path: $folderData})

            MERGE (m)-[:INSIDE_FOFO]->(u)
          `,
          { parentFolderData, folderData }
        )
      );
      loading++;
      if (loading % Math.ceil(FOLDER_FOLDER.size / 10) == 0) {
        console.log(
          "FOLDER_FOLDER uploading: " +
            Math.ceil((loading / (FOLDER_FOLDER.size / 10)) * 10) +
            "%"
        );
      }
    }
    console.log("INSIDE_FOFO relation uploaded");

}
export {upload_FOFO_relation};