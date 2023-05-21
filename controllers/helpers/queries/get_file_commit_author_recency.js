const get_file_commit_author_recency = async (expertsAndScores, path, session, githubRepoCreatedAt) => {

    var startDate =  Date.parse(githubRepoCreatedAt)
    var todayDate =  Date.now()
    var res = await session.readTransaction(txc =>
        txc.run(
       `
        WITH $path as filePath, $startDate as startDate, $todayDate as todayDate
        MATCH(f:File{path: filePath})<-[af:ADDED_FILE]-(c:Commit)-[cb:COMMITTED_BY]->(a:Author)
        WITH f, c, a, (1- ( startDate- c.millis) / (startDate - todayDate )) AS recency
        RETURN a.authorLogin AS AuthorName,  count(recency) as commitCount, sum(recency) AS recencyScore, a.email as email`,
        { path , startDate, todayDate}
        )
    );

    res.records.forEach((r)=> {

        expertsAndScores.push({
            "authorName": r._fields[0],
            "email": r._fields[3],
            "commitCount": r._fields[1].low,
            "commitRecencyScore":  r._fields[2],
            "prCount": 0,
            "prRecencyScore" : 0,
            "reviewCount": 0,
            "reviewRecencyScore": 0,
        })
    });

}

export {get_file_commit_author_recency}