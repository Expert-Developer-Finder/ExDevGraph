const upload_ROOT_FOFI_relation = async (
  fullName,
  rootFiles,
  rootFolders,
  session
) => {
  var loading = 0;

  for (const file of rootFiles) {
    let filePath = file.path;
    const res = await session.executeWrite((tx) =>
      tx.run(
        `
            MATCH (n:ProjectRoot{path: $fullName})
            MATCH (m:File {path: $filePath})
            MERGE (n)-[:ROOT_FILE]->(m)
          `,
        { filePath, fullName }
      )
    );
    loading++;
    if (loading % Math.ceil(rootFiles.size / 10) == 0) {
      console.log(
        "ROOT_FILE uploading: " +
          Math.ceil((loading / (rootFiles.size / 10)) * 10) +
          "%"
      );
    }
  }


  loading = 0;
  for (const folder of rootFolders) {
    let folderPath = folder.path;
    const res = await session.executeWrite((tx) =>
      tx.run(
        `
            MATCH (n:ProjectRoot{path: $fullName})
            MATCH (m:Folder {path: $folderPath})
            MERGE (n)-[:ROOT_FOLDER]->(m)
          `,
        { folderPath, fullName }
      )
    );
    loading++;
    if (loading % Math.ceil(rootFolders.size / 10) == 0) {
      console.log(
        "ROOT_FOLDER uploading: " +
          Math.ceil((loading / (rootFolders.size / 10)) * 10) +
          "%"
      );
    }
  }
  console.log("INSIDE_FOFI relation uploaded");
};

export { upload_ROOT_FOFI_relation };
