const get_file_commit_author = async (expertsAndScores, path, session) => {

    var res = await session.readTransaction(txc =>
        txc.run(
       `
        WITH $path as filePath 
        MATCH(f:File{path: filePath})<-[af:ADDED_FILE]-(n:Commit)-[cb:COMMITTED_BY]->(a:Author)
        RETURN  a.authorLogin as AuthorName,count(cb) as CommitCount`,
        { path }
        )
    );

    res.records.forEach((r)=> {
        var commitCount =  r._fields[1].low;
        var recentCommitScore = typeof( r._fields[2]) == "object"  ? r._fields[2].low: r._fields[2] ;
        expertsAndScores.push({
            "authorName": r._fields[0],
            "commitCount":commitCount,
            "commitRecencyScore": recentCommitScore,
            "prCount": 0,
            "prRecencyScore" : 0,
            "reviewCount": 0,
            "reviewRecencyScore": 0,
        })
    });

}

export {get_file_commit_author}