const upload_folders = async (folders, session)=> {
    var loading = 0;
    for (const folder of folders) {
        let folderPath = folder.path;
        const res = await session.executeWrite((tx) =>
          tx.run(
            `
              CREATE (c:Folder {
                path: $folderPath
              })
              RETURN c
            `,
            { folderPath }
          )
        );
        loading++;
        if (loading % Math.ceil(folders.size / 10) == 0) {
          console.log(
            "Folders uploading: " +
              Math.ceil((loading / (folders.size / 10)) * 10) +
              "%"
          );
        }
      }
      console.log("Folders uploaded");

}

export {upload_folders}