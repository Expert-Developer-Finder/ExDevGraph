const get_folder_pr_author_recency = async (expertsAndScores, path, session, githubRepoCreatedAt) => {
    var startDateStr =  Date.parse(githubRepoCreatedAt)
    var todayDateStr =  Date.now()

    var startDate = parseInt(startDateStr);
    var todayDate = parseInt(todayDateStr);

    var res = await session.readTransaction(txc =>
        txc.run(

       ` WITH $path as filePath
        MATCH(fo:Folder {path: filePath})<-[ifofo:INSIDE_FOFO*0..]-(foChild:Folder)<-[ifofi:INSIDE_FOFI]-(f:File)<-[af:ADDED_FILE]-(c:Commit) -[spb:CONTAINED_IN_PR]->(p:Pull)    WITH DISTINCT p.prNumber as prNum
        MATCH (a:Author)<-[spb:SUBMITTED_PR_BY]-(p:Pull{prNumber: prNum})
        WITH a,spb,p ,(1- ($todayDate - p.prDate) / ($todayDate - $startDate )) AS recency
        RETURN a.authorLogin as AuthorLogin, count(spb) as authorPullCount, sum(recency) as authorPullRecencyScore
`,
        { path , startDate, todayDate}
        )
    );

    res.records.forEach((r)=> {
        var name =  r._fields[0];
        var pullCount = r._fields[1].low;
        var pullRecencyScore = r._fields[2];

        // console.log('====================================');
        // console.log(`${name } has pull count ${pullCount} and pr recency ${pullRecencyScore}`);           

        const alreadyExists = expertsAndScores.some(item => item.authorName === name);

        if ( alreadyExists) {

            // console.log(`${name } already existed in the expertsAndScores`);           
            const targetIndex = expertsAndScores.findIndex(item => item.authorName === name);
            expertsAndScores[targetIndex].prCount = pullCount;
            expertsAndScores[targetIndex].prRecencyScore = pullRecencyScore;
        } else {
            expertsAndScores.push({
                "authorName": r._fields[0],
                "email": r._fields[3],
                "commitCount": 0,
                "commitRecencyScore":0,
                "prCount": pullCount,
                "prRecencyScore" : pullRecencyScore,
                "reviewCount": 0,
                "reviewRecencyScore": 0,
                
            })
        }
       
       
    });

}

export {get_folder_pr_author_recency}