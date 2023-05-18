const upload_methods = async (METHODS, session) => {
  var loading = 0;
  for (const method of METHODS) {
    var path = method;

    const res = await session.executeWrite((tx) =>
      tx.run(
        `
            CREATE (m:Method {key: $path})
            RETURN m
          `,
        { path }
      )
    );
    loading++;
    if (loading % Math.ceil(METHODS.size / 10) == 0) {
      console.log(
        "Methods uploading: " +
          Math.ceil((loading / (METHODS.size / 10)) * 10) +
          "%"
      );
    }
  }

  console.log("METHODS are uploaded");
};

export { upload_methods };
