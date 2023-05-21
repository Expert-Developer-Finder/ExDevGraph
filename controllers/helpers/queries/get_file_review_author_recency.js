const get_file_review_author_recency = async (expertsAndScores, path, session, githubRepoCreatedAt) => {
    var startDate =  Date.parse(githubRepoCreatedAt)
    var todayDate =  Date.now()

    var res = await session.readTransaction(txc =>
        txc.run(

       `
        WITH $path as filePath, $startDate as startDate, $todayDate as todayDate
        MATCH(p:Pull)<-[cip:CONTAINED_IN_PR]-(c:Commit)-[af:ADDED_FILE]->(f:File{path:filePath}) 
        WITH DISTINCT p.prNumber as prNum
        MATCH (a:Author)<-[spb:REVIEWED_BY]-(p:Pull{prNumber: prNum})
        WITH a,spb,p ,(1- (1684414039065 - p.prDate) / (1684414039065 -1679878066000 )) AS recency
        RETURN a.authorLogin as AuthorLogin, count(spb) as authorPullCount, sum(recency) as authorPullRecencyScore`,
        { path , startDate, todayDate}
        )
    );

    res.records.forEach((r)=> {
        var name =  r._fields[0];
        var reviewCount = r._fields[1].low;
        var reviewRecencyScore = r._fields[2];

        //  console.log('====================================');
        //  console.log(`${name } has review count ${reviewCount} and review recency ${reviewRecencyScore}`);           

        const alreadyExists = expertsAndScores.some(item => item.authorName === name);

        if ( alreadyExists) {

             console.log(`${name } already existed in the expertsAndScores`);           
            const targetIndex = expertsAndScores.findIndex(item => item.authorName === name);
            expertsAndScores[targetIndex].reviewCount = reviewCount;
            expertsAndScores[targetIndex].reviewRecencyScore = reviewRecencyScore;
        } else {
            expertsAndScores.push({
                "authorName": r._fields[0],
                "commitCount": 0,
                "commitRecencyScore":0,
                "prCount": 0,
                "prRecencyScore" : 0,
                "reviewCount": reviewCount,
                "reviewRecencyScore": reviewRecencyScore,
                
            })
        }
       
       
    });

}

export {get_file_review_author_recency}