const upload_project = async (repo_full_name, session) => {
    
    const res = await session.executeWrite((tx) =>
      tx.run(
        `
          CREATE (c:ProjectRoot {
            path: $repo_full_name
          })
          RETURN c
        `,
        { repo_full_name }
      )
    );
      
      console.log("Project Node uploaded");
    
};

export { upload_project };
