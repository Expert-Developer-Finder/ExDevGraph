const get_folder_commit_author_recency = async (expertsAndScores, path, session, githubRepoCreatedAt) => {

    var startDateStr =  Date.parse(githubRepoCreatedAt)
    var todayDateStr =  Date.now()

    var startDate = parseInt(startDateStr);
    var todayDate = parseInt(todayDateStr);
    
    var res = await session.readTransaction(txc =>
        txc.run(
       `
        WITH $path as folderPath
        MATCH (fo:Folder {path: folderPath})<-[ifofo:INSIDE_FOFO*0..]-(foChild:Folder)
        <-[ifofi:INSIDE_FOFI]-(f:File)<-[af:ADDED_FILE]-(c:Commit)-[cb:COMMITTED_BY]->(a:Author)
        WITH f, c, a, (1- ( $startDate- c.millis) / ($startDate - $todayDate )) AS recency
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

export {get_folder_commit_author_recency}