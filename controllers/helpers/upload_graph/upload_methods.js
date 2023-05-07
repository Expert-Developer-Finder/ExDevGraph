const upload_methods = async (METHODS, commits, session) => {
  var loading = 0;
  for (const method of METHODS) {
    var key = method[0];
    var filePath = method[1];
    var className = method[2];
    var functionName = method[3];
    var startLineFun = method[4];
    var endLineFun = method[5];

    const res = await session.executeWrite((tx) =>
      tx.run(
        `
            CREATE (m:Method {
              key: $key,
              filePath: $filePath,
              className: $className,
              functionName: $functionName,
              startLineFun: $startLineFun,
              endLineFun: $endLineFun

            })
            RETURN m
          `,
        { key, filePath, className, functionName, startLineFun, endLineFun }
      )
    );
    loading++;
    if (loading % Math.ceil(commits.size / 10) == 0) {
      console.log(
        "Methods uploading: " +
          Math.ceil((loading / (commits.size / 10)) * 10) +
          "%"
      );
    }
  }

  console.log("METHODS are uploaded");
};

export { upload_methods };
