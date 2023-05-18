const upload_files = async (files, session) => {
    var loading = 0;
    for (const file of files) {
        let filePath = file.path;
        const res = await session.executeWrite((tx) =>
          tx.run(
            `
              CREATE (c:File {
                path: $filePath
              })
              RETURN c
            `,
            { filePath }
          )
        );
        loading++;
        if (loading % Math.ceil(files.size / 10) == 0) {
          console.log(
            "Files uploading: " +
              Math.ceil((loading / (files.size / 10)) * 10) +
              "%"
          );
        }
      }
      console.log("Files uploaded");
    
};

export { upload_files };
